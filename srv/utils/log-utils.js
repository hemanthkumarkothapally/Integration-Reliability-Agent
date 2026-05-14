// utils/log-utils.js

/**
 * -------------------------------------------------------
 * BASIC MESSAGE NORMALIZATION
 * -------------------------------------------------------
 */

export function normalizeMessage(msg = '') {

  let m = msg || '';

  /*
   * GUIDs
   */

  m = m.replace(
    /[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}/g,
    '<GUID>'
  );

  /*
   * ISO timestamps
   */

  m = m.replace(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g,
    '<TIMESTAMP>'
  );

  /*
   * Long numeric IDs
   */

  m = m.replace(
    /\b\d{6,}\b/g,
    '<ID>'
  );

  /*
   * Hex transaction IDs
   */

  m = m.replace(
    /\b[a-f0-9]{32}\b/g,
    '<TXID>'
  );

  /*
   * Cleanup whitespace
   */

  m = m.replace(/\s+/g, ' ').trim();

  return m;
}

/**
 * -------------------------------------------------------
 * STRIP DYNAMIC VALUES
 * -------------------------------------------------------
 */

const STRIP_PATTERNS = [

  /*
   * GUIDs
   */

  {
    pattern:
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,

    replace: '<GUID>'
  },

  /*
   * MPL IDs
   */

  {
    pattern:
      /\bAG[A-Za-z0-9_-]{10,}\b/g,

    replace: '<MPL_ID>'
  },

  /*
   * Exchange IDs
   */

  {
    pattern:
      /Exchange\[[^\]]+\]/g,

    replace: 'Exchange[<ID>]'
  },

  /*
   * Hex strings
   */

  {
    pattern:
      /\b[0-9A-F]{10,}\b/g,

    replace: '<HEX>'
  },

  /*
   * File paths
   */

  {
    pattern:
      /\/xsd\/[^\s,]+/g,

    replace: '/xsd/<FILE>'
  },

  /*
   * Line numbers
   */

  {
    pattern:
      /Line\s*:\s*-?\d+,?\s*(Column\s*:\s*-?\d+)?/gi,

    replace: 'Line:<N>'
  },

  /*
   * Sizes
   */

  {
    pattern:
      /\d+\.\d+\s*MB/gi,

    replace: '<SIZE>MB'
  },

  /*
   * Quoted values
   */

  {
    pattern:
      /"[^"]{0,80}"/g,

    replace: '"<VALUE>"'
  },

  /*
   * Script lines
   */

  {
    pattern:
      /@\s*line\s*\d+\s*in\s*\S+/gi,

    replace: '@<LINE>'
  },

  /*
   * Script class names
   */

  {
    pattern:
      /script\d+__Script/gi,

    replace: '<SCRIPT_CLASS>'
  },

  /*
   * Numeric IDs
   */

  {
    pattern:
      /\b\d{5,}\b/g,

    replace: '<ID>'
  },

  /*
   * Timestamps
   */

  {
    pattern:
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g,

    replace: '<TS>'
  },

  /*
   * MPL Sentence
   */

  {
    pattern:
      /The MPL ID for the failed message is\s*:\s*\S+/gi,

    replace: ''
  },

  /*
   * Whitespace
   */

  {
    pattern:
      /\s{2,}/g,

    replace: ' '
  }
];

/**
 * -------------------------------------------------------
 * SIGNATURE RULES
 * -------------------------------------------------------
 */

const SIGNATURE_RULES = [

  // AUTH — most specific first
  { code: 'HTTP_401_BAD_CREDENTIALS',        match: /401|invalid_client|bad.credent/i },
  { code: 'HTTP_401_OAUTH_EXPIRED',          match: /oauth|token.*expir|expir.*token/i },

  // CONNECTIVITY
  { code: 'CONNECTIVITY_TIMEOUT',            match: /timeout|read.timed.out|connection.timed.out/i },
  { code: 'SSL_HANDSHAKE_FAILURE',           match: /sslhandshake|pkix|certificate/i },

  // GROOVY — before HTTP_500 so MissingPropertyException wins
  { code: 'GROOVY_MISSING_PROPERTY',         match: /MissingPropertyException/i },
  { code: 'GROOVY_COMPILE_ERROR',            match: /MultipleCompilationErrors|unable.to.resolve.class/i },
  { code: 'GROOVY_SCRIPT_EXCEPTION',         match: /ScriptException|javax\.script/i },

  // XML / XSD
  { code: 'XML_VALIDATION_NON_XML_PAYLOAD',  match: /non-XML.payload|Validation.for.non-XML/i },
  { code: 'XML_VALIDATION_SCHEMA_ERROR',     match: /XmlValidation|SAXParseException|validation.failed.*xsd/i },

  // XSLT / JSON / SOAP / ODATA
  { code: 'XSLT_TRANSFORMATION_ERROR',       match: /xslt|transformation.error/i },
  { code: 'JSON_PARSE_ERROR',                match: /json.parse|unexpected.token/i },
  { code: 'SOAP_FAULT',                      match: /soapfault|soap.fault/i },
  { code: 'ODATA_BAD_REQUEST',               match: /odata.*bad.request|invalid.key.predicate/i },

  // MANDATORY FIELDS
  { code: 'MANDATORY_FIELD_MISSING',         match: /MANDATORY_FIELD|field.*missing|missing.*payload/i },
  { code: 'FIELD_MIN_LENGTH_VIOLATION',      match: /minLength|does.not.match.*required.simple.type/i },

  // CONVERSION
  { code: 'TYPE_CONVERSION_ERROR',           match: /Cannot.convert|convert.*string.*double|NumberFormat/i },

  // DUPLICATE CHECK
  { code: 'DUPLICATE_CHECK_NO_MESSAGE_ID',   match: /No.message.ID|could.not.be.found.*expression|exchangeProperty/i },
  { code: 'DUPLICATE_CHECK_EVENT_EXCEPTION', match: /Error.Event.Exception/i },

  // MESSAGE SIZE
  { code: 'MSG_SIZE_LIMIT_EXCEEDED',         match: /size.limit|exceeds.*MB|body.size/i },

  // HTTP generic — LAST resort before UNKNOWN
  { code: 'HTTP_500_INTERNAL_SERVER_ERROR',  match: /500|internal.server.error/i },
  { code: 'HTTP_404_NOT_FOUND',              match: /404|not.found/i },

  // FALLBACK
  { code: 'UNKNOWN_ERROR',                   match: /.*/  }
];

