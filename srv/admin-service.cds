using { com.cytechies.integration.reliability as IRA } from '../db/schema';

@path: '/Admin'
service AdminService @(requires:Admin){
    entity MonitoredArtifacts as projection on IRA.MonitoredArtifacts;
}