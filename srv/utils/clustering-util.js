export async function upsertClusters(IncidentClusters,Playbooks, newLogs) {

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

          const newCount =
            existingCluster.incidentCount +
            c.incidentCount;

          await UPDATE(IncidentClusters)
            .set({
              incidentCount: newCount,
              lastSeen: c.lastSeen,
              severity: calculateSeverity(newCount),
              severityCriticality:
                mapSeverityCriticality(newCount)
            })
            .where({
              ID: existingCluster.ID
            });

        } else {

          console.log("Creating New Cluster");

          await INSERT.into(IncidentClusters).entries({

            errorSignature: c.errorSignature,
            iFlowName: c.iFlowName,
            incidentCount: c.incidentCount,
            firstSeen: c.firstSeen,
            lastSeen: c.lastSeen,
            severity: calculateSeverity(c.incidentCount),
            severityCriticality:
              mapSeverityCriticality(c.incidentCount),
            status: 'OPEN',
            playbook_ID: matchedPlaybook?.ID || null
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
      }

}