import cds from '@sap/cds';

export default cds.service.impl(async function () {

    const { IncidentClusters } = this.entities;

    const { Incidents } =
        cds.entities('com.cytechies.integration.reliability');

    this.after('READ', IncidentClusters, async (data) => {  // ← add async

        const records = Array.isArray(data) ? data : [data];
        if (!records.length || !records[0]) return;

        // ── KPI queries ───────────────────────────────────────────────────────
        const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [{ count: totalIncidents24h }, { count: activeClusters }, { count: criticalCount }, { count: resolved24h }] = await Promise.all([

            SELECT.one.from(Incidents)
                .columns('count(*) as count')
                .where('logEnd >', past24h),

            SELECT.one.from(IncidentClusters)
                .columns('count(*) as count')
                .where('status !=', 'RESOLVED'),

            SELECT.one.from(IncidentClusters)
                .columns('count(*) as count')
                .where({ status: { '!=': 'RESOLVED' }, severity: 'CRITICAL' }),

            SELECT.one.from(IncidentClusters)
                .columns('count(*) as count')
                .where('status =', 'RESOLVED')
                .and('modifiedAt >', past24h)
        ]);

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
});