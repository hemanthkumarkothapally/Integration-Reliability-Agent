
import cds from '@sap/cds';
import {
  normalizeMessage,
  normaliseLogs,
  normaliseLog,
  convertDate,
  processInBatches,
  extractAdapter,
  ApiCall,
  upsertMonitoredArtifacts
} from './utils/log-utils.js';

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
    console.log("✅ Connected to IS_RUNTIME_API");

  } catch (err) {

    console.error("❌ Failed to connect IS_RUNTIME_API");
    console.error(err);
    console.error(err.stack);
  }

  try {

    db = await cds.connect.to('db');
    console.log("✅ Connected to DB");

  } catch (err) {

    console.error("❌ Failed to connect DB");
    console.error(err);
    console.error(err.stack);
  }

  const {
    Incidents,
    IncidentClusters,
    MonitoredArtifacts,
    ClusterRecommendations,
    TokenUsages,
    Playbooks
  } = db.entities;

  this.on('getFailedLogs', async () => {

    console.log("========== getFailedLogs START ==========");

    try {

      let enrichedResults = await runPoll();

      console.log("✅ getFailedLogs SUCCESS");
      console.log("Returned Records:", enrichedResults?.length || 0);

      return enrichedResults;

    } catch (err) {

      console.error("❌ getFailedLogs FAILED");
      console.error(err);
      console.error(err.stack);

      return {
        error: err.message,
        stack: err.stack
      };
    }
  });

  async function runPoll() {

    console.log("========== runPoll START ==========");

    try {

      /*
       * ------------------------------------------------------------
       * LAST POLL TIMESTAMP
       * ------------------------------------------------------------
       */

      console.log("Fetching latest artifact timestamp...");

      const latestArtifact = await SELECT.one
        .from(MonitoredArtifacts)
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

      /*
       * ------------------------------------------------------------
       * CPI FILTER
       * ------------------------------------------------------------
       */

      const filter =
        `Status eq 'FAILED' and LogEnd gt datetime'2026-05-14T06:06:36'`;

      console.log("Generated Filter:", filter);

      const path =
        `/api/v1/MessageProcessingLogs?$filter=${encodeURIComponent(filter)}`;

      console.log("CPI API Path:", path);

      /*
       * ------------------------------------------------------------
       * MAIN CPI CALL
       * ------------------------------------------------------------
       */

      console.log("Calling CPI MessageProcessingLogs API...");

      const response = await ApiCall(IS_API, {
        method: 'GET',
        path
      });

      console.log("CPI Response:");
      console.log(JSON.stringify(response, null, 2));

      if (!response) {

        console.error("❌ CPI Response is NULL");

        throw new Error("CPI API returned NULL response");
      }

      const results = response?.d?.results || [];

      console.log("Fetched Results Count:", results.length);

      if (!results.length) {

        console.log("⚠️ No failed logs found");

        return [];
      }

      /*
       * ------------------------------------------------------------
       * ENRICHMENT
       * ------------------------------------------------------------
       */

      console.log("Starting enrichment process...");

      const enriched = await processInBatches(results, async (log) => {

        const guid = log.MessageGuid;

        console.log("------------------------------------------------");
        console.log("Processing GUID:", guid);

        try {

          /*
           * ERROR INFORMATION
           */

          const errorPath =
            `/api/v1/MessageProcessingLogs('${guid}')/ErrorInformation/$value`;

          console.log("Calling ErrorInformation API:", errorPath);

          const errorMessage = await ApiCall(IS_API, {
            method: 'GET',
            path: errorPath
          });

          console.log("Error Message Response:");
          console.log(errorMessage);

          /*
           * ADAPTER ATTRIBUTES
           */

          const adapterPath =
            `/api/v1/MessageProcessingLogs('${guid}')/AdapterAttributes`;

          console.log("Calling AdapterAttributes API:", adapterPath);

          const adapterRes = await ApiCall(IS_API, {
            method: 'GET',
            path: adapterPath
          });

          console.log("Adapter Response:");
          console.log(JSON.stringify(adapterRes, null, 2));

          const adapterType = extractAdapter(adapterRes);

          console.log("Extracted Adapter:", adapterType);

          /*
           * SAFE ERROR HANDLING
           */

          const safeErrorMessage =
            typeof errorMessage === 'string'
              ? errorMessage
              : JSON.stringify(errorMessage);

          console.log("Safe Error Message:");
          console.log(safeErrorMessage);

          const normalized =
            normalizeMessage(safeErrorMessage.trim());

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
            errorMessage: normalized,
            errorSignature: analysed.errorSignature
          };

        } catch (err) {

          console.error("❌ Enrichment Failed");
          console.error("GUID:", guid);
          console.error(err);
          console.error(err.stack);

          return {

            messageGuid: guid,
            iFlowName: log.IntegrationFlowName,
            errorSignature: 'INTERNAL_PROCESSING_ERROR',
            logEnd: convertDate(log.LogEnd)
          };
        }
      });

      console.log("Enriched Records Count:", enriched.length);

      /*
       * ------------------------------------------------------------
       * EXISTING INCIDENTS
       * ------------------------------------------------------------
       */

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

      /*
       * ------------------------------------------------------------
       * INSERT INCIDENTS
       * ------------------------------------------------------------
       */

      if (newLogs.length) {

        console.log("Inserting incidents...");

        await INSERT.into(Incidents).entries(newLogs);

        console.log(`✅ Inserted ${newLogs.length} incidents`);
      }

      /*
       * ------------------------------------------------------------
       * UPDATE MONITORED ARTIFACTS
       * ------------------------------------------------------------
       */

      console.log("Updating MonitoredArtifacts...");

      await upsertMonitoredArtifacts(
        MonitoredArtifacts,
        newLogs
      );

      console.log("✅ MonitoredArtifacts Updated");

      /*
       * ------------------------------------------------------------
       * CLUSTERING
       * ------------------------------------------------------------
       */

      console.log("Starting clustering...");

      const clusterMap = {};

      for (const log of newLogs) {

        const key =
          `${log.errorSignature}::${log.iFlowName}`;

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

      console.log("Cluster Count:", Object.keys(clusterMap).length);

      /*
       * ------------------------------------------------------------
       * UPSERT CLUSTERS
       * ------------------------------------------------------------
       */

      for (const key in clusterMap) {

        console.log("Processing Cluster:", key);

        const c = clusterMap[key];
        const matchedPlaybook =
          await SELECT.one
            .from(Playbooks)
            .where({
              errorType:
                c.errorSignature
            });
        const existingCluster =
          await SELECT.one
            .from(IncidentClusters)
            .where({
              errorSignature: c.errorSignature,
              iFlowName: c.iFlowName
            });

       if (existingCluster) {
  console.log("Updating Existing Cluster");
  const newCount = existingCluster.incidentCount + c.incidentCount;

  await UPDATE(IncidentClusters)
    .set({
      incidentCount: newCount,
      lastSeen: c.lastSeen,
      severity: calculateSeverity(newCount),
      severityCriticality: mapSeverityCriticality(newCount)
    })
    .where({ ID: existingCluster.ID });

  // Link incidents to existing cluster
  await UPDATE(Incidents)
    .set({ cluster_ID: existingCluster.ID })
    .where({ ID: { in: newLogs
      .filter(l =>
        l.errorSignature === c.errorSignature &&
        l.iFlowName === c.iFlowName
      )
      .map(l => l.ID)
    }});

} else {
  console.log("Creating New Cluster");

  const newClusterID = cds.utils.uuid();

  await INSERT.into(IncidentClusters).entries({
    ID: newClusterID,
    errorSignature: c.errorSignature,
    iFlowName: c.iFlowName,
    incidentCount: c.incidentCount,
    firstSeen: c.firstSeen,
    lastSeen: c.lastSeen,
    severity: calculateSeverity(c.incidentCount),
    severityCriticality: mapSeverityCriticality(c.incidentCount),
    status: 'OPEN',
    playbook_ID: matchedPlaybook?.ID || null
  });

  // Link incidents to the new cluster
  await UPDATE(Incidents)
    .set({ cluster_ID: newClusterID })
    .where({ ID: { in: newLogs
      .filter(l =>
        l.errorSignature === c.errorSignature &&
        l.iFlowName === c.iFlowName
      )
      .map(l => l.ID)
    }});
}
        if (
          existingCluster &&
          !existingCluster.playbook_ID &&
          matchedPlaybook
        ) {

          await UPDATE(IncidentClusters)
            .set({
              playbook_ID:
                matchedPlaybook.ID
            })
            .where({
              ID: existingCluster.ID
            });
        }
      }

      console.log("========== runPoll SUCCESS ==========");

      return enriched;

    } catch (err) {

      console.error("❌ runPoll FAILED");
      console.error(err);
      console.error(err.stack);

      throw err;
    }
  }

  //   async function runPoll() {

  //     console.log("========== runPoll START ==========");

  //     try {

  //       /*
  //        * ------------------------------------------------------------
  //        * LAST POLL TIMESTAMP
  //        * ------------------------------------------------------------
  //        */

  //       console.log(
  //         "Fetching latest artifact timestamp..."
  //       );

  //       const latestArtifact =
  //         await SELECT.one
  //           .from(MonitoredArtifacts)
  //           .orderBy({
  //             lastPollTimestamp: 'desc'
  //           });

  //       const fallback =
  //         new Date(
  //           Date.now() - 5 * 60 * 1000
  //         );

  //       const rawTimestamp =
  //         latestArtifact?.lastPollTimestamp ||
  //         fallback;

  //       const lastPollTimestamp =
  //         new Date(rawTimestamp)
  //           .toISOString()
  //           .split('.')[0];

  //       console.log(
  //         "Formatted Timestamp:",
  //         lastPollTimestamp
  //       );

  //       /*
  //        * ------------------------------------------------------------
  //        * CPI FILTER
  //        * ------------------------------------------------------------
  //        */

  //       // const filter =
  //       //   `Status eq 'FAILED' and LogEnd gt datetime'${lastPollTimestamp}'`;

  //       const filter =
  //         `Status eq 'FAILED' and LogEnd gt datetime'2026-05-11T06:06:36'`;
  //       const path =
  //         `/api/v1/MessageProcessingLogs?$filter=${encodeURIComponent(filter)}`;

  //       console.log(
  //         "CPI API Path:",
  //         path
  //       );

  //       /*
  //        * ------------------------------------------------------------
  //        * MAIN CPI CALL
  //        * ------------------------------------------------------------
  //        */

  //       const response =
  //         await ApiCall(IS_API, {
  //           method: 'GET',
  //           path
  //         });

  //       if (!response) {

  //         throw new Error(
  //           "CPI API returned NULL response"
  //         );
  //       }

  //       const results =
  //         response?.d?.results || [];

  //       console.log(
  //         "Fetched Results Count:",
  //         results.length
  //       );

  //       if (!results.length) {

  //         console.log(
  //           "⚠️ No failed logs found"
  //         );

  //         return [];
  //       }

  //       /*
  //        * ------------------------------------------------------------
  //        * EXISTING INCIDENTS
  //        * ------------------------------------------------------------
  //        */

  //       const existing =
  //         await SELECT
  //           .from(Incidents)
  //           .columns('messageGuid');

  //       const existingSet =
  //         new Set(
  //           existing.map(e => e.messageGuid)
  //         );

  //       /*
  //        * ------------------------------------------------------------
  //        * PROCESS LOGS
  //        * ------------------------------------------------------------
  //        */

  //       const processedLogs =
  //         await processInBatches(
  //           results,
  //           async (log) => {

  //             const guid =
  //               log.MessageGuid;

  //             console.log(
  //               "------------------------------------------------"
  //             );

  //             console.log(
  //               "Processing GUID:",
  //               guid
  //             );

  //             /*
  //              * SKIP EXISTING INCIDENT
  //              */

  //             if (
  //               existingSet.has(guid)
  //             ) {

  //               console.log(
  //                 "Skipping existing incident:",
  //                 guid
  //               );

  //               return null;
  //             }

  //             try {

  //               /*
  //                * --------------------------------------------------
  //                * ERROR INFORMATION
  //                * --------------------------------------------------
  //                */

  //               const errorPath =
  //                 `/api/v1/MessageProcessingLogs('${guid}')/ErrorInformation/$value`;

  //               const errorMessage =
  //                 await ApiCall(IS_API, {
  //                   method: 'GET',
  //                   path: errorPath
  //                 });

  //               /*
  //                * --------------------------------------------------
  //                * ADAPTER ATTRIBUTES
  //                * --------------------------------------------------
  //                */

  //               const adapterPath =
  //                 `/api/v1/MessageProcessingLogs('${guid}')/AdapterAttributes`;

  //               const adapterRes =
  //                 await ApiCall(IS_API, {
  //                   method: 'GET',
  //                   path: adapterPath
  //                 });

  //               const adapterType =
  //                 extractAdapter(
  //                   adapterRes
  //                 );

  //               /*
  //                * --------------------------------------------------
  //                * SAFE ERROR HANDLING
  //                * --------------------------------------------------
  //                */

  //               const safeErrorMessage =
  //                 typeof errorMessage === 'string'
  //                   ? errorMessage
  //                   : JSON.stringify(errorMessage);

  //               /*
  //                * --------------------------------------------------
  //                * NORMALIZE
  //                * --------------------------------------------------
  //                */

  //               const normalized =
  //                 normalizeMessage(
  //                   safeErrorMessage.trim()
  //                 );

  //               const analysed =
  //                 normaliseLog({
  //                   errorMessage:
  //                     normalized
  //                 });

  //               /*
  //                * --------------------------------------------------
  //                * FIND EXISTING CLUSTER
  //                * --------------------------------------------------
  //                */

  //               let cluster =
  //                 await SELECT.one
  //                   .from(IncidentClusters)
  //                   .where({

  //                     errorSignature:
  //                       analysed.errorSignature,

  //                     iFlowName:
  //                       log.IntegrationFlowName
  //                   });

  //               /*
  //                * --------------------------------------------------
  //                * CREATE CLUSTER
  //                * --------------------------------------------------
  //                */

  //               if (!cluster) {

  //   try {

  //     await INSERT
  //       .into(IncidentClusters)
  //       .entries({

  //         errorSignature:
  //           analysed.errorSignature,

  //         iFlowName:
  //           log.IntegrationFlowName,

  //         incidentCount: 1,

  //         firstSeen:
  //           convertDate(log.LogEnd),

  //         lastSeen:
  //           convertDate(log.LogEnd),

  //         severity:
  //           calculateSeverity(1),

  //         severityCriticality:
  //           mapSeverityCriticality(1),

  //         status: 'OPEN'
  //       });

  //   } catch (err) {

  //     /*
  //      * Another thread inserted it
  //      */

  //     console.warn(
  //       "Cluster already created concurrently"
  //     );
  //   }

  //   /*
  //    * ALWAYS REFETCH
  //    */

  //   cluster =
  //     await SELECT.one
  //       .from(IncidentClusters)
  //       .where({

  //         errorSignature:
  //           analysed.errorSignature,

  //         iFlowName:
  //           log.IntegrationFlowName
  //       });
  // } else {

  //                 /*
  //                  * --------------------------------------------------
  //                  * UPDATE EXISTING CLUSTER
  //                  * --------------------------------------------------
  //                  */

  //                 console.log(
  //                   "Updating existing cluster:",
  //                   cluster.ID
  //                 );

  //                 const newCount =
  //                   cluster.incidentCount + 1;

  //                 await UPDATE(
  //                   IncidentClusters
  //                 )
  //                   .set({

  //                     incidentCount:
  //                       newCount,

  //                     lastSeen:
  //                       convertDate(
  //                         log.LogEnd
  //                       ),

  //                     severity:
  //                       calculateSeverity(
  //                         newCount
  //                       ),

  //                     severityCriticality:
  //                       mapSeverityCriticality(
  //                         newCount
  //                       )
  //                   })
  //                   .where({
  //                     ID: cluster.ID
  //                   });

  //                 /*
  //                  * REFRESH CLUSTER
  //                  */

  //                 cluster =
  //                   await SELECT.one
  //                     .from(IncidentClusters)
  //                     .where({
  //                       ID: cluster.ID
  //                     });
  //               }

  //               /*
  //                * --------------------------------------------------
  //                * CREATE INCIDENT
  //                * --------------------------------------------------
  //                */

  //               const incident = {

  //                 messageGuid:
  //                   guid,

  //                 iFlowName:
  //                   log.IntegrationFlowName,

  //                 status:
  //                   log.Status,

  //                 logStart:
  //                   convertDate(
  //                     log.LogStart
  //                   ),

  //                 logEnd:
  //                   convertDate(
  //                     log.LogEnd
  //                   ),

  //                 adapter:
  //                   adapterType,

  //                 errorMessage:
  //                   analysed.errorMessage,

  //                 errorSignature:
  //                   analysed.errorSignature,

  //                 /*
  //                  * RELATIONSHIP
  //                  */

  //                 cluster_ID:
  //                   cluster.ID
  //               };

  //               /*
  //                * --------------------------------------------------
  //                * INSERT INCIDENT
  //                * --------------------------------------------------
  //                */

  //               await INSERT
  //                 .into(Incidents)
  //                 .entries(incident);

  //               console.log(
  //                 "Incident inserted:",
  //                 guid
  //               );

  //               return incident;

  //             } catch (err) {

  //               console.error(
  //                 "❌ Enrichment Failed"
  //               );

  //               console.error(
  //                 "GUID:",
  //                 guid
  //               );

  //               console.error(err);
  //               console.error(err.stack);

  //               return {

  //                 messageGuid:
  //                   guid,

  //                 iFlowName:
  //                   log.IntegrationFlowName,

  //                 errorSignature:
  //                   'INTERNAL_PROCESSING_ERROR',

  //                 errorMessage:
  //                   err.message,

  //                 logEnd:
  //                   convertDate(
  //                     log.LogEnd
  //                   )
  //               };
  //             }
  //           }
  //         );

  //       /*
  //        * REMOVE NULLS
  //        */

  //       const newLogs =
  //         processedLogs.filter(Boolean);

  //       console.log(
  //         "Inserted Incidents:",
  //         newLogs.length
  //       );

  //       /*
  //        * ------------------------------------------------------------
  //        * UPDATE MONITORED ARTIFACTS
  //        * ------------------------------------------------------------
  //        */

  //       await upsertMonitoredArtifacts(
  //         MonitoredArtifacts,
  //         newLogs
  //       );

  //       console.log(
  //         "✅ MonitoredArtifacts Updated"
  //       );

  //       console.log(
  //         "========== runPoll SUCCESS =========="
  //       );

  //       return newLogs;

  //     } catch (err) {

  //       console.error(
  //         "❌ runPoll FAILED"
  //       );

  //       console.error(err);
  //       console.error(err.stack);

  //       throw err;
  //     }
  //   }
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
  this.on('getClusterRecommendation', async (req) => {
    try {

      const { cluster_ID } = req.data;

      /*
       * --------------------------------------------------
       * EXISTING RECOMMENDATION
       * --------------------------------------------------
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
       * --------------------------------------------------
       * FETCH CLUSTER
       * --------------------------------------------------
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
       * --------------------------------------------------
       * FETCH SAMPLE INCIDENTS
       * --------------------------------------------------
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
       * --------------------------------------------------
       * GENERATE AI RECOMMENDATION
       * --------------------------------------------------
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
       * --------------------------------------------------
       * STORE RECOMMENDATION
       * --------------------------------------------------
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
       * --------------------------------------------------
       * RETURN SAVED RECORD
       * --------------------------------------------------
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