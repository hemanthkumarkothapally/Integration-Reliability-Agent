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
        }
    });
});