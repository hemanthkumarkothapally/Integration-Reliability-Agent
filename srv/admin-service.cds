using { com.cytechies.integration.reliability as IRA } from '../db/schema';

@path: '/Admin'
// service AdminService @(requires: 'Admin'){
service AdminService{
    entity Tenants as projection on IRA.Tenants;
    entity MonitoredArtifacts as projection on IRA.MonitoredArtifacts;
    entity TokenUsages as projection on IRA.TokenUsages;
    entity DailyMetrics as projection on IRA.DailyMetrics;
    function triggerManualPoll() returns array of Map;
    function getDestinations() returns many {
    Name        : String;
    Type        : String;
    URL         : String;
    Description : String;
};
type Summary {
    TokenConsumption : Integer;
    hanaStorage      : Decimal(15,3);
    totalIncidents   : Integer;
    totalClusters    : Integer;
}

type SupportingMetrics {
    AverageTokensPerChatSession : Integer;
    AverageTokensPerCluster     : Integer;
    AverageHANAGrowthPerDay     : Decimal(10,2);
    AverageTokensPerDay         : Integer;
    AverageIncidentsPerDay      : Integer;
    AverageClusterResolution    : Decimal(10,2);
}

type TokenUsage {
    date   : String;
    input  : Integer;
    output : Integer;
}

type TopConsumer {
    name   : String;
    roles  : array of String;
    amount : String;
}

type UsageAnalytics {
    summary            : Summary;
    supportingMetrics  : SupportingMetrics;
    tokenUsage         : many TokenUsage;
    topConsumers       : many TopConsumer;
}

function getUsageAnalytics(
    fromDate : Date,
    toDate   : Date
) returns UsageAnalytics;
}