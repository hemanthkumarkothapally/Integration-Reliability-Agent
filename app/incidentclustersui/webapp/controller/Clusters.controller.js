sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (BaseController, formatter, Filter, FilterOperator) => {
    "use strict";

    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Clusters", {
        formatter: formatter,
        onInit() {
            this.getOwnerComponent().getModel("globalModel").setProperty("/selectedKey", "clusters");
            const oRouter =
                this.getOwnerComponent().getRouter();

            oRouter.getRoute("RouteClusters")
                .attachPatternMatched(
                    this._onRouteMatched,
                    this
                );
        },
        _onRouteMatched: async function () {
            this.getOwnerComponent().getModel("globalModel").setProperty("/selectedKey", "clusters");

            try {

                this.getView().setBusy(true);
                this.byId("idSeverityTabBar").setSelectedKey('ALL');

                const oTable =
                    this.byId("idClusters");

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

                aFilters =
                    aFilters.concat(
                        this.getGlobalTenantFilter()
                    );
                this.getView().setBusy(true);

                await new Promise((resolve) => {

                    oBinding.attachEventOnce(
                        "dataReceived",
                        resolve
                    );

                    oBinding.filter(aFilters);

                    setTimeout(resolve, 3000);
                });

                await this._filterDropdownBindings();
                await this._updateSeverityCounts();
                this.getView().setBusy(false);

            } catch (oError) {

                console.error(
                    "Route Match Error",
                    oError
                );

            } finally {

                this.getView().setBusy(false);
            }
            this.getView().setBusy(false);

        },
        getGlobalTenantFilter: function () {

            const sTenantId = this.getSelectedTenantId();

            if (!sTenantId || sTenantId === "ALL") {
                return [];
            }

            return [
                new Filter(
                    "tenant_ID",
                    FilterOperator.EQ,
                    sTenantId
                )
            ];
        },
        // onSeverityTabSelect: function (oEvent) {
        //     const sKey = oEvent.getParameter("key");
        //     const oTable = this.byId("idClusters");
        //     const oBinding = oTable.getBinding("items");

        //     let aFilters = [];


        //     if (sKey !== "ALL") {
        //         aFilters.push(
        //             new sap.ui.model.Filter(
        //                 "severity",
        //                 sap.ui.model.FilterOperator.EQ,
        //                 sKey
        //             )
        //         );
        //     }

        //     oBinding.filter(aFilters);
        // },

        onSeverityTabSelect: function (oEvent) {

            const sKey =
                oEvent.getParameter("key");

            const oTable =
                this.byId("idClusters");

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
        _filterDropdownBindings: function () {

            const aTenantFilters =
                this.getGlobalTenantFilter();

            const oClusterBinding =
                this.byId("idClustersCombo")
                    ?.getBinding("items");

            if (oClusterBinding) {
                oClusterBinding.filter(aTenantFilters);
            }
        },
        onRefreshPress: function () {
            var oTable = this.byId("idClusters");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").refresh();
            }
        },

        // onclusterFilterChange: function () {
        //     let aFilters = [];
        //     let oMultiCombo = this.byId("idClustersCombo");

        //     if (oMultiCombo) {
        //         let aSelectedKeys = oMultiCombo.getSelectedKeys();
        //         console.log("Selected Keys: ", aSelectedKeys);

        //         if (aSelectedKeys && aSelectedKeys.length > 0) {
        //             let aComboFilters = aSelectedKeys.map(function (sKey) {
        //                 return new Filter({
        //                     path: "errorType",
        //                     operator: FilterOperator.EQ,
        //                     value1: sKey
        //                 });
        //             });

        //             // Combine selected items with an "OR" condition (and: false)
        //             aFilters.push(new Filter({
        //                 filters: aComboFilters,
        //                 and: false
        //             }));
        //         }
        //     }

        //     // 1. Get reference to your table control
        //     let oTable = this.byId("idClusters");
        //     if (oTable) {
        //         // 2. Access the aggregation list binding for "items"
        //         let oBinding = oTable.getBinding("items");
        //         if (oBinding) {
        //             // 3. Apply the filters. If the array is empty, it naturally clears the filters.
        //             oBinding.filter(aFilters);
        //         }
        //     }
        // },

        // onClusterDateChange: function () {
        //     let aFilters = [];

        //     let oDateRange = this.byId("idDateRangeFilterC");
        //     if (oDateRange) {
        //         let oFromDate = oDateRange.getDateValue();
        //         let oSecondDate = oDateRange.getSecondDateValue();

        //         if (oFromDate && oSecondDate) {
        //             // 1. Establish precise start of day (00:00:00.000) in local/selected time
        //             let oFromDateTime = new Date(oFromDate.getTime());
        //             oFromDateTime.setHours(0, 0, 0, 0);

        //             // 2. Establish precise end of day (23:59:59.999)
        //             let oToDateTime = new Date(oSecondDate.getTime());
        //             oToDateTime.setHours(23, 59, 59, 999);

        //             // 3. Convert both safely to clean ISO strings for the OData engine
        //             let sFromISO = oFromDateTime.toISOString();
        //             let sToISO = oToDateTime.toISOString();

        //             // 4. Create the filter using the explicit string formats
        //             aFilters.push(new Filter({
        //                 path: "lastSeen",
        //                 operator: FilterOperator.BT,
        //                 value1: sFromISO,
        //                 value2: sToISO
        //             }));
        //         }
        //     }

        //     // Apply the filter array to the table binding
        //     let oTable = this.byId("idClusters");
        //     if (oTable) {
        //         let oBinding = oTable.getBinding("items");
        //         if (oBinding) {
        //             oBinding.filter(aFilters);
        //         }
        //     }
        // },
        onclusterFilterChange: function () {
            this._applyMasterFilters();
        },
        onClusterDateChange: function () {
            this._applyMasterFilters();
        },
        _applyMasterFilters: function () {

            let oIconTabHeader =
                this.byId("idSeverityTabBar");

            if (oIconTabHeader) {
                oIconTabHeader.setSelectedKey("ALL");
            }

            let aCombinedFilters =
                this._getDropdownAndDateFilters();

            aCombinedFilters =
                aCombinedFilters.concat(
                    this.getGlobalTenantFilter()
                );

            let oTable =
                this.byId("idClusters");

            if (oTable) {

                let oBinding =
                    oTable.getBinding("items");

                if (oBinding) {

                    oBinding.filter(
                        aCombinedFilters
                    );
                }
            }

            this._updateSeverityCounts();
        },
        _updateSeverityCounts: async function () {

            const oTable =
                this.byId("idClusters");

            if (!oTable) {
                return;
            }

            const oBinding =
                oTable.getBinding("items");

            if (!oBinding) {
                return;
            }

            try {

                let aFilters =
                    this._getDropdownAndDateFilters();

                aFilters =
                    aFilters.concat(
                        this.getGlobalTenantFilter()
                    );

                const oModel =
                    oBinding.getModel();

                const oCountBinding =
                    oModel.bindList(
                        oBinding.getPath(),
                        null,
                        null,
                        aFilters
                    );

                const iLength =
                    oCountBinding.getLength();

                const aContexts =
                    await oCountBinding.requestContexts(
                        0,
                        iLength
                    );

                const aData =
                    aContexts
                        .map(
                            oContext =>
                                oContext?.getObject?.()
                        )
                        .filter(Boolean);

                const iAll =
                    aData.length;

                const iCritical =
                    aData.filter(
                        o =>
                            o.severity ===
                            "CRITICAL"
                    ).length;

                const iHigh =
                    aData.filter(
                        o =>
                            o.severity ===
                            "HIGH"
                    ).length;

                const iMedium =
                    aData.filter(
                        o =>
                            o.severity ===
                            "MEDIUM"
                    ).length;

                const iLow =
                    aData.filter(
                        o =>
                            o.severity ===
                            "LOW"
                    ).length;

                this.byId("idSeverityTabBar")
                    .getItems()[0]
                    .setCount(iAll);

                this.byId("idSeverityTabBar")
                    .getItems()[1]
                    .setCount(iCritical);

                this.byId("idSeverityTabBar")
                    .getItems()[2]
                    .setCount(iHigh);

                this.byId("idSeverityTabBar")
                    .getItems()[3]
                    .setCount(iMedium);

                this.byId("idSeverityTabBar")
                    .getItems()[4]
                    .setCount(iLow);

            } catch (oError) {

                console.error(
                    "Severity Count Error",
                    oError
                );
            }
        },
        onTableUpdateFinished: function (oEvent) {

            const iTotal =
                oEvent.getParameter("total");

            console.log(
                "Cluster records:",
                iTotal
            );
        },
        _getDropdownAndDateFilters: function () {
            let aFilters = [];

            // A. Handle MultiComboBox Errors Filter
            let oMultiCombo = this.byId("idClustersCombo");
            if (oMultiCombo) {
                let aSelectedKeys = oMultiCombo.getSelectedKeys();
                if (aSelectedKeys && aSelectedKeys.length > 0) {
                    let aComboFilters = aSelectedKeys.map(function (sKey) {
                        return new Filter({
                            path: "errorType",
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

            // B. Handle Date Range Filter
            let oDateRange = this.byId("idDateRangeFilterC");
            if (oDateRange) {
                let oFromDate = oDateRange.getDateValue();
                let oSecondDate = oDateRange.getSecondDateValue();

                if (oFromDate && oSecondDate) {
                    let oFromDateTime = new Date(oFromDate.getTime());
                    oFromDateTime.setHours(0, 0, 0, 0);

                    let oToDateTime = new Date(oSecondDate.getTime());
                    oToDateTime.setHours(23, 59, 59, 999);

                    aFilters.push(new Filter({
                        path: "lastSeen",
                        operator: FilterOperator.BT,
                        value1: oFromDateTime.toISOString(),
                        value2: oToDateTime.toISOString()
                    }));
                }
            }
            const aTenantFilters = this.getGlobalTenantFilter();

            if (aTenantFilters.length > 0) {
                aFilters = aFilters.concat(aTenantFilters);
            }
            return aFilters;
        },
        onClearClusterFilters: function () {
            // Clear iFlow filter
            let oIFlowFilter = this.byId("idClustersCombo");
            if (oIFlowFilter) {
                oIFlowFilter.removeAllSelectedItems();
            }



            // let oTenantFilter = this.byId("idTenantFilter");
            // if (oTenantFilter) {
            //     oTenantFilter.removeAllSelectedItems();
            // }

            // Clear date range
            let oDateRange = this.byId("idDateRangeFilterC");
            if (oDateRange) {
                oDateRange.setDateValue(null);
                oDateRange.setSecondDateValue(null);
                oDateRange.setValue("");
            }
            this._applyMasterFilters(); // This will apply the cleared date filter and refresh the table
        },
        onArtifactsPress: async function (oEvent) {
            const oSource = oEvent.getSource();

            if (!this._oArtifactPopover) {
                this._oArtifactPopover = await sap.ui.core.Fragment.load({
                    name: "com.cytechies.integration.reliability.incidentclustersui.fragments.ArtifactsPopover",
                    controller: this
                });

                this.getView().addDependent(this._oArtifactPopover);
            }

            // Bind popover to selected cluster
            this._oArtifactPopover.setBindingContext(
                oSource.getBindingContext()
            );
            this._oArtifactPopover.openBy(oSource);
        },
        onArtifactNav: function (oEvent) {
            this.getView().setBusy(true);
            const sID = oEvent.getSource()
                .getBindingContext()
                .getProperty("artifact_ID");
            this._oArtifactPopover.close();
            this.getOwnerComponent().getRouter().navTo("RouteIC", {
                ID: sID
            });
            this.getView().setBusy(false);
        },
        onIncidentsPress: async function (oEvent) {

            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext();
            const sClusterId = oContext.getProperty("ID");
            const oModel = this.getView().getModel();
            const aContexts = await oModel.bindList(
                `/IncidentClusters(${sClusterId})/incidents`,
                undefined,
                [
                    new sap.ui.model.Sorter("logEnd", true)
                ]
            ).requestContexts(0, 5);
            const aIncidents = aContexts.map(oCtx => oCtx.getObject());
            if (!this._oIncidentPopover) {
                this._oIncidentPopover = await sap.ui.core.Fragment.load({
                    name: "com.cytechies.integration.reliability.incidentclustersui.fragments.IncidentPopover",
                    controller: this
                });

                this.getView().addDependent(this._oIncidentPopover);
            }
            this._oIncidentPopover.setModel(
                new sap.ui.model.json.JSONModel(aIncidents),
                "incidents"
            );
            this._oIncidentPopover.openBy(oSource);
        }

    });
});