// utils/log-utils.js

/**
 * 🧹 Normalize message (remove dynamic noise)
 */
export function normalizeMessage(msg = '') {
  let m = msg || '';

  // GUIDs
  m = m.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}/g, '<GUID>');

  // ISO timestamps
  m = m.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '<TIMESTAMP>');

  // Long numeric IDs
  m = m.replace(/\b\d{6,}\b/g, '<ID>');

  // Hex transaction IDs (32 chars)
  m = m.replace(/\b[a-f0-9]{32}\b/g, '<TXID>');

  // Cleanup whitespace
  m = m.replace(/\s+/g, ' ').trim();

  return m;
}

/**
 * 🧠 Extract stable error signature
 */
export function extractSignature(msg = '') {
  const m = (msg || '').toLowerCase();

  // 🔐 Auth errors
  if (m.includes('401') || m.includes('unauthorized')) {
    if (m.includes('token') || m.includes('oauth')) {
      return 'HTTP_401_OAUTH_EXPIRED';
    }
    return 'HTTP_401_UNAUTHORIZED';
  }

  if (m.includes('403') || m.includes('forbidden')) {
    return 'HTTP_403_FORBIDDEN';
  }

  // 🌐 Connectivity
  if (m.includes('timeout') || m.includes('timed out')) {
    return 'TIMEOUT_ERROR';
  }

  if (m.includes('connection refused')) {
    return 'CONNECTION_REFUSED';
  }

  if (m.includes('unknown host') || m.includes('host not found')) {
    return 'DNS_RESOLUTION_ERROR';
  }

  // 🧾 Mapping / Processing
  if (m.includes('nullpointer') || m.includes('null pointer')) {
    return 'XSLT_NULL_REF';
  }

  if (m.includes('xslt')) {
    return 'XSLT_MAPPING_ERROR';
  }

  if (m.includes('json') && m.includes('parse')) {
    return 'JSON_PARSE_ERROR';
  }

  if (m.includes('xml') && m.includes('parse')) {
    return 'XML_PARSE_ERROR';
  }

  // 📦 Backend
  if (m.includes('500') || m.includes('internal server error')) {
    return 'HTTP_500_BACKEND_ERROR';
  }

  // 🔎 CPI-specific
  if (m.includes('no artifact descriptor')) {
    return 'ARTIFACT_DESCRIPTOR_NOT_FOUND';
  }

  if (m.includes('illegalstateexception')) {
    return 'JAVA_ILLEGAL_STATE';
  }

  // 🧩 Fallback
  return 'UNKNOWN_ERROR';
}

/**
 * 📅 Convert SAP /Date(...)/
 */
export function convertDate(sapDate) {
  if (!sapDate) return null;

  const match = /\/Date\((\d+)\)\//.exec(sapDate);
  return match ? new Date(Number(match[1])).toISOString() : null;
}

/**
 * 🚀 Batch processor (prevents API overload)
 */
export async function processInBatches(items, handler, batchSize = 20) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    try {
      const res = await Promise.all(batch.map(handler));
      results.push(...res);
    } catch (err) {
      console.error('Batch failed:', err.message);
    }
  }

  return results;
}

/**
 * ❗ Extract error safely (CPI returns plain text)
 */
export function extractError(errorText) {
  if (!errorText) return null;

  if (typeof errorText === 'string') {
    return errorText.trim();
  }

  // fallback if unexpected format
  try {
    return JSON.stringify(errorText);
  } catch {
    return 'UNKNOWN_ERROR_FORMAT';
  }
}

/**
 * 🔌 Extract adapter type
 */
export function extractAdapter(adapterRes) {
  const attrs = adapterRes?.d?.results || [];

  const adapter = attrs.find(a =>
    a.Name?.toLowerCase().includes('adapter')
  );

  return adapter?.Value || 'UNKNOWN';
}

/**
 * 🔁 Safe API call with retry
 */
export async function safeApiCall(api, options, retries = 2) {
  try {
    return await api.send(options);
  } catch (err) {

    if (retries > 0) {
      console.warn(`Retrying: ${options.path}`);
      return safeApiCall(api, options, retries - 1);
    }

    console.error('API call failed:', options.path, err.message);
    return null;
  }
}
export async function upsertMonitoredArtifacts(entity,logs) {

  if (!logs.length) return;

  // 🔹 Group latest timestamp per iFlow
  const latestMap = {};

  for (const log of logs) {

    const current = latestMap[log.iFlowName];

    if (
      !current ||
      new Date(log.logEnd) > new Date(current)
    ) {
      latestMap[log.iFlowName] = log.logEnd;
    }
  }

  // 🔹 Existing artifacts
  const existingArtifacts = await SELECT
    .from(entity);

  const existingMap = new Map(
    existingArtifacts.map(a => [a.iFlowName, a])
  );

  // 🔹 Upsert
  for (const [iFlowName, latestTimestamp] of Object.entries(latestMap)) {

    const existing = existingMap.get(iFlowName);

    if (existing) {

      // ✅ Update existing
      await UPDATE(entity)
        .set({
          lastPollTimestamp: latestTimestamp,
          isActive: true
        })
        .where({ ID: existing.ID });

      console.log(`Updated artifact: ${iFlowName}`);

    } else {

      // ✅ Insert new
      await INSERT.into(entity)
        .entries({
          iFlowName,
          iFlowId: iFlowName,
          namespace: 'DEFAULT',
          isActive: true,
          lastPollTimestamp: latestTimestamp
        });

      console.log(`Inserted new artifact: ${iFlowName}`);
    }
  }
}