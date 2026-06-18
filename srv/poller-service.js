import cds from '@sap/cds';
import { runPoll } from './utils/log-helper.js';
import { generateClusterRecommendation } from './utils/ai-recommendation-util.js';
import { updateDailyMetrics, updateDailyAIMetrics } from './utils/daily-metrics.js';
import { cleanupData } from './utils/Cleanup-util.js';

export default cds.service.impl(async function () {
  const srv = this;
  console.log('========== POLLER SERVICE STARTED ==========');

  // Connect to the database. If this fails the service cannot work,
  // so fail fast instead of continuing with an undefined `db`.
  let db;
  try {
    db = await cds.connect.to('db');
    console.log('Connected to DB');
  } catch (err) {
    console.error('Failed to connect to DB', err);
    throw err;
  }

  const {
    Incidents,
    MonitoredArtifacts,
    ClusterRecommendations,
    TokenUsages,
    ClusterArtifacts,
    Playbooks,
    Tenants,
    ApplicationSettings
  } = db.entities;

  const { IncidentClusters } = srv.entities;
  async function buildRecommendation({ cluster_ID, incidentLimit, req }) {
    const existing = await SELECT.one.from(ClusterRecommendations).where({ cluster_ID });
    if (existing) {
      console.log('Returning cached recommendation');
      return { recommendation: existing, cached: true };
    }

    const cluster = await SELECT.one.from(IncidentClusters).where({ ID: cluster_ID });
    if (!cluster) {
      req.error(404, 'Cluster not found');
      return null;
    }

    const incidents = await SELECT.from(Incidents)
      .where({ cluster_ID })
      .orderBy({ logEnd: 'desc' })
      .limit(incidentLimit);

    const aiResult = await generateClusterRecommendation({ cluster, incidents });
    console.log('AI recommendation generated for cluster', cluster_ID);

    await INSERT.into(ClusterRecommendations).entries({
      cluster_ID,
      rootCause: aiResult.recommendation.rootCause,
      businessImpact: aiResult.recommendation.businessImpact,
      remediationSteps: JSON.stringify(aiResult.recommendation.remediationSteps),
      affectedAdapter: aiResult.recommendation.affectedAdapter,
      confidenceScore: aiResult.recommendation.confidenceScore,
      generatedAt: new Date()
    });

    await INSERT.into(TokenUsages).entries({ cluster_ID, ...aiResult.audit });

    const recommendation = await SELECT.one.from(ClusterRecommendations).where({ cluster_ID });
    return { recommendation, aiResult, cached: false };
  }

  srv.on('getFailedLogs', async (req) => {
    // 1. Instantly acknowledge the BTP Job Scheduler to avoid the 15s timeout.
    if (req._ && req._.res) {
      req._.res.status(202).send('Job accepted and running in background');
    } else {
      req.reply('Job accepted');
    }

    // 2. Detach the actual work with CAP's native background worker.
    cds.spawn({ tenant: req.tenant, user: req.user }, async (tx) => {
      console.log('========== getFailedLogs BACKGROUND START ==========');

      try {
        const tenants = await tx.read('Tenants').where({ isActive: true });
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

        console.log(`Total Failed Logs Processed: ${allResults.length}`);
        console.log('========== getFailedLogs BACKGROUND SUCCESS ==========');
      } catch (err) {
        console.error('========== getFailedLogs BACKGROUND FAILED ==========', err);
      }
    });
  });

  srv.after(['CREATE', 'UPDATE'], IncidentClusters, async (data, req) => {
    console.log('after CREATE/UPDATE on IncidentClusters');
    const cluster_ID = data.ID;

    try {
      const incidentSetting = await SELECT.one
        .from(ApplicationSettings)
        .columns('settingValue')
        .where({ settingKey: 'MAX_INCIDENTS_FOR_AI' });

      const incidentLimit = Number(incidentSetting?.settingValue || 5);
      console.log('Incident count limit:', incidentLimit);

      const result = await buildRecommendation({ cluster_ID, incidentLimit, req });
      if (!result) return;                       // cluster not found, 404 already set
      if (result.cached) return result.recommendation;

      const { aiResult, recommendation } = result;

      // Apply AI-derived fields to the cluster in a single update.
      const clusterUpdates = {};
      if (aiResult.playbook_ID) clusterUpdates.playbook_ID = aiResult.playbook_ID;
      if (aiResult.errorType) clusterUpdates.errorType = aiResult.errorType;
      if (Object.keys(clusterUpdates).length) {
        await UPDATE(IncidentClusters).set(clusterUpdates).where({ ID: cluster_ID });
      }

      await updateDailyAIMetrics({
        recommendationsGenerated: 1,
        aiRequests: 1,
        totalInputTokens: aiResult.audit.inputTokens,
        totalOutputTokens: aiResult.audit.outputTokens,
        totalTokens: aiResult.audit.inputTokens + aiResult.audit.outputTokens
      });

      return recommendation;
    } catch (error) {
      console.error('AI recommendation generation failed:', error);
      req.error(500, 'Recommendation generation failed');
    }
  });

  srv.on('getClusterRecommendation', async (req) => {
    try {
      const { cluster_ID } = req.data;
      const incidentSetting = await SELECT.one
        .from(ApplicationSettings)
        .columns('settingValue')
        .where({ settingKey: 'MAX_INCIDENTS_FOR_AI' });

      const incidentLimit = Number(incidentSetting?.settingValue || 5);
      const result = await buildRecommendation({ cluster_ID, incidentLimit, req });
      if (!result) return;                       // cluster not found, 404 already set
      return result.recommendation;
    } catch (error) {
      console.error('AI recommendation generation failed:', error);
      req.error(500, 'Recommendation generation failed');
    }
  });

  srv.on('cleanupRetentionData', async (req) => {
    try {
      const result = await cleanupData(Incidents, IncidentClusters, MonitoredArtifacts, ApplicationSettings);
      return { message: result };
    } catch (error) {
      console.error('Data cleanup failed:', error);
      req.error(500, 'Data cleanup failed');
    }
  });
});