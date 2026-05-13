import cds from '@sap/cds';

export default cds.service.impl(async function () {

    const { IncidentClusters } = this.entities;

    const { Incidents } =
        cds.entities('com.cytechies.integration.reliability');
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
        await INSERT.into('com.candy.app.Messages').entries({
            conversation_ID: conversationId,
            role: 'user',
            content: userMessage
        });
        const contextArticles = await this.send('search', { query: userMessage });
        let contextText = "No relevant context found.";
        let usedContextJSON = "[]";

        if (typeof contextArticles !== 'string' && contextArticles.length > 0) {
            const articles = typeof contextArticles === 'string' ? JSON.parse(contextArticles) : contextArticles;
            contextText = articles.map(a => `Title: ${a.title}\nCategory: ${a.category}\nContent: ${a.content}`).join('\n\n---\n\n');
            usedContextJSON = JSON.stringify(articles);
        }
        const systemPrompt = `You are a friendly and expert SAP BTP assistant. 

CRITICAL FORMATTING RULES:
You must format your ENTIRE response using standard HTML tags. DO NOT use Markdown under any circumstances (e.g., do not use **, *, #, or \`\`\`).
- Use <strong> for emphasis/bolding.
- Use <ul> and <li> for lists.
- Use <br/> for line breaks and paragraph spacing.
- Use <h3> or <h4> for headings.
- Use <pre style="background-color:#f3f4f6; padding:0.5rem; border-radius:4px; font-family:monospace;"><code> for code blocks.
- Use <a href="..." target="_blank"> for links.

BEHAVIORAL RULES:
1. If the user greets you, respond in a warm, friendly, and welcoming manner before addressing their query.
2. Use ONLY the provided context to answer the user's question. 
3. If the answer cannot be found within the provided context, you must explicitly and exactly state: "I cannot answer this based on the provided context." Do not hallucinate or rely on outside knowledge.

Context:
${contextText}`;
        const history = await SELECT.from('com.candy.app.Message')
            .where({ conversation_ID: conversationId })
            .orderBy`createdAt DESC`
            .limit(5);

        history.reverse();

        const apiMessages = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
        }));

        const groqMessagesPayload = [
            { role: "system", content: systemPrompt },
            ...apiMessages
        ];

        try {
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
            const aiResponse = await groq.chat.completions.create({
                messages: groqMessagesPayload,
                model: "openai/gpt-oss-20b",
            });

            const aiContent = aiResponse.choices[0].message.content;
            const tokensUsed = aiResponse.usage.total_tokens;

            const newAiMessage = {
                conversation_ID: conversationId,
                role: 'assistant',
                content: aiContent,
                tokenCount: tokensUsed,
                usedContext: usedContextJSON
            };

            await INSERT.into('com.candy.app.Message').entries(newAiMessage);
            return newAiMessage;

        } catch (err) {
            const newAiMessage = {
                conversation_ID: conversationId,
                role: 'assistant',
                content: "Failed to generate AI response.",
                tokenCount: null,
                usedContext: usedContextJSON
            };

            await INSERT.into('com.cytechies.integration.reliability.Messages').entries(newAiMessage);
            return newAiMessage;
        }
    });


    this.after('READ', IncidentClusters, async (data) => {  // ← add async

        // const records = Array.isArray(data) ? data : [data];
        // if (!records.length || !records[0]) return;

        // // ── KPI queries ───────────────────────────────────────────────────────
        // const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // const [{ count: totalIncidents24h }, { count: activeClusters }, { count: criticalCount }, { count: resolved24h }] = await Promise.all([

        //     SELECT.one.from(Incidents)
        //         .columns('count(*) as count')
        //         .where('logEnd >', past24h),

        //     SELECT.one.from(IncidentClusters)
        //         .columns('count(*) as count')
        //         .where`upper(status) != 'RESOLVED'`,

        //     SELECT.one.from(IncidentClusters)
        //         .columns('count(*) as count')
        //         .where`upper(status) != 'RESOLVED' and upper(severity) = 'CRITICAL'`,

        //     SELECT.one.from(IncidentClusters)
        //         .columns('count(*) as count')
        //        .where`upper(status) = 'RESOLVED'`
        //         .and('modifiedAt >', past24h)
        // ]);


        console.log("READ Event Triggered");

        const records = Array.isArray(data)
            ? data
            : [data];

        if (!records.length || !records[0]) {

            console.log("No Records Found");

            return;
        }

        // ---------------------------------------------------
        // Last 24 Hours
        // ---------------------------------------------------

        const past24h = new Date(
            Date.now() - 24 * 60 * 60 * 1000
        );

        console.log("Past 24 Hours Time:", past24h);

        // ---------------------------------------------------
        // KPI Queries
        // ---------------------------------------------------

        const totalIncidentsQuery =
            SELECT.one.from(Incidents)
                .columns('count(*) as count')
                .where('logEnd >', past24h);

        const activeClustersQuery =
            SELECT.one.from(IncidentClusters)
                .columns('count(*) as count')
                .where`upper(status) != 'RESOLVED'`;

        const criticalCountQuery =
            SELECT.one.from(IncidentClusters)
                .columns('count(*) as count')
                .where`
                    upper(status) != 'RESOLVED'
                    and upper(severity) = 'CRITICAL'
                `;

        const resolved24hQuery =
            SELECT.one.from(IncidentClusters)
                .columns('count(*) as count')
                .where`upper(status) = 'RESOLVED'`
                .and('modifiedAt >', past24h);

        console.log("Executing KPI Queries...");

        // ---------------------------------------------------
        // Execute Queries
        // ---------------------------------------------------

        const [
            { count: totalIncidents24h },
            { count: activeClusters },
            { count: criticalCount },
            { count: resolved24h }

        ] = await Promise.all([

            totalIncidentsQuery,
            activeClustersQuery,
            criticalCountQuery,
            resolved24hQuery

        ]);

        // ---------------------------------------------------
        // Console Logs
        // ---------------------------------------------------

        console.log("--------------------------------");
        console.log("KPI QUERY RESULTS");
        console.log("--------------------------------");

        console.log(
            "Total Incidents (24h):",
            totalIncidents24h
        );

        console.log(
            "Active Clusters:",
            activeClusters
        );

        console.log(
            "Critical Count:",
            criticalCount
        );

        console.log(
            "Resolved (24h):",
            resolved24h
        );

        console.log("--------------------------------");


        // ── Stamp every row ───────────────────────────────────────────────────
        records.forEach(record => {

            // Your existing severity criticality logic — unchanged
            switch (record.severity) {
                case 'CRITICAL': record.severityCriticality = 1; break;
                case 'HIGH': record.severityCriticality = 2; break;
                case 'MEDIUM': record.severityCriticality = 3; break;
                case 'LOW': record.severityCriticality = 5; break;
                default: record.severityCriticality = 0;
            }

            // KPI values — same on every row, Fiori reads from row[0]
            record.totalIncidents24h = Number(totalIncidents24h) || 0;
            record.activeClusters = Number(activeClusters) || 0;
            record.criticalCount = Number(criticalCount) || 0;
            record.resolved24h = Number(resolved24h) || 0;

            // CRITICAL tile colour: red when >0, green when clear
            record.criticalCriticality = record.criticalCount > 0 ? 1 : 3;
        });
    });
});