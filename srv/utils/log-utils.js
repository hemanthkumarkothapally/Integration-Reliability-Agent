// utils/log-utils.js
import { getDestination } from '@sap-cloud-sdk/connectivity';
import { executeHttpRequest } from '@sap-cloud-sdk/http-client';
import { updateDailyMetrics ,updateDailyAIMetrics} from './daily-metrics.js';

/**
 * -------------------------------------------------------
 * BASIC MESSAGE NORMALIZATION
 * -------------------------------------------------------
 */
export function cleanRawError(s) {
  if (!s) return '';
  let raw = String(s).trim();

  // Drop Java stack trace lines (everything after the first "\n\tat ...")
  raw = raw.replace(/\n\s*at [\s\S]*$/g, '');

  // Drop "Caused by:" cascades — keep only the first cause statement
  const causedByMatch = raw.match(/^([\s\S]*?)(?:\nCaused by:|\n\s+caused by:)/i);
  if (causedByMatch) raw = causedByMatch[1].trim();

  // Collapse internal whitespace
  raw = raw.replace(/\s+/g, ' ').trim();

  return raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — STRIP volatile fragments
// ─────────────────────────────────────────────────────────────────────────────

export function stripVolatileFragments(s) {
  return s
    // Timestamps (ISO and RFC-style date strings)
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '<TS>')
    .replace(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2} \d{2}:\d{2}:\d{2} \w{3,4} \d{4}/gi, '<DATE>')

    // UUIDs and message identifiers
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
    .replace(/messageGuid[=:\s]+[A-Za-z0-9_-]+/gi, 'messageGuid=<ID>')

    // Generic [key=value] pairs inside brackets — catches messageId, attempt,
    // request, correlationId, traceId, anything similar
    .replace(/\[[a-zA-Z_][a-zA-Z0-9_]*=[^\]]+\]/g, '[<KV>]')

    // IPv4 addresses
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '<IP>')

    // Hostnames (only when adjacent to network punctuation, NOT Java packages)
    .replace(
      /(?<=[\s/(@\[,])((?:[a-z0-9][a-z0-9-]*\.)+[a-z]{2,})(?=[:/\s\]])/gi,
      '<HOST>'
    )

    // Ports
    .replace(/:\d{2,5}\b/g, ':<PORT>')
    .replace(/port \d{2,5}/gi, 'port <PORT>')

    // File paths
    .replace(/[a-zA-Z]:\\[^\s]+/g, '<PATH>')                              // Windows
    .replace(/\/[A-Za-z0-9_\-./]+\.(xsl|xslt|xml|groovy|js|jar|json|properties|csv)\b/gi, '<PATH>')

    // File names with code/config extensions (must follow whitespace or '/')
    .replace(/(?<=[\s/])([A-Za-z0-9_-]+\.(?:xsl|xslt|xml|groovy|js|jar|properties|csv))\b/gi, '<FILE>')

    // Line and column numbers
    .replace(/at line \d+/gi, 'at line <N>')
    .replace(/\bline\s*\d+/gi, 'line <N>')
    .replace(/lineNumber:\s*\d+/gi, 'lineNumber: <N>')
    .replace(/columnNumber:\s*\d+/gi, 'columnNumber: <N>')
    .replace(/:\d+\)/g, ':<N>)')

    // Domain-specific volatile fields
    .replace(/artifactName\s+\S+/gi, 'artifactName <NAME>')
    .replace(/alias\s+'[^']+'/gi, "alias '<NAME>'")
    .replace(/DEST=\S+/gi, 'DEST=<DEST>')
    .replace(/ASHOST=\S+/gi, 'ASHOST=<HOST>')
    .replace(/SYSNR=\d+/gi, 'SYSNR=<NR>')
    .replace(/PCS=\d+/gi, 'PCS=<NR>')
    .replace(/TYPE=[A-Z]/g, 'TYPE=<X>')

    // Quoted strings (URLs, payload values, identifiers in quotes)
    .replace(/'[^']{0,200}'/g, "'<STR>'")
    .replace(/"[^"]{0,200}"/g, '"<STR>"')

    // HTTP URLs
    .replace(/https?:\/\/\S+/gi, '<URL>')

    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
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

  // let RawError = cleanRawError(errorMessage);
  // let strippedError = stripVolatileFragments(RawError);
  // return strippedError;
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
  { code: 'HTTP_401_BAD_CREDENTIALS', match: /401|invalid_client|bad.credent/i },
  { code: 'HTTP_401_OAUTH_EXPIRED', match: /oauth|token.*expir|expir.*token|access.token.*invalid/i },
  { code: 'HTTP_403_FORBIDDEN', match: /403|forbidden|insufficient.privileges|not.authorized/i },
  { code: 'HTTP_401_BASIC_AUTH_FAILURE', match: /basic.*auth.*fail|WWW-Authenticate.*Basic|invalid.*username.*password/i },
  { code: 'HTTP_401_CLIENT_CERT_MISSING', match: /client.*certificate.*required|mutual.*tls.*fail|no.*client.*cert/i },
  { code: 'OAUTH_TOKEN_FETCH_FAILURE', match: /token.*endpoint.*fail|unable.*fetch.*token|token.*request.*failed|grant_type/i },
  { code: 'OAUTH_SCOPE_INSUFFICIENT', match: /insufficient.*scope|scope.*not.*granted|required.*scope.*missing/i },
  { code: 'SAML_ASSERTION_FAILURE', match: /saml.*assertion|SAMLException|saml.*invalid|assertion.*expired/i },

  // ── SFTP ─────────────────────────────────────────────────────────────────
  { code: 'SFTP_CONNECTION_REFUSED', match: /sftp.*refused|ssh.*connect.*refused|com\.jcraft\.jsch/i },
  { code: 'SFTP_AUTH_FAILURE', match: /sftp.*auth|Auth fail|publickey.*denied|hostkey.*mismatch/i },
  { code: 'SFTP_FILE_NOT_FOUND', match: /sftp.*no such file|sftp.*file.*not.*found|No such file or directory/i },
  { code: 'SFTP_PERMISSION_DENIED', match: /sftp.*permission denied|sftp.*cannot.*write/i },
  { code: 'SFTP_HOST_KEY_CHANGED', match: /host.*key.*changed|WARNING.*REMOTE HOST|POSSIBLE.*ATTACK/i },
  { code: 'SFTP_DIRECTORY_NOT_FOUND', match: /sftp.*no such.*dir|sftp.*directory.*not.*exist|chdir.*fail/i },
  { code: 'SFTP_TRANSFER_INTERRUPTED', match: /sftp.*broken.*pipe|sftp.*transfer.*interrupt|Pipe.*closed/i },
  { code: 'SFTP_FILE_LOCKED', match: /sftp.*lock|file.*in.*use.*sftp|sftp.*cannot.*open.*locked/i },

  // ── CONNECTIVITY ─────────────────────────────────────────────────────────
  { code: 'HTTP_504_PARTNER_TIMEOUT', match: /504|gateway.timeout/i },
  { code: 'CONNECTIVITY_TIMEOUT', match: /timeout|read.timed.out|connection.timed.out|SocketTimeoutException/i },
  { code: 'CONNECTIVITY_REFUSED', match: /connection.refused|ConnectException|ECONNREFUSED/i },
  { code: 'CONNECTIVITY_RESET', match: /connection.reset|ConnectionReset|SocketException.*reset/i },
  { code: 'CONNECTIVITY_DNS_FAILURE', match: /UnknownHostException|failed to resolve|Name or service not known/i },
  { code: 'CONNECTIVITY_NETWORK_UNREACHABLE', match: /Network is unreachable|No route to host|ENETUNREACH/i },
  { code: 'CONNECTIVITY_PROXY_FAILURE', match: /proxy.*connect.*fail|407.*proxy|proxy.*auth.*required|tunnel.*fail/i },
  { code: 'CONNECTIVITY_KEEP_ALIVE_FAILURE', match: /keep.alive.*fail|persistent.*connection.*drop|connection.*pool.*exhaust/i },
  { code: 'CONNECTIVITY_SOCKET_CLOSED', match: /Socket.*closed|Broken pipe|java\.net\.SocketException.*closed/i },
  { code: 'CONNECTIVITY_PORT_UNREACHABLE', match: /port.*unreachable|ECONNREFUSED.*port|destination.*port.*unreachable/i },
  { code: 'CONNECTIVITY_LOAD_BALANCER_ERROR', match: /load.balancer.*error|upstream.*unavailable|502.*bad.*gateway/i },

  // ── SSL / CERTIFICATES ───────────────────────────────────────────────────
  { code: 'SSL_HANDSHAKE_CERTIFICATE_EXPIRED', match: /certificate.*expir|expir.*certificate|CertificateExpiredException/i },
  { code: 'SSL_HANDSHAKE_FAILURE', match: /sslhandshake|SSLHandshakeException|pkix|PKIX.*path|unable.to.find.valid.cert/i },
  { code: 'SSL_CERTIFICATE_UNTRUSTED', match: /self.signed|untrusted.*cert|cert.*not.trusted|SunCertPathBuilderException/i },
  { code: 'SSL_CERTIFICATE_HOSTNAME_MISMATCH', match: /hostname.*mismatch|certificate.*hostname|No subject alternative/i },
  { code: 'SSL_PROTOCOL_VERSION_MISMATCH', match: /TLS.*version|protocol.*mismatch|SSLv3.*disabled|TLSv1\.0.*not.*supported/i },
  { code: 'SSL_CIPHER_SUITE_MISMATCH', match: /no.*cipher.*suite|cipher.*not.*supported|handshake.*cipher/i },
  { code: 'SSL_CERTIFICATE_REVOKED', match: /certificate.*revoked|CRL.*check.*fail|OCSP.*revoked/i },
  { code: 'SSL_KEYSTORE_ERROR', match: /keystore.*load.*fail|KeyStoreException|keystore.*password.*wrong|keystore.*corrupt/i },
  { code: 'SSL_TRUSTSTORE_ERROR', match: /truststore.*fail|trust.*anchor.*found|no.*trusted.*certificate/i },

  // ── GROOVY ───────────────────────────────────────────────────────────────
  { code: 'GROOVY_MISSING_PROPERTY', match: /MissingPropertyException/i },
  { code: 'GROOVY_MISSING_METHOD', match: /MissingMethodException|No signature of method/i },
  { code: 'GROOVY_NULL_POINTER', match: /NullPointerException.*groovy|groovy.*NullPointer/i },
  { code: 'GROOVY_COMPILE_ERROR', match: /MultipleCompilationErrors|unable.to.resolve.class/i },
  { code: 'GROOVY_SCRIPT_EXCEPTION', match: /ScriptException|javax\.script/i },
  { code: 'GROOVY_CLASS_NOT_FOUND', match: /ClassNotFoundException|NoClassDefFoundError/i },
  { code: 'GROOVY_STACK_OVERFLOW', match: /StackOverflowError.*groovy|groovy.*infinite.*loop|groovy.*recursion/i },
  { code: 'GROOVY_ARRAY_INDEX_OUT_OF_BOUNDS', match: /ArrayIndexOutOfBoundsException|IndexOutOfBoundsException/i },
  { code: 'GROOVY_CAST_EXCEPTION', match: /GroovyCastException|Cannot cast|cannot.*coerce/i },
  { code: 'GROOVY_ASSERTION_FAILED', match: /AssertionError.*groovy|groovy.*assert.*fail/i },
  { code: 'GROOVY_CONCURRENT_MODIFICATION', match: /ConcurrentModificationException/i },
  { code: 'GROOVY_MEMORY_ERROR', match: /OutOfMemoryError|java\.lang\.OutOfMemory|heap.*space/i },

  // ── XML / XSD ────────────────────────────────────────────────────────────
  { code: 'XML_VALIDATION_NON_XML_PAYLOAD', match: /non-XML.payload|Validation.for.non-XML/i },
  { code: 'XML_VALIDATION_SCHEMA_ERROR', match: /XmlValidation|SAXParseException|validation.failed.*xsd/i },
  { code: 'XML_PARSE_ERROR', match: /XMLStreamException|javax\.xml|unexpected.*element|Content is not allowed in prolog/i },
  { code: 'XML_NAMESPACE_ERROR', match: /namespace.*mismatch|unexpected.*namespace|undeclared.*namespace/i },
  { code: 'XML_ENCODING_ERROR', match: /encoding.*error|invalid.*encoding|UTF.*BOM|MalformedByteSequence/i },
  { code: 'XML_SCHEMA_NOT_FOUND', match: /schema.*not.*found|xsd.*missing|schema.*location.*fail/i },
  { code: 'XML_ELEMENT_NOT_ALLOWED', match: /element.*not.*allowed|unexpected.*child.*element|invalid.*element.*content/i },
  { code: 'XML_CDATA_ERROR', match: /CDATA.*invalid|illegal.*CDATA|CDATA.*section.*error/i },
  { code: 'XML_SIGNATURE_VALIDATION_FAILURE', match: /xml.*signature.*invalid|XMLSignature.*fail|signature.*verification.*fail/i },
  { code: 'XML_ENCRYPTION_ERROR', match: /xml.*encrypt.*fail|XMLEncryption.*error|decrypt.*xml.*fail/i },

  // ── XSLT ─────────────────────────────────────────────────────────────────
  { code: 'XSLT_NULL_REFERENCE', match: /xslt.*null|null.*xslt|NullPointer.*xslt|xsl.*node.*null/i },
  { code: 'XSLT_TRANSFORMATION_ERROR', match: /xslt|TransformerException|transformation.error/i },
  { code: 'XSLT_TEMPLATE_NOT_FOUND', match: /xsl.*template.*not.*found|no.*matching.*template|xslt.*template.*missing/i },
  { code: 'XSLT_VARIABLE_UNDEFINED', match: /xsl.*variable.*undefined|xslt.*param.*not.*set|undefined.*variable.*xsl/i },
  { code: 'XSLT_FUNCTION_NOT_FOUND', match: /xsl.*function.*not.*found|unknown.*function.*xslt/i },

  // ── MESSAGE MAPPING ───────────────────────────────────────────────────────
  { code: 'MESSAGE_MAPPING_FAILURE', match: /message.mapping|mapping.*failed|MappingException|com\.sap\.it\.rt\.mapping/i },
  { code: 'MESSAGE_MAPPING_LOOKUP_FAILURE', match: /value.mapping.*failed|lookup.*failed|mapping.*table.*not.found/i },
  { code: 'MESSAGE_MAPPING_RUNTIME_EXCEPTION', match: /mapping.*runtime.*exception|UDF.*exception|user.*defined.*function.*fail/i },
  { code: 'MESSAGE_MAPPING_SOURCE_EMPTY', match: /source.*structure.*empty|no.*source.*node|mapping.*source.*null/i },
  { code: 'MESSAGE_MAPPING_TARGET_REQUIRED', match: /target.*field.*required|mandatory.*target.*missing|mapping.*target.*null/i },

  // ── JSON ─────────────────────────────────────────────────────────────────
  { code: 'JSON_PARSE_ERROR', match: /json.parse|unexpected.token|JsonParseException|Unrecognized token/i },
  { code: 'JSON_MAPPING_ERROR', match: /JsonMappingException|Cannot deserialize|No suitable constructor/i },
  { code: 'JSON_SCHEMA_VALIDATION_ERROR', match: /json.*schema.*invalid|json.*does.*not.*conform|ajv.*validation/i },
  { code: 'JSON_SERIALIZATION_ERROR', match: /json.*serial.*fail|JsonProcessingException|cannot.*serialize/i },
  { code: 'JSON_ENCODING_ERROR', match: /json.*encoding.*error|invalid.*json.*character|escape.*sequence.*invalid/i },

  // ── SOAP ─────────────────────────────────────────────────────────────────
  { code: 'SOAP_FAULT', match: /soapfault|soap.fault|SOAPFaultException/i },
  { code: 'SOAP_ACTION_MISMATCH', match: /SOAPAction.*mismatch|action.*not.supported/i },
  { code: 'SOAP_WSDL_NOT_FOUND', match: /wsdl.*not.*found|wsdl.*fetch.*fail|unable.*load.*wsdl/i },
  { code: 'SOAP_OPERATION_NOT_FOUND', match: /operation.*not.*found.*soap|soap.*operation.*undefined/i },
  { code: 'SOAP_MESSAGE_FORMAT_ERROR', match: /soap.*message.*invalid|malformed.*soap|soap.*envelope.*error/i },
  { code: 'SOAP_WS_SECURITY_ERROR', match: /WS-Security|WSSecurityException|ws.*security.*fail|security.*header.*invalid/i },
  { code: 'SOAP_MUSTUNDERSTAND_ERROR', match: /MustUnderstand|header.*not.*understood|soap.*header.*error/i },

  // ── ODATA ────────────────────────────────────────────────────────────────
  { code: 'ODATA_SERVICE_UNAVAILABLE', match: /odata.*unavailable|odata.*503|service.*not.*available.*odata/i },
  { code: 'ODATA_BAD_REQUEST', match: /odata.*bad.request|invalid.key.predicate|ODataException/i },
  { code: 'ODATA_ENTITY_NOT_FOUND', match: /odata.*404|entity.*not.*found.*odata/i },
  { code: 'ODATA_METADATA_FAILURE', match: /metadata.*fetch.*fail|unable.*load.*metadata/i },
  { code: 'ODATA_BATCH_FAILURE', match: /odata.*batch.*fail|batch.*request.*error|\$batch.*error/i },
  { code: 'ODATA_FILTER_PARSE_ERROR', match: /odata.*filter.*invalid|filter.*parse.*error|\$filter.*syntax/i },
  { code: 'ODATA_CONCURRENCY_ERROR', match: /odata.*concurrency|ETag.*mismatch|412.*precondition/i },
  { code: 'ODATA_NAVIGATION_PROPERTY_ERROR', match: /navigation.*property.*fail|expand.*error.*odata|\$expand.*invalid/i },

  // ── PAYLOAD / VALIDATION ──────────────────────────────────────────────────
  { code: 'PAYLOAD_VALIDATION_ERROR', match: /payload.*invalid|invalid.*payload|schema.*validation.*failed|does not conform/i },
  { code: 'MANDATORY_FIELD_MISSING', match: /MANDATORY_FIELD|field.*missing|missing.*payload|required.*field/i },
  { code: 'FIELD_MIN_LENGTH_VIOLATION', match: /minLength|does.not.match.*required.simple.type/i },
  { code: 'FIELD_MAX_LENGTH_VIOLATION', match: /maxLength|value.*too.long|exceeds.*maximum.*length/i },
  { code: 'FIELD_FORMAT_VIOLATION', match: /invalid.*format|format.*invalid|does not match.*pattern/i },
  { code: 'PAYLOAD_TOO_LARGE', match: /payload.*too.*large|request.*entity.*too.*large|413.*payload/i },
  { code: 'PAYLOAD_EMPTY', match: /empty.*payload|payload.*null|no.*body.*found|body.*empty/i },
  { code: 'PAYLOAD_ENCODING_MISMATCH', match: /encoding.*mismatch|charset.*mismatch|content.*encoding.*invalid/i },
  { code: 'PAYLOAD_CONTENT_TYPE_MISMATCH', match: /content.type.*mismatch|415.*unsupported.*media|media.*type.*not.*supported/i },

  // ── CONVERSION ───────────────────────────────────────────────────────────
  { code: 'TYPE_CONVERSION_ERROR', match: /Cannot.convert|convert.*string.*double|NumberFormat|ClassCastException/i },
  { code: 'DATE_PARSE_ERROR', match: /ParseException.*date|date.*parse.*fail|Unparseable date|invalid.*date.*format/i },
  { code: 'CHARSET_CONVERSION_ERROR', match: /charset.*conversion|UnsupportedEncodingException|MalformedInputException/i },
  { code: 'BASE64_DECODE_ERROR', match: /base64.*decode.*fail|invalid.*base64|IllegalArgumentException.*base64/i },

  // ── RATE LIMITING ─────────────────────────────────────────────────────────
  { code: 'RATE_LIMIT_EXCEEDED', match: /429|rate.limit|quota.*exceed|throttl|too.many.requests/i },
  { code: 'API_DAILY_QUOTA_EXCEEDED', match: /daily.*quota|quota.*exhausted|API.*limit.*reached.*day/i },
  { code: 'CONCURRENT_REQUEST_LIMIT', match: /concurrent.*request.*limit|too.*many.*concurrent|parallel.*limit.*exceed/i },

  // ── DUPLICATE CHECK ───────────────────────────────────────────────────────
  { code: 'DUPLICATE_CHECK_NO_MESSAGE_ID', match: /No.message.ID|could.not.be.found.*expression|exchangeProperty/i },
  { code: 'DUPLICATE_CHECK_EVENT_EXCEPTION', match: /Error.Event.Exception/i },
  { code: 'DUPLICATE_MESSAGE_DETECTED', match: /duplicate.*message|message.*already.*processed|idempotent.*duplicate/i },
  { code: 'DUPLICATE_CHECK_STORE_FAILURE', match: /idempotent.*store.*fail|duplicate.*store.*unavailable|JMS.*idempotent/i },

  // ── MESSAGE SIZE ──────────────────────────────────────────────────────────
  { code: 'MSG_SIZE_LIMIT_EXCEEDED', match: /size.limit|exceeds.*MB|body.size|message.*too.large|413/i },
  { code: 'MSG_ATTACHMENT_TOO_LARGE', match: /attachment.*too.*large|attachment.*size.*exceed|multipart.*size.*limit/i },
  { code: 'MSG_HEADER_TOO_LARGE', match: /header.*too.*large|request.*header.*field.*too.*large|431/i },

  // ── JDBC / DATABASE ───────────────────────────────────────────────────────
  { code: 'JDBC_CONNECTION_FAILURE', match: /jdbc.*connect|SQLException.*connect|datasource.*unavailable/i },
  { code: 'JDBC_QUERY_ERROR', match: /SQLException|ORA-|SQL.*syntax.*error|invalid.*column.*name/i },
  { code: 'JDBC_TIMEOUT', match: /jdbc.*timeout|query.*timeout|lock.*timeout.*sql/i },
  { code: 'JDBC_DUPLICATE_KEY', match: /duplicate.*key.*jdbc|unique.*constraint.*violated|ORA-00001|SQLIntegrityConstraintViolation/i },
  { code: 'JDBC_TABLE_NOT_FOUND', match: /table.*not.*found.*sql|ORA-00942|relation.*does.*not.*exist/i },
  { code: 'JDBC_CONNECTION_POOL_EXHAUSTED', match: /connection.*pool.*exhaust|no.*available.*connection.*jdbc|pool.*timeout/i },
  { code: 'JDBC_TRANSACTION_ROLLBACK', match: /transaction.*rollback|TransactionRolledbackException|rollback.*exception/i },
  { code: 'JDBC_DEADLOCK', match: /deadlock.*detected|ORA-00060|Lock wait timeout.*exceeded/i },

  // ── IDoc ──────────────────────────────────────────────────────────────────
  { code: 'IDOC_SEND_FAILURE', match: /idoc.*send.*fail|IDoc.*error|IDOC_INBOUND_ASYNCHRONOUS/i },
  { code: 'IDOC_PARTNER_NOT_FOUND', match: /partner.*profile.*not.found|idoc.*no.*partner/i },
  { code: 'IDOC_SEGMENT_ERROR', match: /idoc.*segment.*invalid|segment.*definition.*not.*found|IDOC.*segment.*unknown/i },
  { code: 'IDOC_STATUS_ERROR', match: /idoc.*status.*51|idoc.*status.*56|idoc.*posting.*fail/i },
  { code: 'IDOC_NUMBER_RANGE_EXHAUSTED', match: /idoc.*number.*range|number.*range.*exhausted.*idoc/i },
  { code: 'IDOC_SYNTAX_ERROR', match: /idoc.*syntax.*error|idoc.*mandatory.*segment.*missing/i },

  // ── RFC / BAPI ────────────────────────────────────────────────────────────
  { code: 'RFC_CONNECTION_FAILURE', match: /RfcException|RFC.*connect|JCoException|destination.*not.*available/i },
  { code: 'RFC_FUNCTION_NOT_FOUND', match: /function.*not.*found.*rfc|FunctionNotFoundException/i },
  { code: 'RFC_AUTHORIZATION_ERROR', match: /RFC.*not.authorized|JCo.*authorization|ABAP.*auth.*failed/i },
  { code: 'RFC_ABAP_RUNTIME_ERROR', match: /ABAP.*runtime.*error|DUMP.*ABAP|short.*dump/i },
  { code: 'RFC_TABLE_ACCESS_DENIED', match: /RFC.*table.*access.*denied|S_TABU_DIS|authorization.*table/i },
  { code: 'RFC_LOGON_FAILURE', match: /RFC.*logon.*fail|JCo.*logon|SAP.*logon.*error|client.*not.*available/i },
  { code: 'RFC_SYSTEM_NOT_AVAILABLE', match: /RFC.*system.*not.*available|SAP.*system.*down|ABAP.*system.*unavailable/i },

  // ── AS2 / EDI ─────────────────────────────────────────────────────────────
  { code: 'AS2_MDN_FAILURE', match: /MDN.*fail|AS2.*acknowledgement.*fail|AS2.*negative.MDN/i },
  { code: 'EDI_PARSE_ERROR', match: /EDI.*parse|invalid.*EDI|ISA.*segment.*error|X12.*invalid/i },
  { code: 'AS2_SIGNATURE_INVALID', match: /AS2.*signature.*invalid|AS2.*certificate.*mismatch|AS2.*integrity.*check/i },
  { code: 'AS2_ENCRYPTION_FAILURE', match: /AS2.*encrypt.*fail|AS2.*decrypt.*fail|AS2.*CMS.*error/i },
  { code: 'EDI_FUNCTIONAL_ACK_REJECTED', match: /997.*rejected|999.*rejected|functional.*ack.*reject|AK5.*R/i },
  { code: 'EDIFACT_PARSE_ERROR', match: /EDIFACT.*error|UNA.*segment|UNB.*invalid|EDIFACT.*syntax/i },

  // ── INTEGRATION ADVISOR / AGREEMENTS ──────────────────────────────────────
  { code: 'IA_AGREEMENT_NOT_FOUND', match: /agreement.*not.found|no.*active.*agreement|trading.*partner.*not/i },
  { code: 'IA_MAPPING_RUNTIME_ERROR', match: /IntegrationAdvisor.*error|MAG.*runtime.*fail/i },
  { code: 'IA_CODELIST_NOT_FOUND', match: /code.*list.*not.*found|codelist.*missing.*IA|qualifier.*not.*in.*list/i },
  { code: 'IA_SCHEMA_VERSION_MISMATCH', match: /schema.*version.*mismatch.*IA|IA.*version.*not.*supported/i },

  // ── JMS / MESSAGING ──────────────────────────────────────────────────────
  { code: 'JMS_QUEUE_NOT_FOUND', match: /JMS.*queue.*not.*found|destination.*not.*exist.*JMS|InvalidDestinationException/i },
  { code: 'JMS_CONNECTION_FAILURE', match: /JMS.*connect.*fail|JMSException.*connect|messaging.*broker.*unavailable/i },
  { code: 'JMS_MESSAGE_EXPIRED', match: /JMS.*message.*expired|message.*TTL.*exceeded|MessageExpiredException/i },
  { code: 'JMS_TRANSACTION_FAILURE', match: /JMS.*transaction.*fail|JMS.*commit.*fail|JMSException.*transaction/i },
  { code: 'JMS_QUEUE_FULL', match: /JMS.*queue.*full|queue.*capacity.*exceeded|ResourceAllocationException/i },
  { code: 'JMS_DEAD_LETTER_QUEUE', match: /dead.*letter.*queue|DLQ|message.*moved.*dead.*letter/i },
  { code: 'JMS_POISON_MESSAGE', match: /poison.*message|max.*redelivery.*exceeded|message.*redelivery.*limit/i },

  // ── MAIL / SMTP ───────────────────────────────────────────────────────────
  { code: 'MAIL_SMTP_AUTH_FAILURE', match: /smtp.*auth.*fail|535.*auth|javax\.mail.*auth/i },
  { code: 'MAIL_SMTP_CONNECTION_FAILURE', match: /smtp.*connect.*fail|MessagingException.*connect|mail.*server.*refused/i },
  { code: 'MAIL_SMTP_RECIPIENT_REJECTED', match: /recipient.*rejected|550.*user.*unknown|no.*such.*user.*smtp/i },
  { code: 'MAIL_ATTACHMENT_ERROR', match: /mail.*attachment.*fail|MessagingException.*attachment|multipart.*mail.*error/i },
  { code: 'MAIL_IMAP_FOLDER_NOT_FOUND', match: /imap.*folder.*not.*found|FolderNotFoundException|mailbox.*not.*exist/i },

  // ── PROCESS DIRECT / LOCAL CALLS ─────────────────────────────────────────
  { code: 'PROCESS_DIRECT_CHANNEL_NOT_FOUND', match: /ProcessDirect.*not.*found|pd.*channel.*unavailable|ProcessDirect.*endpoint.*missing/i },
  { code: 'PROCESS_DIRECT_TIMEOUT', match: /ProcessDirect.*timeout|pd.*timeout|local.*call.*timed.*out/i },
  { code: 'PROCESS_DIRECT_CONCURRENT_LIMIT', match: /ProcessDirect.*concurrent|pd.*max.*caller|local.*integration.*busy/i },

  // ── CONTENT MODIFIER / HEADER ─────────────────────────────────────────────
  { code: 'HEADER_PROPERTY_NOT_FOUND', match: /header.*not.*found.*property|property.*undefined.*header|exchangeProperty.*null/i },
  { code: 'CONTENT_MODIFIER_XPATH_ERROR', match: /content.*modifier.*xpath|xpath.*content.*modifier.*fail|XPath.*evaluation.*fail/i },
  { code: 'DYNAMIC_PARAMETER_RESOLUTION_FAILURE', match: /dynamic.*endpoint.*fail|dynamic.*receiver.*resolve|AdapterException.*dynamic/i },

  // ── EXCEPTION SUBPROCESS ─────────────────────────────────────────────────
  { code: 'ESCALATION_EVENT_TRIGGERED', match: /escalation.*event|EscalationException|exception.*escalat/i },
  { code: 'EXCEPTION_SUBPROCESS_FAILURE', match: /exception.*subprocess.*fail|error.*handler.*fail|exception.*handling.*error/i },
  { code: 'RETRY_EXHAUSTED', match: /retry.*exhausted|max.*retry.*reached|maximum.*attempts.*exceeded/i },
  { code: 'DEAD_LETTER_AFTER_RETRY', match: /dead.*letter.*retry|retry.*dead.*letter|undeliverable.*after.*retry/i },

  // ── SECURITY / ENCRYPTION ────────────────────────────────────────────────
  { code: 'PGP_DECRYPTION_FAILURE', match: /pgp.*decrypt.*fail|PGP.*key.*not.*found|OpenPGP.*error/i },
  { code: 'PGP_ENCRYPTION_FAILURE', match: /pgp.*encrypt.*fail|PGP.*public.*key.*missing/i },
  { code: 'PGP_SIGNATURE_VERIFICATION_FAILURE', match: /pgp.*signature.*invalid|PGP.*verify.*fail|OpenPGP.*signature/i },
  { code: 'KEYSTORE_ENTRY_NOT_FOUND', match: /keystore.*entry.*not.*found|alias.*not.*found.*keystore|certificate.*alias.*missing/i },
  { code: 'CSRF_TOKEN_FETCH_FAILURE', match: /csrf.*token.*fail|X-CSRF-Token.*fail|fetch.*csrf/i },

  // ── SPLITTER / AGGREGATOR ────────────────────────────────────────────────
  { code: 'SPLITTER_XPATH_ERROR', match: /splitter.*xpath.*fail|split.*expression.*error|XPath.*splitter/i },
  { code: 'AGGREGATOR_TIMEOUT', match: /aggregat.*timeout|aggregation.*expire|AggregationStrategy.*timeout/i },
  { code: 'AGGREGATOR_CONDITION_FAILURE', match: /aggregat.*condition.*fail|completion.*condition.*error|aggregat.*strategy.*fail/i },
  { code: 'SPLITTER_NO_ELEMENTS', match: /splitter.*no.*element|split.*result.*empty|nothing.*to.*split/i },

  // ── SCRIPT COLLECTION ────────────────────────────────────────────────────
  { code: 'SCRIPT_COLLECTION_NOT_FOUND', match: /script.*collection.*not.*found|jar.*not.*found.*script|external.*library.*missing/i },
  { code: 'SCRIPT_COLLECTION_CLASS_CONFLICT', match: /script.*class.*conflict|duplicate.*class.*script|library.*version.*conflict/i },

  // ── CPI RUNTIME / INFRASTRUCTURE ─────────────────────────────────────────
  { code: 'IFLOW_DEPLOYMENT_FAILURE', match: /deploy.*fail|iflow.*deploy.*error|artifact.*deploy.*exception/i },
  { code: 'IFLOW_NOT_DEPLOYED', match: /iflow.*not.*deployed|integration.*flow.*not.*started|artifact.*not.*active/i },
  { code: 'WORKER_NODE_UNAVAILABLE', match: /worker.*node.*unavailable|runtime.*node.*fail|CPI.*worker.*down/i },
  { code: 'TENANT_RESOURCE_EXHAUSTED', match: /tenant.*resource.*exhaust|quota.*tenant|memory.*limit.*tenant/i },
  { code: 'RUNTIME_EXCEPTION_UNHANDLED', match: /unhandled.*runtime.*exception|uncaught.*exception.*runtime|FATAL.*runtime/i },

  // ── HTTP GENERIC ──────────────────────────────────────────────────────────
  { code: 'HTTP_500_INTERNAL_SERVER_ERROR', match: /500|internal.server.error/i },
  { code: 'HTTP_503_SERVICE_UNAVAILABLE', match: /503|service.unavailable/i },
  { code: 'HTTP_404_NOT_FOUND', match: /404|not.found/i },
  { code: 'HTTP_400_BAD_REQUEST', match: /400|bad.request/i },
  { code: 'HTTP_408_REQUEST_TIMEOUT', match: /408|request.*timeout.*http/i },
  { code: 'HTTP_409_CONFLICT', match: /409|conflict.*http|resource.*conflict/i },
  { code: 'HTTP_422_UNPROCESSABLE', match: /422|unprocessable.*entity|semantic.*error.*http/i },
  { code: 'HTTP_502_BAD_GATEWAY', match: /502|bad.*gateway/i },
  { code: 'CREDENTIAL_ARTIFACT_NOT_FOUND', match: /No artifact descriptor found|artifactName|IllegalStateException.*artifact|artifact.*descriptor/i },

  // ── FALLBACK ──────────────────────────────────────────────────────────────
  { code: 'UNKNOWN_ERROR', match: /.*/ }
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
    errorMessage: cleaned,    // stripped of noise
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

