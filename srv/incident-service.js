import cds from '@sap/cds';

export default cds.service.impl(async function () {

    const { IncidentClusters } = this.entities;

    const { Incidents } = cds.entities('com.cytechies.integration.reliability');
    this.after('READ', IncidentClusters, async (data) => {  // ← add async

        // const records = Array.isArray(data) ? data : [data];
        // if (!records.length || !records[0]) return;

        // // ── KPI queries ───────────────────────────────────────────────────────
        // const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // const [{ count: totalIncidents24h }, { count: activeClusters }, { count: criticalCount }, { count: resolved24h }] = await Promise.all([

        //     SELECT.one.from(Incidents)
        //         .columns('count(*) as count')
        //         .where('logEnd >', past24h),

        //     SELECT.one.from(IncidentClusters)
        //         .columns('count(*) as count')
        //         .where`upper(status) != 'RESOLVED'`,

        //     SELECT.one.from(IncidentClusters)
        //         .columns('count(*) as count')
        //         .where`upper(status) != 'RESOLVED' and upper(severity) = 'CRITICAL'`,

        //     SELECT.one.from(IncidentClusters)
        //         .columns('count(*) as count')
        //        .where`upper(status) = 'RESOLVED'`
        //         .and('modifiedAt >', past24h)
        // ]);


        console.log("READ Event Triggered");

        const records = Array.isArray(data)
            ? data
            : [data];

        if (!records.length || !records[0]) {

            console.log("No Records Found");

            return;
        }

        // ---------------------------------------------------
        // Last 24 Hours
        // ---------------------------------------------------

        const past24h = new Date(
            Date.now() - 24 * 60 * 60 * 1000
        );

        console.log("Past 24 Hours Time:", past24h);

        // ---------------------------------------------------
        // KPI Queries
        // ---------------------------------------------------

        const totalIncidentsQuery =
            SELECT.one.from(Incidents)
                .columns('count(*) as count')
                .where('logEnd >', past24h);

        const activeClustersQuery =
            SELECT.one.from(IncidentClusters)
                .columns('count(*) as count')
                .where`upper(status) != 'RESOLVED'`;

        const criticalCountQuery =
            SELECT.one.from(IncidentClusters)
                .columns('count(*) as count')
                .where`
                    upper(status) != 'RESOLVED'
                    and upper(severity) = 'CRITICAL'
                `;

        const resolved24hQuery =
            SELECT.one.from(IncidentClusters)
                .columns('count(*) as count')
                .where`upper(status) = 'RESOLVED'`
                .and('modifiedAt >', past24h);

        console.log("Executing KPI Queries...");

        // ---------------------------------------------------
        // Execute Queries
        // ---------------------------------------------------

        const [
            { count: totalIncidents24h },
            { count: activeClusters },
            { count: criticalCount },
            { count: resolved24h }

        ] = await Promise.all([

            totalIncidentsQuery,
            activeClustersQuery,
            criticalCountQuery,
            resolved24hQuery

        ]);

        // ---------------------------------------------------
        // Console Logs
        // ---------------------------------------------------

        console.log("--------------------------------");
        console.log("KPI QUERY RESULTS");
        console.log("--------------------------------");

        console.log(
            "Total Incidents (24h):",
            totalIncidents24h
        );

        console.log(
            "Active Clusters:",
            activeClusters
        );

        console.log(
            "Critical Count:",
            criticalCount
        );

        console.log(
            "Resolved (24h):",
            resolved24h
        );

        console.log("--------------------------------");


        // ── Stamp every row ───────────────────────────────────────────────────
        records.forEach(record => {

            // Your existing severity criticality logic — unchanged
            switch (record.severity) {
                case 'CRITICAL': record.severityCriticality = 1; break;
                case 'HIGH': record.severityCriticality = 2; break;
                case 'MEDIUM': record.severityCriticality = 3; break;
                case 'LOW': record.severityCriticality = 5; break;
                default: record.severityCriticality = 0;
            }

            // KPI values — same on every row, Fiori reads from row[0]
            record.totalIncidents24h = Number(totalIncidents24h) || 0;
            record.activeClusters = Number(activeClusters) || 0;
            record.criticalCount = Number(criticalCount) || 0;
            record.resolved24h = Number(resolved24h) || 0;

            // CRITICAL tile colour: red when >0, green when clear
            record.criticalCriticality = record.criticalCount > 0 ? 1 : 3;
        });
    });
    // srv/incident-service.js

  this.on('GetIncidentChartData', async (req) => {

    const today = new Date();

    const allClusters = await SELECT
        .from('com.cytechies.integration.reliability.IncidentClusters')
        .columns('ID', 'severity', 'status', 'incidentCount', 'lastSeen');

    const clusterMap = Object.fromEntries(
        allClusters.map(c => [c.ID, c])
    );

    /*
     * --------------------------------------------------
     * SEVERITY SUMMARY
     * --------------------------------------------------
     */
    const sevenDaysAgoDate = new Date();
    sevenDaysAgoDate.setDate(today.getDate() - 6);
    sevenDaysAgoDate.setHours(0, 0, 0, 0);

    const severityMap = { Critical: 0, High: 0, Medium: 0, Low: 0, Resolved: 0 };

    for (const c of allClusters) {
        if (!c.lastSeen) continue;
        if (new Date(c.lastSeen) < sevenDaysAgoDate) continue;

        // 👇 normalize to title case
        const sev = c.status === 'RESOLVED'
            ? 'Resolved'
            : toTitleCase(c.severity);

        if (sev in severityMap) severityMap[sev] += (c.incidentCount || 1);
    }

    const severityData = Object.entries(severityMap)
        .map(([severity, count]) => ({ severity, count }));

    /*
     * --------------------------------------------------
     * TREND DATA
     * --------------------------------------------------
     */
const trendData = [];

for (let i = 6; i >= 0; i--) {

    const dayStart = new Date();

    dayStart.setDate(today.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);

    dayEnd.setHours(23, 59, 59, 999);

    const incidents = await SELECT
        .from('com.cytechies.integration.reliability.Incidents')
        .columns('ID', 'cluster_ID')
        .where`
            logEnd >= ${dayStart.toISOString()}
            and logEnd <= ${dayEnd.toISOString()}
        `;

    const clusters = await SELECT
        .from('com.cytechies.integration.reliability.IncidentClusters')
        .columns('ID')
        .where`
            createdAt >= ${dayStart.toISOString()}
            and createdAt <= ${dayEnd.toISOString()}
        `;
    const label = i === 0 ? 'Today'
                    : i === 1 ? 'Yesterday'
                    : `${i} Days Ago`;
    trendData.push({
        DAY: label,
        INCIDENTCOUNT: incidents.length,
        CLUSTERCOUNT: clusters.length
    });
}
    return { severityData, trendData };
});

// helper
function toTitleCase(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function sevenDaysAgo() {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
}
this.on('getPlatformOverview', async (req) => {

    const [
        incidents,
        clusters,
        artifacts,
        recommendations,
        playbooks,
        chatSessions
    ] = await Promise.all([

        SELECT.one.from('com.cytechies.integration.reliability.Incidents')
            .columns`count(ID) as count`,

        SELECT.one.from('com.cytechies.integration.reliability.IncidentClusters')
            .columns`count(ID) as count`,

        SELECT.one.from('com.cytechies.integration.reliability.MonitoredArtifacts')
            .columns`count(ID) as count`,

        SELECT.one.from('com.cytechies.integration.reliability.ClusterRecommendations')
            .columns`count(ID) as count`,

        SELECT.one.from('com.cytechies.integration.reliability.Playbooks')
            .columns`count(ID) as count`,

        SELECT.one.from('com.cytechies.integration.reliability.ChatSessions')
            .columns`count(ID) as count`
    ]);

    return [
        {
            category: 'Incidents',
            count: incidents.count
        },
        {
            category: 'Clusters',
            count: clusters.count
        },
        {
            category: 'Artifacts',
            count: artifacts.count
        },
        {
            category: 'Recommendations',
            count: recommendations.count
        },
        {
            category: 'Playbooks',
            count: playbooks.count
        },
        {
            category: 'Chat Sessions',
            count: chatSessions.count
        }
    ];

});
this.on('GetTopErrorTypes', async (req) => {

    const clusters = await SELECT
        .from('com.cytechies.integration.reliability.IncidentClusters')
        .columns('errorType', 'severity', 'incidentCount')
        .where({ status: { '!=': 'RESOLVED' } })
        .orderBy('incidentCount desc')
        .limit(5);

    return clusters.map(c => ({
        errorType : c.errorType || 'UNKNOWN',
        count     : c.incidentCount || 0,
        severity  : c.severity || 'LOW'
    }));
});
});