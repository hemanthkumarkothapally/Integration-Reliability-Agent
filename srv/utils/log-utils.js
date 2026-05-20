// utils/log-utils.js

/**
 * -------------------------------------------------------
 * BASIC MESSAGE NORMALIZATION
 * -------------------------------------------------------
 */

export function normalizeCpiError(errorMessage) {
    if (!errorMessage) return '';

    let normalized = errorMessage;

    // Remove URLs
    normalized = normalized.replace(/https?:\/\/[^\s]+/gi, '');

    // Remove MPL IDs / GUID-like values
    normalized = normalized.replace(
      /\b[A-Za-z0-9_-]{20,}\b/g,
      ''
    );

    // Remove timestamps
    normalized = normalized.replace(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g,
      ''
    );

    // Remove file sizes
    normalized = normalized.replace(
      /\b\d+(\.\d+)?\s?(KB|MB|GB)\b/gi,
      ''
    );



    // Remove dates
    normalized = normalized.replace(
      /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{1,2}\s\d{2}:\d{2}:\d{2}\sUTC\s\d{4}/gi,
      ''
    );

    // Remove artifact/token names
    // normalized = normalized.replace(
    //   /artifactName\s+\S+/gi,
    //   ''
    // );

    // Remove quoted values
    normalized = normalized.replace(
      /'[^']*'/g,
      ''
    );
    normalized = normalized.replace(
      /\s*The MPL ID for the failed message is\s*:.*$/gi,
      ''
    ).trim();
    normalized = normalized.replace(/\s+/g, ' ').trim();
    return normalized;
  }

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

  // ── AUTH ────────────────────────────────────────────────────────────────
  { code: 'HTTP_401_BAD_CREDENTIALS',           match: /401|invalid_client|bad.credent/i },
  { code: 'HTTP_401_OAUTH_EXPIRED',             match: /oauth|token.*expir|expir.*token|access.token.*invalid/i },
  { code: 'HTTP_403_FORBIDDEN',                 match: /403|forbidden|insufficient.privileges|not.authorized/i },

  // ── SFTP ─────────────────────────────────────────────────────────────────
  { code: 'SFTP_CONNECTION_REFUSED',            match: /sftp.*refused|ssh.*connect.*refused|com\.jcraft\.jsch/i },
  { code: 'SFTP_AUTH_FAILURE',                  match: /sftp.*auth|Auth fail|publickey.*denied|hostkey.*mismatch/i },
  { code: 'SFTP_FILE_NOT_FOUND',                match: /sftp.*no such file|sftp.*file.*not.*found|No such file or directory/i },
  { code: 'SFTP_PERMISSION_DENIED',             match: /sftp.*permission denied|sftp.*cannot.*write/i },

  // ── CONNECTIVITY ─────────────────────────────────────────────────────────
  { code: 'HTTP_504_PARTNER_TIMEOUT',           match: /504|gateway.timeout/i },
  { code: 'CONNECTIVITY_TIMEOUT',               match: /timeout|read.timed.out|connection.timed.out|SocketTimeoutException/i },
  { code: 'CONNECTIVITY_REFUSED',               match: /connection.refused|ConnectException|ECONNREFUSED/i },
  { code: 'CONNECTIVITY_RESET',                 match: /connection.reset|ConnectionReset|SocketException.*reset/i },
  { code: 'CONNECTIVITY_DNS_FAILURE',           match: /UnknownHostException|failed to resolve|Name or service not known/i },
  { code: 'CONNECTIVITY_NETWORK_UNREACHABLE',   match: /Network is unreachable|No route to host|ENETUNREACH/i },

  // ── SSL / CERTIFICATES ───────────────────────────────────────────────────
  { code: 'SSL_HANDSHAKE_CERTIFICATE_EXPIRED',  match: /certificate.*expir|expir.*certificate|CertificateExpiredException/i },
  { code: 'SSL_HANDSHAKE_FAILURE',              match: /sslhandshake|SSLHandshakeException|pkix|PKIX.*path|unable.to.find.valid.cert/i },
  { code: 'SSL_CERTIFICATE_UNTRUSTED',          match: /self.signed|untrusted.*cert|cert.*not.trusted|SunCertPathBuilderException/i },
  { code: 'SSL_CERTIFICATE_HOSTNAME_MISMATCH',  match: /hostname.*mismatch|certificate.*hostname|No subject alternative/i },

  // ── GROOVY ───────────────────────────────────────────────────────────────
  { code: 'GROOVY_MISSING_PROPERTY',            match: /MissingPropertyException/i },
  { code: 'GROOVY_MISSING_METHOD',              match: /MissingMethodException|No signature of method/i },
  { code: 'GROOVY_NULL_POINTER',                match: /NullPointerException.*groovy|groovy.*NullPointer/i },
  { code: 'GROOVY_COMPILE_ERROR',               match: /MultipleCompilationErrors|unable.to.resolve.class/i },
  { code: 'GROOVY_SCRIPT_EXCEPTION',            match: /ScriptException|javax\.script/i },
  { code: 'GROOVY_CLASS_NOT_FOUND',             match: /ClassNotFoundException|NoClassDefFoundError/i },

  // ── XML / XSD ────────────────────────────────────────────────────────────
  { code: 'XML_VALIDATION_NON_XML_PAYLOAD',     match: /non-XML.payload|Validation.for.non-XML/i },
  { code: 'XML_VALIDATION_SCHEMA_ERROR',        match: /XmlValidation|SAXParseException|validation.failed.*xsd/i },
  { code: 'XML_PARSE_ERROR',                    match: /XMLStreamException|javax\.xml|unexpected.*element|Content is not allowed in prolog/i },
  { code: 'XML_NAMESPACE_ERROR',                match: /namespace.*mismatch|unexpected.*namespace|undeclared.*namespace/i },

  // ── XSLT ─────────────────────────────────────────────────────────────────
  { code: 'XSLT_NULL_REFERENCE',                match: /xslt.*null|null.*xslt|NullPointer.*xslt|xsl.*node.*null/i },
  { code: 'XSLT_TRANSFORMATION_ERROR',          match: /xslt|TransformerException|transformation.error/i },

  // ── MESSAGE MAPPING ───────────────────────────────────────────────────────
  { code: 'MESSAGE_MAPPING_FAILURE',            match: /message.mapping|mapping.*failed|MappingException|com\.sap\.it\.rt\.mapping/i },
  { code: 'MESSAGE_MAPPING_LOOKUP_FAILURE',     match: /value.mapping.*failed|lookup.*failed|mapping.*table.*not.found/i },

  // ── JSON ─────────────────────────────────────────────────────────────────
  { code: 'JSON_PARSE_ERROR',                   match: /json.parse|unexpected.token|JsonParseException|Unrecognized token/i },
  { code: 'JSON_MAPPING_ERROR',                 match: /JsonMappingException|Cannot deserialize|No suitable constructor/i },

  // ── SOAP ─────────────────────────────────────────────────────────────────
  { code: 'SOAP_FAULT',                         match: /soapfault|soap.fault|SOAPFaultException/i },
  { code: 'SOAP_ACTION_MISMATCH',               match: /SOAPAction.*mismatch|action.*not.supported/i },

  // ── ODATA ────────────────────────────────────────────────────────────────
  { code: 'ODATA_SERVICE_UNAVAILABLE',          match: /odata.*unavailable|odata.*503|service.*not.*available.*odata/i },
  { code: 'ODATA_BAD_REQUEST',                  match: /odata.*bad.request|invalid.key.predicate|ODataException/i },
  { code: 'ODATA_ENTITY_NOT_FOUND',             match: /odata.*404|entity.*not.*found.*odata/i },
  { code: 'ODATA_METADATA_FAILURE',             match: /metadata.*fetch.*fail|unable.*load.*metadata/i },

  // ── PAYLOAD / VALIDATION ──────────────────────────────────────────────────
  { code: 'PAYLOAD_VALIDATION_ERROR',           match: /payload.*invalid|invalid.*payload|schema.*validation.*failed|does not conform/i },
  { code: 'MANDATORY_FIELD_MISSING',            match: /MANDATORY_FIELD|field.*missing|missing.*payload|required.*field/i },
  { code: 'FIELD_MIN_LENGTH_VIOLATION',         match: /minLength|does.not.match.*required.simple.type/i },
  { code: 'FIELD_MAX_LENGTH_VIOLATION',         match: /maxLength|value.*too.long|exceeds.*maximum.*length/i },
  { code: 'FIELD_FORMAT_VIOLATION',             match: /invalid.*format|format.*invalid|does not match.*pattern/i },

  // ── CONVERSION ───────────────────────────────────────────────────────────
  { code: 'TYPE_CONVERSION_ERROR',              match: /Cannot.convert|convert.*string.*double|NumberFormat|ClassCastException/i },
  { code: 'DATE_PARSE_ERROR',                   match: /ParseException.*date|date.*parse.*fail|Unparseable date|invalid.*date.*format/i },

  // ── RATE LIMITING ─────────────────────────────────────────────────────────
  { code: 'RATE_LIMIT_EXCEEDED',                match: /429|rate.limit|quota.*exceed|throttl|too.many.requests/i },

  // ── DUPLICATE CHECK ───────────────────────────────────────────────────────
  { code: 'DUPLICATE_CHECK_NO_MESSAGE_ID',      match: /No.message.ID|could.not.be.found.*expression|exchangeProperty/i },
  { code: 'DUPLICATE_CHECK_EVENT_EXCEPTION',    match: /Error.Event.Exception/i },
  { code: 'DUPLICATE_MESSAGE_DETECTED',         match: /duplicate.*message|message.*already.*processed|idempotent.*duplicate/i },

  // ── MESSAGE SIZE ──────────────────────────────────────────────────────────
  { code: 'MSG_SIZE_LIMIT_EXCEEDED',            match: /size.limit|exceeds.*MB|body.size|message.*too.large|413/i },

  // ── JDBC / DATABASE ───────────────────────────────────────────────────────
  { code: 'JDBC_CONNECTION_FAILURE',            match: /jdbc.*connect|SQLException.*connect|datasource.*unavailable/i },
  { code: 'JDBC_QUERY_ERROR',                   match: /SQLException|ORA-|SQL.*syntax.*error|invalid.*column.*name/i },
  { code: 'JDBC_TIMEOUT',                       match: /jdbc.*timeout|query.*timeout|lock.*timeout.*sql/i },

  // ── IDoc ──────────────────────────────────────────────────────────────────
  { code: 'IDOC_SEND_FAILURE',                  match: /idoc.*send.*fail|IDoc.*error|IDOC_INBOUND_ASYNCHRONOUS/i },
  { code: 'IDOC_PARTNER_NOT_FOUND',             match: /partner.*profile.*not.found|idoc.*no.*partner/i },

  // ── RFC / BAPI ────────────────────────────────────────────────────────────
  { code: 'RFC_CONNECTION_FAILURE',             match: /RfcException|RFC.*connect|JCoException|destination.*not.*available/i },
  { code: 'RFC_FUNCTION_NOT_FOUND',             match: /function.*not.*found.*rfc|FunctionNotFoundException/i },
  { code: 'RFC_AUTHORIZATION_ERROR',            match: /RFC.*not.authorized|JCo.*authorization|ABAP.*auth.*failed/i },

  // ── AS2 / EDI ─────────────────────────────────────────────────────────────
  { code: 'AS2_MDN_FAILURE',                    match: /MDN.*fail|AS2.*acknowledgement.*fail|AS2.*negative.MDN/i },
  { code: 'EDI_PARSE_ERROR',                    match: /EDI.*parse|invalid.*EDI|ISA.*segment.*error|X12.*invalid/i },

  // ── INTEGRATION ADVISOR / AGREEMENTS ──────────────────────────────────────
  { code: 'IA_AGREEMENT_NOT_FOUND',             match: /agreement.*not.found|no.*active.*agreement|trading.*partner.*not/i },
  { code: 'IA_MAPPING_RUNTIME_ERROR',           match: /IntegrationAdvisor.*error|MAG.*runtime.*fail/i },

  // ── HTTP GENERIC ──────────────────────────────────────────────────────────
  { code: 'HTTP_500_INTERNAL_SERVER_ERROR',     match: /500|internal.server.error/i },
  { code: 'HTTP_503_SERVICE_UNAVAILABLE',       match: /503|service.unavailable/i },
  { code: 'HTTP_404_NOT_FOUND',                 match: /404|not.found/i },
  { code: 'HTTP_400_BAD_REQUEST',               match: /400|bad.request/i },
  { code: 'CREDENTIAL_ARTIFACT_NOT_FOUND', match: /No artifact descriptor found|artifactName|IllegalStateException.*artifact|artifact.*descriptor/i },
  // ── FALLBACK ──────────────────────────────────────────────────────────────
  { code: 'UNKNOWN_ERROR',                      match: /.*/  }
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
  logs,
  IS_API
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
    const iflowDetails = await ApiCall(IS_API, {
            method: 'GET',
            path: `/api/v1/IntegrationRuntimeArtifacts('${iFlowName}')`
          });
    const results = iflowDetails?.d || [];
    console.log("Fetched iFlow details for:", iFlowName, results);
    const existing =
      existingMap.get(iFlowName);

    if (existing) {

      await UPDATE(entity)
        .set({

          lastPollTimestamp:
            latestTimestamp,

          isActive: results.Status === 'STARTED'
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

          namespace: results.Type || 'UNKNOWN',

          isActive: results.Status === 'STARTED',

          lastPollTimestamp:
            latestTimestamp
        });

      console.log(
        `Inserted new artifact: ${iFlowName}`
      );
    }
  }
}