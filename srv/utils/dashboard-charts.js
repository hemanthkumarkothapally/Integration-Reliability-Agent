export async function getIncidentTrend(Incidents, tenantId) {
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const now = new Date();

    // ── FIX: ceil "now" to the next full hour so partial hours get their bucket ──
    // e.g. 12:18 IST → ceiling → 13:00 IST
    const nowIST = new Date(now.getTime() + IST_OFFSET);
    const ceilIST = new Date(nowIST);
    if (ceilIST.getUTCMinutes() > 0 || ceilIST.getUTCSeconds() > 0) {
        ceilIST.setUTCMinutes(0, 0, 0);
        ceilIST.setUTCHours(ceilIST.getUTCHours() + 1); // push to next full hour
    }
    // Convert ceiling back to UTC for range calculations
    const ceilUTC = new Date(ceilIST.getTime() - IST_OFFSET);

    // Five hours back from the ceiling (not from raw now)
    const fiveHoursAgo = new Date(ceilUTC.getTime() - 5 * 60 * 60 * 1000);

    // 1. Build 6 buckets: fiveHoursAgo → ceilUTC, all expressed in IST labels
    const buckets = {};
    for (let i = 0; i <= 5; i++) {
        const d = new Date(fiveHoursAgo.getTime() + i * 60 * 60 * 1000);
        const istDate = new Date(d.getTime() + IST_OFFSET);
        const hourLabel = istDate.getUTCHours().toString().padStart(2, '0') + ':00';
        buckets[hourLabel] = { hour: hourLabel, totalIncidents: 0, openIncidents: 0 };
    }

    // 2. Query UTC range — upper bound is ceilUTC (not now) so we capture the full partial hour
    const where = [
        { ref: ['createdAt'] }, '>=', { val: fiveHoursAgo.toISOString() },
        'and',
        { ref: ['createdAt'] }, '<=', { val: ceilUTC.toISOString() }  // ← was: now.toISOString()
    ];
    if (tenantId && tenantId !== 'ALL') {
        where.push('and', { ref: ['tenant_ID'] }, '=', { val: tenantId });
    }

    const incidentData = await SELECT.from(Incidents).where(where);

    // 3. Map incidents to IST buckets (unchanged)
    incidentData.forEach(i => {
        const dateUTC = new Date(i.createdAt);
        const dateIST = new Date(dateUTC.getTime() + IST_OFFSET);
        const bucket = dateIST.getUTCHours().toString().padStart(2, '0') + ':00';
        if (buckets[bucket]) {
            buckets[bucket].totalIncidents++;
            if (i.status !== 'RESOLVED') {
                buckets[bucket].openIncidents++;
            }
        }
    });

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