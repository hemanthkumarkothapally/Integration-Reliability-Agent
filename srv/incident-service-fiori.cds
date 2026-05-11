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
    }

);

annotate IncidentService.IncidentClusters with {

    severityCriticality @UI.Hidden: true
};

//  annotate IncidentService.IncidentClusters with @UI.PresentationVariant #KPIIncidentOverview: {Visualizations: ['@UI.Chart']};

//  annotate IncidentService.IncidentClusters with @UI.SelectionPresentationVariant #IncidentKPI: {PresentationVariant: {Total: incidentCount}};
