async function getSetting(key, defaultValue, ApplicationSettings) {
    const setting = await SELECT.one
        .from(ApplicationSettings)
        .where({ settingKey: key });

    return setting?.settingValue ?? defaultValue;
}
export async function cleanupData( Incidents, Clusters, Recommendations,ApplicationSettings) {

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

   ;

    const deletedIncidents =
        await DELETE.from(Incidents)
            .where({
                modifiedAt: {
                    "<": incidentCutoff.toISOString()
                },
                status: "RESOLVED"
            });

    const deletedClusters =
        await DELETE.from(Clusters)
            .where({
                modifiedAt: {
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