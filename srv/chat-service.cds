using { com.cytechies.integration.reliability as IRA } from '../db/schema';

@path: '/Chat'
// service ChatService @(requires: 'Viewer'){
service ChatService {
    entity ChatSessions as projection on IRA.ChatSessions
    order by createdAt desc;
    entity Messages          as projection on IRA.Messages;

  action createConversation(
        title     : String,
        clusterId : UUID 
    ) returns {
        ID    : UUID;
        title : String;
    };

   action chat(
        conversationId : UUID,
        referenceID   : UUID,
        userMessage    : String
    ) returns {
        conversation_ID : UUID;
        role            : String;
        content         : String;
        tokenCount      : Integer;
    };
}
