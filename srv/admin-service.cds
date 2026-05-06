using { com.integration.reliability.agent as IRA } from '../db/schema';

@path: '/Admin'
service AdminService{
    entity MonitoredArtifacts as projection on IRA.MonitoredArtifacts;
}