sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"com/cytechies/integration/reliability/incidentclusters/test/integration/pages/IncidentClustersList",
	"com/cytechies/integration/reliability/incidentclusters/test/integration/pages/IncidentClustersObjectPage"
], function (JourneyRunner, IncidentClustersList, IncidentClustersObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('com/cytechies/integration/reliability/incidentclusters') + '/test/flp.html#app-preview',
        pages: {
			onTheIncidentClustersList: IncidentClustersList,
			onTheIncidentClustersObjectPage: IncidentClustersObjectPage
        },
        async: true
    });

    return runner;
});

