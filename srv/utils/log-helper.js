import {
  normalizeCpiError,
  normaliseLog,
  convertDate,
  processInBatches,
  extractAdapter,
  ApiCall,
  ApiCallLogs,
  upsertMonitoredArtifacts
} from './log-utils.js';
import { updateDailyMetrics } from './daily-metrics.js';
import { upsertClusters } from './clustering-util.js';

export async function runPoll({
  srv,
  Incidents,
  IncidentClusters,
  Playbooks,
  MonitoredArtifacts,
  ClusterArtifacts,
  tenant
}) {
  console.log('========== runPoll START ==========');

  try {
    console.log('Fetching latest artifact timestamp...');
    const latestArtifact = await SELECT.one
      .from(MonitoredArtifacts)
      .where({ tenant_ID: tenant.ID })
      .orderBy({ lastPollTimestamp: 'desc' });

    const dateFiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const rawTimestamp = latestArtifact
      ? new Date(latestArtifact.lastPollTimestamp)
      : dateFiveMinAgo;

    console.log('Raw Timestamp:', rawTimestamp);

    const lastPollTimestamp = rawTimestamp.toISOString().split('.')[0];
    console.log('Formatted Timestamp:', lastPollTimestamp);

    const filter = `Status eq 'FAILED' and LogEnd gt datetime'${lastPollTimestamp}'`;
    const path = `/api/v1/MessageProcessingLogs?$filter=${encodeURIComponent(filter)}&$orderby=LogEnd desc`;
    console.log('CPI API Path:', path);

    const response = await ApiCallLogs(tenant, path);
    if (!response) {
      console.error('CPI Response is NULL');
      throw new Error('CPI API returned NULL response');
    }

    const results = response?.d?.results || [];
    console.log('Fetched Results Count:', results.length);

    if (!results.length) {
      console.log('No failed logs found');
      return [];
    }

    console.log('Starting enrichment process...');
    const enriched = await processInBatches(results, async (log) => {
      const guid = log.MessageGuid;

      try {
        const errorPath = `/api/v1/MessageProcessingLogs('${guid}')/ErrorInformation/$value`;
        const errorMessage = await ApiCall(tenant, errorPath);

        const adapterPath = `/api/v1/MessageProcessingLogs('${guid}')/AdapterAttributes`;
        const adapterRes = await ApiCall(tenant, adapterPath);
        const adapterType = extractAdapter(adapterRes);

        const safeErrorMessage = typeof errorMessage === 'string'
          ? errorMessage
          : JSON.stringify(errorMessage);

        const normalized = normalizeCpiError(safeErrorMessage.trim());
        const analysed = normaliseLog({ errorMessage: normalized });

        return {
          tenant_ID: tenant.ID,
          messageGuid: guid,
          iFlowName: log.IntegrationFlowName,
          status: 'OPEN',
          logStart: convertDate(log.LogStart),
          logEnd: convertDate(log.LogEnd),
          adapter: adapterType,
          errorMessage: safeErrorMessage,
          errorSignature: analysed.errorMessage,
          PackageName: log.IntegrationArtifact?.PackageName
        };
      } catch (err) {
        console.error('Enrichment Failed');
        console.error('GUID:', guid);
        console.error(err);
        return {
          tenant_ID: tenant.ID,
          messageGuid: guid,
          iFlowName: log.IntegrationFlowName,
          status: 'OPEN',
          errorSignature: 'INTERNAL_PROCESSING_ERROR',
          logEnd: convertDate(log.LogEnd)
        };
      }
    });

    console.log('Enriched Records Count:', enriched.length);
    const existing = await SELECT.from(Incidents).columns('messageGuid');
    const existingSet = new Set(existing.map(e => e.messageGuid));
    const newLogs = enriched.filter(l => !existingSet.has(l.messageGuid));
    console.log('New Logs Count:', newLogs.length);

    if (newLogs.length) {
      console.log('Inserting incidents...');
      await INSERT.into(Incidents).entries(newLogs);
      console.log(`✅ Inserted ${newLogs.length} incidents`);
    }

    await updateDailyMetrics(tenant.ID, { newIncidents: newLogs.length });

    console.log('Updating MonitoredArtifacts...');
    await upsertMonitoredArtifacts(MonitoredArtifacts, newLogs, tenant);

    console.log('Starting clustering...');
    await upsertClusters(
      Incidents,
      IncidentClusters,
      Playbooks,
      MonitoredArtifacts,
      ClusterArtifacts,
      newLogs,
      srv,
      tenant
    );

    console.log('========== runPoll SUCCESS ==========');
    return enriched;
  } catch (err) {
    console.error('❌ runPoll FAILED');
    console.error(err);
    throw err;
  }
}