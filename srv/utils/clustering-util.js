import cds from '@sap/cds';
import { normaliseLog } from './log-utils.js';
import { refreshClusterSeverity, updateClusterSeverityForIFlow } from './severityEngine-util.js';
import { updateDailyMetrics } from './daily-metrics.js';

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
  for (const log of newLogs) {
    const analysed = normaliseLog({ errorMessage: log.errorSignature });
    const signatureKey = analysed.errorMessage;

    if (!clusterMap[signatureKey]) {
      clusterMap[signatureKey] = {
        signatureKey,                       
        errorType: analysed.errorSignature, 
        sampleRawError: log.errorSignature, 
        incidentCount: 0,
        firstSeen: log.logEnd,
        lastSeen: log.logEnd,
        logs: []
      };
    }

    clusterMap[signatureKey].incidentCount++;
    clusterMap[signatureKey].lastSeen = log.logEnd;
    clusterMap[signatureKey].logs.push(log);
  }

  for (const key in clusterMap) {
    const clusterData = clusterMap[key];

    let cluster = await SELECT.one
      .from(IncidentClusters)
      .where({ tenant_ID: tenant.ID, errorSignature: clusterData.signatureKey });
        const pollerSrv = cds.services.PollerService;

    if (!cluster) {
      const playbook = await SELECT.one
        .from(Playbooks)
        .where({ errorType: clusterData.errorType });

      const clusterId = cds.utils.uuid();
      
      await INSERT.into('IncidentClusters').entries({
        ID: clusterId,
        tenant_ID: tenant.ID,
        errorSignature: clusterData.signatureKey,
        errorType: clusterData.errorType,
        incidentCount: clusterData.incidentCount,
        firstSeen: clusterData.firstSeen,
        lastSeen: clusterData.lastSeen,
        severity: calculateSeverity(clusterData.incidentCount),
        severityCriticality: mapSeverityCriticality(clusterData.incidentCount),
        globalStatus: 'OPEN',
        playbook_ID: playbook?.ID || null
      });

      cluster = await SELECT.one.from(IncidentClusters).where({ ID: clusterId });
      await updateDailyMetrics(tenant.ID, { newClusters: 1 });
    } else {
      const updatedCount = cluster.incidentCount + clusterData.incidentCount;

      await UPDATE('IncidentClusters')
        .set({
          incidentCount: updatedCount,
          lastSeen: clusterData.lastSeen,
          severity: calculateSeverity(updatedCount),
          severityCriticality: mapSeverityCriticality(updatedCount),
          globalStatus: 'OPEN'
        })
        .where({ ID: cluster.ID });
    }

     for (const log of clusterData.logs) {
      const incident = await SELECT.one
        .from(Incidents)
        .where({ tenant_ID: tenant.ID, messageGuid: log.messageGuid });
      if (!incident) continue;

      await UPDATE(Incidents).set({ cluster_ID: cluster.ID }).where({ ID: incident.ID });

      const artifact = await SELECT.one
        .from(MonitoredArtifacts)
        .where({ tenant_ID: tenant.ID, iFlowName: log.iFlowName });
      if (!artifact) continue;

      const relation = await SELECT.one
        .from(ClusterArtifacts)
        .where({ cluster_ID: cluster.ID, artifact_ID: artifact.ID });

      if (!relation) {
        await INSERT.into(ClusterArtifacts).entries({
          ID: cds.utils.uuid(),
          cluster_ID: cluster.ID,
          artifact_ID: artifact.ID,
          resolutionStatus: 'OPEN'
        });
      } else {
        await UPDATE(ClusterArtifacts)
          .set({ resolutionStatus: 'OPEN' })
          .where({ ID: relation.ID });
      }
    }
  }

 const tenantArtifacts = await SELECT
    .from(MonitoredArtifacts)
    .columns('ID', 'iFlowName')
    .where({ tenant_ID: tenant.ID });

  const artifactById = new Map(tenantArtifacts.map(a => [a.ID, a]));

  const relations = await SELECT
    .from(ClusterArtifacts)
    .where({ artifact_ID: { in: tenantArtifacts.map(a => a.ID) } });

  for (const rel of relations) {
    const artifact = artifactById.get(rel.artifact_ID);
    if (!artifact) continue;

    const count = await SELECT.one
      .from(Incidents)
      .columns`count(*) as count`
      .where({
        tenant_ID: tenant.ID,
        cluster_ID: rel.cluster_ID,
        iFlowName: artifact.iFlowName,
        status: 'OPEN'
      });

    await UPDATE(ClusterArtifacts)
      .set({ incidentCount: count?.count || 0 })
      .where({ ID: rel.ID });
  }

  await refreshArtifactDashboard(MonitoredArtifacts, ClusterArtifacts, IncidentClusters, tenant);
}

