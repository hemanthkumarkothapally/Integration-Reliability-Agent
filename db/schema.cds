namespace com.cytechies.integration.reliability;
using { cuid, managed } from '@sap/cds/common';
entity Incidents : cuid, managed {
    messageGuid     : String(100);
    iFlowName       : String(255);
    errorMessage    : String(5000);
    errorSignature  : String(500);
    adapter         : String(100);
    status          : String(50);
    logStart        : Timestamp;    
    logEnd          : Timestamp;
}

entity IncidentClusters : cuid, managed {
    errorSignature  : String(500);
    iFlowName       : String(255);
    severity        : String(50);
    incidentCount   : Integer;
    firstSeen       : Timestamp;
    lastSeen        : Timestamp;
    status          : String(50);
    playbookId      : UUID;
    severityCriticality : Integer;
    
}

entity ClusterRecommendations : cuid, managed {
    cluster             : Association to IncidentClusters;
    rootCause           : String(2000);
    businessImpact      : String(2000);
    remediationSteps    : String(5000);
    affectedAdapter     : String(100);
    confidenceScore     : Decimal(5,2);
    generatedAt         : Timestamp;
}

entity MonitoredArtifacts : cuid, managed {
    iFlowName          : String(255);
    iFlowId            : String(255);
    namespace          : String(255);
    isActive           : Boolean;
    lastPollTimestamp  : Timestamp;
}

entity Playbooks : cuid, managed {
    errorType     : String(255);
    title         : String(255);
    description   : String(2000);
    steps         : String(5000);
    severity      : String(50);
}

entity ChatSessions : cuid, managed {
    title       : String(255);
    createdAt   : Timestamp;
    createdBy   : String(255);
}

entity AccessLogs : cuid, managed {
    action     : String(255);
    user       : String(255);
    timestamp  : Timestamp;
    details    : String(2000);
}

entity TokenUsages : cuid, managed {
    model             : String(255);
    inputTokens       : Integer;
    outputTokens      : Integer;
    estimatedCostUSD  : Decimal(10,4);
    calledAt          : Timestamp;
    purpose           : String(255);
}