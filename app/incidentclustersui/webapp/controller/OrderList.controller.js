sap.ui.define([
    "./BaseController",
    "../model/formatter"
], (BaseController, formatter) => {
    "use strict";

    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.OrderList", {
        formatter: formatter,
        onInit: async function () {


        },

        onAipress: function () {
            // console.log("AI Assistant Button Pressed");
            this.showBusy();
            this.navTo("RouteAIAssistant");
            this.hideBusy();
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
        onCardPress: async function (oEvent) {
    console.log("Card press event triggered");

    const oCard = oEvent.getSource();
    const oContext = oCard.getBindingContext();
    
    // Guard clause: Exit early if context is not yet loaded
    if (!oContext) {
        console.error("Binding context not found on the selected card.");
        return;
    }

    const sID = oContext.getProperty("ID");
    
    // Update the global model with the selected ID
    const oGlobalModel = this.getOwnerComponent().getModel("globalModel");
    if (oGlobalModel) {
        oGlobalModel.setProperty("/iflowId", sID);
        console.log("Cluster ID set in global model:", sID);
    }

    // Navigate to the target route
    this.navTo("RouteIC", {
        ID: sID
    });

    console.log("Route Activated for ID:", sID);
}
,

        onRowPress: async function (oEvent) {
            // this.showBusy(5000);
            console.log("event tRiggered")

            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext();
            const sID = oContext.getProperty("ID");
            this.getOwnerComponent().getModel("globalModel").setProperty("/iflowId", sID);
            console.log("Cluster ID set in global model:", sID);

            this.navTo("RouteIC", {
                ID: sID
            });

            console.log("Route Activated")
            //this.hideBusy();
        },

        onTagPress: function (oEvent) {
    var oPressedTag = oEvent.getSource();
    this._sCurrentSeverityFilter = oPressedTag.data("severity") || "ALL";
    
    // Fire the calculation logic
    this.onSearchiFlowName();
},

// 3. Triggered when interacting with the MultiComboBox dropdown
onFilterChange: function (oEvent) {
    this.onSearchiFlowName();
},

// 4. Unified execution builder 
onSearchiFlowName: function () {
    var aFilters = [];

    // --- SECTION A: MultiComboBox Handling ---
    var oMultiCombo = this.byId("idIFlowFilter");
    if (oMultiCombo) {
        var aSelectedKeys = oMultiCombo.getSelectedKeys();
        
        if (aSelectedKeys && aSelectedKeys.length > 0) {
            // Build multi-token select filter arrays joined by an OR condition
            var aComboFilters = aSelectedKeys.map(function (sKey) {
                return new sap.ui.model.Filter({
                    path: "iFlowName",
                    operator: sap.ui.model.FilterOperator.EQ,
                    value1: sKey
                });
            });
            
            aFilters.push(new sap.ui.model.Filter({
                filters: aComboFilters,
                and: false
            }));
        }
    }

    // --- SECTION B: GenericTag Severity Handling ---
    if (this._sCurrentSeverityFilter && this._sCurrentSeverityFilter !== "ALL") {
        aFilters.push(new sap.ui.model.Filter({
            path: "overallSeverity",
            operator: sap.ui.model.FilterOperator.EQ,
            value1: this._sCurrentSeverityFilter
        }));
    }

    // --- SECTION C: Apply filters to Grid Layout context ---
    var oGrid = this.byId("idGridId");
    if (oGrid) {
        var oBinding = oGrid.getBinding("content");
        if (oBinding) {
            oBinding.filter(aFilters);
        } else {
            console.warn("Grid content binding context not found.");
        }
    }
}

    });
});
