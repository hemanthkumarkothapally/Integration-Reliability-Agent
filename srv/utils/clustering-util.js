import {
  normaliseLog
} from './log-utils.js';
import { calculateArtifactSeverity } from './severityEngine-util.js';
// export async function upsertClusters(Incidents,IncidentClusters,Playbooks,MonitoredArtifacts,ClusterArtifacts, newLogs,srv) {

//   const clusterMap = {};
  
//         for (const log of newLogs) {
  
//           const key = log.errorSignature;
  
//           if (!clusterMap[key]) {
  
//             clusterMap[key] = {
  
//               errorSignature: log.errorSignature,
//               incidentCount: 0,
//               firstSeen: log.logEnd,
//               lastSeen: log.logEnd,
//               iFlows: new Set()
//             };
//           }
  
//           clusterMap[key].incidentCount++;
//           clusterMap[key].lastSeen = log.logEnd;
//           clusterMap[key].iFlows.add(log.iFlowName);
//         }
  
//         console.log("Cluster Count:", Object.keys(clusterMap).length);
  
//         /*
//          * ------------------------------------------------------------
//          * UPSERT CLUSTERS
//          * ------------------------------------------------------------
//          */
  
//         for (const key in clusterMap) {
  
//           console.log("Processing Cluster:", key);
//           const newClusterID = cds.utils.uuid();
//           const c = clusterMap[key];
//           let matchedPlaybook = null;
//           const existingCluster =
//             await SELECT.one
//               .from(IncidentClusters)
//               .where({
//                 errorSignature: c.errorSignature
//               });
  
//           if (existingCluster) {
//             console.log("Updating Existing Cluster");
//             const newCount = existingCluster.incidentCount + c.incidentCount;
  
//             await srv.run(UPDATE(IncidentClusters)
//               .set({
//                 incidentCount: newCount,
//                 lastSeen: c.lastSeen,
//                 status: 'OPEN',
//                 severity: calculateSeverity(newCount),
//                 severityCriticality: mapSeverityCriticality(newCount)
//               })
//               .where({ ID: existingCluster.ID }));
  
//             // Link incidents to existing cluster
//             await UPDATE(Incidents)
//               .set({ cluster_ID: existingCluster.ID })
//               .where({
//                 ID: {
//                   in: newLogs
//                     .filter(l =>
//                       l.errorSignature === c.errorSignature
//                     )
//                     .map(l => l.ID)
//                 }
//               });
  
//           } else {
//             console.log("Creating New Cluster");
  
  
//             const analysed =
//               normaliseLog({
//                 errorMessage:
//                   c.errorSignature
//               });
//             matchedPlaybook =
//               await SELECT.one
//                 .from(Playbooks)
//                 .where({
//                   errorType:
//                     analysed.errorSignature
//                 });
//             console.log("Analysed Cluster Result:", analysed);
//             await srv.run(INSERT.into(IncidentClusters).entries({
//               ID: newClusterID,
//               errorSignature: c.errorSignature,
//               errorType: analysed.errorSignature,
//               incidentCount: c.incidentCount,
//               firstSeen: c.firstSeen,
//               lastSeen: c.lastSeen,
//               severity: calculateSeverity(c.incidentCount),
//               severityCriticality: mapSeverityCriticality(c.incidentCount),
//               status: 'OPEN',
//               playbook_ID: matchedPlaybook?.ID || null
//             }));
  
//             // Link incidents to the new cluster
//             await UPDATE(Incidents)
//               .set({ cluster_ID: newClusterID })
//               .where({
//                 ID: {
//                   in: newLogs
//                     .filter(l =>
//                       l.errorSignature === c.errorSignature
//                     )
//                     .map(l => l.ID)
//                 }
//               });
//           }
//           if (
//             existingCluster &&
//             !existingCluster.playbook_ID &&
//             matchedPlaybook
//           ) {
  
//             await UPDATE(IncidentClusters)
//               .set({
//                 playbook_ID:
//                   matchedPlaybook.ID
//               })
//               .where({
//                 ID: existingCluster.ID
//               });
//           }
//           const clusterId =
//             existingCluster?.ID || newClusterID;
  
//           for (const iFlowId of c.iFlows) {
  
//             const artifact =
//               await SELECT.one
//                 .from(MonitoredArtifacts)
//                 .where({ iFlowId });
  
//             if (!artifact) continue;
  
//             const existingRelation =
//               await SELECT.one
//                 .from(ClusterArtifacts)
//                 .where({
//                   cluster_ID: clusterId,
//                   artifact_ID: artifact.ID
//                 });
  
//             if (!existingRelation) {
  
//               await INSERT.into(ClusterArtifacts).entries({
//                 ID: cds.utils.uuid(),
//                 cluster_ID: clusterId,
//                 artifact_ID: artifact.ID
//               });
  
//               console.log(
//                 `Linked Cluster ${clusterId} -> iFlow ${artifact.iFlowName}`
//               );
//             }
//           }
//         }

