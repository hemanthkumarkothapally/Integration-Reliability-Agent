sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator"
], function (Controller, MessageToast, BusyIndicator) {
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
        }

    });
});