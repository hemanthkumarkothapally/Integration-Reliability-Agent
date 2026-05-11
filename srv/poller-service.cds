using { com.cytechies.integration.reliability as IRA } from '../db/schema';

@path: '/Poller'
service PollerService @(requires: Admin){
    entity Incidents as projection on IRA.Incidents;
    function getFailedLogs() returns array of Map;
}