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

        // _onRouteMatched: async function () {
        //     this.getOwnerComponent().getModel("globalModel").setProperty("/selectedKey","iflows");
        //     // Only set defaults the very first time
        //     if (this._bInitialized) {
        //         return;
        //     }
        //     this._bInitialized = true;

        //     let oDateRange = this.byId("idDateRangeFilter");
        //     if (oDateRange) {
        //         let oFromDate = new Date();
        //         oFromDate.setHours(0, 0, 0, 0);
        //         let oToDate = new Date();
        //         oDateRange.setDateValue(oFromDate);
        //         oDateRange.setSecondDateValue(oToDate);
        //         this.onFilteriFlow();
        //     }
        // },
        _onRouteMatched: async function () {
            this.getOwnerComponent().getModel("globalModel").setProperty("/selectedKey", "iflows");

            try {
                this.getView().setBusy(true);
                this.byId("idIFLowSeverityTabBar").setSelectedKey('ALL');
                
                const oTable = this.byId("idMonitoredArtifacts");
                if (!oTable) {
                    this.getView().setBusy(false);
                    return;
                }
                
                const oBinding = oTable.getBinding("items");
                if (!oBinding) {
                    this.getView().setBusy(false);
                    return;
                }

                const aFilters = this._getDropdownAndDateFilters();
                const aTenantFilters = this.getGlobalTenantFilter();
                const aCombinedFilters = aFilters.concat(aTenantFilters);

                await new Promise((resolve) => {
                    oBinding.attachEventOnce("dataReceived", (oEvt) => {
                        const oError = oEvt.getParameter("error");
                        if (oError) {
                            // Immediately pop the dialog on initial load failure
                            this.showErrorDialog(oError, "Initial Data Load Failed");
                        }
                        resolve();
                    });
                    
                    oBinding.filter(aCombinedFilters);
                    setTimeout(resolve, 3000); // Failsafe resolve
                });

                await this._filterDropdownBindings();
                await this._updateSeverityCounts();

            } catch (oError) {
                this.showErrorDialog(oError, "Routing Error");
            } finally {
                this.getView().setBusy(false);
            }
        },

        onRefreshPress: function () {
            const oTable = this.byId("idMonitoredArtifacts");
            const oBinding = oTable && oTable.getBinding("items");

            if (oBinding) {
                oBinding.attachEventOnce("dataReceived", (oEvt) => {
                    const oError = oEvt.getParameter("error");
                    if (oError) {
                        this._iPollFailures = (this._iPollFailures || 0) + 1;
                        
                        // Fire dialog immediately if polling fails (or adjust to >= 2 to prevent network blip spam)
                        if (this._iPollFailures >= 1) {
                            this.showErrorDialog(oError, "Live Polling Error");
                        }
                    } else {
                        this._iPollFailures = 0; // Reset counter on success
                    }
                });
            }

            this.onFilteriFlow();
            this._filterDropdownBindings();
            this._updateSeverityCounts();
            this._updateRefreshTime();
        },
        _updateSeverityCounts: async function () {

            const oTable = this.byId("idMonitoredArtifacts");

            if (!oTable) {
                return;
            }

            const oBinding = oTable.getBinding("items");

            if (!oBinding) {
                return;
            }

            try {

                // Header filters only
                let aFilters = this._getDropdownAndDateFilters();

                // Global tenant filter
                aFilters = aFilters.concat(
                    this.getGlobalTenantFilter()
                );

                const oModel = oBinding.getModel();

                // Use same path as your table binding
                const oCountBinding = oModel.bindList(
                    oBinding.getPath(),
                    null,
                    null,
                    aFilters
                );

                const iLength = oCountBinding.getLength();

                const aContexts =
                    await oCountBinding.requestContexts(
                        0,
                        iLength
                    );

                const aData = aContexts
                    .map(oContext => oContext?.getObject?.())
                    .filter(Boolean);

                const iAll = aData.length;

                const iCritical =
                    aData.filter(
                        o => o.overallSeverity === "CRITICAL"
                    ).length;

                const iHigh =
                    aData.filter(
                        o => o.overallSeverity === "HIGH"
                    ).length;

                const iMedium =
                    aData.filter(
                        o => o.overallSeverity === "MEDIUM"
                    ).length;

                const iLow =
                    aData.filter(
                        o => o.overallSeverity === "LOW"
                    ).length;

                this.byId("allTab")?.setCount(iAll);
                this.byId("criticalTab")?.setCount(iCritical);
                this.byId("highTab")?.setCount(iHigh);
                this.byId("mediumTab")?.setCount(iMedium);
                this.byId("lowTab")?.setCount(iLow);

                console.log("Severity Counts:", {
                    ALL: iAll,
                    CRITICAL: iCritical,
                    HIGH: iHigh,
                    MEDIUM: iMedium,
                    LOW: iLow
                });

            } catch (e) {
                console.error("Count calculation failed", e);
            }
        },
        _filterDropdownBindings: function () {

            const aTenantFilters =
                this.getGlobalTenantFilter();

            const oIFlowBinding =
                this.byId("idIFlowFilter")
                    ?.getBinding("items");

            if (oIFlowBinding) {
                oIFlowBinding.filter(aTenantFilters);
            }

            const oPackageBinding =
                this.byId("idpackageFilter")
                    ?.getBinding("items");

            if (oPackageBinding) {
                oPackageBinding.filter(aTenantFilters);
            }
        },
        // onRefreshPress: function () {

        //     this.onFilteriFlow();

        //     this._filterDropdownBindings();
        //     this._updateSeverityCounts();
        //     this._updateRefreshTime();
        // },


        // onRefreshPress: function () {
        //     let oTable = this.byId("idMonitoredArtifacts");
        //     if (oTable && oTable.getBinding("items")) {
        //         oTable.getBinding("items").refresh();
        //     }
        //     this._updateRefreshTime();
        // },

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


        onRowPress: async function (oEvent) {

            this.showBusy();
            console.log("showBusy() called");
            const oItem = oEvent.getParameter("listItem");
            const oContext = oItem.getBindingContext();

            if (!oContext) return;

            // Show busy indicator before async operation


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
                this.hideBusy();
            }
        },
        onFilterChange: function () {

            this.showBusy();

            let oIconTabHeader =
                this.byId("idIFLowSeverityTabBar");

            if (oIconTabHeader) {
                oIconTabHeader.setSelectedKey("ALL");
            }

            this.onFilteriFlow();

            this._updateSeverityCounts();

            this.hideBusy();
        },
        onSeverityTabSelect: function (oEvent) {

    const sKey =
        oEvent.getParameter("key");

    const oTable =
        this.byId("idMonitoredArtifacts");

    if (!oTable) {
        return;
    }

    const oBinding =
        oTable.getBinding("items");

    if (!oBinding) {
        return;
    }

    let aFilters =
        this._getDropdownAndDateFilters();

    // Add tenant filter
    aFilters =
        aFilters.concat(
            this.getGlobalTenantFilter()
        );

    // Add severity filter
    if (sKey !== "ALL") {

        aFilters.push(
            new Filter(
                "overallSeverity",
                FilterOperator.EQ,
                sKey
            )
        );
    }

    oBinding.filter(aFilters);
},
        onFilteriFlow: function () {

            let aFilters = this._getDropdownAndDateFilters();

            // Always append global tenant filter
            const aTenantFilters = this.getGlobalTenantFilter();
            aFilters = aFilters.concat(aTenantFilters);

            let oTable = this.byId("idMonitoredArtifacts");

            if (oTable) {
                let oBinding = oTable.getBinding("items");

                if (oBinding) {
                    oBinding.filter(aFilters);
                }
            }
        },
        // onFilteriFlow: function () {
        //     let aFilters = this._getDropdownAndDateFilters();

        //     let oTable = this.byId("idMonitoredArtifacts");
        //     if (oTable) {
        //         let oBinding = oTable.getBinding("items");
        //         if (oBinding) {
        //             oBinding.filter(aFilters);
        //         } else {
        //             console.warn("Table items binding context not found.");
        //         }
        //     }
        // },
        _getDropdownAndDateFilters: function () {
            let aFilters = [];

            // 1. IFlow Filter
            let oMultiiFlowCombo = this.byId("idIFlowFilter");
            if (oMultiiFlowCombo) {
                let aSelectedKeys = oMultiiFlowCombo.getSelectedKeys();
                if (aSelectedKeys && aSelectedKeys.length > 0) {
                    let aComboFilters = aSelectedKeys.map(function (sKey) {
                        return new Filter({
                            path: "iFlowName",
                            operator: FilterOperator.EQ,
                            value1: sKey
                        });
                    });
                    aFilters.push(new Filter({ filters: aComboFilters, and: false }));
                }
            }

            // 2. Tenant Filter
            let oMultiTenantCombo = this.byId("idTenantFilter");
            if (oMultiTenantCombo) {
                let aSelectedKeys = oMultiTenantCombo.getSelectedKeys();
                if (aSelectedKeys && aSelectedKeys.length > 0) {
                    let aComboFilters = aSelectedKeys.map(function (sKey) {
                        return new Filter({
                            path: "tenant_ID",
                            operator: FilterOperator.EQ,
                            value1: sKey
                        });
                    });
                    aFilters.push(new Filter({ filters: aComboFilters, and: false }));
                }
            }

            // 3. Package Filter
            let oPackageMultiCombo = this.byId("idpackageFilter");
            if (oPackageMultiCombo) {
                let aSelectedKeys = oPackageMultiCombo.getSelectedKeys();
                if (aSelectedKeys && aSelectedKeys.length > 0) {
                    let aComboFilters = aSelectedKeys.map(function (sKey) {
                        return new Filter({
                            path: "PackageName",
                            operator: FilterOperator.EQ,
                            value1: sKey
                        });
                    });
                    aFilters.push(new Filter({ filters: aComboFilters, and: false }));
                }
            }

            // 4. Date Range Filter
            let oDateRange = this.byId("idDateRangeFilter");
            if (oDateRange) {
                let oFromDate = oDateRange.getDateValue();
                let oSecondDate = oDateRange.getSecondDateValue();
                if (oFromDate && oSecondDate) {
                    let oToDate = new Date(oSecondDate.getTime());
                    oToDate.setHours(23, 59, 59, 999);

                    aFilters.push(new Filter({
                        path: "lastErrorAt",
                        operator: FilterOperator.BT,
                        value1: oFromDate.toISOString(),
                        value2: oToDate.toISOString()
                    }));
                }
            }

            return aFilters;
        },
        onClearFilters: function (oEvent) {
            // Clear all Combo Boxes (including Package Filter)
            ["idIFlowFilter", "idpackageFilter", "idTenantFilter"].forEach(sId => {
                let oCombo = this.byId(sId);
                if (oCombo) {
                    oCombo.removeAllSelectedItems();
                }
            });

            // Clear date range
            let oDateRange = this.byId("idDateRangeFilter");
            if (oDateRange) {
                oDateRange.setDateValue(null);
                oDateRange.setSecondDateValue(null);
                oDateRange.setValue("");
            }

            // Snap active selection back to ALL tab
            let oIconTabHeader = this.byId("idIFLowSeverityTabBar");
            if (oIconTabHeader) {
                oIconTabHeader.setSelectedKey("ALL");
            }

            // Re-apply clear state filters to the table binding context
            this.onFilteriFlow();
        },



        // onFilterChange: function (oEvent) {
        //     this.showBusy();
        //     this.onFilteriFlow();
        //     this.hideBusy();

        // },

        // onTagPress: function (oEvent) {
        //     let oPressedTag = oEvent.getSource();
        //     this._sCurrentSeverityFilter = oPressedTag.data("severity") || "ALL";
        //     let oButtonContainer = oPressedTag.getParent();
        //     let aButtons = oButtonContainer.getItems();
        //     aButtons.forEach(function (oButton) {
        //         oButton.setEnabled(true);
        //     });
        //     oPressedTag.setEnabled(false);
        //     this.onFilteriFlow();
        // },

        // onFilteriFlow: function () {
        //     let aFilters = [];
        //     let oMultiiFlowCombo = this.byId("idIFlowFilter");
        //     if (oMultiiFlowCombo) {
        //         let aSelectedKeys = oMultiiFlowCombo.getSelectedKeys();
        //         console.log(aSelectedKeys)

        //         if (aSelectedKeys && aSelectedKeys.length > 0) {
        //             let aComboFilters = aSelectedKeys.map(function (sKey) {
        //                 return new Filter({
        //                     path: "iFlowName",
        //                     operator: FilterOperator.EQ,
        //                     value1: sKey
        //                 });
        //             });

        //             aFilters.push(new Filter({
        //                 filters: aComboFilters,
        //                 and: false
        //             }));
        //         }
        //     }
        //     let oMultiTenantCombo = this.byId("idTenantFilter");

        //     if (oMultiTenantCombo) {
        //         let aSelectedKeys = oMultiTenantCombo.getSelectedKeys();
        //         console.log(aSelectedKeys)

        //         if (aSelectedKeys && aSelectedKeys.length > 0) {
        //             let aComboFilters = aSelectedKeys.map(function (sKey) {
        //                 return new Filter({
        //                     path: "tenant_ID",
        //                     operator: FilterOperator.EQ,
        //                     value1: sKey
        //                 });
        //             });

        //             aFilters.push(new Filter({
        //                 filters: aComboFilters,
        //                 and: false
        //             }));
        //         }
        //     }

        //     let oPackageMultiCombo = this.byId("idpackageFilter");
        //     if (oPackageMultiCombo) {
        //         let aSelectedKeys = oPackageMultiCombo.getSelectedKeys();
        //         console.log(aSelectedKeys)

        //         if (aSelectedKeys && aSelectedKeys.length > 0) {
        //             let aComboFilters = aSelectedKeys.map(function (sKey) {
        //                 return new Filter({
        //                     path: "PackageName",
        //                     operator: FilterOperator.EQ,
        //                     value1: sKey
        //                 });
        //             });

        //             aFilters.push(new Filter({
        //                 filters: aComboFilters,
        //                 and: false
        //             }));
        //         }
        //     }
        //     if (this._sCurrentSeverityFilter && this._sCurrentSeverityFilter !== "ALL") {
        //         aFilters.push(new Filter({
        //             path: "overallSeverity",
        //             operator: FilterOperator.EQ,
        //             value1: this._sCurrentSeverityFilter
        //         }));
        //     }


        //     let oDateRange = this.byId("idDateRangeFilter");
        //     if (oDateRange) {
        //         let oFromDate = oDateRange.getDateValue();
        //         let oSecondDate = oDateRange.getSecondDateValue();
        //         if (oFromDate && oSecondDate) {
        //             let oToDate = new Date(oSecondDate.getTime());
        //             oToDate.setHours(23, 59, 59, 999);
        //             let sFromDate = oFromDate.toISOString();
        //             let sToDate = oToDate.toISOString();

        //             aFilters.push(new Filter({
        //                 path: "lastErrorAt",
        //                 operator: FilterOperator.BT,
        //                 value1: sFromDate,
        //                 value2: sToDate
        //             }));
        //         }
        //     }
        //     let oniFlowTable = this.byId("idMonitoredArtifacts");
        //     console.log(aFilters);
        //     if (oniFlowTable) {
        //         // CHANGED: Get binding for 'items' instead of 'content'
        //         let oBinding = oniFlowTable.getBinding("items");
        //         if (oBinding) {
        //             oBinding.filter(aFilters);
        //         } else {
        //             console.warn("Table items binding context not found.");
        //         }
        //     }

        // },
        onTableUpdateFinished: function (oEvent) {


            const iTotal = oEvent.getParameter("total");

            console.log("Total records:", iTotal);
        }
        // onTableUpdateFinished: function (oEvent) {
        //     // This parameter is provided natively by the updateFinished event
        //     let iTotalItems = oEvent.getParameter("total");
        //     let oTitleControl = this.byId("idTableTitle");

        //     if (oTitleControl) {
        //         oTitleControl.setText("Monitored Artifacts (" + iTotalItems + ")");
        //     }
        // },
        // onClearFilters: function (oEvent) {

        //     // Clear iFlow filter
        //     let oIFlowFilter = this.byId("idIFlowFilter");
        //     if (oIFlowFilter) {
        //         oIFlowFilter.removeAllSelectedItems();
        //     }

        //     // Clear Package filter
        //     let oPackageFilter = this.byId("idpackageFilter");
        //     if (oPackageFilter) {
        //         oPackageFilter.removeAllSelectedItems();
        //     }

        //     let oTenantFilter = this.byId("idTenantFilter");
        //     if (oTenantFilter) {
        //         oTenantFilter.removeAllSelectedItems();
        //     }

        //     // Clear date range
        //     let oDateRange = this.byId("idDateRangeFilter");
        //     if (oDateRange) {
        //         oDateRange.setDateValue(null);
        //         oDateRange.setSecondDateValue(null);
        //         oDateRange.setValue("");
        //     }

        //     // Reset severity filter
        //     let oPressedTag = oEvent.getSource();
        //     this._sCurrentSeverityFilter = oPressedTag.data("severity") || "ALL";
        //     let oButtonContainer = oPressedTag.getParent();
        //     let aButtons = oButtonContainer.getItems();
        //     aButtons.forEach(function (oButton) {
        //         oButton.setEnabled(true);
        //     });

        //     // Remove all filters from table
        //     this.onFilteriFlow();
        // },
        // onSeverityTabSelect: function (oEvent) {
        //     const sKey = oEvent.getParameter("key");
        //     const oTable = this.byId("idMonitoredArtifacts");
        //     const oBinding = oTable.getBinding("items");

        //     let aFilters = [];

        //     if (sKey !== "ALL") {
        //         aFilters.push(
        //             new sap.ui.model.Filter(
        //                 "overallSeverity",
        //                 sap.ui.model.FilterOperator.EQ,
        //                 sKey
        //             )
        //         );
        //     }

        //     oBinding.filter(aFilters);
        // }


    });
});