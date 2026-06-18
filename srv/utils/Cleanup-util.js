async function getSetting(key, defaultValue, ApplicationSettings) {
    const setting = await SELECT.one
        .from(ApplicationSettings)
        .where({ settingKey: key });

    return setting?.settingValue ?? defaultValue;
}

async function getRetentionDays(key, ApplicationSettings, fallback = 1) {
    const days = Number(await getSetting(key, fallback, ApplicationSettings));
    return Number.isFinite(days) && days >= 0 ? days : fallback;
}

function cutoffISO(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString();
}

export async function cleanupData(Incidents, Clusters, MonitoredArtifacts, ApplicationSettings) {
    const incidentRetentionDays = await getRetentionDays('INCIDENT_RETENTION_DAYS', ApplicationSettings);
    const clusterRetentionDays = await getRetentionDays('CLUSTER_RETENTION_DAYS', ApplicationSettings);
    const monitoringRetentionDays = await getRetentionDays('MONITORING_RETENTION_DAYS', ApplicationSettings);

    const deletedIncidents = await DELETE.from(Incidents).where({
        modifiedAt: { '<': cutoffISO(incidentRetentionDays) },
        status: 'RESOLVED'
    });

    const deletedClusters = await DELETE.from(Clusters).where({
        modifiedAt: { '<': cutoffISO(clusterRetentionDays) },
        globalStatus: 'RESOLVED'
    });

    const deletedIflowMonitoring = await DELETE.from(MonitoredArtifacts).where({
        lastPollTimestamp: { '<': cutoffISO(monitoringRetentionDays) },
        overallSeverity: 'HEALTHY'
    });

    console.log(
        `Retention cleanup completed: Incidents=${deletedIncidents}, ` +
        `Clusters=${deletedClusters}, Monitoring=${deletedIflowMonitoring}`
    );

    return `Deleted Incidents: ${deletedIncidents}, ` +
        `Deleted Clusters: ${deletedClusters}, ` +
        `Deleted Monitoring: ${deletedIflowMonitoring}`;
}