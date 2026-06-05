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
            let iFiveMinutes = 50000; // 5 minutes in milliseconds
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

        onNavBackToOverview: function () {
            this.navTo("RouteOverview");
        },

        _onRouteMatched: function () {
            // Only set defaults the very first time
            if (this._bInitialized) {
                return;
            }
            this._bInitialized = true;

            let oDateRange = this.byId("idDateRangeFilter");
            if (oDateRange) {
                let oFromDate = new Date();
                oFromDate.setHours(0, 0, 0, 0);
                let oToDate = new Date();
                oDateRange.setDateValue(oFromDate);
                oDateRange.setSecondDateValue(oToDate);
                this.onFilteriFlow();
            }
        },

        onRefreshPress: function () {
            let oTable = this.byId("idMonitoredArtifacts");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").refresh();
            }
            this._updateRefreshTime();
        },

        _updateRefreshTime: function () {
            let oModel = this.getOwnerComponent().getModel("globalModel");
            let sCurrentTime = new Date().toLocaleTimeString();
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

        // onRowPress: async function (oEvent) {

        //     debugger;
        //     const oItem = oEvent.getParameter("listItem");
        //     const oContext = oItem.getBindingContext();

        //     if (!oContext) return;

        //     try {
        //         // requestProperty ensures the data is there before moving forward
        //         const sID = await oContext.requestProperty("ID");

        //         if (sID) {
        //             const oGlobalModel = this.getOwnerComponent().getModel("globalModel");
        //             oGlobalModel.setProperty("/iflowId", sID);

        //             this.getOwnerComponent().getRouter().navTo("RouteIC", {
        //                 ID: sID
        //             });
        //         } else {
        //             console.error("ID is physically missing from the backend response.");
        //         }
        //     } catch (oError) {
        //         console.error("Failed to fetch ID from OData cache:", oError);
        //     }

        // },

        onRowPress: async function (oEvent) {
            debugger;
            const oItem = oEvent.getParameter("listItem");
            const oContext = oItem.getBindingContext();

            if (!oContext) return;

            // Show busy indicator before async operation
            sap.ui.core.BusyIndicator.show(5000);

            try {
                // requestProperty ensures the data is there before moving forward
                const sID = await oContext.requestProperty("ID");

                if (sID) {
                    const oGlobalModel = this.getOwnerComponent().getModel("globalModel");
                    oGlobalModel.setProperty("/iflowId", sID);

                    this.getOwnerComponent().getRouter().navTo("RouteIC", {
                        ID: sID
                    });
                } else {
                    console.error("ID is physically missing from the backend response.");
                }
            } catch (oError) {
                console.error("Failed to fetch ID from OData cache:", oError);
            } finally {
                // Always hide the busy indicator, even if an error occurred
                sap.ui.core.BusyIndicator.hide();
            }
        },


        // onRowPress: async function (oEvent) {
        //     const oItem = oEvent.getParameter("listItem") || oEvent.getSource();
        //     const oContext = oItem ? oItem.getBindingContext() : null;
        //     if (!oContext) {
        //         console.error("Binding context not found on the selected row item.");
        //         return;
        //     }
        //     const sID = oContext.getProperty("ID");
        //     const oGlobalModel = this.getOwnerComponent().getModel("globalModel");
        //     if (oGlobalModel) {
        //         oGlobalModel.setProperty("/iflowId", sID);
        //         console.log("Cluster ID successfully cached in global model:", sID);
        //     }
        //     this.navTo("RouteIC", {
        //         ID: sID
        //     });
        // },

        onFilterChange: function (oEvent) {
            this.showBusy();
            this.onFilteriFlow();
            this.hideBusy();

        },

        onTagPress: function (oEvent) {
            let oPressedTag = oEvent.getSource();
            this._sCurrentSeverityFilter = oPressedTag.data("severity") || "ALL";
            let oButtonContainer = oPressedTag.getParent();
            let aButtons = oButtonContainer.getItems();
            aButtons.forEach(function (oButton) {
                oButton.setEnabled(true);
            });
            oPressedTag.setEnabled(false);
            this.onFilteriFlow();
        },

        onFilteriFlow: function () {
            let aFilters = [];
            let oMultiiFlowCombo = this.byId("idIFlowFilter");
            if (oMultiiFlowCombo) {
                let aSelectedKeys = oMultiiFlowCombo.getSelectedKeys();
                console.log(aSelectedKeys)

                if (aSelectedKeys && aSelectedKeys.length > 0) {
                    let aComboFilters = aSelectedKeys.map(function (sKey) {
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
            let oMultiTenantCombo = this.byId("idTenantFilter");

            if (oMultiTenantCombo) {
                let aSelectedKeys = oMultiTenantCombo.getSelectedKeys();
                console.log(aSelectedKeys)

                if (aSelectedKeys && aSelectedKeys.length > 0) {
                    let aComboFilters = aSelectedKeys.map(function (sKey) {
                        return new Filter({
                            path: "tenant_ID",
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

            let oPackageMultiCombo = this.byId("idpackageFilter");
            if (oPackageMultiCombo) {
                let aSelectedKeys = oPackageMultiCombo.getSelectedKeys();
                console.log(aSelectedKeys)

                if (aSelectedKeys && aSelectedKeys.length > 0) {
                    let aComboFilters = aSelectedKeys.map(function (sKey) {
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


            let oDateRange = this.byId("idDateRangeFilter");
            if (oDateRange) {
                let oFromDate = oDateRange.getDateValue();
                let oSecondDate = oDateRange.getSecondDateValue();
                if (oFromDate && oSecondDate) {
                    let oToDate = new Date(oSecondDate.getTime());
                    oToDate.setHours(23, 59, 59, 999);
                    let sFromDate = oFromDate.toISOString();
                    let sToDate = oToDate.toISOString();

                    aFilters.push(new Filter({
                        path: "lastErrorAt",
                        operator: FilterOperator.BT,
                        value1: sFromDate,
                        value2: sToDate
                    }));
                }
            }
            let oniFlowTable = this.byId("idMonitoredArtifacts");
            console.log(aFilters);
            if (oniFlowTable) {
                // CHANGED: Get binding for 'items' instead of 'content'
                let oBinding = oniFlowTable.getBinding("items");
                if (oBinding) {
                    oBinding.filter(aFilters);
                } else {
                    console.warn("Table items binding context not found.");
                }
            }

        },
        // onTableUpdateFinished: function (oEvent) {
        //     // This parameter is provided natively by the updateFinished event
        //     let iTotalItems = oEvent.getParameter("total");
        //     let oTitleControl = this.byId("idTableTitle");

        //     if (oTitleControl) {
        //         oTitleControl.setText("Monitored Artifacts (" + iTotalItems + ")");
        //     }
        // },
        onClearFilters: function (oEvent) {

            // Clear iFlow filter
            let oIFlowFilter = this.byId("idIFlowFilter");
            if (oIFlowFilter) {
                oIFlowFilter.removeAllSelectedItems();
            }

            // Clear Package filter
            let oPackageFilter = this.byId("idpackageFilter");
            if (oPackageFilter) {
                oPackageFilter.removeAllSelectedItems();
            }

            let oTenantFilter = this.byId("idTenantFilter");
            if (oTenantFilter) {
                oTenantFilter.removeAllSelectedItems();
            }

            // Clear date range
            let oDateRange = this.byId("idDateRangeFilter");
            if (oDateRange) {
                oDateRange.setDateValue(null);
                oDateRange.setSecondDateValue(null);
                oDateRange.setValue("");
            }

            // Reset severity filter
            let oPressedTag = oEvent.getSource();
            this._sCurrentSeverityFilter = oPressedTag.data("severity") || "ALL";
            let oButtonContainer = oPressedTag.getParent();
            let aButtons = oButtonContainer.getItems();
            aButtons.forEach(function (oButton) {
                oButton.setEnabled(true);
            });

            // Remove all filters from table
            this.onFilteriFlow();
        },


    });
});