using {com.cytechies.integration.reliability as IRA} from '../db/schema';

@path: '/Incident'
service IncidentService {
    //entity Incidents        as projection on IRA.Incidents;
    @requires                                  : 'Viewer'
    @readonly
    @Capabilities.FilterRestrictions.Filterable: true
    @Capabilities.SortRestrictions.Sortable    : true
    @Capabilities.TopSupported                 : true
    @Capabilities.SkipSupported                : true
    entity IncidentClusters  as
        projection on IRA.IncidentClusters {
            *,
            virtual null as totalIncidents24h   : Integer, // Incidents.logEnd > now-24h
            virtual null as activeClusters      : Integer, // status != 'RESOLVED'
            virtual null as criticalCount       : Integer, // active + severity = 'CRITICAL'
            virtual null as resolved24h         : Integer, // status='RESOLVED' + modifiedAt > now-24h
            virtual null as criticalCriticality : Integer
        };

    @requires: 'Viewer'
    @readonly
    entity Recommendations   as projection on IRA.ClusterRecommendations;

    @requires: 'Viewer'
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
    entity MonitoredArtifact as projection on IRA.MonitoredArtifacts;

    @requires: 'Viewer'
    @readonly
    entity Playbook          as projection on IRA.Playbooks;

    entity ChatSessions      as projection on IRA.ChatSessions;

    entity Messages          as projection on IRA.Messages;

     action chat(conversationId: UUID, userMessage: String) returns Messages;
  action createConversation(title: String) returns ChatSessions;
    @requires: 'Admin'
    action triggerPoll();
}
