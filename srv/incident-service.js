import cds from '@sap/cds';
import { refreshArtifactDashboard } from './utils/clustering-util.js';
import { updateDailyMetrics } from './utils/daily-metrics.js';
import { getIncidentTrend, getClusterSeverityChart, getIflowSeverityChart } from './utils/dashboard-charts.js';

export default cds.service.impl(async function () {

  const { IncidentClusters, MonitoredArtifacts, ClusterArtifacts, Tenants } = this.entities;
  const { Incidents } = cds.entities('com.cytechies.integration.reliability');
  this.on('resolveClusterForArtifact', async (req) => {
    const { clusterId, artifactId, note } = req.data;

    // Validate input BEFORE touching the database.
    if (!clusterId) return req.error(400, 'clusterId is required');
    if (!artifactId) return req.error(400, 'artifactId is required');

    const artifact = await SELECT.one.from(MonitoredArtifacts).where({ ID: artifactId });
    if (!artifact) return req.error(404, 'Artifact not found');

    const tenant = await SELECT.one.from(Tenants).where({ ID: artifact.tenant_ID });

    console.log('Resolving cluster for artifact:', { clusterId, artifactId });

    const relation = await SELECT.one
      .from(ClusterArtifacts)
      .where({ cluster_ID: clusterId, artifact_ID: artifactId });
    if (!relation) return req.error(404, 'ClusterArtifact relation not found');

    await UPDATE(ClusterArtifacts)
      .set({
        resolutionStatus: 'RESOLVED',
        resolutionNote: note || 'Resolved from UI'
      })
      .where({ ID: relation.ID });

    await updateDailyMetrics(tenant.ID, { resolvedIflowClusters: 1 });

    // If every artifact relation on the cluster is resolved, close the cluster.
    const openRelations = await SELECT
      .from(ClusterArtifacts)
      .where({ cluster_ID: clusterId, resolutionStatus: { '!=': 'RESOLVED' } });

    if (openRelations.length === 0) {
      await UPDATE(IncidentClusters)
        .set({ globalStatus: 'RESOLVED', status: 'RESOLVED' })
        .where({ ID: clusterId });
      await updateDailyMetrics(tenant.ID, { resolvedClusters: 1 });
    } else {
      await UPDATE(IncidentClusters)
        .set({ globalStatus: 'PARTIALLY_RESOLVED' })
        .where({ ID: clusterId });
    }

    // Resolve the open incidents belonging to this artifact within the cluster.
    const resolvedCount = await SELECT
      .from(Incidents)
      .columns('ID')
      .where({ cluster_ID: clusterId, iFlowName: artifact.iFlowName, status: 'OPEN' });

    await UPDATE(Incidents)
      .set({ status: 'RESOLVED' })
      .where({ cluster_ID: clusterId, iFlowName: artifact.iFlowName });

    await updateDailyMetrics(tenant.ID, { resolvedIncidents: resolvedCount.length });

    await refreshArtifactDashboard(MonitoredArtifacts, ClusterArtifacts, IncidentClusters, tenant);

    return 'Cluster resolved successfully';
  });

  this.on('getDashboardCharts', async (req) => {
    const { tenantId } = req.data;

    const artifactFilter = {};
    const clusterFilter = { globalStatus: { '!=': 'RESOLVED' } };
    const incidentFilter = { status: { '!=': 'RESOLVED' } };

    if (tenantId) {
      artifactFilter.tenant_ID = tenantId;
      clusterFilter.tenant_ID = tenantId;
      incidentFilter.tenant_ID = tenantId;
    }

    const monitoredIflows = await SELECT.one
      .from(MonitoredArtifacts)
      .columns`count(*) as count`
      .where(artifactFilter);

    const openClusters = await SELECT.one
      .from(IncidentClusters)
      .columns`count(*) as count`
      .where(clusterFilter);

    const openIncidents = await SELECT.one
      .from(Incidents)
      .columns`count(*) as count`
      .where(incidentFilter);

    const criticalIflows = await SELECT.one
      .from(MonitoredArtifacts)
      .columns`count(*) as count`
      .where({ ...artifactFilter, overallSeverity: 'CRITICAL' });

    // NOTE: this counts ALL resolved relations, not just today's (see review notes).
    let resolvedToday;
    if (tenantId) {
      const artifactIds = await SELECT
        .from(MonitoredArtifacts)
        .columns('ID')
        .where({ tenant_ID: tenantId });

      resolvedToday = await SELECT.one
        .from(ClusterArtifacts)
        .columns`count(*) as count`
        .where({
          resolutionStatus: 'RESOLVED',
          artifact_ID: { in: artifactIds.map(a => a.ID) }
        });
    } else {
      resolvedToday = await SELECT.one
        .from(ClusterArtifacts)
        .columns`count(*) as count`
        .where({ resolutionStatus: 'RESOLVED' });
    }

    return {
      monitoredIflows: monitoredIflows?.count || 0,
      openClusters: openClusters?.count || 0,
      openIncidents: openIncidents?.count || 0,
      criticalIflows: criticalIflows?.count || 0,
      resolvedToday: resolvedToday?.count || 0,
      incidentTrend: await getIncidentTrend(Incidents, tenantId),
      clusterSeverity: await getClusterSeverityChart(IncidentClusters, tenantId),
      iflowSeverity: await getIflowSeverityChart(MonitoredArtifacts, tenantId)
    };
  });

  this.on('getTopCriticalIflows', async (req) => {
    const { tenantId } = req.data;

    const artifactFilter = {};
    if (tenantId) artifactFilter.tenant_ID = tenantId;

    const artifacts = await SELECT
      .from(MonitoredArtifacts)
      .columns(
        'ID',
        'iFlowName',
        'PackageName',
        'overallSeverity',
        'openClusterCount',
        'severityScore',
        'severityZScore',
        'lastErrorAt'
      )
      .where(artifactFilter);

    const relations = await SELECT
      .from(ClusterArtifacts)
      .columns('artifact_ID', 'incidentCount');

    const incidentMap = {};
    for (const r of relations) {
      incidentMap[r.artifact_ID] = (incidentMap[r.artifact_ID] || 0) + (r.incidentCount || 0);
    }

    const priority = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, HEALTHY: 0 };

    return artifacts
      .map(a => ({ ...a, totalIncidents: incidentMap[a.ID] || 0 }))
      .sort((a, b) => {
        const sevDiff = priority[b.overallSeverity] - priority[a.overallSeverity];
        if (sevDiff !== 0) return sevDiff;
        return (b.severityScore || 0) - (a.severityScore || 0);
      })
      .slice(0, 5);
  });
});