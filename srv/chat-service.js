import cds from '@sap/cds';

async function callAI(destination, messages, system = null, maxTokens = 256) {
    const payload = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: maxTokens,
        messages
    };
    console.log("chat system prompt:", system);
    if (system) payload.system = system;
    console.log("Sending AI Request with payload:", JSON.stringify(payload, null, 2));
    const response = await destination.send({
        method: 'POST',
        path: '/inference/deployments/d2f31ccfd2765c35/invoke',
        headers: {
            'Content-Type': 'application/json',
            'AI-Resource-Group': 'default'
        },
        data: payload
    });

    return {
        text: response?.content?.[0]?.text ?? null,
        tokenCount: (response?.usage?.output_tokens ?? null) + (response?.usage?.input_tokens ?? null),
        inputTokens: response?.usage?.input_tokens ?? null,
        outputTokens: response?.usage?.output_tokens ?? null
    };
}

export default cds.service.impl(async function () {

    let srv = this;
    const { ChatSessions, Messages } = this.entities;
    const destination = await cds.connect.to('GenAIHubDestination');
    this.on('createConversation', async (req) => {
        const { clusterId } = req.data;
        let UserQuery = req.data.title || "New Chat";
        let title = req.data.title || "New Chat";
        console.log("Creating conversation with title:", title, "and clusterId:", clusterId);
        try {
            if (clusterId) {
                // Load cluster to generate a meaningful title
                const cluster = await SELECT.one
                    .from('com.cytechies.integration.reliability.IncidentClusters')
                    .where({ ID: clusterId });

                if (cluster) {

                    const { text } = await callAI(destination, [
                        {
                            role: 'user',
                            content: `Generate a short chat session title (max 8 words, no quotes) for an SAP Integration Suite incident investigation with these details:
                            iFlow: ${cluster.iFlowName}
                            Error: ${cluster.errorSignature}
                            Severity: ${cluster.severity}
                            UserQuery:${UserQuery}
                            Return ONLY the title text, nothing else.`
                        }
                    ]);

                    if (text) title = text.trim();
                }
            }
        } catch (err) {
            console.error("Title generation failed, using default:", err.message);
        }
        console.log("Final Chat Title:", title);
        const newConv = {
            ID: cds.utils.uuid(),
            title,
            cluster_ID: clusterId || null
        };

        await srv.run(INSERT.into(ChatSessions).entries(newConv));
        return newConv;
    });
    this.on('chat', async (req) => {
        const { conversationId, referenceID, userMessage } = req.data;

        if (!conversationId || !userMessage) {
            return req.error(400, "Missing conversationId or userMessage");
        }
        let uid = cds.utils.uuid();
        // 1. Save user message first
        await INSERT.into('com.cytechies.integration.reliability.Messages').entries({
            ID: uid,
            conversation_ID: conversationId,
            role: 'user',
            content: userMessage
        });
        const newAiMessage = {
            conversation_ID: conversationId,
            role: 'assistant',
            content: "Generating AI response... TEST",
            tokenCount: 5678,

        };
        await srv.run(UPDATE(Messages)
            .set({ tokenCount: 1234 })
            .where({ ID: uid }));
        await srv.run(INSERT.into(Messages).entries(newAiMessage));
        newAiMessage.inputTokens = 1234;
        newAiMessage.outputTokens = 5678;
        return newAiMessage; // for testing
        try {
            // 2. Load full history (includes the message we just inserted)
            // const history = await SELECT
            //     .from('com.cytechies.integration.reliability.Messages')
            //     .where({ conversation_ID: conversationId })
            //     .orderBy('createdAt asc');

            let systemPrompt = `You are an AI assistant for SAP Integration Suite incident management.
 
                            [TASK]
                            Answer questions specifically about this cluster. Be concise and technical.
 
                            [STRICT OUTPUT RULES]
                            1. You MUST output RAW, VALID HTML ONLY.
                            2. DO NOT use any Markdown formatting whatsoever (no **, no ##, no * for bullets).
                            3. DO NOT wrap your response in \`\`\`html or \`\`\` code blocks. The response must be injected directly into the DOM.
                            4. Use standard HTML tags for structure: <p> for paragraphs, <ul>/<li> for lists, <strong> for emphasis, and <br> for line breaks.
                            5. You must wrap your entire response within a single root <div> tag.`;

            if (referenceID) {
                // Fetch recent incidents for the cluster
                const incidents = await SELECT
                    .from('com.cytechies.integration.reliability.Incidents')
                    .where({
                        cluster_ID: referenceID
                    })
                    .orderBy({
                        logEnd: 'desc'
                    })
                    .limit(2);

                // Clean up the payload to save tokens and keep the LLM focused
                const incidentSummary = incidents.map((i, index) => ({
                    index: index + 1,
                    errorMessage: i.errorMessage,
                    adapter: i.adapter,
                    logEnd: i.logEnd
                }));

                // Append the dynamic context to the system prompt
                systemPrompt += `
                    [CONTEXT]
                    Cluster ID: ${referenceID}
 
                    Recent Incidents (Latest 10):
                    ${JSON.stringify(incidentSummary, null, 2)}
                    `;
            }

            // 5. Build messages array from history
            const messages = [{
                role: "user",
                content: userMessage
            }];
            const { text, tokenCount, inputTokens, outputTokens } = await callAI(destination, messages, systemPrompt, 1524);
            console.log("AI Response:", text);
            const aiText = text ?? 'Failed to generate AI response.';

            // 7. Save and return assistant reply
            const newAiMessage = {
                conversation_ID: conversationId,
                role: 'assistant',
                content: aiText,
                tokenCount: outputTokens
            };
            await srv.run(UPDATE(Messages)
                .set({ tokenCount: inputTokens })
                .where({ ID: uid }));
            await srv.run(INSERT.into(Messages).entries(newAiMessage));
            newAiMessage.inputTokens = inputTokens;
            newAiMessage.outputTokens = outputTokens;
            return newAiMessage;

        } catch (err) {
            console.error("Chat AI error:", err.reason?.response?.body ?? err.message);

            const fallback = {
                conversation_ID: conversationId,
                role: 'assistant',
                content: 'Failed to generate AI response.',
                tokenCount: null
            };

            await INSERT.into('com.cytechies.integration.reliability.Messages').entries(fallback);
            return fallback;
        }
    });
    this.after(['CREATE', 'UPDATE','DELETE'], Messages, async (data, req) => {

        try {

            const conversationId = data.conversation_ID;

            if (!conversationId) return;

            // Get all messages for this conversation
            const messages = await SELECT
                .from('com.cytechies.integration.reliability.Messages')
                .columns('tokenCount')
                .where({ conversation_ID: conversationId });

            // Calculate total tokens
            const totalTokens = messages.reduce((sum, msg) => {
                return sum + (msg.tokenCount || 0);
            }, 0);

            // Update session token usage
            await srv.run(UPDATE(ChatSessions)
                .set({
                    totalSessionTokenUsage: totalTokens
                })
                .where({ ID: conversationId }));

            console.log("Updated total token usage:", totalTokens);

        } catch (err) {
            console.error("Token aggregation failed:", err);
        }

    });
    this.after(['CREATE', 'UPDATE','DELETE'], ChatSessions, async (data, req) => {

        try {

            const clusterId = data.cluster_ID;

            if (!clusterId) return;

            // Get all messages for this conversation
            const chatSessions = await SELECT
                .from('com.cytechies.integration.reliability.ChatSessions')
                .columns('totalSessionTokenUsage')
                .where({ cluster_ID: clusterId });

            // Calculate total tokens
            const totalTokens = chatSessions.reduce((sum, session) => {
                return sum + (session.totalSessionTokenUsage || 0);
            }, 0);

            // Update session token usage
            await UPDATE('com.cytechies.integration.reliability.IncidentClusters')
                .set({
                    totalTokenUsage: totalTokens
                })
                .where({ ID: clusterId });

            console.log("Updated total token usage of cluster", clusterId, ":", totalTokens);

        } catch (err) {
            console.error("Cluster token aggregation failed:", err);
        }

    });
});
