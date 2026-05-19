using IncidentService as service from '../../srv/incident-service';
annotate service.IncidentClusters with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'errorSignature',
                Value : errorSignature,
            },
            
            {
                $Type : 'UI.DataField',
                Value : severity,
            },
            {
                $Type : 'UI.DataField',
                Label : 'incidentCount',
                Value : incidentCount,
            },
            {
                $Type : 'UI.DataField',
                Label : 'firstSeen',
                Value : firstSeen,
            },
            {
                $Type : 'UI.DataField',
                Label : 'lastSeen',
                Value : lastSeen,
            },
            {
                $Type : 'UI.DataField',
                Value : status,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
);

