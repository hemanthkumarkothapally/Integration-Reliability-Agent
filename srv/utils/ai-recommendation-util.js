export async function generateClusterRecommendation(
    payload
) {

    console.log(
        "AI recommendation started"
    );

    const {
        cluster,
        incidents
    } = payload;


    const destination = await cds.connect.to('GenAIHubDestination');

    /*
     * --------------------------------------------------
     * BUILD INCIDENT SUMMARY
     * --------------------------------------------------
     */

    const incidentSummary =
        incidents.map((i, index) => ({

            index: index + 1,

            errorMessage:
                i.errorMessage,

            adapter:
                i.adapter,

            logEnd:
                i.logEnd
        }));

    /*
     * --------------------------------------------------
     * AI PROMPT
     * --------------------------------------------------
     */

    const prompt = `
You are an SAP Integration Suite reliability expert.

Analyze this SAP CPI incident cluster.

Return ONLY valid JSON.

Required JSON structure:

{
  "rootCause": "",
  "businessImpact": "",
  "remediationSteps": ["", "", "",...],
  "affectedAdapter": "",
  "confidenceScore": 0
}

Cluster:
${JSON.stringify(cluster, null, 2)}

Recent Incidents:
${JSON.stringify(incidentSummary, null, 2)}

Rules:
- Keep remediation steps concise
- try to give max 3 remediation steps
- If there is no adapter, try to analyse the adapter from error and send.
- Confidence score must be 0-100
- Output JSON only
`;

    try {

        /*
         * --------------------------------------------------
         * AI CALL
         * --------------------------------------------------
         */

        const response =
            await destination.send({

                method: 'POST',
                path: '/inference/deployments/d2f31ccfd2765c35/invoke',
                headers: {
                    'Content-Type': 'application/json',
                    'AI-Resource-Group': 'default'
                },
                data: {
                    anthropic_version: "bedrock-2023-05-31",
                    max_tokens: 512,
                    system: `You are an SAP CPI incident diagnosis assistant. Always return STRICT valid JSON only.`,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                }
            });

        /*
         * --------------------------------------------------
         * EXTRACT CONTENT
         * --------------------------------------------------
         */

        console.log(
            "Raw AI response:",
            JSON.stringify(
                response,
                null,
                2
            )
        );

        const content =
            response?.content?.[0]?.text;

        if (!content) {

            throw new Error(
                `Unexpected response shape:
${JSON.stringify(response)}`
            );
        }

        /*
         * --------------------------------------------------
         * CLEAN MARKDOWN
         * --------------------------------------------------
         */

        const cleaned =
            content
                .replace(/```json\n?/g, '')
                .replace(/```/g, '')
                .trim();

        /*
         * --------------------------------------------------
         * PARSE JSON
         * --------------------------------------------------
         */

        const parsed =
            JSON.parse(cleaned);

        const usage =
            response?.usage || {};

        const inputTokens =
            usage.input_tokens || 0;

        const outputTokens =
            usage.output_tokens || 0;

        /*
         * Claude Sonnet pricing example
         */

        const estimatedCostUSD =
            Number(
                (
                    ((inputTokens / 1_000_000) * 3) +
                    ((outputTokens / 1_000_000) * 15)
                ).toFixed(4)
            );

        return {

            recommendation: {

                rootCause:
                    parsed.rootCause ||
                    'Unknown root cause',

                businessImpact:
                    parsed.businessImpact ||
                    'Unknown business impact',

                remediationSteps:
                    Array.isArray(
                        parsed.remediationSteps
                    )
                        ? parsed.remediationSteps
                        : [],

                affectedAdapter:
                    parsed.affectedAdapter ||
                    cluster.adapter ||
                    'UNKNOWN',

                confidenceScore:
                    Number(
                        parsed.confidenceScore || 50
                    )
            },

            audit: {

                model:
                    response.model ||
                    'claude-sonnet',

                inputTokens,

                outputTokens,

                estimatedCostUSD,

                calledAt:
                    new Date(),

                purpose:
                    'CLUSTER_RCA'
            }
        };

    } catch (err) {

        console.error(
            "AI Error status:",
            err.reason?.response?.status
        );

        console.error(
            "AI Error body:",
            JSON.stringify(
                err.reason?.response?.body,
                null,
                2
            )
        );

        /*
         * --------------------------------------------------
         * SAFE FALLBACK
         * --------------------------------------------------
         */

        return {

    recommendation: {

        rootCause:
            `Repeated ${cluster.errorSignature} failures detected in ${cluster.iFlowName}.`,

        businessImpact:
            'Potential message processing disruption.',

        remediationSteps: [

            'Inspect integration flow logs',

            'Validate endpoint connectivity',

            'Review payload structure and credentials'
        ],

        affectedAdapter:
            'UNKNOWN',

        confidenceScore: 40
    },

    audit: {

        model:
            'claude-sonnet',

        inputTokens: 0,

        outputTokens: 0,

        estimatedCostUSD: 0,

        calledAt:
            new Date(),

        purpose:
            'CLUSTER_RCA'
    }
};
    }
}