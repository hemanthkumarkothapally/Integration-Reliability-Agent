import cds from '@sap/cds';
import { getDestination } from '@sap-cloud-sdk/connectivity';
import { executeHttpRequest } from '@sap-cloud-sdk/http-client';
import { runPoll } from './utils/log-helper.js';
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
    const summary = {

        TokenConsumption:
            aiMetrics.reduce(
                (s, r) => s + (r.totalTokens || 0),
                0
            ),

        hanaStorage: 0,

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

    const hanaStorage = [];

    const hanaStorageConfig = {
        labels: {}
    };

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

            const tenantResults = await runPoll({srv,
            Incidents,
            IncidentClusters,
            Playbooks,
            MonitoredArtifacts,
            ClusterArtifacts,
            tenant});

            allResults.push(...tenantResults);

          } catch (err) {

            console.error(
              `Polling failed for tenant ${tenant.tenantName}`,
              err
            );

            // Continue with next tenant
          }
        }

        console.log(`Total Failed Logs Processed: ${allResults.length}`);
        console.log("========== getFailedLogs BACKGROUND SUCCESS ==========");
                return {status: 'success', processedLogs: allResults.length};


      } catch (err) {

        console.error("========== getFailedLogs BACKGROUND FAILED ==========");
        console.error(err);
        return {status: 'error', message: err.message || 'An error occurred during manual polling.'};

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
});
