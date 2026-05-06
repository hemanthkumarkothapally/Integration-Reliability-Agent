using { com.integration.reliability.agent as IRA } from '../db/schema';

@path: '/Poller'
service PollerService{
    entity Incidents as projection on IRA.Incidents;
}