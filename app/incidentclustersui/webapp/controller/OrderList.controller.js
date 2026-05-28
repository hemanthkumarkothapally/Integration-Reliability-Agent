sap.ui.define([
    "./BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../model/formatter"
], (BaseController, Filter, FilterOperator, formatter) => {
    "use strict";

    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.OrderList", {
        formatter: formatter,
        onInit: async function () {

            this.showBusy();

            try {

                this._initializeControls();
                this._attachEvents();
                await this._initializeData();

            } catch (error) {
                console.error("Initialization Failed");
                console.error(error);
                this.showToast("Application Load Failed");

            } finally {

                this.hideBusy();
            }
        },

        _initializeControls: function () {

            const oVizFrame = this.byId("idLineChart");

            const oPopOver = this.byId("idPopOver");

            oPopOver.connect(
                oVizFrame.getVizUid()
            );

            oVizFrame.setVizProperties({

                title: {
                    visible: false
                },
                plotArea: {
                    
                    marker: {
                        visible: true
                    },
                    dataLabel: {
                        
                        visible: true
                    }
                },

                valueAxis: {
                    title: {
                        visible: true
                    }
                },

                valueAxis2: {
                    title: {
                        visible: true
                    }
                }

            });

        },
        _attachEvents: function () {

            const oTable = this.byId("idIncidentClustersTable");

            oTable.attachEventOnce(
                "updateFinished",
                this._loadDashboardKPIs.bind(this)
            );

        },

        _initializeData: async function () {

            await Promise.all([
                this._loadChartData(),
                this._loadTopErrorTypes()

            ]);

        },

        _loadChartData: async function () {

            try {

                const oModel = this.getModel();

                // Call CAP Function
                const oResponse =
                    await oModel.bindContext(
                        "/GetIncidentChartData()"
                    ).requestObject();

                console.log("CAP Function Response");
                console.log(oResponse);

                // Create JSON Model  // Set Model
                // const oChartModel =
                //     new JSONModel(oResponse);


                // this.getView().setModel(
                //     oChartModel,
                //     "chart"
                // );

                this.getModel("chart").setData(oResponse);
                //console.log("Chart Model Set Successfully", chart);
            }
            catch (error) {

                console.error("Chart Load Failed");
                console.error(error);

            }

        },
        _loadTopErrorTypes: async function () {

            try {

                const oModel = this.getModel();

                // Call CAP Function
                const oResponse =
                    await oModel.bindContext(
                        "/GetTopErrorTypes()"
                    ).requestObject();

                console.log("CAP Function Response");
                console.log(oResponse);

                const aResults =
                    oResponse.value || oResponse.results || [];

                // this.getView().setModel(
                //     new JSONModel({
                //         data: aResults
                //     }),
                //     "topErrors"
                // );
                this.getModel("topErrors")
                    .setData({
                        data: aResults
                    });

            } catch (error) {
                console.error("Top Error Types Load Failed");
                console.error(error);
                this.showToast("Failed to load top error types");
            }
        },

        onSideNavButtonPress: function () {
            let oToolPage = this.byId("toolPage1");
            oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
        },

        onSeverityTabSelect: function (oEvent) {

            const sKey = oEvent.getParameter("key");
            const oTable = this.byId("idIncidentClustersTable");
            const oBinding = oTable.getBinding("items");
            let aFilters = [];

            if (sKey !== "ALL") {
                aFilters.push(
                    new Filter(
                        "severity",
                        FilterOperator.EQ,
                        sKey
                    )
                );
            }

            oBinding.filter(aFilters);
        },

        onRowPress: async function (oEvent) {
            this.showBusy();
            console.log("event tRiggered")

            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext();
            const sID = oContext.getProperty("ID");
            this.getOwnerComponent().getModel("globalModel").setProperty("/cluster_id", sID);
            console.log("Cluster ID set in global model:", sID);

            this.navTo("RouteIC", {
                ID: sID
            });

            console.log("Route Activated")
            this.hideBusy();
        },

        _loadDashboardKPIs: function () {

            const oTable = this.byId("idIncidentClustersTable");
            const aItems = oTable.getItems();
            if (!aItems.length) {
                console.log("No Table Data");
                return;
            }

            // Find First Actual Data Row
            let oData = null;
            for (let i = 0; i < aItems.length; i++) {
                const oContext =
                    aItems[i].getBindingContext();
                if (oContext) {
                    oData =
                        oContext.getObject();
                    break;
                }
            }

            if (!oData) {
                console.log("No Binding Data Found");
                return;
            }

            console.log("KPI DATA:", oData);

            // Dashboard Model
            // const oDashboardModel = new JSONModel({

            //     totalIncidents24h: oData.totalIncidents24h,
            //     activeClusters: oData.activeClusters,
            //     criticalCount: oData.criticalCount,
            //     resolved24h: oData.resolved24h,
            //     criticalCriticality: oData.criticalCriticality

            // });

            // this.getView().setModel(oDashboardModel, "dashboard");

            this.getModel("dashboard")
                .setData({
                    totalIncidents24h: oData.totalIncidents24h,
                    activeClusters: oData.activeClusters,
                    criticalCount: oData.criticalCount,
                    resolved24h: oData.resolved24h,
                    criticalCriticality: oData.criticalCriticality
                });
            console.log(
                "Dashboard Model Set Successfully"
            );

        },
        onAipress: function () {    
            // console.log("AI Assistant Button Pressed");
            this.showBusy();
            this.navTo("RouteAIAssistant");
            this.hideBusy();
        }



    });
});
