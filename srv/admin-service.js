import cds from '@sap/cds';
import { getDestination } from '@sap-cloud-sdk/connectivity';
import { executeHttpRequest } from '@sap-cloud-sdk/http-client';
import { runPoll } from './utils/log-helper.js';
import JobSchedulerClient from '@sap/jobs-client';
import xsenv from '@sap/xsenv';
import { updateDailyMetrics } from './utils/daily-metrics.js';

export default cds.service.impl(async function () {
  const srv = this;
  const db = await cds.connect.to('db');

  const {
    Tenants,
    Incidents,
    Playbooks,
    MonitoredArtifacts,
    ClusterArtifacts,
    DailyMetrics,
    DailyAIMetrics,
    ApplicationSettings,
    IncidentClusters
  } = db.entities('com.cytechies.integration.reliability');

  const POLLING_MODE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const POLLING_INTERVAL_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  // DB returns rows already sorted by totalTokens desc.
  async function getTopTokenConsumers() {
    return await SELECT('createdBy as name', 'sum(tokenCount) as totalTokens')
      .from('com.cytechies.integration.reliability.Messages')
      .where({ tokenCount: { '>': 0 } })
      .groupBy('createdBy')
      .orderBy('totalTokens desc');
  }

  this.on('getUsageAnalytics', async (req) => {
    const { fromDate, toDate } = req.data;

    const metrics = await SELECT
      .from(DailyMetrics)
      .where({ metricDate: { between: fromDate, and: toDate } })
      .orderBy('metricDate');

    const aiMetrics = await SELECT
      .from(DailyAIMetrics)
      .where({ metricDate: { between: fromDate, and: toDate } })
      .orderBy('metricDate');

    const summary = {
      TokenConsumption: aiMetrics.reduce((s, r) => s + (r.totalTokens || 0), 0),
      hanaStorage: Number(metrics[metrics.length - 1]?.hanaStorage || 0),
      totalIncidents: metrics.reduce((s, r) => s + (r.newIncidents || 0), 0),
      totalClusters: metrics.reduce((s, r) => s + (r.newClusters || 0), 0)
    };

    const totalChatSessions = aiMetrics.reduce((s, r) => s + (r.totalChatSessions || 0), 0);
    const days = Math.max(metrics.length, 1);

    const start = new Date(fromDate);
    const end = new Date(toDate);

    // ----- Token usage per day -----
    const tokenMap = aiMetrics.reduce((acc, metric) => {
      acc[metric.metricDate] = {
        input: metric.totalInputTokens || 0,
        output: metric.totalOutputTokens || 0
      };
      return acc;
    }, {});

    const tokenUsage = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      tokenUsage.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        input: tokenMap[dateKey]?.input || 0,
        output: tokenMap[dateKey]?.output || 0
      });
    }

    const topConsumers = await getTopTokenConsumers();

    // ----- HANA storage per day -----
    const hanaMap = metrics.reduce((acc, metric) => {
      if (!(metric.metricDate in acc)) {
        acc[metric.metricDate] = Number(metric.hanaStorage || 0);
      }
      return acc;
    }, {});

    const hanaUsage = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split('T')[0];
      hanaUsage.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        storage: hanaMap[dateKey] || 0
      });
    }

    const growths = [];
    for (let i = 1; i < hanaUsage.length; i++) {
      const diff = hanaUsage[i].storage - hanaUsage[i - 1].storage;
      if (diff > 0) growths.push(diff);
    }

    const averageHANAGrowthPerDay = growths.length
      ? Number((growths.reduce((a, b) => a + b, 0) / growths.length).toFixed(4))
      : 0;
    const averagePollsPerDay = metrics.reduce(
      (s, r) =>
        s +
        (r.pollFailures + r.pollRuns || 0),
      0
    ) / days;
    const supportingMetrics = {
      AverageTokensPerChatSession: totalChatSessions > 0
        ? Math.round(summary.TokenConsumption / totalChatSessions)
        : 0,
      AverageTokensPerCluster: summary.totalClusters > 0
        ? Math.round(summary.TokenConsumption / summary.totalClusters)
        : 0,
      AverageHANAGrowthPerDay: averageHANAGrowthPerDay,
      AverageTokensPerDay: Math.round(summary.TokenConsumption / days),
      AverageIncidentsPerDay: Math.round(summary.totalIncidents / days),
      AveragePollsPerDay: Math.round(averagePollsPerDay),
      totalChatSessions,
      totalUserMessages: aiMetrics.reduce((s, r) => s + (r.totalUserMessages || 0), 0),
      totalAIMessages: aiMetrics.reduce((s, r) => s + (r.totalAIMessages || 0), 0),
      aiRecommendations: aiMetrics.reduce((s, r) => s + (r.recommendationsGenerated || 0), 0)
    };

    return { summary, supportingMetrics, tokenUsage, hanaUsage, topConsumers };
  });

  this.on('triggerManualPoll', async () => {
    try {
      const tenants = await SELECT.from(Tenants).where({ isActive: true });
      console.log(`Active Tenants Found: ${tenants.length}`);
      const allResults = [];

      for (const tenant of tenants) {
        try {
          const tenantResults = await runPoll({
            srv,
            Incidents,
            IncidentClusters,
            Playbooks,
            MonitoredArtifacts,
            ClusterArtifacts,
            tenant
          });

          allResults.push(...tenantResults);

          await updateDailyMetrics(tenant.ID, {
            pollRuns: 1,
            lastPollAt: new Date(),
            lastPollStatus: 'SUCCESS'
          });
        } catch (err) {
          console.error(`Polling failed for tenant ${tenant.tenantName}`, err);
          await updateDailyMetrics(tenant.ID, {
            pollFailures: 1,
            lastPollAt: new Date(),
            lastPollStatus: 'FAILED'
          });
          // Continue with the next tenant.
        }
      }

      console.log(`Manual poll complete. Total failed logs processed: ${allResults.length}`);
      return { status: 'success', processedLogs: allResults.length };
    } catch (err) {
      console.error('Manual poll failed', err);
      return { status: 'error', message: err.message || 'An error occurred during manual polling.' };
    }
  });

  this.on('getDestinations', async () => {
    const destinationService = await getDestination({ destinationName: 'Destination_Service' });
    const destinations = await executeHttpRequest(destinationService, {
      method: 'GET',
      url: '/destination-configuration/v1/subaccountDestinations'
    });
    return destinations.data.map(d => ({
      Name: d.Name,
      Type: d.Type,
      URL: d.URL,
      Description: d.Description || ''
    }));
  });

  this.before('UPDATE', 'ApplicationSettings', async (req) => {
    const { ID, settingValue } = req.data;

    const schedulerSettings = [POLLING_MODE_ID, POLLING_INTERVAL_ID];
    if (!schedulerSettings.includes(ID)) return;

    // Read current scheduler settings.
    const settings = await SELECT
      .from(ApplicationSettings)
      .columns('ID', 'settingValue')
      .where({ ID: { in: schedulerSettings } });

    let pollingMode = settings.find(s => s.ID === POLLING_MODE_ID)?.settingValue;
    let pollingInterval = settings.find(s => s.ID === POLLING_INTERVAL_ID)?.settingValue;

    // Apply the incoming change before recalculating the schedule.
    if (ID === POLLING_MODE_ID) pollingMode = settingValue;
    if (ID === POLLING_INTERVAL_ID) pollingInterval = settingValue;

    const active = pollingMode === 'AUTOMATIC';
    const minutes = parseInt(pollingInterval, 10);

    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 180) {
      return req.error(400, `Invalid polling interval: ${pollingInterval}`);
    }

    try {
      const { jobscheduler } = xsenv.getServices({ jobscheduler: { label: 'jobscheduler' } });
      console.log(`Connecting to Job Scheduler at ${jobscheduler.url}...`);

      const scheduler = new JobSchedulerClient.Scheduler(jobscheduler);
      const JOB_ID = process.env.JOB_ID;
      const SCHEDULE_ID = process.env.JOB_SCHEDULE_ID;

      const schedule = {
        repeatInterval: `${minutes} minutes`,
        active,
        description: `Recurring Schedule (Repeat Interval) - ${minutes} mins`
      };

      await new Promise((resolve, reject) =>
        scheduler.updateJobSchedule(
          { jobId: JOB_ID, scheduleId: SCHEDULE_ID, schedule },
          (err, res) => (err ? reject(err) : resolve(res))
        )
      );

      console.log(`Polling schedule updated successfully to every ${minutes} minutes.`);
      req.info(`Polling schedule updated to every ${minutes} minutes`);
    } catch (e) {
      // Scheduler update failed -> fail the request so the DB and scheduler don't drift apart.
      req.error(502, `Failed to update polling schedule: ${e.message}`);
    }
  });

  this.on('testHanaStorage', async () => {
    const pollerSrv = cds.services.PollerService;
    const incidents = await SELECT.from(Incidents)
      .orderBy({ logEnd: 'desc' })
      .limit(3);
     const incidentSummary = incidents.map((i, index) => ({
        errorMessage: i.errorMessage
    }));
    return  {incidentSummary} ;
  });
});