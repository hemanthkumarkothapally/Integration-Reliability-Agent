
import cds from '@sap/cds';
import {
  normalizeCpiError,
  normaliseLogs,
  normaliseLog,
  convertDate,
  processInBatches,
  extractAdapter,
  ApiCall,
  upsertMonitoredArtifacts
} from './utils/log-utils.js';

import {
  upsertClusters
} from './utils/clustering-util.js';

import {
  generateClusterRecommendation
} from './utils/ai-recommendation-util.js';

export default cds.service.impl(async function () {

  const srv = this;
  console.log("========== POLLER SERVICE STARTED ==========");
  let IS_API;
  let db;
  try {
    IS_API = await cds.connect.to('IS_RUNTIME_API');
    console.log("Connected to IS_RUNTIME_API");
  } catch (err) {
    console.error("Failed to connect IS_RUNTIME_API");
    console.error(err);
    console.error(err.stack);
  }
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
    Playbooks
  } = db.entities;
  const { IncidentClusters } = srv.entities;
  this.on('getFailedLogs', async () => {
    console.log("========== getFailedLogs START ==========");
    try {
      let enrichedResults = await runPoll();
      console.log("getFailedLogs SUCCESS");
      console.log("Returned Records:", enrichedResults?.length || 0);
      return enrichedResults;
    } catch (err) {
      console.error("getFailedLogs FAILED");
      console.error(err);
      return {
        error: err.message
      };
    }
  });

  async function runPoll() {
    console.log("========== runPoll START ==========");
    try {

      /* LAST POLL TIMESTAMP */
      console.log("Fetching latest artifact timestamp...");
      const latestArtifact = await SELECT.one.from(MonitoredArtifacts)
        .orderBy({ lastPollTimestamp: 'desc' });

      console.log("Latest Artifact:", latestArtifact);

      const fallback = new Date(Date.now() - 5 * 60 * 1000);
      const rawTimestamp =
        latestArtifact?.lastPollTimestamp ||
        fallback;

      console.log("Raw Timestamp:", rawTimestamp);

      const lastPollTimestamp = new Date(rawTimestamp)
        .toISOString()
        .split('.')[0];

      console.log("Formatted Timestamp:", lastPollTimestamp);

      /* CPI logs Filter */

      const filter = `Status eq 'FAILED' and LogEnd gt datetime'${lastPollTimestamp}'`;

      console.log("Generated Filter:", filter);

      // const path = `/api/v1/MessageProcessingLogs?$filter=${encodeURIComponent(filter)}`;
      const path = `/api/v1/MessageProcessingLogs?$filter=${encodeURIComponent(filter)}&$orderby=LogEnd asc`;
      console.log("CPI API Path:", path);
      console.log("Calling CPI MessageProcessingLogs API...");

      const response = await ApiCall(IS_API, {
        method: 'GET',
        path
      });

      console.log("CPI Response:");
      console.log(JSON.stringify(response, null, 2));

      if (!response) {

        console.error("CPI Response is NULL");

        throw new Error("CPI API returned NULL response");
      }

      const results = response?.d?.results || [];

      console.log("Fetched Results Count:", results.length);

      if (!results.length) {

        console.log("No failed logs found");

        return [];
      }

      /* ENRICHMENT */

      console.log("Starting enrichment process...");

      const enriched = await processInBatches(results, async (log) => {

        const guid = log.MessageGuid;

        console.log("------------------------------------------------");
        console.log("Processing GUID:", guid);

        try {

          /* ERROR INFORMATION */

          const errorPath = `/api/v1/MessageProcessingLogs('${guid}')/ErrorInformation/$value`;

          console.log("Calling ErrorInformation API:", errorPath);

          const errorMessage = await ApiCall(IS_API, {
            method: 'GET',
            path: errorPath
          });

          console.log("Error Message Response:");
          console.log(errorMessage);

          /* ADAPTER ATTRIBUTES */

          const adapterPath = `/api/v1/MessageProcessingLogs('${guid}')/AdapterAttributes`;

          console.log("Calling AdapterAttributes API:", adapterPath);

          const adapterRes = await ApiCall(IS_API, {
            method: 'GET',
            path: adapterPath
          });

          console.log("Adapter Response:");
          console.log(JSON.stringify(adapterRes, null, 2));

          const adapterType = extractAdapter(adapterRes);

          console.log("Extracted Adapter:", adapterType);

          /* SAFE ERROR HANDLING */

          const safeErrorMessage =
            typeof errorMessage === 'string'
              ? errorMessage
              : JSON.stringify(errorMessage);

          console.log("Safe Error Message:");
          console.log(safeErrorMessage);

          const normalized =
            normalizeCpiError(safeErrorMessage.trim());

          console.log("Normalized Message:");
          console.log(normalized);
          const analysed =
            normaliseLog({
              errorMessage:
                normalized
            });

          console.log("Analysed Result:");
          console.log(analysed);

          return {
            messageGuid: guid,
            iFlowName: log.IntegrationFlowName,
            status: log.Status,
            logStart: convertDate(log.LogStart),
            logEnd: convertDate(log.LogEnd),
            adapter: adapterType,
            errorMessage: safeErrorMessage,
            errorSignature: normalized
          };

        } catch (err) {

          console.error("Enrichment Failed");
          console.error("GUID:", guid);
          console.error(err);
          return {
            messageGuid: guid,
            iFlowName: log.IntegrationFlowName,
            errorSignature: 'INTERNAL_PROCESSING_ERROR',
            logEnd: convertDate(log.LogEnd)
          };
        }
      });

      console.log("Enriched Records Count:", enriched.length);

      /* EXISTING INCIDENTS */

      console.log("Fetching existing incidents...");

      const existing =
        await SELECT.from(Incidents)
          .columns('messageGuid');

      console.log("Existing Incidents Count:", existing.length);

      const existingSet =
        new Set(existing.map(e => e.messageGuid));

      const newLogs =
        enriched.filter(l => !existingSet.has(l.messageGuid));

      console.log("New Logs Count:", newLogs.length);

      /* INSERT INCIDENTS */

      if (newLogs.length) {
        console.log("Inserting incidents...");
        await INSERT.into(Incidents).entries(newLogs);
        console.log(`✅ Inserted ${newLogs.length} incidents`);
      }

      /* UPDATE MONITORED ARTIFACTS */

      console.log("Updating MonitoredArtifacts...");
      await upsertMonitoredArtifacts(
        MonitoredArtifacts,
        newLogs,
        IS_API
      );
      console.log(" MonitoredArtifacts Updated");

      /* CLUSTERING */

      console.log("Starting clustering...");
      await upsertClusters(Incidents, IncidentClusters, Playbooks, MonitoredArtifacts, ClusterArtifacts, newLogs,srv)
      console.log("========== runPoll SUCCESS ==========");
      console.log("Raw Timestamp:", rawTimestamp);
      return enriched;

    } catch (err) {
      console.error("❌ runPoll FAILED");
      console.error(err);
      throw err;
    }
  }


  this.after('CREATE', IncidentClusters, async (data) => {
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

});