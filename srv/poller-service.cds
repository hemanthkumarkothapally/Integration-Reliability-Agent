using { com.cytechies.integration.reliability as IRA } from '../db/schema';

@path: '/Poller'
// service PollerService @(requires: 'Admin'){
service PollerService {
    type ClusterRecommendationResponse {
        ID                   : UUID;
        cluster_ID           : UUID;
        rootCause            : LargeString;
        businessImpact       : LargeString;
        remediationSteps     : LargeString;
        affectedAdapter      : String(120);
        confidenceScore      : Integer;
        recommendationSource : String(40);
        modelName            : String(100);
        generatedAt          : Timestamp;
    }
    entity IncidentClusters as projection on IRA.IncidentClusters;
    function getClusterRecommendation(cluster_ID : UUID) returns ClusterRecommendationResponse;
    function getFailedLogs() returns array of Map;
    function cleanupRetentionData() returns String;
}