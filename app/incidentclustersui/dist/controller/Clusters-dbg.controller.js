sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "../model/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (BaseController, formatter, Filter, FilterOperator) => {
    "use strict";

    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Clusters", {
        formatter: formatter,
        onInit() {

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
            const sKey = oEvent.getParameter("key");
            const oTable = this.byId("idClusters");
            const oBinding = oTable.getBinding("items");

            let aFilters = [];

            // Read the master MultiCombo and Date values to maintain overall filters
            let aMasterFilters = this._getDropdownAndDateFilters();

            if (sKey !== "ALL") {
                aMasterFilters.push(
                    new Filter("severity", FilterOperator.EQ, sKey)
                );
            }

            if (oBinding) {
                oBinding.filter(aMasterFilters);
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
        _applyMasterFilters: function() {
            // 1. Reset the IconTabHeader selection back to "ALL"
            let oIconTabHeader = this.byId("idSeverityTabBar");
            if (oIconTabHeader) {
                oIconTabHeader.setSelectedKey("ALL");
            }

            // 2. Fetch all filters combined (Combo + Date)
            let aCombinedFilters = this._getDropdownAndDateFilters();

            // 3. Apply everything to the table
            let oTable = this.byId("idClusters");
            if (oTable) {
                let oBinding = oTable.getBinding("items");
                if (oBinding) {
                    oBinding.filter(aCombinedFilters);
                }
            }
        },
        _getDropdownAndDateFilters: function() {
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
        }

    });
});