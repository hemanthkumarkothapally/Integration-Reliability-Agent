using {com.cytechies.integration.reliability as IRA} from '../db/schema';

@path: '/Incident'
service IncidentService {
    entity Incidents          as projection on IRA.Incidents;

    // @requires                                  : 'Viewer'
    @readonly
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
    action   triggerPoll();

    // srv/incident-service.cds

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
}