// }

export async function upsertClusters(
  Incidents,
  IncidentClusters,
  Playbooks,
  MonitoredArtifacts,
  ClusterArtifacts,
  newLogs,
  srv
) {

  const clusterMap = {};

  /*
   * ----------------------------------------
   * GROUP LOGS BY ERROR SIGNATURE
   * ----------------------------------------
   */

  for (const log of newLogs) {

    const key = log.errorSignature;

    if (!clusterMap[key]) {

      clusterMap[key] = {

        errorSignature: log.errorSignature,

        incidentCount: 0,

        firstSeen: log.logEnd,

        lastSeen: log.logEnd,

        logs: []
      };
    }

    clusterMap[key].incidentCount++;

    clusterMap[key].lastSeen = log.logEnd;

    clusterMap[key].logs.push(log);
  }

  /*
   * ----------------------------------------
   * PROCESS EACH CLUSTER
   * ----------------------------------------
   */

  for (const key in clusterMap) {

    const clusterData = clusterMap[key];

    const analysed =
      normaliseLog({
        errorMessage:
          clusterData.errorSignature
      });

    /*
     * ----------------------------------------
     * FIND EXISTING CLUSTER
     * ----------------------------------------
     */

    let cluster =
      await SELECT.one
        .from(IncidentClusters)
        .where({
          errorSignature:
            clusterData.errorSignature
        });

    /*
     * ----------------------------------------
     * CREATE NEW CLUSTER
     * ----------------------------------------
     */

    if (!cluster) {

      const playbook =
        await SELECT.one
          .from(Playbooks)
          .where({
            errorType:
              analysed.errorSignature
          });

      const clusterId =
        cds.utils.uuid();

      await INSERT.into(
        IncidentClusters
      ).entries({

        ID: clusterId,

        errorSignature:
          clusterData.errorSignature,

        errorType:
          analysed.errorSignature,

        incidentCount:
          clusterData.incidentCount,

        firstSeen:
          clusterData.firstSeen,

        lastSeen:
          clusterData.lastSeen,

        severity:
          calculateSeverity(
            clusterData.incidentCount
          ),

        severityCriticality:
          mapSeverityCriticality(
            clusterData.incidentCount
          ),

        globalStatus: 'OPEN',

        playbook_ID:
          playbook?.ID || null
      });

      cluster =
        await SELECT.one
          .from(IncidentClusters)
          .where({
            ID: clusterId
          });
    }

    /*
     * ----------------------------------------
     * UPDATE EXISTING CLUSTER
     * ----------------------------------------
     */

    else {

      const updatedCount =
        cluster.incidentCount +
        clusterData.incidentCount;

      await UPDATE(
        IncidentClusters
      )
      .set({

        incidentCount:
          updatedCount,

        lastSeen:
          clusterData.lastSeen,

        severity:
          calculateSeverity(
            updatedCount
          ),

        severityCriticality:
          mapSeverityCriticality(
            updatedCount
          ),

        globalStatus: 'OPEN'
      })
      .where({
        ID: cluster.ID
      });
    }

    /*
     * ----------------------------------------
     * LINK INCIDENTS
     * ----------------------------------------
     */

    for (const log of clusterData.logs) {

      const incident =
        await SELECT.one
          .from(Incidents)
          .where({
            messageGuid:
              log.messageGuid
          });

      if (!incident) continue;

      await UPDATE(Incidents)
        .set({
          cluster_ID:
            cluster.ID
        })
        .where({
          ID: incident.ID
        });

      /*
       * ----------------------------------------
       * FIND ARTIFACT
       * ----------------------------------------
       */

      const artifact =
        await SELECT.one
          .from(MonitoredArtifacts)
          .where({
            iFlowName:
              log.iFlowName
          });

      if (!artifact)
        continue;

      /*
       * ----------------------------------------
       * FIND EXISTING RELATION
       * ----------------------------------------
       */

      let relation =
        await SELECT.one
          .from(ClusterArtifacts)
          .where({

            cluster_ID:
              cluster.ID,

            artifact_ID:
              artifact.ID
          });

      /*
       * ----------------------------------------
       * CREATE RELATION
       * ----------------------------------------
       */

      if (!relation) {

        await INSERT.into(
          ClusterArtifacts
        ).entries({

          ID:
            cds.utils.uuid(),

          cluster_ID:
            cluster.ID,

          artifact_ID:
            artifact.ID,

          resolutionStatus:
            'OPEN'
        });
      }

      /*
       * ----------------------------------------
       * UPDATE RELATION
       * ----------------------------------------
       */

      else {

        await UPDATE(
          ClusterArtifacts
        )
        .set({
          resolutionStatus:
            'OPEN'
        })
        .where({
          ID:
            relation.ID
        });
      }
    }
  }

  /*
   * ----------------------------------------
   * RECALCULATE DASHBOARD
   * ----------------------------------------
   */

  await refreshArtifactDashboard(
    MonitoredArtifacts,
    ClusterArtifacts,
    IncidentClusters
  );
}

