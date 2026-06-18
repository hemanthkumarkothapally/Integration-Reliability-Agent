using {com.cytechies.integration.reliability as IRA} from '../db/schema';

@path: '/Incident'
service IncidentService {
    entity Incidents          as projection on IRA.Incidents order by logEnd desc;

    // @requires                                  : 'Viewer'
    @Capabilities.FilterRestrictions.Filterable: true
    @Capabilities.SortRestrictions.Sortable    : true
    @Capabilities.TopSupported                 : true
    @Capabilities.SkipSupported                : true
    entity IncidentClusters   as
        projection on IRA.IncidentClusters {
            *,
            monitoredArtifacts                  : redirected to ClusterArtifacts,
            virtual null as totalIncidents24h   : Integer, // Incidents.logEnd > now-24h
            virtual null as activeClusters      : Integer, // status != 'RESOLVED'
            virtual null as criticalCount       : Integer, // active + severity = 'CRITICAL'
            virtual null as resolved24h         : Integer, // status='RESOLVED' + modifiedAt > now-24h
            virtual null as criticalCriticality : Integer
        };

    entity ClusterArtifacts   as
        projection on IRA.ClusterArtifacts {
            *,
            artifact : redirected to MonitoredArtifacts
        };

    // @requires: 'Viewer'
    @readonly
    entity Recommendations    as projection on IRA.ClusterRecommendations;

    // @requires: 'Viewer'
    @restrict: [
        {
            grant: ['READ'],
            to   : 'Viewer'
        },
        {
            grant: [
                'READ',
                'WRITE'
            ],
            to   : 'Admin'
        }
    ]
    entity MonitoredArtifacts as projection on IRA.MonitoredArtifacts order by lastPollTimestamp desc;

    // @requires: 'Viewer'
    @readonly
    entity Playbook           as projection on IRA.Playbooks;
    entity Tenants as projection on IRA.Tenants;
    entity ApplicationSettings as projection on IRA.ApplicationSettings;
function resolveClusterForArtifact(
        clusterId  : UUID,
        artifactId : UUID,
        note       : String
    ) returns String;
type DashboardCharts {
    monitoredIflows    : Integer;
    openClusters       : Integer;
    openIncidents      : Integer;
    criticalIflows     : Integer;
    resolvedToday      : Integer;
    incidentTrend     : LargeString;
    clusterSeverity   : LargeString;
    iflowSeverity     : LargeString;
}
 
function getDashboardCharts(tenantId : UUID) returns DashboardCharts;
type TopCriticalIFlow {
    ID                : UUID;
    iFlowName         : String(255);
    PackageName       : String(255);
    overallSeverity   : String(50);
    openClusterCount  : Integer;
    totalIncidents    : Integer;
    severityScore     : Decimal(10,2);
    severityZScore    : Decimal(10,2);
    lastPollTimestamp : Timestamp;
}
function getTopCriticalIflows(tenantId : UUID) returns many TopCriticalIFlow;

}