export async function refreshArtifactDashboard(MonitoredArtifacts, ClusterArtifacts, IncidentClusters, tenant) {
  const artifacts = await SELECT.from(MonitoredArtifacts).where({ tenant_ID: tenant.ID });

  if (!artifacts.length) {
    console.log(`No artifacts found for tenant ${tenant.tenantName}`);
    return;
  }

  const relations = await SELECT
    .from(ClusterArtifacts)
    .where({ artifact_ID: { in: artifacts.map(a => a.ID) } });

  const relationMap = new Map();
  for (const rel of relations) {
    if (!relationMap.has(rel.artifact_ID)) relationMap.set(rel.artifact_ID, []);
    relationMap.get(rel.artifact_ID).push(rel);
  }

  const artifactStats = [];

  for (const artifact of artifacts) {
    const artifactRelations = relationMap.get(artifact.ID) || [];
    const openRelations = artifactRelations.filter(r => r.resolutionStatus === 'OPEN');
    const resolvedRelations = artifactRelations.filter(r => r.resolutionStatus === 'RESOLVED');
    const openClusterIds = openRelations.map(r => r.cluster_ID).filter(Boolean);

    let lastFailureAt = null;
    if (openClusterIds.length) {
      const clusters = await SELECT
        .from(IncidentClusters)
        .columns('lastSeen')
        .where({ tenant_ID: tenant.ID, ID: { in: openClusterIds } });

      lastFailureAt = clusters.reduce(
        (latest, current) =>
          (!latest || new Date(current.lastSeen) > new Date(latest)) ? current.lastSeen : latest,
        null
      );
    }

    artifactStats.push({
      artifact,
      openClusterCount: openRelations.length,
      resolvedClusterCount: resolvedRelations.length,
      lastFailureAt
    });
  }

  const counts = artifactStats.map(a => a.openClusterCount);
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  for (const stat of artifactStats) {
    const count = stat.openClusterCount;
    const zScore = stdDev === 0 ? 0 : (count - mean) / stdDev;

    let severity = 'HEALTHY';
    if (zScore >= 2.0) severity = 'CRITICAL';
    else if (zScore >= 1.5) severity = 'HIGH';
    else if (zScore >= 1.0) severity = 'MEDIUM';
    else if (count > 0) severity = 'LOW';

    await UPDATE(MonitoredArtifacts)
      .set({
        overallSeverity: severity,
        severityScore: Number(Math.abs(zScore).toFixed(2)),
        severityZScore: Number(zScore.toFixed(2)),
        openClusterCount: stat.openClusterCount,
        resolvedClusterCount: stat.resolvedClusterCount,
        ...(stat.lastFailureAt && { lastErrorAt: stat.lastFailureAt })
      })
      .where({ ID: stat.artifact.ID });

    await updateClusterSeverityForIFlow(stat.artifact.ID, ClusterArtifacts);
  }

  await refreshClusterSeverity(IncidentClusters, tenant);

  console.log(`Artifact dashboard refresh completed for tenant ${tenant.tenantName}`);
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