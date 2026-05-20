sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "../model/formatter"
], (Controller, Filter, FilterOperator, JSONModel, formatter) => {
    "use strict";
 
    return Controller.extend("com.cytechies.integration.reliability.incidentclustersui.controller.OrderList", {
        formatter: formatter,
        onInit() {
            const oVizFrame =
                this.byId("idLineChart");
 
            const oPopOver =
                this.byId("idPopOver");
 
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
           
 
            this._loadChartData();
 
            const oTable =
                this.byId("idIncidentClustersTable");
 
            // Load KPI Data Once
            oTable.attachEventOnce(
                "updateFinished",
                this._loadDashboardKPIs.bind(this)
            );
 
            // // Update Table Count
            // oTable.attachUpdateFinished(
            //     this._onTableUpdateFinished.bind(this)
            // );
 
        },
 
        _loadChartData: async function () {
 
            try {
 
                const oModel =
                    this.getOwnerComponent().getModel();
 
                // Call CAP Function
                const oResponse =
                    await oModel.bindContext(
                        "/GetIncidentChartData()"
                    ).requestObject();
 
                console.log("CAP Function Response");
 
                console.log(oResponse);
 
                // Create JSON Model
                const oChartModel =
                    new sap.ui.model.json.JSONModel(oResponse);
 
                // Set Model
                this.getView().setModel(
                    oChartModel,
                    "chart"
                );
                console.log("Chart Model Set Successfully", oChartModel);
 
            }
            catch (error) {
 
                console.error("Chart Load Failed");
 
                console.error(error);
 
            }

            this._loadTopErrorTypes();
 
        },
 _loadTopErrorTypes: async function () {
  const oModel =
                    this.getOwnerComponent().getModel();
 
                // Call CAP Function
                const oResponse =
                    await oModel.bindContext(
                        "/GetTopErrorTypes()"
                    ).requestObject();
 
                console.log("CAP Function Response");
                console.log(oResponse);
            const aResults = oResponse.value || oResponse.results || [];
            this.getView().setModel(new JSONModel({ data: aResults }), "topErrors");
       
    
},

        onSideNavButtonPress: function () {
 
            let oToolPage = this.byId("toolPage1");
            oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
        },
        onSeverityTabSelect: function (oEvent) {
 
            const sKey =
                oEvent.getParameter("key");
 
            const oTable =
                this.byId("idIncidentClustersTable");
 
            const oBinding =
                oTable.getBinding("items");
 
            let aFilters = [];
 
            if (sKey !== "ALL") {
 
                aFilters.push(
                    new sap.ui.model.Filter(
                        "severity",
                        sap.ui.model.FilterOperator.EQ,
                        sKey
                    )
                );
            }
 
            oBinding.filter(aFilters);
        },
 
 
        // _onTableUpdateFinished: function (oEvent) {
 
        //     const iCount =
        //         oEvent.getParameter("total");
 
        //     console.log("Table Count:", iCount);
 
        //     const oTableModel =
        //         new sap.ui.model.json.JSONModel({
 
        //             count: iCount
 
        //         });
 
        //     this.getView().setModel(
        //         oTableModel,
        //         "table"
        //     );
 
        // },
 
        onRowPress: async function (oEvent) {
            sap.ui.core.BusyIndicator.show(100);
            console.log("event tRiggered")
 
            const oItem = oEvent.getSource();
 
            const oContext = oItem.getBindingContext();
 
            const sID = oContext.getProperty("ID");
 
            this.getOwnerComponent().getModel("globalModel").setProperty("/cluster_id", sID);
            console.log("Cluster ID set in global model:", sID);
            // let oModel = this.getOwnerComponent().getModel("PollerModel");
 
            // const oBinding = oModel.bindContext(
            //     `/Recommendations(cluster_ID='${sID}')`
            // );
 
            // try {
 
            //     const oResult = await oBinding.requestObject();
 
            //     console.log("Recommendation from service:", oResult);
 
            // } catch (err) {
 
            //     console.error(err);
            // }
            this.getOwnerComponent()
                .getRouter()
                .navTo("RouteIC", {
                    ID: sID
                });
 
            console.log("Route Activated")
            sap.ui.core.BusyIndicator.hide();
        },
        onSearchiFlowName: function () {
            const aFilters = [];
 
            // iFlowName
            const aIflowKeys = this.byId("_IDGenMultiComboBox")
                .getSelectedKeys();
 
            if (aIflowKeys.length > 0) {
 
                const aIflowFilters = aIflowKeys.map(function (sKey) {
                    return new Filter(
                        "iFlowName",
                        FilterOperator.EQ,
                        sKey
                    );
                });
 
                aFilters.push(
                    new Filter({
                        filters: aIflowFilters,
                        and: false
                    })
                );
            }
            const aSeverityKeys = this.byId("_IDGenMultiComboBox1")
                .getSelectedKeys();
 
            if (aSeverityKeys.length > 0) {
 
                const aSeverityFilters = aSeverityKeys.map(function (sKey) {
                    return new Filter(
                        "severity",
                        FilterOperator.EQ,
                        sKey
                    );
                });
 
                aFilters.push(
                    new Filter({
                        filters: aSeverityFilters,
                        and: false
                    })
                );
            }
 
            // Status
            const aStatusKeys = this.byId("_IDGenMultiComboBox2")
                .getSelectedKeys();
 
            if (aStatusKeys.length > 0) {
 
                const aStatusFilters = aStatusKeys.map(function (sKey) {
                    return new Filter(
                        "status",
                        FilterOperator.EQ,
                        sKey
                    );
                });
 
                aFilters.push(
                    new Filter({
                        filters: aStatusFilters,
                        and: false
                    })
                );
            }
            const oTable = this.byId("idIncidentClustersTable");
 
            // Get Binding
            const oBinding = oTable.getBinding("items");
 
            // Apply Filter
            oBinding.filter(aFilters);
        },
        // // _loadDashboardKPIs: function () {
 
        // //     const oTable =
        // //         this.byId("idIncidentClustersTable");
 
        // //     const aItems =
        // //         oTable.getItems();
 
        // //     if (!aItems.length) {
 
        // //         console.log("No Table Data");
 
        // //         return;
        // //     }
 
        // //     // First Row Data
        // //     const oData =
        // //         aItems[0]
        // //             .getBindingContext()
        // //             .getObject();
 
        // //     console.log("KPI DATA:", oData);
 
        // //     // Dashboard Model
        // //     const oDashboardModel =
        // //         new JSONModel({
 
        // //             totalIncidents24h:
        // //                 oData.totalIncidents24h,
 
        // //             activeClusters:
        // //                 oData.activeClusters,
 
        // //             criticalCount:
        // //                 oData.criticalCount,
 
        // //             resolved24h:
        // //                 oData.resolved24h,
 
        // //             criticalCriticality:
        // //                 oData.criticalCriticality
 
        // //         });
 
        // //     this.getView().setModel(
        // //         oDashboardModel,
        // //         "dashboard"
        // //     );
 
        // //     console.log(
        // //         "Dashboard Model Set Successfully"
        // //     );
 
        // // }
 
        _loadDashboardKPIs: function () {
 
            const oTable =
                this.byId("idIncidentClustersTable");
 
            const aItems =
                oTable.getItems();
 
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
            const oDashboardModel =
                new JSONModel({
 
                    totalIncidents24h:
                        oData.totalIncidents24h,
 
                    activeClusters:
                        oData.activeClusters,
 
                    criticalCount:
                        oData.criticalCount,
 
                    resolved24h:
                        oData.resolved24h,
 
                    criticalCriticality:
                        oData.criticalCriticality
 
                });
 
            this.getView().setModel(
                oDashboardModel,
                "dashboard"
            );
 
            console.log(
                "Dashboard Model Set Successfully"
            );
 
        }
 
 
    });
});
 