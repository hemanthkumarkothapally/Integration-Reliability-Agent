using { com.integration.reliability.agent as IRA } from '../db/schema';

@path: '/Chat'
service ChatService{
    entity ChatSessions as projection on IRA.ChatSessions;
}