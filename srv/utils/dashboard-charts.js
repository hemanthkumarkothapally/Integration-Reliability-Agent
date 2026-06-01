export async function getIncidentTrend(
    Incidents
) {

    /*
     * ----------------------------------------
     * TODAY 00:00:00
     * ----------------------------------------
     */

    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );

    const incidents =
        await SELECT
            .from(Incidents)
            .where({
                createdAt: {
                    '>=': today
                }
            })
            .columns(
                'createdAt',
                'status'
            );

    /*
     * ----------------------------------------
     * CREATE TODAY'S 2-HOUR BUCKETS
     * ----------------------------------------
     */

    const buckets = {};

    for (
        let hour = 0;
        hour < 24;
        hour += 2
    ) {

        const bucket =
            hour
                .toString()
                .padStart(2, '0') +
            ':00';

        buckets[bucket] = {

            time: bucket,

            totalIncidents: 0,

            openIncidents: 0
        };
    }

    /*
     * ----------------------------------------
     * POPULATE BUCKETS
     * ----------------------------------------
     */

    incidents.forEach(i => {

        const date =
            new Date(
                i.createdAt
            );

        const bucketHour =
            Math.floor(
                date.getHours() / 2
            ) * 2;

        const bucket =
            bucketHour
                .toString()
                .padStart(2, '0') +
            ':00';

        buckets[bucket]
            .totalIncidents++;

        if (
            i.status !==
            'RESOLVED'
        ) {

            buckets[bucket]
                .openIncidents++;
        }
    });

    return Object.values(
        buckets
    );
}
export async function getClusterSeverityChart(
    IncidentClusters
) {

    const clusters =
        await SELECT
            .from(
                IncidentClusters
            )
            .columns(
                'severity'
            )
            .where({
                globalStatus: {
                    '!=':
                    'RESOLVED'
                }
            });

    const result = {

        CRITICAL: 0,

        HIGH: 0,

        MEDIUM: 0,

        LOW: 0
    };

    clusters.forEach(c => {

        if (
            result[c.severity] !==
            undefined
        ) {

            result[c.severity]++;
        }
    });

    return Object.entries(
        result
    ).map(
        ([severity, count]) => ({

            severity,

            count
        })
    );
}
export async function getIflowSeverityChart(
    MonitoredArtifacts
) {

    const artifacts =
        await SELECT
            .from(
                MonitoredArtifacts
            )
            .columns(
                'overallSeverity'
            );

    const result = {

        CRITICAL: 0,

        HIGH: 0,

        MEDIUM: 0,

        LOW: 0,

        HEALTHY: 0
    };

    artifacts.forEach(a => {

        const sev =
            a.overallSeverity;

        if (
            result[sev] !==
            undefined
        ) {

            result[sev]++;
        }
    });

    return Object.entries(
        result
    ).map(
        ([severity, count]) => ({

            severity,

            count
        })
    );
}