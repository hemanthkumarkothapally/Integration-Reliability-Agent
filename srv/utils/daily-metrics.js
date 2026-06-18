import cds from '@sap/cds';

export async function updateDailyMetrics(
    tenantId,
    updates
) {
    const { MonitoredArtifacts, Tenants } = cds.entities('com.cytechies.integration.reliability');

    const today =
        new Date().toISOString().split('T')[0];

    const { DailyMetrics } =
        cds.entities('com.cytechies.integration.reliability');

    let metric =
        await SELECT.one.from(DailyMetrics)
            .where({
                metricDate: today,
                tenant_ID: tenantId
            });

    if (!metric) {

        await INSERT.into(DailyMetrics).entries({
            metricDate: today,
            tenant_ID: tenantId
        });

        metric =
            await SELECT.one.from(DailyMetrics)
                .where({
                    metricDate: today,
                    tenant_ID: tenantId
                });
    }

    const updatePayload = {};

    Object.entries(updates).forEach(async ([k, v]) => {
        if (k === 'lastPollAt' || k === 'lastPollStatus') {
            updatePayload[k] = v;
        }
        else {

            updatePayload[k] =
                (metric[k] || 0) + v;
        }
    });
    const startDate = new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = new Date(new Date().setHours(23, 59, 59, 999));

    const healthyArtifacts = await SELECT.from(MonitoredArtifacts)
        .where({
            tenant_ID: tenantId,
            overallSeverity: 'HEALTHY',
            modifiedAt: {
                between: startDate.toISOString(),
                and: endDate.toISOString()
            }
        });

    const criticalArtifacts = await SELECT.from(MonitoredArtifacts)
        .where({
            tenant_ID: tenantId,
            overallSeverity: 'CRITICAL',
            modifiedAt: {
                between: startDate.toISOString(),
                and: endDate.toISOString()
            }
        });


    updatePayload.healthyArtifacts = healthyArtifacts.length;
    updatePayload.criticalArtifacts = criticalArtifacts.length;
    const db = await cds.connect.to('db');
    const storageTables =
        await db.run(`
    SELECT
        ROUND(SUM(TABLE_SIZE) / 1024 / 1024 / 1024, 3) AS SIZE_GB
    FROM M_TABLES
    WHERE SCHEMA_NAME = CURRENT_SCHEMA

 
`);
    const totalUsedSize = parseFloat(storageTables[0].SIZE_GB || 0);

    console.log("SIZE_GB:", storageTables[0].SIZE_GB);
    console.log("totalUsedSize:", totalUsedSize);
    console.log("typeof:", typeof totalUsedSize);

    updatePayload.hanaStorage = totalUsedSize;

    console.log("updatePayload:", JSON.stringify(updatePayload, null, 2));
    await UPDATE(DailyMetrics)
        .set(updatePayload)
        .where({ ID: metric.ID });
}

export async function updateDailyAIMetrics(
    updates
) {
    const { DailyAIMetrics } = cds.entities('com.cytechies.integration.reliability');
    const today =
        new Date().toISOString().split('T')[0];

    let metric =
        await SELECT.one.from(DailyAIMetrics)
            .where({ metricDate: today });

    if (!metric) {
        await INSERT.into(DailyAIMetrics).entries({
            metricDate: today
        });

        metric =
            await SELECT.one.from(DailyAIMetrics)
                .where({ metricDate: today });
    }

    const updatePayload = {};

    Object.entries(updates).forEach(([k, v]) => {
        updatePayload[k] =
            (metric[k] || 0) + v;
    });

    await UPDATE(DailyAIMetrics)
        .set(updatePayload)
        .where({ ID: metric.ID });
}