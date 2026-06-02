export async function getIncidentTrend(
    Incidents,
    tenantId
) {
    // 1. Calculate the cutoff (Current Time - 5 Hours)
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const now = new Date();

    // 2. Initialize buckets ONLY for the last 5 hours
    const buckets = {};
    for (let i = 0; i <= 5; i++) {
        const d = new Date(fiveHoursAgo.getTime() + i * 60 * 60 * 1000);
        const hourLabel = d.getUTCHours().toString().padStart(2, '0') + ':00';
        buckets[hourLabel] = {
            hour: hourLabel,
            totalIncidents: 0,
            openIncidents: 0
        };
    }

    // 3. Fetch incidents within this specific 5-hour window
    const where = [
        { ref: ['createdAt'] }, '>=', { val: fiveHoursAgo.toISOString() },
        'and',
        { ref: ['createdAt'] }, '<=', { val: now.toISOString() }
    ];

    if (tenantId) {
        where.push(
            'and',
            { ref: ['tenant_ID'] }, '=', { val: tenantId }
        );
    }

    const incidentData =
        await SELECT
            .from(Incidents)
            .where(where);


    // 4. Populate buckets
    incidentData.forEach(i => {
        const date = new Date(i.createdAt);
        const bucket = date.getUTCHours().toString().padStart(2, '0') + ':00';

        if (buckets[bucket]) {
            buckets[bucket].totalIncidents++;

            if (i.status !== 'RESOLVED') {
                buckets[bucket].openIncidents++;
            }
        }
    });

    // 5. Sort to ensure chronological order and return
    return Object.values(buckets).sort((a, b) => a.hour.localeCompare(b.hour));
}
export async function getClusterSeverityChart(
    IncidentClusters,
    tenantId
) {

    const filter = {
        globalStatus: {
            '!=': 'RESOLVED'
        }
    };

    if (tenantId) {
        filter.tenant_ID = tenantId;
    }

    const clusters =
        await SELECT
            .from(IncidentClusters)
            .columns('severity')
            .where(filter);

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
    MonitoredArtifacts,
    tenantId
) {

    const filter = {};

    if (tenantId) {
        filter.tenant_ID = tenantId;
    }

    const artifacts =
        await SELECT
            .from(MonitoredArtifacts)
            .columns('overallSeverity')
            .where(filter);

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