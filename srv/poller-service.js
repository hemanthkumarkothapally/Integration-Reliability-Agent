import cds from '@sap/cds';
import {
  normalizeMessage,
  extractSignature,
  convertDate,
  processInBatches,
  extractError,
  extractAdapter,
  safeApiCall,
  upsertMonitoredArtifacts
} from './utils/log-utils.js';

export default cds.service.impl(async function () {

  const IS_API = await cds.connect.to('IS_RUNTIME_API');
  const db = await cds.connect.to('db');

  const {
    Incidents,
    IncidentClusters,
    MonitoredArtifacts
  } = db.entities;
  this.on('getFailedLogs', async () => {
    try {
      let enrichedResults = await runPoll();
      return enrichedResults;
    }
    catch (err) {
      throw err;
    }
  });

  /* Core Poll Logic
   */
  async function runPoll() {
    try {
      // 🔹 Get last poll timestamp (GLOBAL fallback)
      const latestArtifact = await SELECT.one
        .from(MonitoredArtifacts)
        .orderBy({ lastPollTimestamp: 'desc' });

      const fallback = new Date(Date.now() - 5 * 60 * 1000);

      const rawTimestamp =
        latestArtifact?.lastPollTimestamp ||
        fallback;

      // ✅ CPI-compatible format
      const lastPollTimestamp = new Date(rawTimestamp)
        .toISOString()
        .split('.')[0];
      console.log(lastPollTimestamp);

      const filter = `Status eq 'FAILED' and LogEnd gt datetime'${lastPollTimestamp}'`;

      const path = `/api/v1/MessageProcessingLogs?$filter=${encodeURIComponent(filter)}`;

      const response = await safeApiCall(IS_API, {
        method: 'GET',
        path
      });

      const results = response?.d?.results || [];

      if (!results.length) {
        console.log('No new logs');
        return;
      }

      console.log(`Fetched ${results.length} logs`);

      /**
       * 🔹 Enrichment (batched)
       */
      const enriched = await processInBatches(results, async (log) => {

        const guid = log.MessageGuid;

        try {
          // 🔹 Error metadata
          const errorMessage = await safeApiCall(IS_API, {
            method: 'GET',
            path: `/api/v1/MessageProcessingLogs('${guid}')/ErrorInformation/$value`
          });
          errorMessage = errorMessage.trim();


          // 🔹 Adapter
          const adapterRes = await safeApiCall(IS_API, {
            method: 'GET',
            path: `/api/v1/MessageProcessingLogs('${guid}')/AdapterAttributes`
          });

          const adapterType = extractAdapter(adapterRes);

          // 🔹 Normalize + Signature
          const normalized = normalizeMessage(errorMessage);
          // const signature = extractSignature(normalized);

          return {
            messageGuid: guid,
            iFlowName: log.IntegrationFlowName,
            status: log.Status,
            logStart: convertDate(log.LogStart),
            logEnd: convertDate(log.LogEnd),
            adapter: adapterType,
            errorMessage: normalized,
            errorSignature: normalized
          };

        } catch (err) {
          console.error('Enrichment failed:', guid);

          return {
            messageGuid: guid,
            iFlowName: log.IntegrationFlowName,
            errorSignature: 'INTERNAL_PROCESSING_ERROR',
            logEnd: convertDate(log.LogEnd)
          };
        }
      });

      /**
       * 🔹 Dedup + Insert Incidents
       */
      const existing = await SELECT.from(Incidents).columns('messageGuid');

      const existingSet = new Set(existing.map(e => e.messageGuid));

      const newLogs = enriched.filter(l => !existingSet.has(l.messageGuid));

      if (newLogs.length) {
        await INSERT.into(Incidents).entries(newLogs);
        console.log(`Inserted ${newLogs.length} incidents`);
      }
      await upsertMonitoredArtifacts(MonitoredArtifacts,newLogs)
      /* Clustering
       */
      const clusterMap = {};

      for (const log of newLogs) {
        const key = `${log.errorSignature}::${log.iFlowName}`;

        if (!clusterMap[key]) {
          clusterMap[key] = {
            errorSignature: log.errorSignature,
            iFlowName: log.iFlowName,
            incidentCount: 0,
            firstSeen: log.logEnd,
            lastSeen: log.logEnd
          };
        }

        clusterMap[key].incidentCount++;
        clusterMap[key].lastSeen = log.logEnd;
      }

      /**
       * 🔹 Upsert Clusters
       */
      for (const key in clusterMap) {

        const c = clusterMap[key];

        const existingCluster = await SELECT.one.from(IncidentClusters)
          .where({
            errorSignature: c.errorSignature,
            iFlowName: c.iFlowName
          });

        if (existingCluster) {

          const newCount = existingCluster.incidentCount + c.incidentCount;

          await UPDATE(IncidentClusters)
            .set({
              incidentCount: newCount,
              lastSeen: c.lastSeen,
              severity: calculateSeverity(newCount),
              severityCriticality: mapSeverityCriticality(newCount)
            })
            .where({ ID: existingCluster.ID });

        } else {

          await INSERT.into(IncidentClusters).entries({
            errorSignature: c.errorSignature,
            iFlowName: c.iFlowName,
            incidentCount: c.incidentCount,
            firstSeen: c.firstSeen,
            lastSeen: c.lastSeen,
            severity: calculateSeverity(c.incidentCount),
            severityCriticality: mapSeverityCriticality(c.incidentCount),
            status: 'OPEN'
          });
        }
      }
      return enriched;
    } catch (err) {
      throw err;
    }
  }

  /**
   * 🚦 Severity Logic
   */
  function calculateSeverity(count) {
    if (count > 30) return 'CRITICAL';
    if (count >= 15) return 'HIGH';
    if (count >= 5) return 'MEDIUM';
    return 'LOW';
  }

  function mapSeverityCriticality(count) {
    if (count > 30) return 1;
    if (count >= 15) return 2;
    if (count >= 5) return 3;
    return 4;
  }

});