sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/f/library",
    "../model/formatter"
], function (Controller, MessageToast, BusyIndicator, JSONModel, Filter, FilterOperator, fioriLibrary, formatter) {
    "use strict";

    return Controller.extend("com.cytechies.integration.reliability.incidentclustersui.controller.BaseController", {

        getRouter: function () {
            return this.getOwnerComponent().getRouter();
        },

        getModel: function (sName) {
            return this.getOwnerComponent().getModel(sName);
        },

        setModel: function (oModel, sName) {
            return this.getView().setModel(oModel, sName);
        },

        navTo: function (sRoute, oParameters) {
            this.getRouter().navTo(
                sRoute,
                oParameters
            );
        },

        showBusy: function (iDelay = 0) {
            BusyIndicator.show(iDelay);
        },

        showBusyTime: function (iDelay) {
            BusyIndicator.show(iDelay);
        },

        hideBusy: function () {
            BusyIndicator.hide();
        },

        showToast: function (sMessage) {
            MessageToast.show(sMessage);
        },



        onListSearch: function (oEvent) {
            var oSource = oEvent.getSource();
            var sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";

            // Read configuration from custom data on the SearchField
            var sListId = oSource.data("listId");
            var sFields = oSource.data("searchFields");

            if (!sListId || !sFields) {
                console.warn("onListSearch: missing listId or searchFields custom data");
                return;
            }

            var aFields = sFields.split(",").map(function (s) { return s.trim(); });
            this.applyListSearch(sListId, sQuery, aFields);
        },


        applyCentralBindingFilter: function (sControlId, sAggregation, aFilters) {
            sAggregation = sAggregation || "items";
            var oControl = this.byId(sControlId);

            if (!oControl) {
                console.warn("BaseController: Control target element not found: " + sControlId);
                return;
            }

            var oBinding = oControl.getBinding(sAggregation);
            if (!oBinding) {
                console.warn("BaseController: No binding found on aggregation context: " + sAggregation);
                return;
            }

            // Executes the filter updates on your OData V4 Model
            oBinding.filter(aFilters);
        },


        applyListSearch: function (sListId, sQuery, aFields, sAggregation) {
            sAggregation = sAggregation || "items";

            var oControl = this.byId(sListId);
            if (!oControl) {
                console.warn("applyListSearch: control not found - " + sListId);
                return;
            }

            var oBinding = oControl.getBinding(sAggregation);
            if (!oBinding) {
                console.warn("applyListSearch: no binding on aggregation " + sAggregation);
                return;
            }

            if (sQuery) {
                var aFilters = aFields.map(function (sField) {
                    return new Filter({
                        path: sField,
                        operator: FilterOperator.Contains,
                        value1: sQuery,
                        caseSensitive: false   // ← case-insensitive
                    });
                });

                var oCombinedFilter = new Filter({
                    filters: aFilters,
                    and: false
                });

                oBinding.filter([oCombinedFilter]);
            } else {
                oBinding.filter([]);
            }
        },


        applyFilterBarSearch: function (sTargetControlId, sAggregationName, aFilterConfigs) {
            var oTargetControl = this.byId(sTargetControlId);
            if (!oTargetControl) { return; }

            var oBinding = oTargetControl.getBinding(sAggregationName);
            if (!oBinding) { return; }

            var aRootFilters = [];

            aFilterConfigs.forEach(function (oConfig) {
                var oMultiCombo = this.byId(oConfig.controlId);
                if (oMultiCombo) {
                    var aSelectedKeys = oMultiCombo.getSelectedKeys();
                    if (aSelectedKeys && aSelectedKeys.length > 0) {
                        var aSubFilters = aSelectedKeys.map(function (sKey) {
                            return new Filter(oConfig.bindingPath, FilterOperator.EQ, sKey);
                        });
                        // Items within the same multi-combobox get grouped with OR
                        aRootFilters.push(new Filter({ filters: aSubFilters, and: false }));
                    }
                }
            }.bind(this));

            // All separate filters together get grouped with AND
            if (aRootFilters.length > 0) {
                oBinding.filter(new Filter({ filters: aRootFilters, and: true }));
            } else {
                oBinding.filter([]); // Clear all filters if nothing is selected
            }
        }

    });
});