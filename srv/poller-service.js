
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
    Tenants
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
      // Note: Use 'tx.run' or 'tx.read' inside cds.spawn to ensure proper DB connection
      const tenants = await tx.read('Tenants').where({ isActive: true });
      const allResults = [];
      
      for (const tenant of tenants) {
       // console.log(`Processing Tenant: ${tenant.tenantName}`);
        // Ensure runPoll is available in this scope
        const tenantResults = await runPoll(tenant); 
        allResults.push(...tenantResults);
      }
      
      console.log(`Total Failed Logs Processed: ${allResults.length}`);
      console.log("========== getFailedLogs BACKGROUND SUCCESS ==========");
      
    } catch (err) {
      console.error("========== getFailedLogs BACKGROUND FAILED ==========");
      console.error(err);
    }
  });

});

  async function runPoll(tenant) {
    console.log("========== runPoll START ==========");
    // await DELETE.from(Incidents);
    try {
      const IS_API =
        await cds.connect.to(
          tenant.destinationName
        );
      console.log(
        `Connected to ${tenant.destinationName}`
      );
      /* LAST POLL TIMESTAMP */
      console.log("Fetching latest artifact timestamp...");
      const latestArtifact = await SELECT.one.from(MonitoredArtifacts)
  .orderBy({ lastPollTimestamp: 'desc' });

//console.log("Latest Artifact:", latestArtifact);

// 1. Fallback to 5 minutes ago if no previous polling record exists
const dateFiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

// 2. CRITICAL FIX: Ensure rawTimestamp is evaluated as a Date instance
const rawTimestamp = latestArtifact ? new Date(latestArtifact.lastPollTimestamp) : dateFiveMinAgo;

console.log("Raw Timestamp:", rawTimestamp);

// 3. Strip out milliseconds/Z characters to satisfy SAP CPI's OData parser
const lastPollTimestamp = rawTimestamp.toISOString().split('.')[0];

console.log("Formatted Timestamp:", lastPollTimestamp);

/* CPI logs Filter */
const filter = `Status eq 'FAILED' and LogEnd gt datetime'${lastPollTimestamp}'`;

console.log("Generated Filter:", filter);


      // const path = `/api/v1/MessageProcessingLogs?$filter=${encodeURIComponent(filter)}`;
      const path = `/api/v1/MessageProcessingLogs?$filter=${encodeURIComponent(filter)}&$orderby=LogEnd desc`;
      console.log("CPI API Path:", path);
      console.log("Calling CPI MessageProcessingLogs API...");

      const response = await ApiCall(IS_API, {
        method: 'GET',
        path
      });

      // console.log("CPI Response:");
      // console.log(JSON.stringify(response, null, 2));

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

        // console.log("------------------------------------------------");
        // console.log("Processing GUID:", guid);

        try {

          /* ERROR INFORMATION */

          const errorPath = `/api/v1/MessageProcessingLogs('${guid}')/ErrorInformation/$value`;

          // console.log("Calling ErrorInformation API:", errorPath);

          const errorMessage = await ApiCall(IS_API, {
            method: 'GET',
            path: errorPath
          });

          // console.log("Error Message Response:");
          // console.log(errorMessage);

          /* ADAPTER ATTRIBUTES */

          const adapterPath = `/api/v1/MessageProcessingLogs('${guid}')/AdapterAttributes`;

          // console.log("Calling AdapterAttributes API:", adapterPath);

          const adapterRes = await ApiCall(IS_API, {
            method: 'GET',
            path: adapterPath
          });

          // console.log("Adapter Response:");
          // console.log(JSON.stringify(adapterRes, null, 2));

          const adapterType = extractAdapter(adapterRes);

          // console.log("Extracted Adapter:", adapterType);

          /* SAFE ERROR HANDLING */

          const safeErrorMessage =
            typeof errorMessage === 'string'
              ? errorMessage
              : JSON.stringify(errorMessage);

          // console.log("Safe Error Message:");
          // console.log(safeErrorMessage);

          const normalized =
            normalizeCpiError(safeErrorMessage.trim());

          // console.log("Normalized Message:");
          // console.log(normalized);
          const analysed =
            normaliseLog({
              errorMessage:
                normalized
            });

          // console.log("Analysed Result:");
          // console.log(analysed);

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
            PackageName: log.IntegrationArtifact.PackageName,
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
        IS_API,
        tenant
      );
      console.log(" MonitoredArtifacts Updated");

      /* CLUSTERING */

      console.log("Starting clustering...");
      await upsertClusters(Incidents, IncidentClusters, Playbooks, MonitoredArtifacts, ClusterArtifacts, newLogs, srv, tenant)
      console.log("========== runPoll SUCCESS ==========");
      console.log("Raw Timestamp:", rawTimestamp);
      console.log("Formatted Timestamp:", lastPollTimestamp);
      return enriched;

    } catch (err) {
      console.error("❌ runPoll FAILED");
      console.error(err);
      throw err;
    }
  }


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

      const incidents =
        await SELECT
          .from(Incidents)
          .where({
            cluster_ID
          })
          .orderBy({
            logEnd: 'desc'
          })
          .limit(2);

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
      const result = await cleanupData(Incidents, IncidentClusters, ClusterRecommendations,ApplicationSettings);
      return { message: result };
    } catch (error) {
      console.error('Data cleanup failed:', error);
      req.error(500, 'Data cleanup failed');
    }
  });

});