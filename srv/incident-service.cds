using {com.cytechies.integration.reliability  as IRA} from '../db/schema';

@path: '/Incident'
service IncidentService {
    //entity Incidents        as projection on IRA.Incidents;
    @requires                                  : 'Viewer'
    @readonly
    @Capabilities.FilterRestrictions.Filterable: true
    @Capabilities.SortRestrictions.Sortable    : true
    @Capabilities.TopSupported                 : true
    @Capabilities.SkipSupported                : true
    entity IncidentClusters  as projection on IRA.IncidentClusters;

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

    @requires: 'Admin'
    action triggerPoll();
}
