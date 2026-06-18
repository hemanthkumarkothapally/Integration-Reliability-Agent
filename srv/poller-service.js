import cds from '@sap/cds';
import { runPoll } from './utils/log-helper.js';
import {
  generateClusterRecommendation
} from './utils/ai-recommendation-util.js';
import { updateDailyMetrics ,updateDailyAIMetrics} from './utils/daily-metrics.js';
import { cleanupData } from './utils/Cleanup-util.js';
export default cds.service.impl(async function () {

  const srv = this;
  console.log("========== POLLER SERVICE STARTED ==========");
  let IS_API;
  let db;

  try {
    db = await cds.connect.to('db');
    console.log("Connected to DB");
  } catch (err) {
    console.error("Failed to connect DB");
    console.error(err);
    return {
      error: err.message
    };
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
  try {
    const tenants =
      await SELECT.from(Tenants)
        .where({ isActive: true });

    console.log(
      `Found ${tenants.length} active tenants`
    );
  } catch (err) {
    console.error("Failed to connect IS_RUNTIME_API");
    console.error(err);
    console.error(err.stack);
  }
  this.on('getFailedLogs', async (req) => {

    // 1. Instantly respond to BTP Job Scheduler to prevent the 15-second timeout
    if (req._ && req._.res) {
      req._.res.status(202).send('Job accepted and running in background');
    } else {
      req.reply('Job accepted');
    }

    // 2. Use CAP's native background worker (cds.spawn)
    // This safely detaches the process while keeping your database connection alive
    cds.spawn({ tenant: req.tenant, user: req.user }, async (tx) => {
      console.log("========== getFailedLogs BACKGROUND START ==========");

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

            console.error(
              `Polling failed for tenant ${tenant.tenantName}`,
              err
            );
            await updateDailyMetrics(tenant.ID, {
                        pollFailures: 1,
                        lastPollAt: new Date(),
                        lastPollStatus: 'FAILED'
                    });
            // Continue with next tenant
          }
        }

        console.log(`Total Failed Logs Processed: ${allResults.length}`);
        console.log("========== getFailedLogs BACKGROUND SUCCESS ==========");
        return { status: 'success', processedLogs: allResults.length };

      } catch (err) {

        console.error("========== getFailedLogs BACKGROUND FAILED ==========");
        console.error(err);
        return { status: 'error', message: err.message || 'An error occurred during manual polling.' };
      }
    });

  });
  this.after(['CREATE', 'UPDATE'], IncidentClusters, async (data) => {
    console.log("CREATE Event Triggered for IncidentClusters");
    const record = data;
    const cluster_ID = record.ID;
    try {

      /* EXISTING RECOMMENDATION */

      let recommendation =
        await SELECT.one
          .from(ClusterRecommendations)
          .where({
            cluster_ID
          });

      /* RETURN EXISTING */

      if (recommendation) {
        console.log(
          "Returning cached recommendation"
        );
        return recommendation;
      }

      /* FETCH CLUSTER */

      const cluster =
        await SELECT.one
          .from(IncidentClusters)
          .where({
            ID: cluster_ID
          });

      if (!cluster) {
        return req.error(
          404,
          'Cluster not found'
        );
      }

      /*
       * FETCH SAMPLE INCIDENTS
       */
         const incidentSetting = await SELECT.one
                    .from(ApplicationSettings)
                    .columns('settingValue')
                    .where({
                        settingKey: 'MAX_INCIDENTS_FOR_AI'
                    });

                const incidentLimit =
                    Number(incidentSetting?.settingValue || 5);

                console.log(
                    "Incident count limit:",
                    incidentLimit
                );
      const incidents =
        await SELECT
          .from(Incidents)
          .where({
            cluster_ID
          })
          .orderBy({
            logEnd: 'desc'
          })
          .limit(incidentLimit);

      /*
       * GENERATE AI RECOMMENDATION
       */

      const aiResult =
        await generateClusterRecommendation({

          cluster,

          incidents
        });

      console.log(
        "AI Recommendation:",
        aiResult
      );

      /*
       * STORE RECOMMENDATION
       */

      await INSERT.into(
        ClusterRecommendations
      ).entries({

        cluster_ID,

        rootCause:
          aiResult.recommendation.rootCause,

        businessImpact:
          aiResult.recommendation.businessImpact,

        remediationSteps:
          JSON.stringify(
            aiResult.recommendation.remediationSteps
          ),

        affectedAdapter:
          aiResult.recommendation.affectedAdapter,

        confidenceScore:
          aiResult.recommendation.confidenceScore,

        generatedAt:
          new Date()
      });

      await INSERT.into(
        TokenUsages
      ).entries({

        cluster_ID,

        ...aiResult.audit
      });

      if (aiResult.playbook_ID) {
        await UPDATE(IncidentClusters)
          .set({
            playbook_ID:
              aiResult.playbook_ID
          })
          .where({
            ID: cluster_ID
          });
      }
      if (aiResult.errorType) {
        await UPDATE(IncidentClusters)
          .set({
            errorType:
              aiResult.errorType
          })
          .where({
            ID: cluster_ID
          });
      }
      /*
       * RETURN SAVED RECORD
       */

      await updateDailyAIMetrics(
        {
          recommendationsGenerated: 1,
          aiRequests: 1,
          totalInputTokens: aiResult.audit.inputTokens,
          totalOutputTokens: aiResult.audit.outputTokens,
          totalTokens: aiResult.audit.inputTokens + aiResult.audit.outputTokens
        }
      );

      return await SELECT.one
        .from(ClusterRecommendations)
        .where({
          cluster_ID
        });

    } catch (error) {

      console.error(
        'AI recommendation generation failed:',
        error
      );

      req.error(
        500,
        'Recommendation generation failed'
      );
    }
  });
  this.on('getClusterRecommendation', async (req) => {
    try {

      const { cluster_ID } = req.data;

      /*
  
       * EXISTING RECOMMENDATION
  
       */

      let recommendation =
        await SELECT.one
          .from(ClusterRecommendations)
          .where({
            cluster_ID
          });

      /*
       * RETURN EXISTING
       */

      if (recommendation) {

        console.log(
          "Returning cached recommendation"
        );

        return recommendation;
      }

      /*
  
       * FETCH CLUSTER
  
       */

      const cluster =
        await SELECT.one
          .from(IncidentClusters)
          .where({
            ID: cluster_ID
          });

      if (!cluster) {

        return req.error(
          404,
          'Cluster not found'
        );
      }

      /*
  
       * FETCH SAMPLE INCIDENTS
  
       */

      const incidents =
        await SELECT
          .from(Incidents)
          .where({
            cluster_ID
          })
          .orderBy({
            logEnd: 'desc'
          })
          .limit(10);

      /*
  
       * GENERATE AI RECOMMENDATION
  
       */

      const aiResult =
        await generateClusterRecommendation({

          cluster,

          incidents
        });

      console.log(
        "AI Recommendation:",
        aiResult
      );

      /*
  
       * STORE RECOMMENDATION
  
       */

      await INSERT.into(
        ClusterRecommendations
      ).entries({

        cluster_ID,

        rootCause:
          aiResult.recommendation.rootCause,

        businessImpact:
          aiResult.recommendation.businessImpact,

        remediationSteps:
          JSON.stringify(
            aiResult.recommendation.remediationSteps
          ),

        affectedAdapter:
          aiResult.recommendation.affectedAdapter,

        confidenceScore:
          aiResult.recommendation.confidenceScore,

        generatedAt:
          new Date()
      });

      await INSERT.into(
        TokenUsages
      ).entries({

        cluster_ID,

        ...aiResult.audit
      });

      /*
  
       * RETURN SAVED RECORD
  
       */

      return await SELECT.one
        .from(ClusterRecommendations)
        .where({
          cluster_ID
        });

    } catch (error) {

      console.error(
        'AI recommendation generation failed:',
        error
      );

      req.error(
        500,
        'Recommendation generation failed'
      );
    }
  });
  this.on('cleanupRetentionData', async (req) => {
    try {
      const result = await cleanupData(Incidents, IncidentClusters, MonitoredArtifacts, ApplicationSettings);
      return { message: result };
    } catch (error) {
      console.error('Data cleanup failed:', error);
      req.error(500, 'Data cleanup failed');
    }
  });

});