// export async function ApiCall(
//   api,
//   options,
//   retries = 2
// ) {

//   try {

//     return await api.send(options);

//   } catch (err) {

//     console.error(
//       `API Error (${options.path}):`,
//       err.message
//     );

//     if (retries > 0) {

//       console.warn(
//         `Retrying: ${options.path}`
//       );

//       return ApiCall(
//         api,
//         options,
//         retries - 1
//       );
//     }

//     throw err;
//   }
// }
export async function ApiCall(tenant, path) {

  try {
    const destination = await getDestination({ destinationName: tenant.destinationName });
      if (!destination) throw new Error(`Destination "${tenant.destinationName}" not found`);
    const res = await executeHttpRequest(destination, {
        method: 'get',
        url: path,
      });
    console.log("CPI raw body:", JSON.stringify(res.data));
    return res.data;
  } catch (err) {

    console.error(
      `API Error (${options.path}):`,
      err.message
    );
    throw err;
  }
}

/* UPSERT MONITORED ARTIFACTS
 */

export async function upsertMonitoredArtifacts(
  entity,
  logs,
  tenant
) {
  /*
   * ----------------------------------------
   * EMPTY LOGS
   * ----------------------------------------
   */
  if (!logs.length)
    return;
  /*
   * ----------------------------------------
   * BUILD LATEST MAP
   * ----------------------------------------
   */
  const latestMap = {};
  for (const log of logs) {
    const current =
      latestMap[
      log.iFlowName
      ];
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
  const packageMap = {};
  for (const log of logs) {

    packageMap[log.iFlowName] =
      log.PackageName || 'UNKNOWN_PACKAGE';
  }
  /*
   * ----------------------------------------
   * EXISTING ARTIFACTS
   * ----------------------------------------
   */

  const existingArtifacts =
    await SELECT
      .from(entity)
      .where({
        tenant_ID: tenant.ID
      });

  const existingMap =
    new Map(
      existingArtifacts.map(a => [
        a.iFlowName,
        a
      ])
    );
  // console.log(
  //   "latestMap:",
  //   latestMap
  // );
  // console.log(
  //   "existingMap:",
  //   existingMap
  // );
  /*
   * ----------------------------------------
   * UPSERT ARTIFACTS
   * ----------------------------------------
   */
  for (const [
    iFlowName,
    latestTimestamp
  ] of Object.entries(latestMap)) {
    /*
     * ----------------------------------------
     * FETCH IFLOW DETAILS
     * ----------------------------------------
     */
    const packageName =
      packageMap[iFlowName] ||
      'UNKNOWN_PACKAGE';
    let iflowDetails = null;
    try {
      iflowDetails =
        await ApiCall(tenant, `/api/v1/IntegrationRuntimeArtifacts('${iFlowName}')`);
    } catch (err) {
      console.error(
        `Failed to fetch iFlow details: ${iFlowName}`
      );
      console.error(err);
    }
    const results =
      iflowDetails?.d || {};
    console.log(
      "Fetched iFlow details:",
      iFlowName,
      results
    );
    /*
     * ----------------------------------------
     * EXISTING ARTIFACT
     * ----------------------------------------
     */
    const existing =
      existingMap.get(
        iFlowName
      );
    /*
     * ----------------------------------------
     * UPDATE EXISTING
     * ----------------------------------------
     */

    if (existing) {
      await UPDATE(entity)
        .set({
          /*
           * ----------------------------------------
           * BASIC INFO
           * ----------------------------------------
           */
          lastPollTimestamp:
            latestTimestamp,
          lastErrorAt: latestTimestamp,
          isActive:
            results.Status ===
            'STARTED',
          Type:
            results.Type ||
            existing.Type ||
            'UNKNOWN',
          PackageName:
            packageName,
          overallSeverity:
            existing.openClusterCount === 0
              ? 'HEALTHY'
              : existing.overallSeverity
        })
        .where({
          ID: existing.ID,
          tenant_ID: tenant.ID
        });

      // console.log(
      //   `Updated artifact: ${iFlowName}`
      // );
    }

    /*
     * ----------------------------------------
     * INSERT NEW
     * ----------------------------------------
     */

    else {
      await INSERT
        .into(entity)
        .entries({
          ID:
            cds.utils.uuid(),
          tenant_ID: tenant.ID,
          iFlowName,
          iFlowId:
            iFlowName,
          Type:
            results.Type ||
            'UNKNOWN',
          PackageName:
            packageName,
          isActive:
            results.Status ===
            'STARTED',
          lastPollTimestamp:
            latestTimestamp,
          lastErrorAt: latestTimestamp,
          overallSeverity:
            'HEALTHY',
          severityScore:
            0,
          severityZScore:
            0,
          openClusterCount:
            0,
          resolvedClusterCount:
            0,
          totalBusinessImpactEUR:
            0
        });
         await updateDailyMetrics(
            tenant.ID,
            {
                monitoredArtifacts: 1
            }
        );
      console.log(
        `Inserted new artifact: ${iFlowName}`
      );
    }
  }
}