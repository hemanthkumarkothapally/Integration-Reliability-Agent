sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "../model/formatter",
    "sap/viz/ui5/format/ChartFormatter",
    "sap/viz/ui5/api/env/Format",
    "sap/viz/ui5/controls/common/feeds/FeedItem"
], function (BaseController, JSONModel, formatter, ChartFormatter, Format, FeedItem) {
    "use strict";

    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.UsageAnalytics", {
        formatter: formatter,

        onInit: function () {
            this.getView().setBusy(true);
            Format.numericFormatter(ChartFormatter.getInstance());

            var oChartModel = new JSONModel(this._getChartData());
            this.getView().setModel(oChartModel, "chart");

            this._initVizFrames();

            this.getView().setBusy(false);

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteUsageAnalytics").attachPatternMatched(
                this._onRouteMatched,
                this
            );
            // ✅ no return
        },

        _initVizFrames: function () {
            var oView = this.getView();
            var oChartModel = oView.getModel("chart");

            // popover + axis formatting for every chart
            ["idSeverityDonut", "idIncidentTrend", "idTokenUsage", "idHanaStorage"]
                .forEach(function (sId) {
                    var oVizFrame = oView.byId(sId);
                    if (!oVizFrame) { return; }

                    var oPopover = new sap.viz.ui5.controls.Popover();
                    oPopover.connect(oVizFrame.getVizUid());

                    oVizFrame.setVizProperties({
                        valueAxis: {
                            label: { formatString: ChartFormatter.DefaultPattern.SHORTFLOAT }
                        }
                    });
                });

            // feeds for the HANA stacked column — names pulled from the model
            var oHana = oView.byId("idHanaStorage");
            if (oHana) {
                var oLabels = oChartModel.getProperty("/hanaStorageConfig/labels");

                var aValueFeeds = [
                    oLabels.tenant1,
                    oLabels.tenant2,
                    oLabels.tenant3,
                    oLabels.tenant4,
                    oLabels.tenant5,
                    oLabels.tenant6
                ];

                oHana.addFeed(new FeedItem({
                    uid: "valueAxis",
                    type: "Measure",
                    values: aValueFeeds
                }));

                oHana.addFeed(new FeedItem({
                    uid: "categoryAxis",
                    type: "Dimension",
                    values: ["Date"]
                }));
            }
        },
        _onRouteMatched: async function (oEvent) {
            this.getOwnerComponent().getModel("globalModel").setProperty("/selectedKey", "UsageAnalytics");

            this.getSettingsData().catch(function (err) {
                // handle/log error
            });
        },


        /* =========================================================== */
        /* data                                                        */
        /* =========================================================== */

        /**
         * Static mock data. In a real app replace this with the result of
         * an OData/REST call and call this.getView().getModel("chart").setData(...)
         */
        _getChartData: async function () {

             const oModel = this.getOwnerComponent().getModel("AdminModel");
        const oContext = oModel.bindContext("/getUsageAnalytics(...)");
        oContext.setParameter("fromDate", "2026-06-04");
        oContext.setParameter("toDate", "2026-06-15");
        await oContext.execute();
        const aData = oContext.getBoundContext().getObject();
console.log("Usage analytics data: ", aData);
            // return {

            //     summary: { TokenConsumption: 40000000000, hanaStorage: 1.378, totalIncidents: 27383, totalClusters: "39" },

            //     supportingMetrics: {
            //         AverageTokensPerChatSession: 6800000,
            //         AverageTokensPerCluster: 3500000,
            //         AverageHANAGrowthPerDay: 0.05,
            //         AverageTokensPerDay: 1500000,
            //         AverageIncidentsPerDay: 120000,
            //         AverageClusterResolution: 12

            //     },

            //     /* ---- line: Token usage (input / output) ------------- */
            //     tokenUsage: [
            //         { date: "May 11", input: 273000, output: 155000 },
            //         { date: "May 14", input: 310000, output: 170000 },
            //         { date: "May 17", input: 330000, output: 185000 },
            //         { date: "May 20", input: 362000, output: 201000 },
            //         { date: "May 23", input: 345000, output: 196000 },
            //         { date: "May 26", input: 390000, output: 220000 },
            //         { date: "May 29", input: 410000, output: 235000 },
            //         { date: "Jun 2", input: 455000, output: 260000 },
            //         { date: "Jun 5", input: 490000, output: 290000 }
            //     ],


            //     /* ---- stacked column: HANA storage (GB by schema) ---- */
            //     // hanaStorage: [
            //     //     { "date": "May 11", "tenant1": 0.38, "tenant2": 0.14, "tenant3": 0.06, "tenant4": 0.05, "tenant5": 0.04, "tenant6": 0.03 },
            //     //     { "date": "May 14", "tenant1": 0.42, "tenant2": 0.15, "tenant3": 0.07, "tenant4": 0.06, "tenant5": 0.05, "tenant6": 0.04 },
            //     //     { "date": "May 17", "tenant1": 0.45, "tenant2": 0.18, "tenant3": 0.08, "tenant4": 0.07, "tenant5": 0.06, "tenant6": 0.04 },
            //     //     { "date": "May 20", "tenant1": 0.49, "tenant2": 0.19, "tenant3": 0.09, "tenant4": 0.08, "tenant5": 0.06, "tenant6": 0.05 },
            //     //     { "date": "May 23", "tenant1": 0.53, "tenant2": 0.21, "tenant3": 0.10, "tenant4": 0.09, "tenant5": 0.07, "tenant6": 0.06 },
            //     //     { "date": "May 26", "tenant1": 0.58, "tenant2": 0.22, "tenant3": 0.11, "tenant4": 0.10, "tenant5": 0.08, "tenant6": 0.06 },
            //     //     { "date": "May 29", "tenant1": 0.63, "tenant2": 0.25, "tenant3": 0.12, "tenant4": 0.11, "tenant5": 0.09, "tenant6": 0.07 },
            //     //     { "date": "Jun 2", "tenant1": 0.70, "tenant2": 0.27, "tenant3": 0.14, "tenant4": 0.13, "tenant5": 0.10, "tenant6": 0.08 },
            //     //     { "date": "Jun 5", "tenant1": 0.82, "tenant2": 0.39, "tenant3": 0.17, "tenant4": 0.15, "tenant5": 0.12, "tenant6": 0.09 }
            //     // ],

            //     hanaStorage: [
            //         { "date": "May 11" },
            //         { "date": "May 14", "tenant1": 0.42, "tenant2": 0.15, "tenant3": 0.07, "tenant4": 0.06, "tenant5": 0.05 },
            //         { "date": "May 17", "tenant1": 0.45, "tenant2": 0.18, "tenant3": 0.08, "tenant4": 0.07, "tenant5": 0.06 },
            //         { "date": "May 20", "tenant1": 0.49, "tenant2": 0.19, "tenant3": 0.09, "tenant5": 0.06 },
            //         { "date": "May 23", "tenant1": 0.53, "tenant2": 0.21, "tenant3": 0.10, "tenant4": 0.09, "tenant5": 0.07 },
            //         { "date": "May 26", "tenant1": 0.58, "tenant3": 0.11, "tenant4": 0.10, "tenant5": 0.08 },
            //         { "date": "May 29", "tenant2": 0.25, "tenant3": 0.12, "tenant4": 0.11, "tenant5": 0.09 },
            //         { "date": "Jun 2", "tenant1": 0.70, "tenant2": 0.27, "tenant3": 0.14, "tenant4": 0.13, "tenant5": 0.10 },
            //         { "date": "Jun 5", "tenant1": 0.82, "tenant2": 0.39, "tenant4": 0.15, "tenant5": 0.12 }
            //     ],


            //     hanaStorageConfig: {
            //         labels: {
            //             tenant1: "IRA Schema",
            //             tenant2: "Practice_March",
            //             tenant3: "DataBridge",
            //             tenant4: "FlowSync",
            //             tenant5: "NexusCore",
            //             // tenant6: "PulseOps"
            //         },

            //     },

            //     topConsumers: [
            //         {
            //             name: "Subrahmanyam Raghunathan",
            //             roles: ["PaymentSync", "iFlow tuning", "Error handling"],
            //             amount: "104000203004"
            //         },
            //         {
            //             name: "Al Wu",
            //             roles: ["EDI flows", "SAP IS"],
            //             amount: "82000020300"
            //         },
            //         {
            //             name: "Raj",
            //             roles: ["Incident analysis", "Monitoring"],
            //             amount: "47000020300"
            //         },
            //         {
            //             name: "Venkatanarasimharajuvaripeta Thyagarajan",
            //             roles: ["General monitoring", "Alerting", "Token audits"],
            //             amount: "3200002030000000000000000000000"
            //         },
            //         {
            //             name: "Subrahmanyam Raghunathan",
            //             roles: ["PaymentSync", "iFlow tuning", "Error handling"],
            //             amount: "104000203004"
            //         },
            //         {
            //             name: "Al Wu",
            //             roles: ["EDI flows", "SAP IS"],
            //             amount: "82000020300"
            //         },
            //         {
            //             name: "Raj",
            //             roles: ["Incident analysis", "Monitoring"],
            //             amount: "47000020300"
            //         },
            //         {
            //             name: "Venkatanarasimharajuvaripeta Thyagarajan",
            //             roles: ["General monitoring", "Alerting", "Token audits"],
            //             amount: "3200002030000000000000000000000"
            //         },
            //     ],
            // };
        },

        /* =========================================================== */
        /* optional: backend refresh                                   */
        /* =========================================================== */

        /**
         * Example of refreshing the model from a service.
         * Wire this to your period selector (1D / 7D / 30D ...).
         */
        loadChartData: function (sPeriod) {
            var oModel = this.getView().getModel("chart");

            fetch("/api/analytics/charts?period=" + encodeURIComponent(sPeriod))
                .then(function (oRes) { return oRes.json(); })
                .then(function (oData) {
                    oModel.setData(oData);          // same shape as _getChartData()
                })
                .catch(function (oErr) {
                    // keep the old data on failure
                    jQuery.sap.log.error("Chart data load failed", oErr);
                });
        },

        onFilterChange: function (oEvent) {
            var oParams = oEvent.getParameters();

            if (!oParams.valid) {
                console.log("Invalid date range entered");
                return;
            }

            var oValue = oParams.value;

            if (!oValue) {
                console.log("Date range cleared");
                return;
            }
            var aDates = sap.m.DynamicDateRange.toDates(oValue);
            var oFromDate = aDates[0];
            var oToDate = aDates[1];

            console.log("Operator:", oValue.operator);
            console.log("From:", oFromDate);
            console.log("To:", oToDate);
        },

        

    });
});