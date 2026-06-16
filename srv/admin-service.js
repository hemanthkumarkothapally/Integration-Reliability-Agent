import cds from '@sap/cds';
import { getDestination } from '@sap-cloud-sdk/connectivity';
import { executeHttpRequest } from '@sap-cloud-sdk/http-client';
import { runPoll } from './utils/log-helper.js';
import JobSchedulerClient from "@sap/jobs-client";
import xsenv from "@sap/xsenv";
export default cds.service.impl(async function () {
    const db = await cds.connect.to('db');

    const {
        Tenants,
        Incidents,
        IncidentClusters,
        Playbooks,
        MonitoredArtifacts,
        ClusterArtifacts, DailyMetrics, DailyAIMetrics
    } = db.entities('com.cytechies.integration.reliability');
    const srv = this;
    this.on("getUsageAnalytics", async (req) => {
        const {
            fromDate,
            toDate
        } = req.data;

        const metrics = await SELECT
            .from(DailyMetrics)
            .where({
                metricDate: {
                    between: fromDate,
                    and: toDate
                }
            })
            .orderBy("metricDate");

        const aiMetrics = await SELECT
            .from(DailyAIMetrics)
            .where({
                metricDate: {
                    between: fromDate,
                    and: toDate
                }
            })
            .orderBy("metricDate");

        const db = await cds.connect.to('db');

        const storageTables = await db.run(`
    SELECT
        TABLE_NAME,
        ROUND(TABLE_SIZE / 1024 / 1024 / 1024, 3) AS SIZE_GB
    FROM M_TABLES
    WHERE SCHEMA_NAME = CURRENT_SCHEMA
      AND TABLE_SIZE > 0
    ORDER BY TABLE_SIZE DESC
`);

        const totalStorageGB =
            storageTables.reduce(
                (sum, t) => sum + Number(t.SIZE_GB || 0),
                0
            );
        const summary = {

            TokenConsumption:
                aiMetrics.reduce(
                    (s, r) => s + (r.totalTokens || 0),
                    0
                ),

            hanaStorage:
                Number(totalStorageGB.toFixed(3)),

            totalIncidents:
                metrics.reduce(
                    (s, r) => s + (r.newIncidents || 0),
                    0
                ),

            totalClusters:
                metrics.reduce(
                    (s, r) => s + (r.newClusters || 0),
                    0
                )
        };

        const totalChatSessions =
            aiMetrics.reduce(
                (s, r) => s + (r.totalChatSessions || 0),
                0
            );

        const days =
            Math.max(metrics.length, 1);

        const supportingMetrics = {

            AverageTokensPerChatSession:
                totalChatSessions > 0
                    ? Math.round(
                        summary.TokenConsumption /
                        totalChatSessions
                    )
                    : 0,

            AverageTokensPerCluster:
                summary.totalClusters > 0
                    ? Math.round(
                        summary.TokenConsumption /
                        summary.totalClusters
                    )
                    : 0,

            AverageHANAGrowthPerDay: 0,

            AverageTokensPerDay:
                Math.round(
                    summary.TokenConsumption /
                    days
                ),

            AverageIncidentsPerDay:
                Math.round(
                    summary.totalIncidents /
                    days
                ),

            AverageClusterResolution:
                metrics.length
                    ? Number(
                        (
                            metrics.reduce(
                                (s, r) =>
                                    s +
                                    Number(
                                        r.averageResolutionHours || 0
                                    ),
                                0
                            ) / metrics.length
                        ).toFixed(2)
                    )
                    : 0
        };

        const tokenUsage = aiMetrics.map(metric => ({

            date:
                new Date(metric.metricDate)
                    .toLocaleDateString(
                        "en-US",
                        {
                            month: "short",
                            day: "numeric"
                        }
                    ),

            input:
                metric.totalInputTokens || 0,

            output:
                metric.totalOutputTokens || 0

        }));

        const hanaStorage = [{
            date: new Date().toLocaleDateString(
                "en-US",
                {
                    month: "short",
                    day: "numeric"
                }
            )
        }];

        const hanaStorageConfig = {
            labels: {}
        };

        storageTables.forEach((table, index) => {

            const key = `table${index + 1}`;

            hanaStorage[0][key] =
                Number(table.SIZE_GB);

            hanaStorageConfig.labels[key] =
                table.TABLE_NAME
                    .replace(
                        "COM_CYTECHIES_INTEGRATION_RELIABILITY_",
                        ""
                    );
        });

        const topConsumers = [

            {
                name: "AI Recommendations",
                roles: [
                    "Cluster Recommendations"
                ],
                amount: String(
                    aiMetrics.reduce(
                        (s, r) =>
                            s +
                            (r.recommendationsGenerated || 0),
                        0
                    )
                )
            },

            {
                name: "Chat Sessions",
                roles: [
                    "AI Chat"
                ],
                amount: String(
                    totalChatSessions
                )
            },

            {
                name: "User Messages",
                roles: [
                    "Prompt Requests"
                ],
                amount: String(
                    aiMetrics.reduce(
                        (s, r) =>
                            s +
                            (r.totalUserMessages || 0),
                        0
                    )
                )
            },

            {
                name: "AI Messages",
                roles: [
                    "Responses"
                ],
                amount: String(
                    aiMetrics.reduce(
                        (s, r) =>
                            s +
                            (r.totalAIMessages || 0),
                        0
                    )
                )
            }

        ];

        return {

            summary,

            supportingMetrics,

            tokenUsage,

            hanaStorage,

            hanaStorageConfig,

            topConsumers

        };

    });
    this.on('triggerManualPoll', async (req) => {

        try {

            const tenants = await SELECT.from(Tenants).where({ isActive: true });
            console.log(`Active Tenants Found: ${tenants.length}`);
            const allResults = [];

            for (const tenant of tenants) {

                try {

                    const tenantResults = await runPoll({
                        srv,
                        Incidents,
                        IncidentClusters,
                        Playbooks,
                        MonitoredArtifacts,
                        ClusterArtifacts,
                        tenant
                    });

                    allResults.push(...tenantResults);
                    await updateDailyMetrics(tenant.ID, {
                        pollRuns: 1,
                        lastPollAt: new Date(),
                        lastPollStatus: 'SUCCESS'
                    });

                } catch (err) {

                    console.error(
                        `Polling failed for tenant ${tenant.tenantName}`,
                        err
                    );
                    await updateDailyMetrics(tenant.ID, {
                        pollFailures: 1,
                        lastPollAt: new Date(),
                        lastPollStatus: 'FAILED'
                    });
                    // Continue with next tenant
                }
            }

            console.log(`Total Failed Logs Processed: ${allResults.length}`);
            console.log("========== getFailedLogs BACKGROUND SUCCESS ==========");
            return { status: 'success', processedLogs: allResults.length };


        } catch (err) {

            console.error("========== getFailedLogs BACKGROUND FAILED ==========");
            console.error(err);
            return { status: 'error', message: err.message || 'An error occurred during manual polling.' };

        }
    });
    this.on('getDestinations', async (req) => {
        const destinationService = await getDestination({ destinationName: 'Destination_Service' });
        const destinations = await executeHttpRequest(destinationService, {
            method: 'GET',
            url: '/destination-configuration/v1/subaccountDestinations'
        });
        return destinations.data.map(d => ({
            Name: d.Name,
            Type: d.Type,
            URL: d.URL,
            Description: d.Description || ''
        }));
    });
    this.after('UPDATE', 'ApplicationSettings', async (data, req) => {
        console.log('UPDATE FIRED');
        console.log(data);
        const { ID, settingValue } = data;
        if (ID !== 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') return;
        console.log(`Updating polling schedule to every ${settingValue} minutes...`);
        const minutes = parseInt(settingValue, 10);
        if (!Number.isInteger(minutes) || minutes < 5 || minutes > 180) {
            return req.error(400, `Invalid polling interval: ${settingValue}`);
        }

        try {
            const { jobscheduler } = xsenv.getServices({ jobscheduler: { label: 'jobscheduler' } });
            console.log(`Connecting to Job Scheduler at ${jobscheduler.url}...`);
            const scheduler = new JobSchedulerClient.Scheduler(jobscheduler);
            const JOB_ID = process.env.JOB_ID;
            const SCHEDULE_ID = process.env.JOB_SCHEDULE_ID;
            const schedule = {
                repeatInterval: `${minutes} minutes`,
                active: true,
                description: `Recurring Schedule (Repeat Interval) - ${minutes} mins`
            };

            await new Promise((resolve, reject) =>
                scheduler.updateJobSchedule(
                    { jobId: JOB_ID, scheduleId: SCHEDULE_ID, schedule },
                    (err, res) => (err ? reject(err) : resolve(res))
                )
            );
            console.log(`Polling schedule updated successfully to every ${minutes} minutes.`);
            req.info(`Polling schedule updated to every ${minutes} minutes`);
        } catch (e) {
            // JSS failed → fail the request so DB and scheduler don't drift apart
            req.error(502, `Failed to update polling schedule: ${e.message}`);
        }
    });
    this.on('testHanaStorage', async () => {

       const db = await cds.connect.to('db');

const storageTables = await db.run(`
    SELECT
        TABLE_NAME,
        ROUND(TABLE_SIZE / 1024 / 1024 / 1024, 3) AS SIZE_GB
    FROM M_TABLES
    WHERE SCHEMA_NAME = CURRENT_SCHEMA
      AND TABLE_SIZE > 0
    ORDER BY TABLE_SIZE DESC
`);

const totalStorageGB =
    storageTables.reduce(
        (sum, t) => sum + Number(t.SIZE_GB || 0),
        0
    );const hanaStorage = [{
    date: new Date().toLocaleDateString(
        "en-US",
        {
            month: "short",
            day: "numeric"
        }
    )
}];

const hanaStorageConfig = {
    labels: {}
};

storageTables.forEach((table, index) => {

    const key = `table${index + 1}`;

    hanaStorage[0][key] =
        Number(table.SIZE_GB);

    hanaStorageConfig.labels[key] =
        table.TABLE_NAME
            .replace(
                "COM_CYTECHIES_INTEGRATION_RELIABILITY_",
                ""
            );
});


        return JSON.stringify({
             totalStorageGB: Number(totalStorageGB.toFixed(3)),
    hanaStorage,
    hanaStorageConfig
        });
    });
});
