import cds from '@sap/cds';
 
export default cds.service.impl(async function () {
 
    const { IncidentClusters } = this.entities;
 
    const { Incidents } = cds.entities('com.cytechies.integration.reliability');
    this.on('createConversation', async (req) => {
        const newId = cds.utils.uuid();
        const { title } = req.data;
        const newConv = { ID: newId, title: title || "New Chat" };
        await INSERT.into('com.cytechies.integration.reliability.ChatSessions').entries(newConv);
        return newConv;
    });
 
    this.on('chat', async (req) => {
        const { conversationId, userMessage } = req.data;
        if (!conversationId || !userMessage) return req.error(400, "Missing conversationId or userMessage");
        await INSERT.into('com.cytechies.integration.reliability.Messages').entries({
            conversation_ID: conversationId,
            role: 'user',
            content: userMessage
        });
 
       
            const newAiMessage = {
                conversation_ID: conversationId,
                role: 'assistant',
                content: "Failed to generate AI response.",
                tokenCount: null
            };
            await INSERT.into('com.cytechies.integration.reliability.Messages').entries(newAiMessage);
            return newAiMessage;
       
    });
});

