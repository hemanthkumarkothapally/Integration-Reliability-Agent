using { com.cytechies.integration.reliability as IRA } from '../db/schema';

@path: '/Admin'
// service AdminService @(requires: 'Admin'){
service AdminService{
    entity Tenants as projection on IRA.Tenants;
    entity MonitoredArtifacts as projection on IRA.MonitoredArtifacts;
    entity TokenUsages as projection on IRA.TokenUsages;
    function triggerManualPoll() returns array of Map;
    function getDestinations() returns many {
    Name        : String;
    Type        : String;
    URL         : String;
    Description : String;
};
}