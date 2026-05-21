import {
  normaliseLog
} from './log-utils.js';
export async function upsertClusters(Incidents,IncidentClusters,Playbooks,MonitoredArtifacts,ClusterArtifacts, newLogs,srv) {

  const clusterMap = {};
  
        for (const log of newLogs) {
  
          const key = log.errorSignature;
  
          if (!clusterMap[key]) {
  
            clusterMap[key] = {
  
              errorSignature: log.errorSignature,
              incidentCount: 0,
              firstSeen: log.logEnd,
              lastSeen: log.logEnd,
              iFlows: new Set()
            };
          }
  
          clusterMap[key].incidentCount++;
          clusterMap[key].lastSeen = log.logEnd;
          clusterMap[key].iFlows.add(log.iFlowName);
        }
  
        console.log("Cluster Count:", Object.keys(clusterMap).length);
  
        /*
         * ------------------------------------------------------------
         * UPSERT CLUSTERS
         * ------------------------------------------------------------
         */
  
        for (const key in clusterMap) {
  
          console.log("Processing Cluster:", key);
          const newClusterID = cds.utils.uuid();
          const c = clusterMap[key];
          let matchedPlaybook = null;
          const existingCluster =
            await SELECT.one
              .from(IncidentClusters)
              .where({
                errorSignature: c.errorSignature
              });
  
          if (existingCluster) {
            console.log("Updating Existing Cluster");
            const newCount = existingCluster.incidentCount + c.incidentCount;
  
            await srv.run(UPDATE(IncidentClusters)
              .set({
                incidentCount: newCount,
                lastSeen: c.lastSeen,
                status: 'OPEN',
                severity: calculateSeverity(newCount),
                severityCriticality: mapSeverityCriticality(newCount)
              })
              .where({ ID: existingCluster.ID }));
  
            // Link incidents to existing cluster
            await UPDATE(Incidents)
              .set({ cluster_ID: existingCluster.ID })
              .where({
                ID: {
                  in: newLogs
                    .filter(l =>
                      l.errorSignature === c.errorSignature
                    )
                    .map(l => l.ID)
                }
              });
  
          } else {
            console.log("Creating New Cluster");
  
  
            const analysed =
              normaliseLog({
                errorMessage:
                  c.errorSignature
              });
            matchedPlaybook =
              await SELECT.one
                .from(Playbooks)
                .where({
                  errorType:
                    analysed.errorSignature
                });
            console.log("Analysed Cluster Result:", analysed);
            await srv.run(INSERT.into(IncidentClusters).entries({
              ID: newClusterID,
              errorSignature: c.errorSignature,
              errorType: analysed.errorSignature,
              incidentCount: c.incidentCount,
              firstSeen: c.firstSeen,
              lastSeen: c.lastSeen,
              severity: calculateSeverity(c.incidentCount),
              severityCriticality: mapSeverityCriticality(c.incidentCount),
              status: 'OPEN',
              playbook_ID: matchedPlaybook?.ID || null
            }));
  
            // Link incidents to the new cluster
            await UPDATE(Incidents)
              .set({ cluster_ID: newClusterID })
              .where({
                ID: {
                  in: newLogs
                    .filter(l =>
                      l.errorSignature === c.errorSignature
                    )
                    .map(l => l.ID)
                }
              });
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
          const clusterId =
            existingCluster?.ID || newClusterID;
  
          for (const iFlowId of c.iFlows) {
  
            const artifact =
              await SELECT.one
                .from(MonitoredArtifacts)
                .where({ iFlowId });
  
            if (!artifact) continue;
  
            const existingRelation =
              await SELECT.one
                .from(ClusterArtifacts)
                .where({
                  cluster_ID: clusterId,
                  artifact_ID: artifact.ID
                });
  
            if (!existingRelation) {
  
              await INSERT.into(ClusterArtifacts).entries({
                ID: cds.utils.uuid(),
                cluster_ID: clusterId,
                artifact_ID: artifact.ID
              });
  
              console.log(
                `Linked Cluster ${clusterId} -> iFlow ${artifact.iFlowName}`
              );
            }
          }
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