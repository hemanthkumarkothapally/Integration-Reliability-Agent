export async function refreshClusterSeverity(
    IncidentClusters,
    tenant
) {

    const clusters =
        await SELECT
            .from(IncidentClusters)
            .where({

                tenant_ID:
                    tenant.ID,

                globalStatus: {
                    '!=': 'RESOLVED'
                }
            });

    if (!clusters.length) {

        console.log(
            `No active clusters found for tenant ${tenant.tenantName}`
        );

        return;
    }

    const counts =
        clusters.map(
            c => c.incidentCount || 0
        );

    const mean =
        counts.reduce(
            (a, b) => a + b,
            0
        ) / counts.length;

    const variance =
        counts.reduce(
            (sum, value) =>
                sum +
                Math.pow(
                    value - mean,
                    2
                ),
            0
        ) / counts.length;

    const stdDev =
        Math.sqrt(variance);

    console.log({

        tenant:
            tenant.tenantName,

        mean:
            mean.toFixed(2),

        stdDev:
            stdDev.toFixed(2)
    });

    for (const cluster of clusters) {

        const count =
            cluster.incidentCount || 0;

        const zScore =
            stdDev === 0
                ? 0
                : (
                    count - mean
                ) / stdDev;

        let severity =
            'LOW';

        let criticality =
            5;

        if (zScore >= 2.0) {

            severity =
                'CRITICAL';

            criticality =
                1;
        }

        else if (zScore >= 1.5) {

            severity =
                'HIGH';

            criticality =
                2;
        }

        else if (zScore >= 1.0) {

            severity =
                'MEDIUM';

            criticality =
                3;
        }

        else if (count > 0) {

            severity =
                'LOW';

            criticality =
                5;
        }

        await UPDATE(
            IncidentClusters
        )
        .set({

            severity,

            severityCriticality:
                criticality
        })
        .where({

            ID:
                cluster.ID,

            tenant_ID:
                tenant.ID
        });

        // console.log(
        //     cluster.errorType,
        //     {
        //         incidentCount:
        //             count,

        //         zScore:
        //             Number(
        //                 zScore.toFixed(2)
        //             ),

        //         severity
        //     }
        // );
    }

    console.log(
        `Cluster severity refresh completed for tenant ${tenant.tenantName}`
    );
}