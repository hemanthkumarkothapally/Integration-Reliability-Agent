sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/f/library",
    "../model/formatter"
], (Controller, JSONModel, Filter, FilterOperator, fioriLibrary, formatter) => {
    "use strict";
 
    return Controller.extend("com.cytechies.integration.reliability.incidentclustersui.controller.IC", {
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
        // _onObjectMatched: async function (oEvent) {
 
        //     const sID =
        //         oEvent.getParameter("arguments").ID;
 
        //     const oModel =
        //         this.getView().getModel();
 
 
 
        //     const oHeaderBinding =
        //         oModel.bindList(
        //             "/IncidentClusters",
        //             undefined,
        //             undefined,
        //             [
        //                 new Filter(
        //                     "ID",
        //                     FilterOperator.EQ,
        //                     sID
        //                 )
        //             ]
        //         );
 
        //     const aHeaderContexts =
        //         await oHeaderBinding.requestContexts();
 
        //     if (aHeaderContexts.length > 0) {
 
        //         const oHeaderData =
        //             aHeaderContexts[0].getObject();
 
        //         console.log("Header Data:", oHeaderData);
 
        //         const oHeaderModel =
        //             new JSONModel(oHeaderData);
 
        //         this.getView().setModel(
        //             oHeaderModel,
        //             "headerDetails"
        //         );
 
        //     }
 
        //     // Details Model
        //     const oJSONModel =
        //         new JSONModel();
 
        //     this.getView().setModel(
        //         oJSONModel,
        //         "details"
        //     );
 
        //     // Read Recommendation Data
        //     const oBinding =
        //         oModel.bindList(
        //             "/Recommendations",
        //             undefined,
        //             undefined,
        //             [
        //                 new Filter(
        //                     "cluster_ID",
        //                     FilterOperator.EQ,
        //                     sID
        //                 )
        //             ]
        //         );
 
        //     const aContexts =
        //         await oBinding.requestContexts();
 
        //     if (aContexts.length > 0) {
 
        //         const oData =
        //             aContexts[0].getObject();
 
        //         console.log("Recommendation Data:", oData);
 
        //         // Set Main Details
        //         oJSONModel.setData(oData);
 
        //         // Prepare Timeline Steps
        //         const aStepsRaw =
        //             JSON.parse(oData.remediationSteps);
 
        //         const aSteps =
        //             aStepsRaw.map(function (sStep, iIndex) {
 
        //                 return {
 
        //                     title: "STEP " + (iIndex + 1),
        //                     text: sStep
 
        //                 };
 
        //             });
 
        //         // Timeline Model
        //         const oStepsModel =
        //             new JSONModel({
 
        //                 steps: aSteps
 
        //             });
 
        //         this.getView().setModel(
        //             oStepsModel,
        //             "remediationSteps"
        //         );
 
        //         console.log("Timeline Steps:", aSteps);
 
        //     }
 
        // }
 
        // _onObjectMatched: async function (oEvent) {
 
        //     const sID = oEvent.getParameter("arguments").ID;
        //     const oModel = this.getView().getModel();
 
        //     // ✅ Fetch cluster WITH incidents expanded
        //     const oContext = oModel.bindContext(
        //         "/IncidentClusters('" + sID + "')",
        //         undefined,
        //         { $expand: "incidents" }
        //     );
 
        //     const oClusterData = await oContext.requestObject();
        //     console.log("Cluster + Incidents:", oClusterData);
 
        //     // ✅ Header model (iFlowName, severity, status, etc.)
        //     const oHeaderModel = new JSONModel(oClusterData);
        //     this.getView().setModel(oHeaderModel, "headerDetails");
 
        //     // ✅ Incidents model → drives the list
        //     const oIncidentsModel = new JSONModel({
        //         incidents: oClusterData.incidents || []
        //     });
        //     this.getView().setModel(oIncidentsModel, "incidentsModel");
 
        //     // --- Recommendations / Details (keep your existing code below) ---
        //     const oJSONModel = new JSONModel();
        //     this.getView().setModel(oJSONModel, "details");
 
        //     const oBinding = oModel.bindList(
        //         "/Recommendations",
        //         undefined,
        //         undefined,
        //         [new Filter("cluster_ID", FilterOperator.EQ, sID)]
        //     );
 
        //     const aContexts = await oBinding.requestContexts();
 
        //     if (aContexts.length > 0) {
        //         const oData = aContexts[0].getObject();
        //         oJSONModel.setData(oData);
 
        //         const aStepsRaw = JSON.parse(oData.remediationSteps);
        //         const aSteps = aStepsRaw.map((sStep, iIndex) => ({
        //             title: "STEP " + (iIndex + 1),
        //             text: sStep
        //         }));
 
        //         this.getView().setModel(new JSONModel({ steps: aSteps }), "remediationSteps");
        //     }
        // }
 
 
 _onObjectMatched: async function (oEvent) {
     sap.ui.core.BusyIndicator.show(100);
            const sID = oEvent.getParameter("arguments").ID;
            const oModel = this.getView().getModel();
            this.getOwnerComponent().getModel("globalModel").setProperty("/cluster_id", sID);
            console.log("Cluster ID set in global model:", sID);
            try {
                // ✅ Fetch BOTH in parallel — cluster+incidents AND recommendation
                const [oClusterData, oRecommendationData] = await Promise.all([
 
                    // 1️⃣ Cluster with incidents expanded
                    oModel
                        .bindContext("/IncidentClusters('" + sID + "')", undefined, {
                            $expand: "incidents"
                        })
                        .requestObject(),
 
                    // 2️⃣ ClusterRecommendations filtered by cluster_ID
                    oModel
                        .bindList(
                            "/Recommendations",
                            undefined,
                            undefined,
                            [new Filter("cluster_ID", FilterOperator.EQ, sID)]
                        )
                        .requestContexts()
 
                ]);
 
                console.log("Cluster Data:", oClusterData);
 
                // ✅ 1. Header model — iFlowName, severity, status, counts, dates
                this.getView().setModel(
                    new JSONModel(oClusterData),
                    "headerDetails"
                );
 
                // ✅ 2. Incidents model — drives the error message list
                this.getView().setModel(
                    new JSONModel({ incidents: oClusterData.incidents || [] }),
                    "incidentsModel"
                );
 
                // ✅ 3. Recommendation / Details model
                const oDetailsModel = new JSONModel({
                    rootCause: "",
                    businessImpact: "",
                    confidenceScore: 0,
                    affectedAdapter: "",
                    generatedAt: ""
                });
                this.getView().setModel(oDetailsModel, "details");
 
                // ✅ 4. Remediation Steps timeline model (empty default)
                const oStepsModel = new JSONModel({ steps: [] });
                this.getView().setModel(oStepsModel, "remediationSteps");
 
                // Populate if recommendation exists
                if (oRecommendationData.length > 0) {
                    const oRec = oRecommendationData[0].getObject();
                    console.log("Recommendation Data:", oRec);
 
                    // Set rootCause, businessImpact, confidenceScore, etc.
                    oDetailsModel.setData({
                        rootCause       : oRec.rootCause        || "",
                        businessImpact  : oRec.businessImpact   || "",
                        confidenceScore : oRec.confidenceScore  || 0,
                        affectedAdapter : oRec.affectedAdapter  || "",
                        generatedAt     : oRec.generatedAt      || ""
                    });
 
                    // Parse remediationSteps — handle both JSON string and plain string
                    let aSteps = [];
                    try {
                        const aParsed = JSON.parse(oRec.remediationSteps);
                        aSteps = aParsed.map((sStep, iIndex) => ({
                            title: "STEP " + (iIndex + 1),
                            text : sStep
                        }));
                    } catch (e) {
                        // If it's a plain string, show as single step
                        aSteps = [{ title: "STEP 1", text: oRec.remediationSteps }];
                    }
 
                    oStepsModel.setData({ steps: aSteps });
                    console.log("Timeline Steps:", aSteps);
 
                } else {
                    console.warn("No recommendation found for cluster:", sID);
                }
 
            } catch (oError) {
                console.error("Failed to load incident details:", oError);
            }
            sap.ui.core.BusyIndicator.hide();
        }
 
 
    });
 
});
 