export async function refreshArtifactDashboard(
  MonitoredArtifacts,
  ClusterArtifacts,
  IncidentClusters
) {

  /*
   * ----------------------------------------
   * GET ALL ARTIFACTS
   * ----------------------------------------
   */

  const artifacts =
    await SELECT.from(
      MonitoredArtifacts
    );

  /*
   * ----------------------------------------
   * BUILD CURRENT OPEN CLUSTER COUNTS
   * ----------------------------------------
   */

  const artifactStats = [];

  for (const artifact of artifacts) {

    /*
     * ----------------------------------------
     * GET RELATIONS
     * ----------------------------------------
     */

    const relations =
      await SELECT.from(
        ClusterArtifacts
      )
      .where({
        artifact_ID:
          artifact.ID
      });

    /*
     * ----------------------------------------
     * OPEN CLUSTERS
     * ----------------------------------------
     */

    const openClusters =
      relations.filter(
        r =>
          r.resolutionStatus ===
          'OPEN'
      );

    /*
     * ----------------------------------------
     * RESOLVED CLUSTERS
     * ----------------------------------------
     */

    const resolvedClusters =
      relations.filter(
        r =>
          r.resolutionStatus ===
          'RESOLVED'
      );

    /*
     * ----------------------------------------
     * CRITICAL COUNT
     * ----------------------------------------
     */

    let criticalCount = 0;

    /*
     * ----------------------------------------
     * LAST FAILURE
     * ----------------------------------------
     */

    let lastFailure = null;

    for (const relation of openClusters) {

      const cluster =
        await SELECT.one
          .from(
            IncidentClusters
          )
          .where({
            ID:
              relation.cluster_ID
          });

      if (!cluster)
        continue;

      if (
        cluster.severity ===
        'CRITICAL'
      ) {

        criticalCount++;
      }

      if (
        !lastFailure ||
        new Date(cluster.lastSeen) >
        new Date(lastFailure)
      ) {

        lastFailure =
          cluster.lastSeen;
      }
    }

    artifactStats.push({

      artifact,

      openClusterCount:
        openClusters.length,

      resolvedClusterCount:
        resolvedClusters.length,

      criticalClusterCount:
        criticalCount,

      lastFailureAt:
        lastFailure
    });
  }

  /*
   * ----------------------------------------
   * CALCULATE GLOBAL MEAN
   * ----------------------------------------
   */

  const counts =
    artifactStats.map(
      a => a.openClusterCount
    );

  const mean =
    counts.reduce(
      (a, b) => a + b,
      0
    ) / counts.length;

  /*
   * ----------------------------------------
   * VARIANCE
   * ----------------------------------------
   */

  const variance =
    counts.reduce(
      (sum, value) =>
        sum +
        Math.pow(value - mean, 2),
      0
    ) / counts.length;

  /*
   * ----------------------------------------
   * STANDARD DEVIATION
   * ----------------------------------------
   */

  const stdDev =
    Math.sqrt(variance);

  console.log({
    mean,
    stdDev
  });

  /*
   * ----------------------------------------
   * UPDATE EACH ARTIFACT
   * ----------------------------------------
   */

  for (const stat of artifactStats) {

    /*
     * ----------------------------------------
     * Z SCORE
     * ----------------------------------------
     */

    const zScore =
      stdDev === 0
        ? 0
        : (
            stat.openClusterCount -
            mean
          ) / stdDev;

    /*
     * ----------------------------------------
     * SCORE
     * ----------------------------------------
     */

    const score =
      Number(
        Math.abs(zScore)
          .toFixed(2)
      );

    /*
     * ----------------------------------------
     * SEVERITY
     * ----------------------------------------
     */

    let severity = 'HEALTHY';

    if (zScore >= 2) {

      severity = 'CRITICAL';

    } else if (zScore >= 1.5) {

      severity = 'HIGH';

    } else if (zScore >= 1) {

      severity = 'MEDIUM';

    } else if (zScore >= 0.5) {

      severity = 'LOW';
    }

    /*
     * ----------------------------------------
     * UPDATE DB
     * ----------------------------------------
     */

    await UPDATE(
      MonitoredArtifacts
    )
    .set({

      overallSeverity:
        severity,

      severityScore:
        score,

      severityZScore:
        Number(
          zScore.toFixed(2)
        ),

      openClusterCount:
        stat.openClusterCount,

      resolvedClusterCount:
        stat.resolvedClusterCount,

      criticalClusterCount:
        stat.criticalClusterCount,

      lastFailureAt:
        stat.lastFailureAt,

      lastPollTimestamp:
        new Date()
    })
    .where({
      ID:
        stat.artifact.ID
    });

    console.log(
      `Updated Artifact ${stat.artifact.iFlowName}`,
      {

        severity,

        score,

        zScore,

        mean,

        stdDev
      }
    );
  }
}
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