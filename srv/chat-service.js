import cds from '@sap/cds';
import { updateDailyMetrics, updateDailyAIMetrics } from './utils/daily-metrics.js';

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
    console.log("Received AI Response:", JSON.stringify(response, null, 2));

    await updateDailyAIMetrics(
        {
            aiRequests: 1,
            totalInputTokens: response?.usage?.input_tokens ?? null,
            totalOutputTokens: response?.usage?.output_tokens ?? null,
            totalTokens: (response?.usage?.input_tokens ?? null) + (response?.usage?.output_tokens ?? null)
        }
    );
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
    const db = await cds.connect.to('db');
    const { ApplicationSettings } = db.entities;
    const destination = await cds.connect.to('GenAIHubDestination');



    this.on('createConversation', async (req) => {
        let UserQuery = req.data.title || "New Chat";
        let title = req.data.title || "New Chat";
        const { text } = await callAI(destination, [
            {
                role: 'user',
                content: `Generate a short chat session title (max 8 words, no quotes) for an SAP Integration Suite incident investigation with these details:
                            UserQuery:${UserQuery}
                            Return ONLY the title text, nothing else.`
            }
        ]);
        if (text) title = text.trim();
        const newConv = {
            ID: cds.utils.uuid(),
            title: title || UserQuery,
        };
        await srv.run(INSERT.into(ChatSessions).entries(newConv));
        await updateDailyAIMetrics(
            {
                totalChatSessions: 1
            }
        );
        return newConv;
    });




    this.on('chat', async (req) => {
        const { conversationId, referiFlowID, referClusterID, userMessage } = req.data;
        const maxInputLimit = 1524;
        console.log("Received chat request for conversationId:", conversationId, "with iFlow reference:", referiFlowID, "and cluster reference:", referClusterID);

        if (!conversationId || !userMessage) {
            return req.error(400, "Missing conversationId or userMessage");
        }
        let uid = cds.utils.uuid();
        let reference = null;
        // 1. Save user message first
        await INSERT.into('com.cytechies.integration.reliability.Messages').entries({
            ID: uid,
            conversation_ID: conversationId,
            role: 'user',
            content: userMessage,

        });
        await updateDailyAIMetrics(
            {
                totalUserMessages: 1
            }
        );

        try {
            // 2. Load full history (includes the message we just inserted)
            const historySetting = await SELECT.one
                .from(ApplicationSettings)
                .columns('settingValue')
                .where({
                    settingKey: 'HISTORY_MESSAGE_COUNT'
                });

            const historyLimit =
                Number(historySetting?.settingValue || 5);

            console.log(
                "History message count limit:",
                historyLimit
            );
            const history = await SELECT
                .from('com.cytechies.integration.reliability.Messages')
                .where({ conversation_ID: conversationId })
                .orderBy('createdAt desc').limit(historyLimit);

            let systemPrompt = `You are an AI assistant for SAP Integration Suite incident management.
                [TASK] Answer questions specifically about this cluster. Be concise and technical.
                [OUTPUT RULES] Always output raw valid HTML only, wrapped in a single <div></div> root. No Markdown. Use <p></p>, <ul></ul>, <li></li>, <strong></strong>, <br></br>. Never use code blocks.`;

            if (referClusterID) {
                // Fetch recent incidents for the cluster
                const clusterData = await SELECT.one
                    .from('com.cytechies.integration.reliability.IncidentClusters').where({
                        ID: referClusterID
                    });
                reference = `Cluster:${clusterData.errorType}`;
                const incidentSetting = await SELECT.one
                    .from(ApplicationSettings)
                    .columns('settingValue')
                    .where({
                        settingKey: 'MAX_INCIDENTS_FOR_AI'
                    });

                const incidentLimit =
                    Number(incidentSetting?.settingValue || 5);

                console.log(
                    "Incident count limit:",
                    incidentLimit
                );
                const incidents = await SELECT
                    .from('com.cytechies.integration.reliability.Incidents')
                    .where({
                        cluster_ID: referClusterID
                    })
                    .orderBy({
                        logEnd: 'desc'
                    })
                    .limit(incidentLimit);

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
                    Cluster ID: ${referClusterID}
 
                    Recent Incidents (Latest 10):
                    ${JSON.stringify(incidentSummary, null, 2)}
                    `;
            }
            if (referiFlowID) {
                // 2. Fetch iFlow details along with its associated cluster mapping links
                const iflowData = await SELECT.one
                    .from('com.cytechies.integration.reliability.MonitoredArtifacts', referiFlowID)
                    .columns(m => {
                        m.iFlowName, m.iFlowId, m.PackageName, m.isActive, m.overallSeverity, m.openClusterCount,
                            m.clusters(c => {
                                c.resolutionStatus,
                                    c.cluster(ic => {
                                        ic.ID, ic.errorType, ic.severity
                                    })
                            })
                    });

                reference = `iFlow:${iflowData.iFlowName}`;

                if (iflowData) {
                    // 3. Fetch latest 2 raw incidents tied directly to this specific iFlow name
                    const rawIflowIncidents = await SELECT
                        .from('com.cytechies.integration.reliability.Incidents')
                        .where({ iFlowName: iflowData.iFlowName })
                        .orderBy({ logEnd: 'desc' })
                        .limit(1); // Strictly capped at 1 incident

                    systemPrompt += `
                        [IFLOW CONTEXT]
                        iFlow Technical Name: ${iflowData.iFlowName}
                        Current Severity State: ${iflowData.overallSeverity}
                        Open Clusters Count: ${iflowData.openClusterCount}

                        Active Cluster Mappings:
                        ${JSON.stringify(iflowData.clusters || [], null, 2)}

                        Recent iFlow Execution Failures (Max 2):
                        ${JSON.stringify(rawIflowIncidents, null, 2)}
                        `;
                }
            }

            // 5. Build messages array from history
            // const messages = [{
            //     role: "user",
            //     content: userMessage
            // }];


            // Reverse the array in-place so it's back in chronological order (oldest to newest)
            history.reverse();

            // Map directly to the format required by your LLM client
            const messages = history.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            const systemPromptChars = systemPrompt.length;
            const messagesChars = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
            const estimatedInputTokens = Math.ceil((systemPromptChars + messagesChars) / 4);



            // 3. Fallback: If tokens breach limits, drop history and send ONLY the current message
            let finalMessages = messages;
            if (estimatedInputTokens > maxInputLimit - 50) {
                console.warn(`Token limit exceeded (${estimatedInputTokens}/${maxInputLimit}). Dropping history context.`);

                // Keep only the very last item in the array (the user's current query)
                finalMessages = [messages[messages.length - 1]];
            }
            // const fullPayloadText = systemPrompt + finalMessages.map(m => `\n[${m.role}]: ${m.content}`).join('');



            //{ text: systemPrompt+ fullPayloadText,tokenCount: 1234,inputTokens: 1234,outputTokens: 1234};//
            const { text, tokenCount, inputTokens, outputTokens } = await callAI(destination, finalMessages, systemPrompt, maxInputLimit);
            console.log("AI Response:", text);
            const aiText = text ?? 'Failed to generate AI response.';

            // 7. Save and return assistant reply
            const newAiMessage = {
                conversation_ID: conversationId,
                role: 'assistant',
                content: aiText,
                reference: reference,
                tokenCount: outputTokens
            };
            await srv.run(UPDATE(Messages)
                .set({ tokenCount: inputTokens, reference: reference })
                .where({ ID: uid }));
            await srv.run(INSERT.into(Messages).entries(newAiMessage));

            await updateDailyAIMetrics({
                totalAIMessages: 1
            });
            newAiMessage.inputTokens = inputTokens;
            newAiMessage.outputTokens = outputTokens;
            return newAiMessage;

        } catch (err) {
            console.error("Chat AI error:", err.reason?.response?.body ?? err.message);

            const fallback = {
                conversation_ID: conversationId,
                role: 'assistant',
                content: "Chat AI error:" + err.reason?.response?.body ?? err.message,
                tokenCount: null
            };

            await INSERT.into('com.cytechies.integration.reliability.Messages').entries(fallback);
            return fallback;
        }
    });
    this.after(['CREATE', 'UPDATE', 'DELETE'], Messages, async (data, req) => {

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
    this.after(['CREATE', 'UPDATE', 'DELETE'], ChatSessions, async (data, req) => {

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
