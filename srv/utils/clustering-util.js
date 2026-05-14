// -------------------------------------------------------
// CLUSTER RULES
// -------------------------------------------------------

const CLUSTER_RULES = [
  {
    id:       'auth_failure',
    label:    'Auth / credential failure',
    severity: 'CRITICAL',
    criticality: 1,
    match: (err) => /401|invalid_client|bad.credent|unauthorized|oauth|token/i.test(err)
  },
  {
    id:       'msg_size',
    label:    'Message size exceeded',
    severity: 'HIGH',
    criticality: 2,
    match: (err) => /size.limit|body.size|exceeds.*mb|payload.*too.large/i.test(err)
  },
  {
    id:       'script_error',
    label:    'Groovy script error',
    severity: 'HIGH',
    criticality: 2,
    match: (err) => /MissingPropertyException|ScriptException|MultipleCompilationErrors|unable.to.resolve.class|groovy/i.test(err)
  },
  {
    id:       'xml_validation',
    label:    'XML validation failure',
    severity: 'MEDIUM',
    criticality: 3,
    match: (err) => /XmlValidation|SAXParseException|non-XML.payload|xsd.*error|validation.failed.*xsd/i.test(err)
  },
  {
    id:       'missing_field',
    label:    'Mandatory field missing',
    severity: 'MEDIUM',
    criticality: 3,
    match: (err) => /MANDATORY_FIELD|missing.*payload|field.*missing|minLength|does.not.match.*required/i.test(err)
  },
  {
    id:       'type_conversion',
    label:    'Type conversion error',
    severity: 'MEDIUM',
    criticality: 3,
    match: (err) => /Cannot.convert|cast.*exception|NumberFormat|convert.*string.*double/i.test(err)
  },
  {
    id:       'no_message_id',
    label:    'Message ID not found',
    severity: 'LOW',
    criticality: 4,
    match: (err) => /No.message.ID|could.not.be.found.*expression|exchangeProperty/i.test(err)
  },
  {
    id:       'event_exception',
    label:    'Duplicate / event exception',
    severity: 'LOW',
    criticality: 4,
    match: (err) => /Error.Event.Exception|duplicate/i.test(err)
  },
  {
    id:       'unknown',
    label:    'Uncategorised error',
    severity: 'INFO',
    criticality: 5,
    match: () => true
  }
];

// -------------------------------------------------------
// CLUSTERING FUNCTION
// -------------------------------------------------------

function clusterIncidents(incidents) {

  const buckets = {};

  for (const inc of incidents) {

    const err = inc.errorMessage || inc.errorSignature || '';
    const rule = CLUSTER_RULES.find(r => r.match(err));

    // key = rule + iFlow so the same error type on different iFlows
    // stays separate — matching your IncidentClusters schema
    const key = `${rule.id}::${inc.iFlowName}`;

    if (!buckets[key]) {
      buckets[key] = {
        errorSignature:      rule.label,
        iFlowName:           inc.iFlowName,
        severity:            rule.severity,
        severityCriticality: rule.criticality,
        incidentCount:       0,
        firstSeen:           inc.logEnd,
        lastSeen:            inc.logEnd,
        status:              'OPEN'
      };
    }

    const b = buckets[key];
    b.incidentCount++;

    if (inc.logEnd < b.firstSeen) b.firstSeen = inc.logEnd;
    if (inc.logEnd > b.lastSeen)  b.lastSeen  = inc.logEnd;
  }

  return Object.values(buckets)
    .sort((a, b) => a.severityCriticality - b.severityCriticality || b.incidentCount - a.incidentCount);
}

// -------------------------------------------------------
// UPSERT INTO IncidentClusters
// -------------------------------------------------------

export async function upsertClusters(IncidentClusters, newLogs) {

  const clusters = clusterIncidents(newLogs);

  for (const cluster of clusters) {

    // check if a cluster row already exists for this signature + iFlow
    const existing = await SELECT.one
      .from(IncidentClusters)
      .where({
        errorSignature: cluster.errorSignature,
        iFlowName:      cluster.iFlowName
      });

    if (existing) {

      await UPDATE(IncidentClusters)
        .set({
          incidentCount:  existing.incidentCount + cluster.incidentCount,
          lastSeen:       cluster.lastSeen > existing.lastSeen
                            ? cluster.lastSeen
                            : existing.lastSeen,
          severity:            cluster.severity,
          severityCriticality: cluster.severityCriticality,
          status:         existing.status === 'RESOLVED' ? 'REOPENED' : existing.status
        })
        .where({
          errorSignature: cluster.errorSignature,
          iFlowName:      cluster.iFlowName
        });

    } else {

      await INSERT.into(IncidentClusters).entries(cluster);
    }
  }

  return clusters;
}