sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (BaseController, formatter, Filter, FilterOperator) => {
    "use strict";

    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.monitored_iflows", {
        formatter: formatter,

        onInit: function () {
            this._updateRefreshTime();
            var iFiveMinutes = 300;
            this._refreshInterval = setInterval(function () {
                this.onRefreshPress();
            }.bind(this), iFiveMinutes);
        },

        onRefreshPress: function () {
            var oTable = this.byId("idGridListId");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").refresh();
            }
            this._updateRefreshTime();
        },

        _updateRefreshTime: function () {
            var oModel = this.getOwnerComponent().getModel("globalModel");
            var sCurrentTime = new Date().toLocaleTimeString();
            oModel.setProperty("/lastRefreshTime", sCurrentTime);

        },
        onExit: function () {
            if (this._refreshInterval) {
                clearInterval(this._refreshInterval);
                this._refreshInterval = null; // Clear it out completely
            }
        },


        onAipress: function () {
            this.showBusy();
            this.navTo("RouteAIAssistant");
            this.hideBusy();
        },

        onSeverityTabSelect: function (oEvent) {
            const sKey = oEvent.getParameter("key");
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

            // Update for Table (if still used)
            const oTable = this.byId("idIncidentClustersTable");
            if (oTable) {
                const oTableBinding = oTable.getBinding("items");
                if (oTableBinding) {
                    oTableBinding.filter(aFilters);
                }
            }

            // Update for the new GridList
            const oGridList = this.byId("idGridListId");
            if (oGridList) {
                const oGridBinding = oGridList.getBinding("items");
                if (oGridBinding) {
                    oGridBinding.filter(aFilters);
                }
            }
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
        },

        onRowPress: async function (oEvent) {
            console.log("Row press event triggered");

            // 1. Natively fetch the individual row item container from the table event parameter
            const oItem = oEvent.getParameter("listItem") || oEvent.getSource();

            // 2. Guard Clause: Safely extract and check binding context data
            const oContext = oItem ? oItem.getBindingContext() : null;
            if (!oContext) {
                console.error("Binding context not found on the selected row item.");
                return;
            }

            const sID = oContext.getProperty("ID");

            // 3. Update Global Tracking State
            const oGlobalModel = this.getOwnerComponent().getModel("globalModel");
            if (oGlobalModel) {
                oGlobalModel.setProperty("/iflowId", sID);
                console.log("Cluster ID successfully cached in global model:", sID);
            }

            // 4. Trigger Cross-View Navigation Routing
            this.navTo("RouteIC", {
                ID: sID
            });

            console.log("Route Activated for ID:", sID);
        },

        onTagPress: function (oEvent) {

            var oPressedTag = oEvent.getSource();

            this._sCurrentSeverityFilter = oPressedTag.data("severity") || "ALL";



            // Fire the calculation logic

            this.onSearchiFlowName();

        },



        // Triggered when interacting with the MultiComboBox dropdown

        onFilterChange: function (oEvent) {

            console.log("1. Dropdown changed!");

            this.onSearchiFlowName();

        },

        // onTagPress: function (oEvent) {
        //     var oPressedTag = oEvent.getSource();
        //     this._sCurrentSeverityFilter = oPressedTag.data("severity") || "ALL";

        //     // 1. Get the FlexBox container holding all the buttons
        //     var oButtonContainer = oPressedTag.getParent();

        //     // 2. Re-enable ALL buttons in that container
        //     var aButtons = oButtonContainer.getItems();
        //     aButtons.forEach(function (oButton) {
        //         oButton.setEnabled(true);
        //     });

        //     // 3. Disable the specific button that was just pressed
        //     oPressedTag.setEnabled(false);

        //     // Fire the calculation logic
        //     this.onSearchiFlowName();
        // },

        // Unified execution builder 
        onSearchiFlowName: function () {
            var aFilters = [];

            // --- SECTION A: MultiComboBox Handling ---
            var oMultiCombo = this.byId("idIFlowFilter");
            if (oMultiCombo) {
                var aSelectedKeys = oMultiCombo.getSelectedKeys();
                console.log(aSelectedKeys)

                if (aSelectedKeys && aSelectedKeys.length > 0) {
                    // Build multi-token select filter arrays joined by an OR condition
                    var aComboFilters = aSelectedKeys.map(function (sKey) {
                        return new Filter({
                            path: "iFlowName",
                            operator: FilterOperator.EQ,
                            value1: sKey
                        });
                    });

                    aFilters.push(new Filter({
                        filters: aComboFilters,
                        and: false
                    }));
                }
            }

            // --- SECTION B: GenericTag Severity Handling ---
            if (this._sCurrentSeverityFilter && this._sCurrentSeverityFilter !== "ALL") {
                aFilters.push(new Filter({
                    path: "overallSeverity",
                    operator: FilterOperator.EQ,
                    value1: this._sCurrentSeverityFilter
                }));
            }

            // --- SECTION C: Date Range Handling ---
            var oDateRange = this.byId("idDateRangeFilter");
            if (oDateRange) {
                var oFromDate = oDateRange.getDateValue();
                var oSecondDate = oDateRange.getSecondDateValue();

                // Only apply filter if both a start and end date are selected
                if (oFromDate && oSecondDate) {

                    // Clone the date to avoid mutating the control's internal value
                    var oToDate = new Date(oSecondDate.getTime());

                    // Set 'To' date to 23:59:59 to include all records on the final day
                    oToDate.setHours(23, 59, 59, 999);

                    // FIX: Convert JS Dates to OData V4 compatible ISO Strings
                    var sFromDate = oFromDate.toISOString();
                    var sToDate = oToDate.toISOString();

                    aFilters.push(new Filter({
                        path: "lastPollTimestamp", // Or "modifiedAt" depending on your backend
                        operator: FilterOperator.BT,
                        value1: sFromDate,
                        value2: sToDate
                    }));
                }
            }

            // --- SECTION C: Apply filters to Grid List context ---
            // CHANGED: Target idGridListId instead of idGridId
            var oGridList = this.byId("idGridListId");
            if (oGridList) {
                // CHANGED: Get binding for 'items' instead of 'content'
                var oBinding = oGridList.getBinding("items");
                if (oBinding) {
                    oBinding.filter(aFilters);
                } else {
                    console.warn("Grid list items binding context not found.");
                }
            }
        }
    });
});