using {com.cytechies.integration.reliability as IRA} from '../db/schema';

@path: '/Incident'
service IncidentService {
    entity Incidents          as projection on IRA.Incidents;

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
    entity MonitoredArtifacts as projection on IRA.MonitoredArtifacts;

    // @requires: 'Viewer'
    @readonly
    entity Playbook           as projection on IRA.Playbooks;


    // @requires: 'Admin'
    function triggerPoll() returns array of Map;

    function GetIncidentChartData() returns {
        severityData : array of {
            severity : String;
            count    : Integer;
        };
        trendData    : array of {
            day      : String;
            critical : Integer;
            high     : Integer;
            medium   : Integer;
            resolved : Integer;
        };
    };
    function GetTopErrorTypes()     returns array of {
        errorType : String;
        count     : Integer;
        severity  : String;
    };

    function onReDiagnoseIncidentCluster(
    cluster_ID : UUID
    ) returns {
        ID                   : UUID;
        cluster_ID           : UUID;
        rootCause            : LargeString;
        businessImpact       : LargeString;
        remediationSteps     : LargeString;
        affectedAdapter      : String(120);
        confidenceScore      : Integer;
        recommendationSource : String(40);
        modelName            : String(100);
        generatedAt          : Timestamp;
    };
}
