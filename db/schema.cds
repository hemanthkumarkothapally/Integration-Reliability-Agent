namespace com.cytechies.integration.reliability;
using { cuid, managed } from '@sap/cds/common';
entity Incidents : cuid, managed {
    messageGuid     : String(100);
    iFlowName       : String(300);
    errorMessage    : LargeString;
    errorSignature  : LargeString;
    adapter         : String(100);
    status          : String(50);
    logStart        : Timestamp;
    logEnd          : Timestamp;
    cluster                : Association to IncidentClusters;
}

entity IncidentClusters : cuid, managed {
    errorSignature  : String;
    iFlowName       : String(300);
    severity        : String(50);
    incidentCount   : Integer;
    firstSeen       : Timestamp;
    lastSeen        : Timestamp;
    status          : String(50);
    playbookId      : UUID;
    severityCriticality : Integer;
     
    incidents              : Composition of many Incidents
                           on incidents.cluster = $self;
}
entity ClusterRecommendations : cuid, managed {
    cluster             : Association to IncidentClusters;
    rootCause           : String(2000);
    businessImpact      : String(2000);
    remediationSteps    : LargeString;
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

entity Playbooks :cuid, managed {
    errorType       : String(100);
    title           : String(255);
    description     : LargeString;
    steps           : LargeString;
    severity        : String(20);
}
entity ChatSessions : cuid, managed {
    title       : String(255);
    messages : Composition of many Messages on messages.conversation = $self;
}
entity Messages : cuid{
   conversation : Association to one ChatSessions;
   role  :LargeString;
   content  : LargeString;
   createdAt : Timestamp @cds.on.insert : $now;
   tokenCount : Integer;
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