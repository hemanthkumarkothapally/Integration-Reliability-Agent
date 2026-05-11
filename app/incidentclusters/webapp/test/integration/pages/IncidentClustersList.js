sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'com.cytechies.integration.reliability.incidentclusters',
            componentId: 'IncidentClustersList',
            contextPath: '/IncidentClusters'
        },
        CustomPageDefinitions
    );
});