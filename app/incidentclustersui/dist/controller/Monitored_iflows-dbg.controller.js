sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (BaseController, formatter, Filter, FilterOperator) => {
    "use strict";

    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Monitored_iflows", {
        formatter: formatter,

        onInit: function () {
            this._updateRefreshTime();
            var iFiveMinutes = 300; // 1/2 minute in milliseconds
            this._refreshInterval = setInterval(function () {
                this.onRefreshPress();
            }.bind(this), iFiveMinutes);


            const oRouter =
                this.getOwnerComponent().getRouter();

            oRouter.getRoute("Routemonitored_iflows")
                .attachPatternMatched(
                    this._onRouteMatched,
                    this
                );
        },

        _onRouteMatched: function () {
            var oDateRange = this.byId("idDateRangeFilter");

            if (oDateRange) {
                var oToday = new Date();

                oDateRange.setDateValue(oToday);
                oDateRange.setSecondDateValue(oToday);

                this.onFilteriFlow();
            }
        },

        onRefreshPress: function () {
            var oTable = this.byId("idMonitoredArtifacts");
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


        onRowPress: async function (oEvent) {
            const oItem = oEvent.getParameter("listItem") || oEvent.getSource();
            const oContext = oItem ? oItem.getBindingContext() : null;
            if (!oContext) {
                console.error("Binding context not found on the selected row item.");
                return;
            }
            const sID = oContext.getProperty("ID");
            const oGlobalModel = this.getOwnerComponent().getModel("globalModel");
            if (oGlobalModel) {
                oGlobalModel.setProperty("/iflowId", sID);
                console.log("Cluster ID successfully cached in global model:", sID);
            }
            this.navTo("RouteIC", {
                ID: sID
            });
        },

        onFilterChange: function (oEvent) {
            this.onFilteriFlow();

        },

        onTagPress: function (oEvent) {
            var oPressedTag = oEvent.getSource();
            this._sCurrentSeverityFilter = oPressedTag.data("severity") || "ALL";
            var oButtonContainer = oPressedTag.getParent();
            var aButtons = oButtonContainer.getItems();
            aButtons.forEach(function (oButton) {
                oButton.setEnabled(true);
            });
            oPressedTag.setEnabled(false);
            this.onFilteriFlow();
        },

        onFilteriFlow: function () {
            var aFilters = [];
            var oMultiCombo = this.byId("idIFlowFilter");
            if (oMultiCombo) {
                var aSelectedKeys = oMultiCombo.getSelectedKeys();
                console.log(aSelectedKeys)

                if (aSelectedKeys && aSelectedKeys.length > 0) {
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

            var oPackageMultiCombo = this.byId("idpackageFilter");
            if (oPackageMultiCombo) {
                var aSelectedKeys = oPackageMultiCombo.getSelectedKeys();
                console.log(aSelectedKeys)

                if (aSelectedKeys && aSelectedKeys.length > 0) {
                    var aComboFilters = aSelectedKeys.map(function (sKey) {
                        return new Filter({
                            path: "PackageName",
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
            if (this._sCurrentSeverityFilter && this._sCurrentSeverityFilter !== "ALL") {
                aFilters.push(new Filter({
                    path: "overallSeverity",
                    operator: FilterOperator.EQ,
                    value1: this._sCurrentSeverityFilter
                }));
            }
            var oDateRange = this.byId("idDateRangeFilter");
            if (oDateRange) {
                var oFromDate = oDateRange.getDateValue();
                var oSecondDate = oDateRange.getSecondDateValue();
                if (oFromDate && oSecondDate) {
                    var oToDate = new Date(oSecondDate.getTime());
                    oToDate.setHours(23, 59, 59, 999);
                    var sFromDate = oFromDate.toISOString();
                    var sToDate = oToDate.toISOString();

                    aFilters.push(new Filter({
                        path: "lastPollTimestamp",
                        operator: FilterOperator.BT,
                        value1: sFromDate,
                        value2: sToDate
                    }));
                }
            }
            var oniFlowTable = this.byId("idMonitoredArtifacts");
            if (oniFlowTable) {
                // CHANGED: Get binding for 'items' instead of 'content'
                var oBinding = oniFlowTable.getBinding("items");
                if (oBinding) {
                    oBinding.filter(aFilters);
                } else {
                    console.warn("Table items binding context not found.");
                }
            }

        },
        onTableUpdateFinished: function (oEvent) {
            // This parameter is provided natively by the updateFinished event
            var iTotalItems = oEvent.getParameter("total");
            var oTitleControl = this.byId("idTableTitle");

            if (oTitleControl) {
                oTitleControl.setText("Monitored Artifacts (" + iTotalItems + ")");
            }
        },
        onClearFilters: function () {

            // Clear iFlow filter
            var oIFlowFilter = this.byId("idIFlowFilter");
            if (oIFlowFilter) {
                oIFlowFilter.removeAllSelectedItems();
            }

            // Clear Package filter
            var oPackageFilter = this.byId("idpackageFilter");
            if (oPackageFilter) {
                oPackageFilter.removeAllSelectedItems();
            }

            // Clear date range
            var oDateRange = this.byId("idDateRangeFilter");
            if (oDateRange) {
                oDateRange.setDateValue(null);
                oDateRange.setSecondDateValue(null);
                oDateRange.setValue("");
            }

            // Reset severity filter
            this._sCurrentSeverityFilter = "ALL";

            // Re-enable all severity buttons
            var aSeverityButtons = [
                this.byId("btnAll"),
                this.byId("btnCritical"),
                this.byId("btnHigh"),
                this.byId("btnMedium"),
                this.byId("btnLow")
            ];

            aSeverityButtons.forEach(function (oButton) {
                if (oButton) {
                    oButton.setEnabled(true);
                }
            });

            // Disable ALL button (optional)
            if (this.byId("btnAll")) {
                this.byId("btnAll").setEnabled(false);
            }

            // Remove all filters from table
            this.onFilteriFlow();
        },


    });
});