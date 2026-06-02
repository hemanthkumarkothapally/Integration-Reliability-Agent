namespace com.cytechies.integration.reliability;
using { cuid, managed } from '@sap/cds/common';

entity Tenants : cuid, managed {
    tenantName      : String(255);
    tenantId        : String(255);
    destinationName : String(255);
    region          : String(100);
    isActive        : Boolean default true;
}
entity Incidents : cuid, managed {
    tenant          : Association to Tenants;
    messageGuid     : String(100);
    iFlowName       : String(300);
    errorMessage    : LargeString;
    errorSignature  : LargeString;
    adapter         : String(100);
    status          : String(50);
    logStart        : Timestamp;
    logEnd          : Timestamp;
    PackageName     : String(255);
    cluster                : Association to IncidentClusters;
}

entity IncidentClusters : cuid, managed {
    tenant          : Association to Tenants;
    errorSignature  : String;
    errorType       : String(300);
    severity        : String(50);
    incidentCount   : Integer;
    firstSeen       : Timestamp;
    lastSeen        : Timestamp;
    status          : String(50);
    playbook        : Association to Playbooks;
    severityCriticality : Integer;
    globalStatus           : String(50);
    incidents              : Composition of many Incidents
                           on incidents.cluster = $self;
    chatSessions : Association to many ChatSessions on chatSessions.cluster = $self;
    totalTokenUsage : Integer;
    monitoredArtifacts   : Composition of many ClusterArtifacts on monitoredArtifacts.cluster = $self;
    recommendations     : Composition of one ClusterRecommendations
                            on recommendations.cluster = $self;
    messages : Association to many Messages on messages.referCluster = $self;
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
    tenant              : Association to Tenants;
    iFlowName          : String(255);
    iFlowId            : String(255);
    Type          : String(255);
    PackageName     : String(255);
    isActive           : Boolean;
    lastErrorAt : Timestamp;
    lastPollTimestamp  : Timestamp;
    overallSeverity    : String(50) default 'HEALTHY';
    severityScore      : Decimal(10,2);
    severityZScore     : Decimal(10,2);
    openClusterCount   : Integer default 0;
    resolvedClusterCount: Integer default 0;
    totalBusinessImpactEUR : Decimal(15,2) default 0;
    clusters : Association to many ClusterArtifacts
               on clusters.artifact = $self;
    messages : Association to many Messages on messages.referiFlow = $self;
}
entity ClusterArtifacts : cuid, managed{
    cluster             : Association to IncidentClusters;
    artifact            : Association to MonitoredArtifacts;
    incidentCount       : Integer default 0;
    iflowClusterSeverity: String(50);
    resolutionStatus    : String(50)  default 'OPEN';
    resolutionNote      : String(2000);
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
    cluster  : Association to IncidentClusters;
    messages : Composition of many Messages on messages.conversation = $self;
    totalSessionTokenUsage : Integer;
}
entity Messages : cuid{
   conversation : Association to one ChatSessions;
   role  :LargeString;
   content  : LargeString;
   createdAt : Timestamp @cds.on.insert : $now;
   tokenCount : Integer;    
   referiFlow : Association to one MonitoredArtifacts;
   referCluster: Association to one IncidentClusters;
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