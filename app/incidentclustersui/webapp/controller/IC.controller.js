sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/f/library"
], (Controller, JSONModel, Filter, FilterOperator, fioriLibrary) => {
    "use strict";

    return Controller.extend("com.cytechies.integration.reliability.incidentclustersui.controller.IC", {
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
 
            const sID =
                oEvent.getParameter("arguments").ID;
 
            const oModel =
                this.getView().getModel();
 
 
            const oHeaderBinding =
                oModel.bindList(
                    "/IncidentClusters",
                    undefined,
                    undefined,
                    [
                        new Filter(
                            "ID",
                            FilterOperator.EQ,
                            sID
                        )
                    ]
                );
 
            const aHeaderContexts =
                await oHeaderBinding.requestContexts();
 
            if (aHeaderContexts.length > 0) {
 
                const oHeaderData =
                    aHeaderContexts[0].getObject();
 
                console.log("Header Data:", oHeaderData);
 
                const oHeaderModel =
                    new JSONModel(oHeaderData);
 
                this.getView().setModel(
                    oHeaderModel,
                    "headerDetails"
                );
 
            }
 
            // Details Model
            const oJSONModel =
                new JSONModel();
 
            this.getView().setModel(
                oJSONModel,
                "details"
            );
 
            // Read Recommendation Data
            const oBinding =
                oModel.bindList(
                    "/Recommendations",
                    undefined,
                    undefined,
                    [
                        new Filter(
                            "cluster_ID",
                            FilterOperator.EQ,
                            sID
                        )
                    ]
                );
 
            const aContexts =
                await oBinding.requestContexts();
 
            if (aContexts.length > 0) {
 
                const oData =
                    aContexts[0].getObject();
 
                console.log("Recommendation Data:", oData);
 
                // Set Main Details
                oJSONModel.setData(oData);
 
                // Prepare Timeline Steps
                const aStepsRaw =
                    JSON.parse(oData.remediationSteps);
 
                const aSteps =
                    aStepsRaw.map(function (sStep, iIndex) {
 
                        return {
 
                            title: "STEP " + (iIndex + 1),
                            text: sStep
 
                        };
 
                    });
 
                // Timeline Model
                const oStepsModel =
                    new JSONModel({
 
                        steps: aSteps
 
                    });
 
                this.getView().setModel(
                    oStepsModel,
                    "remediationSteps"
                );
 
                console.log("Timeline Steps:", aSteps);
 
            }
 
        }





    });

});