import {
  normaliseLog
} from './log-utils.js';
import { refreshClusterSeverity, updateClusterSeverityForIFlow } from './severityEngine-util.js';
import { updateDailyMetrics ,updateDailyAIMetrics} from './daily-metrics.js';

export async function upsertClusters(
  Incidents,
  IncidentClusters,
  Playbooks,
  MonitoredArtifacts,
  ClusterArtifacts,
  newLogs,
  srv,
  tenant
) {

  const clusterMap = {};

  /*
   * ----------------------------------------
   * GROUP LOGS BY ERROR SIGNATURE
   * ----------------------------------------
   */

  for (const log of newLogs) {

    // const key = log.errorSignature;
    const analysed = normaliseLog({ errorMessage: log.errorSignature });
    const key = analysed.errorSignature === 'UNKNOWN_ERROR'
      ? analysed.errorMessage
      : analysed.errorSignature;

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
          tenant_ID: tenant.ID,
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
        tenant_ID: tenant.ID,
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
      await updateDailyMetrics(
        tenant.ID,
        {
          newClusters: 1
        }
      );
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
            tenant_ID: tenant.ID,
            messageGuid: log.messageGuid
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
            tenant_ID: tenant.ID,
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
    const tenantArtifacts =
      await SELECT
        .from(MonitoredArtifacts)
        .columns('ID')
        .where({
          tenant_ID: tenant.ID
        });

    const relations =
      await SELECT
        .from(ClusterArtifacts)
        .where({
          artifact_ID: {
            in: tenantArtifacts.map(a => a.ID)
          }
        });

    for (const rel of relations) {

      const artifact =
        await SELECT.one
          .from(MonitoredArtifacts)
          .where({
            ID: rel.artifact_ID,
            tenant_ID: tenant.ID
          });

      if (!artifact) continue;

      const count =
        await SELECT.one
          .from(Incidents)
          .columns`count(*) as count`
          .where({
            tenant_ID: tenant.ID,
            cluster_ID: rel.cluster_ID,
            iFlowName: artifact.iFlowName,
            status: 'OPEN'
          });

      await UPDATE(ClusterArtifacts)
        .set({
          incidentCount: count.count || 0
        })
        .where({
          ID: rel.ID
        });
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
    IncidentClusters,
    tenant
  );
}

export async function refreshArtifactDashboard(
  MonitoredArtifacts,
  ClusterArtifacts,
  IncidentClusters,
  tenant
) {

  const artifacts =
    await SELECT
      .from(MonitoredArtifacts)
      .where({
        tenant_ID: tenant.ID
      });

  if (!artifacts.length) {
    console.log(
      `No artifacts found for tenant ${tenant.tenantName}`
    );
    return;
  }

  const relations =
    await SELECT
      .from(ClusterArtifacts)
      .where({
        artifact_ID: {
          in: artifacts.map(
            a => a.ID
          )
        }
      });

  const relationMap =
    new Map();

  for (const rel of relations) {

    if (
      !relationMap.has(
        rel.artifact_ID
      )
    ) {
      relationMap.set(
        rel.artifact_ID,
        []
      );
    }

    relationMap
      .get(rel.artifact_ID)
      .push(rel);
  }

  const artifactStats = [];

  for (const artifact of artifacts) {

    const artifactRelations =
      relationMap.get(
        artifact.ID
      ) || [];

    const openRelations =
      artifactRelations.filter(
        r =>
          r.resolutionStatus ===
          'OPEN'
      );

    const resolvedRelations =
      artifactRelations.filter(
        r =>
          r.resolutionStatus ===
          'RESOLVED'
      );

    const openClusterIds =
      openRelations
        .map(
          r => r.cluster_ID
        )
        .filter(Boolean);

    let lastFailureAt =
      null;

    if (
      openClusterIds.length
    ) {

      const clusters =
        await SELECT
          .from(
            IncidentClusters
          )
          .columns(
            'lastSeen'
          )
          .where({

            tenant_ID:
              tenant.ID,

            ID: {
              in:
                openClusterIds
            }
          });

      lastFailureAt =
        clusters.reduce(
          (
            latest,
            current
          ) => {

            return (
              !latest ||
              new Date(
                current.lastSeen
              ) >
              new Date(
                latest
              )
            )
              ? current.lastSeen
              : latest;
          },
          null
        );
    }

    artifactStats.push({
      artifact,
      openClusterCount:
        openRelations.length,
      resolvedClusterCount:
        resolvedRelations.length,
      lastFailureAt
    });
  }

  /*
   * ----------------------------------------
   * STANDARD DEVIATION
   * ----------------------------------------
   */

  const counts =
    artifactStats.map(
      a =>
        a.openClusterCount
    );

  const mean =
    counts.reduce(
      (a, b) => a + b,
      0
    ) / counts.length;

  const variance =
    counts.reduce(
      (
        sum,
        value
      ) =>
        sum +
        Math.pow(
          value - mean,
          2
        ),
      0
    ) / counts.length;

  const stdDev =
    Math.sqrt(
      variance
    );

  // console.log({
  //     tenant:
  //         tenant.tenantName,
  //     mean:
  //         mean.toFixed(2),
  //     stdDev:
  //         stdDev.toFixed(2)
  // });

  /*
   * ----------------------------------------
   * UPDATE SEVERITY
   * ----------------------------------------
   */

  for (const stat of artifactStats) {

    const count =
      stat.openClusterCount;

    const zScore =
      stdDev === 0
        ? 0
        : (
          count - mean
        ) / stdDev;

    let severity =
      'HEALTHY';

    if (
      zScore >= 2.0
    ) {

      severity =
        'CRITICAL';
    }

    else if (
      zScore >= 1.5
    ) {

      severity =
        'HIGH';
    }

    else if (
      zScore >= 1.0
    ) {

      severity =
        'MEDIUM';
    }

    else if (
      count > 0
    ) {

      severity =
        'LOW';
    }

    const score =
      Number(
        Math.abs(
          zScore
        ).toFixed(2)
      );

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
            zScore.toFixed(
              2
            )
          ),

        openClusterCount:
          stat.openClusterCount,

        resolvedClusterCount:
          stat.resolvedClusterCount,

        ...(stat.lastFailureAt && {
          lastErrorAt:
            stat.lastFailureAt
        })
      })
      .where({
        ID:
          stat.artifact.ID
      });

    // console.log(
    //     stat.artifact.iFlowName,
    //     {
    //         openClusterCount:
    //             count,
    //         zScore:
    //             Number(
    //                 zScore.toFixed(
    //                     2
    //                 )
    //             ),
    //         severity
    //     }
    // );
    await updateClusterSeverityForIFlow(
      stat.artifact.ID,
      ClusterArtifacts
    );
  }

  await refreshClusterSeverity(
    IncidentClusters,
    tenant
  );


  console.log(
    `Artifact dashboard refresh completed for tenant ${tenant.tenantName}`
  );
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