using {com.cytechies.integration.reliability as IRA} from '../db/schema';

@path: '/Incident'
service IncidentService @(requires:Admin){
    entity Incidents        as projection on IRA.Incidents;
    entity IncidentClusters as projection on IRA.IncidentClusters;
    entity Recommendations  as projection on IRA.ClusterRecommendations;
}
