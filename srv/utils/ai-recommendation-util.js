import cds from '@sap/cds';

const MAX_INCIDENT_SAMPLES = 3;   // clustered incidents are near-identical; a few suffice
const MAX_MSG_LEN = 500;          // cap each error message length

// Send only the fields the model needs for root-cause analysis.
function slimCluster(cluster) {
    const slim = {
        errorSignature: cluster.errorSignature,
        errorType: cluster.errorType,
        iFlowName: cluster.iFlowName,
        adapter: cluster.adapter,
        incidentCount: cluster.incidentCount,
        severity: cluster.severity,
        firstSeen: cluster.firstSeen,
        lastSeen: cluster.lastSeen
    };
    for (const k of Object.keys(slim)) {
        if (slim[k] === undefined || slim[k] === null) delete slim[k];
    }
    return slim;
}

// De-duplicate, cap and truncate incident error messages.
function sampleIncidents(incidents) {
    const seen = new Set();
    const samples = [];
    for (const i of incidents) {
        const msg = (i.errorMessage || '').trim().slice(0, MAX_MSG_LEN);
        if (!msg || seen.has(msg)) continue;
        seen.add(msg);
        samples.push(msg);
        if (samples.length >= MAX_INCIDENT_SAMPLES) break;
    }
    return samples;
}

// Resolve the matching playbook in code (match is a plain errorType lookup),
// so no playbook data is ever sent to the model.
async function resolvePlaybookId(cluster, errorType) {
    if (cluster.playbook_ID) return cluster.playbook_ID;
    const errType = errorType || cluster.errorType;
    if (!errType) return null;
    const pb = await SELECT.one.from('Playbooks').columns('ID').where({ errorType: errType });
    return pb?.ID || null;
}

export async function generateClusterRecommendation(payload) {
    console.log('AI recommendation started');

    const { cluster, incidents } = payload;
    const destination = await cds.connect.to('GenAIHubDestination');

    // Compact data, trimmed fields, concise instructions. No playbook payload.
    const prompt = `You are an SAP Integration Suite reliability expert. Analyze this SAP CPI incident cluster and return ONLY valid JSON in exactly this shape:
{"rootCause":"","businessImpact":"","remediationSteps":["","",""],"affectedAdapter":"","confidenceScore":0,"errorType":""}

Cluster: ${JSON.stringify(slimCluster(cluster))}
Recent error messages: ${JSON.stringify(sampleIncidents(incidents))}

Rules:
- Max 3 concise remediation steps.
- If no adapter is given, infer it from the error.
- confidenceScore is an integer 0-100.
- Derive errorType from the cluster and error messages; use UNKNOWN_ERROR if unclear.
- Output JSON only, no markdown, no commentary.`;

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

        const errorType = parsed.errorType || null;
        const playbook_ID = await resolvePlaybookId(cluster, errorType);

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
            playbook_ID,
            errorType
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