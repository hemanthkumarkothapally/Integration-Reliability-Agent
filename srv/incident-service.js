import cds from '@sap/cds';
import { generateClusterRecommendation } from './utils/ai-recommendation-util.js';
import { runPoll } from './utils/log-helper.js';
import { refreshArtifactDashboard } from './utils/clustering-util.js';
import { getIncidentTrend, getClusterSeverityChart, getIflowSeverityChart } from './utils/dashboard-charts.js';
export default cds.service.impl(async function () {

    const { IncidentClusters, Recommendations, Playbooks, MonitoredArtifacts, ClusterArtifacts } = this.entities;

    const { Incidents, TokenUsages } = cds.entities('com.cytechies.integration.reliability');
    this.after('READ', IncidentClusters, async (data) => {
        console.log("READ Event Triggered");

        const records = Array.isArray(data)
            ? data
            : [data];

        if (!records.length || !records[0]) {
            console.log("No Records Found");
            return;
        }
        const past24h = new Date(
            Date.now() - 24 * 60 * 60 * 1000
        );

        console.log("Past 24 Hours Time:", past24h);
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
            errorType: c.errorType || 'UNKNOWN',
            count: c.incidentCount || 0,
            severity: c.severity || 'LOW'
        }));
    });
    this.on('onReDiagnoseIncidentCluster', async (req) => {
        try {
            const { cluster_ID } = req.data;
            const cluster =
                await SELECT.one
                    .from(IncidentClusters)
                    .where({
                        ID: cluster_ID
                    });

            if (!cluster) {
                return req.error(
                    404,
                    'Cluster not found'
                );
            }
            /*
             * FETCH SAMPLE INCIDENTS
             */

            const incidents =
                await SELECT
                    .from(Incidents)
                    .where({
                        cluster_ID
                    })
                    .orderBy({
                        logEnd: 'desc'
                    })
                    .limit(2);

            /*
             * GENERATE AI RECOMMENDATION
             */

            const aiResult =
                await generateClusterRecommendation({
                    cluster,
                    incidents
                });

            console.log(
                "AI Recommendation:",
                aiResult
            );

            /*
             * STORE RECOMMENDATION
             */
            await UPDATE(Recommendations).where({ cluster_ID }
            ).set({
                rootCause:
                    aiResult.recommendation.rootCause,

                businessImpact:
                    aiResult.recommendation.businessImpact,

                remediationSteps:
                    JSON.stringify(
                        aiResult.recommendation.remediationSteps
                    ),

                affectedAdapter:
                    aiResult.recommendation.affectedAdapter,

                confidenceScore:
                    aiResult.recommendation.confidenceScore,

                generatedAt:
                    new Date()
            });


            await INSERT.into(
                TokenUsages
            ).entries({
                cluster_ID,
                ...aiResult.audit
            });
            return await SELECT.one
                .from(Recommendations)
                .where({
                    cluster_ID
                });

        } catch (error) {

            console.error(
                'AI recommendation generation failed:',
                error
            );

            req.error(
                500,
                'Recommendation generation failed'
            );
        }
    });
    this.on('triggerPoll', async () => {
        try {

            console.log("Manual poll triggered");

            let failedLogs = await runPoll({
                srv: this,
                Incidents,
                IncidentClusters,
                Playbooks,
                MonitoredArtifacts,
                ClusterArtifacts
            });

            console.log("Manual poll completed");
            return failedLogs;
        } catch (error) {

            console.error(
                "Manual poll failed:",
                error
            );
        }
    });


    this.on('resolveClusterForArtifact', async (req) => {
        const {
            clusterId,
            artifactId,
            note
        } = req.data;

        if (!clusterId) {
            req.error(400, 'clusterId is required');
        }

        if (!artifactId) {
            req.error(400, 'artifactId is required');
        }
        console.log("Resolving cluster for artifact:",
            { clusterId, artifactId }
        );
        const relation =
            await SELECT.one
                .from(ClusterArtifacts)
                .where({
                    cluster_ID:
                        clusterId,
                    artifact_ID:
                        artifactId
                });
        if (!relation) {
            req.error(
                404,
                'ClusterArtifact relation not found'
            );
        }

        await UPDATE(ClusterArtifacts)
            .set({
                resolutionStatus:
                    'RESOLVED',
                resolutionNote:
                    note || 'Resolved from UI'
            })
            .where({
                ID: relation.ID
            });
        const openRelations =
            await SELECT.from(ClusterArtifacts)
                .where({
                    cluster_ID:
                        clusterId,
                    resolutionStatus:
                        { '!=': 'RESOLVED' }
                });
        if (openRelations.length === 0) {
            await UPDATE(IncidentClusters)
                .set({
                    globalStatus:
                        'RESOLVED',
                    status:
                        'RESOLVED'
                })
                .where({
                    ID: clusterId
                });
        }
        else {
            await UPDATE(IncidentClusters)
                .set({
                    globalStatus:
                        'PARTIALLY_RESOLVED'
                })
                .where({
                    ID: clusterId
                });
        }
        const artifact =
            await SELECT.one
                .from(MonitoredArtifacts)
                .where({
                    ID: artifactId
                });

        if (artifact) {

            await UPDATE(Incidents)
                .set({
                    status: 'RESOLVED'
                })
                .where({
                    cluster_ID: clusterId,
                    iFlowName: artifact.iFlowName
                });
        }
        await refreshArtifactDashboard(
            MonitoredArtifacts,
            ClusterArtifacts,
            IncidentClusters
        );
        return 'Cluster resolved successfully';
    }
    );
    this.on('getDashboardCharts', async (req) => {

        const { tenantId } = req.data;

        const artifactFilter = {};
        const clusterFilter = {
            globalStatus: { '!=': 'RESOLVED' }
        };
        const incidentFilter = {
            status: { '!=': 'RESOLVED' }
        };

        if (tenantId) {
            artifactFilter.tenant_ID = tenantId;
            clusterFilter.tenant_ID = tenantId;
            incidentFilter.tenant_ID = tenantId;
        }

        const monitoredIflows =
            await SELECT.one
                .from(MonitoredArtifacts)
                .columns`count(*) as count`
                .where(artifactFilter);

        const openClusters =
            await SELECT.one
                .from(IncidentClusters)
                .columns`count(*) as count`
                .where(clusterFilter);

        const openIncidents =
            await SELECT.one
                .from(Incidents)
                .columns`count(*) as count`
                .where(incidentFilter);

        const criticalIflows =
            await SELECT.one
                .from(MonitoredArtifacts)
                .columns`count(*) as count`
                .where({
                    ...artifactFilter,
                    overallSeverity: 'CRITICAL'
                });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const resolvedToday =
            await SELECT.one
                .from(ClusterArtifacts)
                .columns`count(*) as count`
                .where({
                    resolutionStatus: 'RESOLVED',
                    modifiedAt: { '>=': today }
                });

        return {
            monitoredIflows:
                monitoredIflows?.count || 0,

            openClusters:
                openClusters?.count || 0,

            openIncidents:
                openIncidents?.count || 0,

            criticalIflows:
                criticalIflows?.count || 0,

            resolvedToday:
                resolvedToday?.count || 0,

            incidentTrend:
                await getIncidentTrend(
                    Incidents,
                    tenantId
                ),

            clusterSeverity:
                await getClusterSeverityChart(
                    IncidentClusters,
                    tenantId
                ),

            iflowSeverity:
                await getIflowSeverityChart(
                    MonitoredArtifacts,
                    tenantId
                )
        };
    });
    this.on('getTopCriticalIflows',
        async (req) => {

            const { tenantId } =
                req.data;
            const artifactFilter = {};
            if (tenantId) {
                artifactFilter.tenant_ID = tenantId;
            }
            const artifacts =
                await SELECT
                    .from(
                        MonitoredArtifacts
                    )
                    .columns(
                        'ID',
                        'iFlowName',
                        'PackageName',
                        'overallSeverity',
                        'openClusterCount',
                        'severityScore',
                        'severityZScore',
                        'lastPollTimestamp'
                    )
                    .where(artifactFilter);

            const relations =
                await SELECT
                    .from(
                        ClusterArtifacts
                    )
                    .columns(
                        'artifact_ID',
                        'incidentCount'
                    );

            const incidentMap = {};

            relations.forEach(r => {

                incidentMap[r.artifact_ID] =
                    (incidentMap[r.artifact_ID] || 0) +
                    (r.incidentCount || 0);
            });

            const priority = {
                CRITICAL: 4,
                HIGH: 3,
                MEDIUM: 2,
                LOW: 1,
                HEALTHY: 0
            };

            return artifacts
                .map(a => ({
                    ...a,
                    totalIncidents:
                        incidentMap[a.ID] || 0
                }))
                .sort((a, b) => {

                    const sevDiff =
                        priority[b.overallSeverity] -
                        priority[a.overallSeverity];

                    if (sevDiff !== 0) {
                        return sevDiff;
                    }

                    return (
                        (b.severityScore || 0) -
                        (a.severityScore || 0)
                    );
                })
                .slice(0, 5);
        }
    );
});