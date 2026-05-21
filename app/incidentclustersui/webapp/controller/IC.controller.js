sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/f/library",
    "../model/formatter",
    "./BaseController"
], (Controller, JSONModel, Filter, FilterOperator, fioriLibrary, formatter, BaseController) => {
    "use strict";

    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.IC", {
        formatter: formatter,
        onInit() {
            const oRouter =
                this.getOwnerComponent().getRouter();

            oRouter.getRoute("RouteIC")
                .attachPatternMatched(
                    this._onObjectMatched,
                    this
                );
        },


        onAipress() {
            // Safely get the FCL directly by the ID you gave it in the XML view
            var oFCL = this.getView().byId("flexibleColumnLayout");

            if (!oFCL) {
                console.error("Could not find FlexibleColumnLayout. Check the ID in your XML view.");
                return;
            }

            var sCurrentLayout = oFCL.getLayout();

            // Check if the FCL is currently showing two columns
            if (sCurrentLayout === fioriLibrary.LayoutType.TwoColumnsMidExpanded ||
                sCurrentLayout === fioriLibrary.LayoutType.TwoColumnsBeginExpanded) {

                // 1. It is already open -> Close it
                // oFCL.setLayout(fioriLibrary.LayoutType.OneColumn);

                oFCL.setLayout(fioriLibrary.LayoutType.OneColumn);
                console.log("Closing chat");

            } else {

                // 2. It is closed -> Open it
                oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsBeginExpanded);
                console.log("Opening chat");
            }
        },


        _onObjectMatched: async function (oEvent) {
            this.resetDetailsPage(oEvent.getParameter("arguments").ID);
        },
       
    });

});
