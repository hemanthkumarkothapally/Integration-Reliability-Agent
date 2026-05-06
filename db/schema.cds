namespace com.integration.reliability.agent;
using {
    cuid,
    managed
} from '@sap/cds/common';

entity Incidents : cuid, managed {
    messageGuid    : String(50);
    iFlowName      : String(250);
    errorMessage   : LargeString;
    errorSignature : String(500);
    adapter        : String(100);
    status         : String(50);
    logStart       : Timestamp;
    logEnd         : Timestamp;
}

entity IncidentCluster : cuid, managed {
  errorSignature  : String;
  iFlowName       : String;
  severity        : String;
  incidentCount   : Integer;
  firstSeen       : Timestamp;
  lastSeen        : Timestamp;
  status          : String;
  playbook        : Association to Playbook;
}

entity ClusterRecommendation : cuid, managed {
  cluster            : Association to IncidentCluster;
  rootCause          : LargeString;
  businessImpact     : LargeString;
  remediationSteps   : LargeString;
  affectedAdapter    : String;
  confidenceScore    : Decimal(5,2);
  generatedAt        : Timestamp;
}

entity MonitoredArtifact : cuid, managed {
  iFlowName          : String;
  iFlowId            : String;
  namespace          : String;
  isActive           : Boolean;
  lastPollTimestamp  : Timestamp;
}

entity Playbook : cuid, managed {
  errorType     : String;
  title         : String;
  description   : LargeString;
  steps         : LargeString;
  severity      : String;
}

entity ChatSession : cuid, managed {
  title       : String;
  createdAt   : Timestamp;
  createdBy   : String;
}

entity AccessLog : cuid, managed {
  action      : String;
  user        : String;
  timestamp   : Timestamp;
  details     : LargeString;
}

entity TokenUsage : cuid, managed {
  model               : String;
  inputTokens         : Integer;
  outputTokens        : Integer;
  estimatedCostUSD    : Decimal(10,4);
  calledAt            : Timestamp;
  purpose             : String;
}