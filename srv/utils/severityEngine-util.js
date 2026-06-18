function meanAndStdDev(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return { mean, stdDev: Math.sqrt(variance) };
}

export async function refreshClusterSeverity(IncidentClusters, tenant) {
  const clusters = await SELECT
    .from(IncidentClusters)
    .where({ tenant_ID: tenant.ID, globalStatus: { '!=': 'RESOLVED' } });

  if (!clusters.length) {
    console.log(`No active clusters found for tenant ${tenant.tenantName}`);
    return;
  }

  const counts = clusters.map(c => c.incidentCount || 0);
  const { mean, stdDev } = meanAndStdDev(counts);

  console.log({
    tenant: tenant.tenantName,
    mean: mean.toFixed(2),
    stdDev: stdDev.toFixed(2)
  });

  for (const cluster of clusters) {
    const count = cluster.incidentCount || 0;
    const zScore = stdDev === 0 ? 0 : (count - mean) / stdDev;

    let severity = 'LOW';
    let criticality = 5;

    if (zScore >= 2.0) {
      severity = 'CRITICAL';
      criticality = 1;
    } else if (zScore >= 1.5) {
      severity = 'HIGH';
      criticality = 2;
    } else if (zScore >= 1.0) {
      severity = 'MEDIUM';
      criticality = 3;
    }

    await UPDATE(IncidentClusters)
      .set({ severity, severityCriticality: criticality })
      .where({ ID: cluster.ID, tenant_ID: tenant.ID });
  }

  console.log(`Cluster severity refresh completed for tenant ${tenant.tenantName}`);
}

export async function updateClusterSeverityForIFlow(artifactId, ClusterArtifacts) {
  const relations = await SELECT
    .from(ClusterArtifacts)
    .columns('ID', 'incidentCount')
    .where({ artifact_ID: artifactId, resolutionStatus: 'OPEN' });

  if (!relations.length) return;

  const counts = relations.map(r => r.incidentCount || 0);
  const { mean, stdDev } = meanAndStdDev(counts);

  for (const relation of relations) {
    const incidentCount = relation.incidentCount || 0;
    let severity = 'LOW';

    if (incidentCount > 0) {
      const zScore = stdDev === 0 ? 0 : (incidentCount - mean) / stdDev;
      if (zScore >= 2) severity = 'CRITICAL';
      else if (zScore >= 1.5) severity = 'HIGH';
      else if (zScore >= 1) severity = 'MEDIUM';
    }

    await UPDATE(ClusterArtifacts)
      .set({ iflowClusterSeverity: severity })
      .where({ ID: relation.ID });
  }
}