/**
 * -------------------------------------------------------
 * NORMALISE SINGLE LOG
 * -------------------------------------------------------
 */

export function normaliseLog(inc = {}) {

  const raw = inc.errorMessage || inc.errorSignature || '';

  // Step 1 — strip dynamic values
  let cleaned = raw;
  for (const { pattern, replace } of STRIP_PATTERNS) {
    cleaned = cleaned.replace(pattern, replace);
  }
  cleaned = cleaned.trim();

  // Step 2 — match against RAW (not cleaned) so class names are still intact
  const rule = SIGNATURE_RULES.find(r => r.match.test(raw));
  const signature = rule?.code ?? 'UNKNOWN_ERROR';

  return {
    ...inc,
    errorMessage:   cleaned,    // stripped of noise
    errorSignature: signature   // derived from raw
  };
}

/**
 * -------------------------------------------------------
 * NORMALISE ALL LOGS
 * -------------------------------------------------------
 */

export function normaliseLogs(logs = []) {
  return logs.map(normaliseLog);
}

/**
 * -------------------------------------------------------
 * SAP DATE CONVERSION
 * -------------------------------------------------------
 */

export function convertDate(sapDate) {

  if (!sapDate)
    return null;

  const match =
    /\/Date\((\d+)\)\//
      .exec(sapDate);

  return match
    ? new Date(
        Number(match[1])
      ).toISOString()
    : null;
}

/**
 * -------------------------------------------------------
 * BATCH PROCESSOR
 * -------------------------------------------------------
 */

export async function processInBatches(
  items,
  handler,
  batchSize = 20
) {

  const results = [];

  for (
    let i = 0;
    i < items.length;
    i += batchSize
  ) {

    const batch =
      items.slice(
        i,
        i + batchSize
      );

    try {

      const res =
        await Promise.all(
          batch.map(handler)
        );

      results.push(...res);

    } catch (err) {

      console.error(
        'Batch failed:',
        err.message
      );
    }
  }

  return results;
}

/**
 * -------------------------------------------------------
 * EXTRACT ADAPTER
 * -------------------------------------------------------
 */

export function extractAdapter(adapterRes) {

  const attrs =
    adapterRes?.d?.results || [];

  const adapter =
    attrs.find(a =>
      a.Name
        ?.toLowerCase()
        .includes('adapter')
    );

  return adapter?.Value || 'UNKNOWN';
}

/**
 * -------------------------------------------------------
 * SAFE API CALL
 * -------------------------------------------------------
 */

export async function ApiCall(
  api,
  options,
  retries = 2
) {

  try {

    return await api.send(options);

  } catch (err) {

    console.error(
      `API Error (${options.path}):`,
      err.message
    );

    if (retries > 0) {

      console.warn(
        `Retrying: ${options.path}`
      );

      return ApiCall(
        api,
        options,
        retries - 1
      );
    }

    throw err;
  }
}

/**
 * -------------------------------------------------------
 * UPSERT MONITORED ARTIFACTS
 * -------------------------------------------------------
 */

export async function upsertMonitoredArtifacts(
  entity,
  logs
) {

  if (!logs.length)
    return;

  const latestMap = {};

  for (const log of logs) {

    const current =
      latestMap[log.iFlowName];

    if (
      !current ||
      new Date(log.logEnd) >
      new Date(current)
    ) {

      latestMap[
        log.iFlowName
      ] = log.logEnd;
    }
  }

  const existingArtifacts =
    await SELECT.from(entity);

  const existingMap =
    new Map(
      existingArtifacts.map(a => [
        a.iFlowName,
        a
      ])
    );

  for (const [
    iFlowName,
    latestTimestamp
  ] of Object.entries(latestMap)) {

    const existing =
      existingMap.get(iFlowName);

    if (existing) {

      await UPDATE(entity)
        .set({

          lastPollTimestamp:
            latestTimestamp,

          isActive: true
        })
        .where({
          ID: existing.ID
        });

      console.log(
        `Updated artifact: ${iFlowName}`
      );

    } else {

      await INSERT
        .into(entity)
        .entries({

          iFlowName,

          iFlowId:
            iFlowName,

          namespace:
            'DEFAULT',

          isActive: true,

          lastPollTimestamp:
            latestTimestamp
        });

      console.log(
        `Inserted new artifact: ${iFlowName}`
      );
    }
  }
}