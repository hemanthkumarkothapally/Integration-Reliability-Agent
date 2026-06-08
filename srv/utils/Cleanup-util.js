async function getSetting(key, defaultValue, ApplicationSettings) {
    const setting = await SELECT.one
        .from(ApplicationSettings)
        .where({ settingKey: key });

    return setting?.settingValue ?? defaultValue;
}
export async function cleanupData( Incidents, Clusters,ApplicationSettings) {

    const incidentRetentionDays = Number(
        await getSetting(
            "INCIDENT_RETENTION_DAYS",
            1,
            ApplicationSettings
        )
    );

    const clusterRetentionDays = Number(
        await getSetting(
            "CLUSTER_RETENTION_DAYS",
            1,
            ApplicationSettings
        )
    );

    const monitoringRetentionDays = Number(
        await getSetting(
            "MONITORING_RETENTION_DAYS",
            1,
            ApplicationSettings
        )
    );

    const incidentCutoff = new Date();
    incidentCutoff.setDate(
        incidentCutoff.getDate() -
        incidentRetentionDays
    );

    const clusterCutoff = new Date();
    clusterCutoff.setDate(
        clusterCutoff.getDate() -
        clusterRetentionDays
    );

    const monitoringCutoff = new Date();
    monitoringCutoff.setDate(
        monitoringCutoff.getDate() -
        monitoringRetentionDays
    );

    const deletedIncidents =
        await DELETE.from(Incidents)
            .where({
                ModifiedAt: {
                    "<": incidentCutoff.toISOString()
                },
                status: "RESOLVED"
            });

    const deletedClusters =
        await DELETE.from(Clusters)
            .where({
                ModifiedAt: {
                    "<": clusterCutoff.toISOString()
                },
                globalStatus: "RESOLVED"
            });
    console.log(
        `Retention cleanup completed:
         Incidents=${deletedIncidents},
         Clusters=${deletedClusters}`
    );
    return `Deleted Incidents: ${deletedIncidents}, Deleted Clusters: ${deletedClusters}`;
}