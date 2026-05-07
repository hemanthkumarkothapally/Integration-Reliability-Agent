using { com.cytechies.integration.reliability as IRA } from '../db/schema';

@path: '/Chat'
service ChatService @(requires:Viewer){
    entity ChatSessions as projection on IRA.ChatSessions;
}