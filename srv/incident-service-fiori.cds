using IncidentService from './incident-service';
//using {UI} from '@sap/cds/common';

annotate IncidentService.IncidentClusters with @(

    UI.HeaderInfo         : {
        TypeName      : 'Incident Cluster',
        TypeNamePlural: 'Incident Clusters',
        Title         : {Value: iFlowName},
        Description   : {Value: errorSignature}
    },
    UI.SelectionFields    : [
        severity,
        status,
        iFlowName
    ],

    UI.LineItem           : [

        {
            $Type: 'UI.DataField',
            Label: 'iFlow Name',
            Value: iFlowName
        },

        {
            $Type: 'UI.DataField',
            Label: 'Error Type',
            Value: errorSignature
        },

        {
            $Type: 'UI.DataField',
            Label: 'Incident Count',
            Value: incidentCount
        },

        {
            $Type      : 'UI.DataField',
            Label      : 'Severity',
            Value      : severity,
            Criticality: severityCriticality
        },

        {
            $Type: 'UI.DataField',
            Label: 'Status',
            Value: status
        },

        {
            $Type: 'UI.DataField',
            Label: 'Last Seen',
            Value: lastSeen
        }
    ],

    UI.DataPoint #Severity: {
        Title      : 'Severity',
        Value      : severity,
        Criticality: severityCriticality
    },
    //  UI.DataPoint #TotalIncidents24h: {
    //     Title: 'Total Incidents (24h)',
    //     Value: totalIncidents24h
    // },

    // UI.DataPoint #ActiveClusters: {
    //     Title      : 'Active Clusters',
    //     Value      : activeClusters,
    //     Criticality: 2
    // },

    // UI.DataPoint #Critical: {
    //     Title      : 'CRITICAL',
    //     Value      : criticalCount,
    //     Criticality: criticalCriticality
    // },

    // UI.DataPoint #Resolved24h: {
    //     Title      : 'Resolved (24h)',
    //     Value      : resolved24h,
    //     Criticality: 3
    // },

    // UI.SelectionVariant #All: {
    //     Text         : 'All',
    //     SelectOptions: []
    // },

    // UI.KPI #TotalIncidents24h: {
    //     DataPoint       : ![@UI.DataPoint#TotalIncidents24h],
    //     SelectionVariant: ![@UI.SelectionVariant#All]
    // },

    // UI.KPI #ActiveClusters: {
    //     DataPoint       : ![@UI.DataPoint#ActiveClusters],
    //     SelectionVariant: ![@UI.SelectionVariant#All]
    // },

    // UI.KPI #Critical: {
    //     DataPoint       : ![@UI.DataPoint#Critical],
    //     SelectionVariant: ![@UI.SelectionVariant#All]
    // },

    // UI.KPI #Resolved24h: {
    //     DataPoint       : ![@UI.DataPoint#Resolved24h],
    //     SelectionVariant: ![@UI.SelectionVariant#All]
    // },

    // UI.PresentationVariant #TotalIncidents24h: {
    //     Visualizations: [
    //         '@UI.KPI#TotalIncidents24h'
    //     ]
    // },

    // UI.PresentationVariant #ActiveClusters: {
    //     Visualizations: [
    //         '@UI.KPI#ActiveClusters'
    //     ]
    // },

    // UI.PresentationVariant #Critical: {
    //     Visualizations: [
    //         '@UI.KPI#Critical'
    //     ]
    // },

    // UI.PresentationVariant #Resolved24h: {
    //     Visualizations: [
    //         '@UI.KPI#Resolved24h'
    //     ]
    // }


);


// ── Labels ────────────────────────────────────────────────────────────────────
annotate IncidentService.IncidentClusters with {
    totalIncidents24h @Common.Label: 'Total Incidents (24h)';
    activeClusters    @Common.Label: 'Active Clusters';
    criticalCount     @Common.Label: 'CRITICAL';
    resolved24h       @Common.Label: 'Resolved (24h)';
};

// ── Hide all virtual fields from table & forms ────────────────────────────────
annotate IncidentService.IncidentClusters with {
    totalIncidents24h   @UI.Hidden: true;
    activeClusters      @UI.Hidden: true;
    criticalCount       @UI.Hidden: true;
    resolved24h         @UI.Hidden: true;
    criticalCriticality @UI.Hidden: true;
};

annotate IncidentService.IncidentClusters with {

    status    @Common.Label: 'Status';
    severity  @Common.Label: 'Severity';
    iFlowName @Common.Label: 'iFlowName';

};

annotate IncidentService.IncidentClusters with {

    severityCriticality @UI.Hidden: true
};
