import cds from '@sap/cds';

export async function updateDailyMetrics(
    tenantId,
    updates
) {
    const { MouniteredArtifacts, Tenants } = cds.entities('com.cytechies.integration.reliability');

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

    Object.entries(updates).forEach(([k, v]) => {

        updatePayload[k] =
            (metric[k] || 0) + v;

    });
    const healthyArtifacts = await SELECT.from(MouniteredArtifacts)
        .where({
            tenant_ID: tenantId,
            status: 'HEALTHY',
            ModifiedAt: {
                '>=': new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
                '<=': new Date(new Date().setHours(23, 59, 59, 999)).toISOString()
            }
        }).count();
    const criticalArtifacts = await SELECT.from(MouniteredArtifacts)
        .where({
            tenant_ID: tenantId,
            status: 'CRITICAL',
            ModifiedAt: {
                '>=': new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
                '<=': new Date(new Date().setHours(23, 59, 59, 999)).toISOString()
            }
        }).count();

    updatePayload.healthyArtifacts = healthyArtifacts;
    updatePayload.criticalArtifacts = criticalArtifacts;
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