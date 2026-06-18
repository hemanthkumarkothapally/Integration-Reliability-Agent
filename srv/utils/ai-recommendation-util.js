import cds from '@sap/cds';

export async function generateClusterRecommendation(payload) {
    console.log('AI recommendation started');

    const { cluster, incidents } = payload;
    const destination = await cds.connect.to('GenAIHubDestination');

    const incidentSummary = incidents.map((i, index) => ({
        index: index + 1,
        errorMessage: i.errorMessage,
        adapter: i.adapter,
        logEnd: i.logEnd
    }));

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
        prompt += `

Available Playbooks:
${JSON.stringify(playbooks, null, 2)}

- Match the most relevant playbook by errorType or errorSignature and return its ID in playbookId field.
`;
    }

    try {
        const definitionId = process.env.AI_RECOMMENDATION_DEFINITION_ID;

        const response = await destination.send({
            method: 'POST',
            path: `/inference/deployments/${definitionId}/invoke`,
            headers: {
                'Content-Type': 'application/json',
                'AI-Resource-Group': 'default'
            },
            data: {
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 1024,
                system: 'You are an SAP CPI incident diagnosis assistant. Always return STRICT valid JSON only.',
                messages: [
                    { role: 'user', content: prompt }
                ]
            }
        });

        console.log('Raw AI response:', JSON.stringify(response, null, 2));

        const content = response?.content?.[0]?.text;
        if (!content) {
            throw new Error(`Unexpected response shape: ${JSON.stringify(response)}`);
        }

        const cleaned = content
            .replace(/```json\n?/g, '')
            .replace(/```/g, '')
            .trim();

        const parsed = JSON.parse(cleaned);
        console.log('Parsed AI response:', JSON.stringify(parsed, null, 2));

        const usage = response?.usage || {};
        const inputTokens = usage.input_tokens || 0;
        const outputTokens = usage.output_tokens || 0;

        return {
            recommendation: {
                rootCause: parsed.rootCause || 'Unknown root cause',
                businessImpact: parsed.businessImpact || 'Unknown business impact',
                remediationSteps: Array.isArray(parsed.remediationSteps) ? parsed.remediationSteps : [],
                affectedAdapter: parsed.affectedAdapter || cluster.adapter || 'UNKNOWN',
                confidenceScore: Number(parsed.confidenceScore || 50)
            },
            audit: {
                model: response.model || 'claude-sonnet',
                inputTokens,
                outputTokens,
                estimatedCostUSD: null,
                calledAt: new Date(),
                purpose: 'CLUSTER_RCA'
            },
            playbook_ID: parsed.playbookId || null,
            errorType: parsed.errorType || null
        };
    } catch (err) {
        console.error('AI recommendation failed:', err.message || err);
        if (err.reason?.response) {
            console.error('AI Error status:', err.reason.response.status);
            console.error('AI Error body:', JSON.stringify(err.reason.response.body, null, 2));
        }

        return {
            recommendation: {
                rootCause: `Repeated ${cluster.errorSignature} failures detected in ${cluster.iFlowName}.`,
                businessImpact: 'Potential message processing disruption.',
                remediationSteps: [
                    'Inspect integration flow logs',
                    'Validate endpoint connectivity',
                    'Review payload structure and credentials'
                ],
                affectedAdapter: 'UNKNOWN',
                confidenceScore: 40
            },
            audit: {
                model: 'claude-sonnet',
                inputTokens: 0,
                outputTokens: 0,
                estimatedCostUSD: null,
                calledAt: new Date(),
                purpose: 'CLUSTER_RCA'
            },
            playbook_ID: null,
            errorType: null
        };
    }
}