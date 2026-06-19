sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (BaseController, formatter, Filter, FilterOperator) => {
    "use strict";

    // Auto-refresh cadence for live polling
    const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    // Failsafe timeout so the busy spinner always clears even if dataReceived never fires
    const DATA_LOAD_FAILSAFE_MS = 3000;

    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Monitored_iflows", {
        formatter: formatter,

        onInit: function () {
            this._updateRefreshTime();

            this._refreshInterval = setInterval(() => {
                this.onRefreshPress();
            }, REFRESH_INTERVAL_MS);

            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("Routemonitored_iflows")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        onNavBackToOverview: function () {
            this.navTo("RouteOverview");
        },

        _onRouteMatched: async function () {
            this.getOwnerComponent().getModel("globalModel").setProperty("/selectedKey", "iflows");

            try {
                this.getView().setBusy(true);
                this.byId("idIFLowSeverityTabBar").setSelectedKey("ALL");

                const oTable = this.byId("idMonitoredArtifacts");
                if (!oTable) {
                    return;
                }

                const oBinding = oTable.getBinding("items");
                if (!oBinding) {
                    return;
                }

                const aFilters = this._getDropdownAndDateFilters();
                const aTenantFilters = this.getGlobalTenantFilter();
                const aCombinedFilters = aFilters.concat(aTenantFilters);

                await new Promise((resolve) => {
                    oBinding.attachEventOnce("dataReceived", (oEvt) => {
                        const oError = oEvt.getParameter("error");
                        if (oError) {
                            this.showErrorDialog(oError, "Initial Data Load Failed");
                        }
                        resolve();
                    });

                    oBinding.filter(aCombinedFilters);
                    setTimeout(resolve, DATA_LOAD_FAILSAFE_MS);
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
                        if (this._iPollFailures >= 1) {
                            this.showErrorDialog(oError, "Live Polling Error");
                        }
                    } else {
                        this._iPollFailures = 0;
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
                let aFilters = this._getDropdownAndDateFilters();
                aFilters = aFilters.concat(this.getGlobalTenantFilter());

                const oModel = oBinding.getModel();
                const oCountBinding = oModel.bindList(oBinding.getPath(), null, null, aFilters);

                const iLength = oCountBinding.getLength();
                const aContexts = await oCountBinding.requestContexts(0, iLength);

                const aData = aContexts
                    .map(oContext => oContext?.getObject?.())
                    .filter(Boolean);

                const iAll = aData.length;
                const iCritical = aData.filter(o => o.overallSeverity === "CRITICAL").length;
                const iHigh = aData.filter(o => o.overallSeverity === "HIGH").length;
                const iMedium = aData.filter(o => o.overallSeverity === "MEDIUM").length;
                const iLow = aData.filter(o => o.overallSeverity === "LOW").length;
                const iHealthy = aData.filter(o => o.overallSeverity === "HEALTHY").length;

                this.byId("allTab")?.setCount(iAll);
                this.byId("criticalTab")?.setCount(iCritical);
                this.byId("highTab")?.setCount(iHigh);
                this.byId("mediumTab")?.setCount(iMedium);
                this.byId("lowTab")?.setCount(iLow);
                this.byId("healthyTab")?.setCount(iHealthy);

            } catch (e) {
                console.error("Count calculation failed", e);
            }
        },

        _filterDropdownBindings: function () {
            const aTenantFilters = this.getGlobalTenantFilter();

            const oIFlowBinding = this.byId("idIFlowFilter")?.getBinding("items");
            if (oIFlowBinding) {
                oIFlowBinding.filter(aTenantFilters);
            }

            const oPackageBinding = this.byId("idpackageFilter")?.getBinding("items");
            if (oPackageBinding) {
                oPackageBinding.filter(aTenantFilters);
            }
        },

        _updateRefreshTime: function () {
            const oModel = this.getOwnerComponent().getModel("globalModel");
            const sCurrentTime = new Date().toLocaleTimeString();
            oModel.setProperty("/lastRefreshTime", sCurrentTime);
        },

        onExit: function () {
            if (this._refreshInterval) {
                clearInterval(this._refreshInterval);
                this._refreshInterval = null;
            }
        },

        onAipress: function () {
            this.showBusy();
            this.navTo("RouteAIAssistant");
            this.hideBusy();
        },

        onRowPress: async function (oEvent) {
            this.showBusy();

            const oItem = oEvent.getParameter("listItem");
            const oContext = oItem.getBindingContext();

            if (!oContext) {
                this.hideBusy();
                return;
            }

            try {
                // requestProperty ensures the data is there before navigating
                const sID = await oContext.requestProperty("ID");

                if (sID) {
                    const oGlobalModel = this.getOwnerComponent().getModel("globalModel");
                    oGlobalModel.setProperty("/iflowId", sID);

                    this.getOwnerComponent().getRouter().navTo("RouteIC", {
                        ID: sID
                    });
                } else {
                    console.error("ID is missing from the backend response.");
                }
            } catch (oError) {
                console.error("Failed to fetch ID from OData cache:", oError);
            } finally {
                this.hideBusy();
            }
        },

        onFilterChange: function () {
            this.showBusy();

            const oIconTabHeader = this.byId("idIFLowSeverityTabBar");
            if (oIconTabHeader) {
                oIconTabHeader.setSelectedKey("ALL");
            }

            this.onFilteriFlow();
            this._updateSeverityCounts();

            this.hideBusy();
        },

        onSeverityTabSelect: function (oEvent) {
            const sKey = oEvent.getParameter("key");
            const oTable = this.byId("idMonitoredArtifacts");
            if (!oTable) {
                return;
            }

            const oBinding = oTable.getBinding("items");
            if (!oBinding) {
                return;
            }

            let aFilters = this._getDropdownAndDateFilters();
            aFilters = aFilters.concat(this.getGlobalTenantFilter());

            if (sKey !== "ALL") {
                aFilters.push(new Filter("overallSeverity", FilterOperator.EQ, sKey));
            }

            oBinding.filter(aFilters);
        },

        onFilteriFlow: function () {
            let aFilters = this._getDropdownAndDateFilters();
            aFilters = aFilters.concat(this.getGlobalTenantFilter());

            const oTable = this.byId("idMonitoredArtifacts");
            if (oTable) {
                const oBinding = oTable.getBinding("items");
                if (oBinding) {
                    oBinding.filter(aFilters);
                }
            }
        },

        _getDropdownAndDateFilters: function () {
            const aFilters = [];

            // 1. IFlow Filter
            const oMultiiFlowCombo = this.byId("idIFlowFilter");
            if (oMultiiFlowCombo) {
                const aSelectedKeys = oMultiiFlowCombo.getSelectedKeys();
                if (aSelectedKeys && aSelectedKeys.length > 0) {
                    const aComboFilters = aSelectedKeys.map(function (sKey) {
                        return new Filter({ path: "iFlowName", operator: FilterOperator.EQ, value1: sKey });
                    });
                    aFilters.push(new Filter({ filters: aComboFilters, and: false }));
                }
            }

            // 2. Tenant Filter
            const oMultiTenantCombo = this.byId("idTenantFilter");
            if (oMultiTenantCombo) {
                const aSelectedKeys = oMultiTenantCombo.getSelectedKeys();
                if (aSelectedKeys && aSelectedKeys.length > 0) {
                    const aComboFilters = aSelectedKeys.map(function (sKey) {
                        return new Filter({ path: "tenant_ID", operator: FilterOperator.EQ, value1: sKey });
                    });
                    aFilters.push(new Filter({ filters: aComboFilters, and: false }));
                }
            }

            // 3. Package Filter
            const oPackageMultiCombo = this.byId("idpackageFilter");
            if (oPackageMultiCombo) {
                const aSelectedKeys = oPackageMultiCombo.getSelectedKeys();
                if (aSelectedKeys && aSelectedKeys.length > 0) {
                    const aComboFilters = aSelectedKeys.map(function (sKey) {
                        return new Filter({ path: "PackageName", operator: FilterOperator.EQ, value1: sKey });
                    });
                    aFilters.push(new Filter({ filters: aComboFilters, and: false }));
                }
            }

            // 4. Date Range Filter
            const oDateRange = this.byId("idDateRangeFilter");
            if (oDateRange) {
                const oFromDate = oDateRange.getDateValue();
                const oSecondDate = oDateRange.getSecondDateValue();
                if (oFromDate && oSecondDate) {
                    const oToDate = new Date(oSecondDate.getTime());
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

        onClearFilters: function () {
            // Clear all combo boxes
            ["idIFlowFilter", "idpackageFilter", "idTenantFilter"].forEach(sId => {
                const oCombo = this.byId(sId);
                if (oCombo) {
                    oCombo.removeAllSelectedItems();
                }
            });

            // Clear date range
            const oDateRange = this.byId("idDateRangeFilter");
            if (oDateRange) {
                oDateRange.setDateValue(null);
                oDateRange.setSecondDateValue(null);
                oDateRange.setValue("");
            }

            // Snap active selection back to ALL tab
            const oIconTabHeader = this.byId("idIFLowSeverityTabBar");
            if (oIconTabHeader) {
                oIconTabHeader.setSelectedKey("ALL");
            }

            this.onFilteriFlow();
            this._updateSeverityCounts();  
        },

        onTableUpdateFinished: function (oEvent) {
            const iTotal = oEvent.getParameter("total");
            // TODO: wire iTotal to a table title (e.g. "Monitored Artifacts (N)") or remove this handler
            return iTotal;
        }
    });
});