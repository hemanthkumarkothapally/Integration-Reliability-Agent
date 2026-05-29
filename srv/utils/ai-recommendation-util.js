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

    let prompt = `
You are an SAP Integration Suite reliability expert.

Analyze this SAP CPI incident cluster.

Return ONLY valid JSON.

Required JSON structure:

{
  "rootCause": "",
  "businessImpact": "",
  "remediationSteps": ["", "", "",...],
  "affectedAdapter": "",
  "confidenceScore": 0,
  "playbookId": "" // optional, can be null if no relevant playbook found,
  "errorType": "" 
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
- if playbook is not there in cluster, try to go throgh the playbooks entity and find the relevant playbook based on the error signature and iflow name and use that to give more accurate recommendation.
- if not able to find relevant playbook, then give null in playbook id field in the response.
- Give the Error type by analysing the error signature and error type field in the cluster and also from the error message in the incidents. If not able to find the error type then give UNKNOWN_ERROR in the error type field.
- Output JSON only
`;
    if (!cluster.playbook_ID) {
        const playbooks = await SELECT.from('Playbooks');

        prompt = prompt + `

Available Playbooks:
${JSON.stringify(playbooks, null, 2)}

- Match the most relevant playbook by errorType or errorSignature and return its ID in playbookId field.
`;
    }
    // if(cluster.errorType === 'UNKNOWN_ERROR'){
    //     prompt = prompt + `- If error type is UNKNOWN_ERROR, try to infer the error type based on the error message and other available data and return it in the errorType field.`;
    // }
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
                    max_tokens: 1024,
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
        console.log(
            "Parsed AI response:",
            JSON.stringify(
                parsed,
                null,
                2
            )
        );
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
            },
            playbook_ID: parsed.playbookId || null,
            errorType: parsed.errorType || null
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
const GREETING_PATTERNS = [
    /^(hi|hello|hey|howdy|hiya|good\s*(morning|afternoon|evening|day))\b/i,
    /^(thanks?|thank\s*you|thx|ty)\b/i,
    /^(bye|goodbye|see\s*you|cya|take\s*care)\b/i,
    /^(how\s*are\s*you|what'?s\s*up|wassup)\b/i,
    /^(ok|okay|got\s*it|sure|alright|sounds\s*good)\b/i,
    /^(yes|no|maybe|nope|yep|yeah)\b/i
];

const CLUSTER_PATTERNS = [
    /error|exception|fail|incident|cluster|iflow|adapter|log|timeout|retry/i,
    /root\s*cause|remediat|fix|resolv|diagnos|impact|status/i,
    /why|what\s*is|how\s*to|when\s*did|what\s*happen/i
];

export async function classifyIntent(message) {
    const trimmed = message.trim();

    // Short messages are likely greetings
    if (trimmed.split(' ').length <= 3) {
        if (GREETING_PATTERNS.some(p => p.test(trimmed))) return 'GREETING';
    }

    if (CLUSTER_PATTERNS.some(p => p.test(trimmed))) return 'CLUSTER';

    // Default to CLUSTER so technical questions always get full context
    return 'CLUSTER';
}