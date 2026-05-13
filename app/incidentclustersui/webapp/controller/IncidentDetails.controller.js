sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/f/library"
], (Controller, JSONModel, Filter, FilterOperator, fioriLibrary) => {
    "use strict";


    return Controller.extend("com.cytechies.integration.reliability.incidentclustersui.controller.IncidentDetails", {
        onInit() {

        },
        onAipress: function () {
            // Navigate up to the FlexibleColumnLayout instance
            var oFCL = this.oView.getParent().getParent();

            // Ensure sap.f.LayoutType is available in your controller scope
            // (Usually imported as fioriLibrary or sap.f.LayoutType)
            var sCurrentLayout = oFCL.getLayout();

            if (sCurrentLayout === sap.f.LayoutType.OneColumn) {
                // If it is closed, expand to two columns
                oFCL.setLayout(sap.f.LayoutType.TwoColumnsBeginExpanded);
                console.log("Opening chat side panel");
            } else {
                // If it is already open, collapse it back to one column
                oFCL.setLayout(sap.f.LayoutType.OneColumn);
                console.log("Closing chat side panel");
            }
        },

        // onAipress() {
        //     // Safely get the FCL directly by the ID you gave it in the XML view
        //     var oFCL = this.getView().byId("flexibleColumnLayout");

        //     if (!oFCL) {
        //         console.error("Could not find FlexibleColumnLayout. Check the ID in your XML view.");
        //         return;
        //     }

        //     var sCurrentLayout = oFCL.getLayout();

        //     // Check if the FCL is currently showing two columns
        //     if (sCurrentLayout === fioriLibrary.LayoutType.TwoColumnsMidExpanded ||
        //         sCurrentLayout === fioriLibrary.LayoutType.TwoColumnsBeginExpanded) {

        //         // 1. It is already open -> Close it
        //         // oFCL.setLayout(fioriLibrary.LayoutType.OneColumn);

        //         oFCL.setLayout(fioriLibrary.LayoutType.OneColumn);
        //         console.log("Closing chat");

        //     } else {

        //         // 2. It is closed -> Open it
        //         oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsBeginExpanded);
        //         console.log("Opening chat");
        //     }
        // },



    });
});