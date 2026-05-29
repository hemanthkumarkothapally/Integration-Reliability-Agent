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
            let oFCL = this.getView().byId("flexibleColumnLayout");

            if (!oFCL) {
                console.error("Could not find FlexibleColumnLayout. Check the ID in your XML view.");
                return;
            }

            let sCurrentLayout = oFCL.getLayout();

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

        //     sap.ui.core.BusyIndicator.show(100);
        //     const sID = oEvent.getParameter("arguments").ID;
        //     const oModel = this.getView().getModel();
        //     this.getOwnerComponent().getModel("globalModel").setProperty("/cluster_id", sID);
        //     console.log("Cluster ID set in global model:", sID);
        //     try {
        //         const [oClusterData, oRecommendationData] = await Promise.all([

        //             // 1️⃣ Cluster with incidents expanded
        //             oModel
        //                 .bindContext("/MonitoredArtifacts('" + sID + "')", undefined, {
        //                     $expand: "clusters,playbook,monitoredArtifacts($expand=artifact)"
        //                 })
        //                 .requestObject(),

        //             // 2️⃣ ClusterRecommendations filtered by cluster_ID
        //             oModel
        //                 .bindList(
        //                     "/Recommendations",
        //                     undefined,
        //                     undefined,
        //                     [new Filter("cluster_ID", FilterOperator.EQ, sID)]
        //                 )
        //                 .requestContexts()

        //         ]);

        //         console.log("Cluster Data:", oClusterData);

        //         // ✅ 1. Header model — iFlowName, severity, status, counts, dates
        //         this.getView().setModel(
        //             new JSONModel(oClusterData),
        //             "headerDetails"
        //         );

        //         // ✅ 2. Incidents model — drives the error message list
        //         this.getView().setModel(
        //             new JSONModel({ incidents: oClusterData.incidents || [] }),
        //             "incidentsModel"
        //         );

        //         // ✅ 3. Recommendation / Details model
        //         const oDetailsModel = new JSONModel({
        //             rootCause: "",
        //             businessImpact: "",
        //             confidenceScore: 0,
        //             affectedAdapter: "",
        //             generatedAt: ""
        //         });
        //         this.getView().setModel(oDetailsModel, "details");

        //         // ✅ 4. Remediation Steps timeline model (empty default)
        //         const oStepsModel = new JSONModel({ steps: [] });
        //         this.getView().setModel(oStepsModel, "remediationSteps");
        //         const oPlaybookStepsModel = new JSONModel({ steps: [] });
        //         this.getView().setModel(oPlaybookStepsModel, "playbookSteps");
        //         if (oRecommendationData.length > 0) {
        //             const oRec = oRecommendationData[0].getObject();
        //             console.log("Recommendation Data:", oRec);

        //             // Set rootCause, businessImpact, confidenceScore, etc.
        //             oDetailsModel.setData({
        //                 rootCause: oRec.rootCause || "",
        //                 businessImpact: oRec.businessImpact || "",
        //                 confidenceScore: oRec.confidenceScore || 0,
        //                 affectedAdapter: oRec.affectedAdapter || "",
        //                 generatedAt: oRec.generatedAt || ""
        //             });

        //             // Parse remediationSteps — handle both JSON string and plain string
        //             let aSteps = [];
        //             try {
        //                 console.log("remediation Steps:", oRec.remediationSteps);
        //                 console.log("Playbook Data:", oClusterData.playbook.steps);
        //                 const aParsed = JSON.parse(oRec.remediationSteps);
        //                 aSteps = aParsed.map((sStep, iIndex) => ({
        //                     title: "STEP " + (iIndex + 1),
        //                     text: sStep
        //                 }));

        //             } catch (e) {
        //                 // If it's a plain string, show as single step
        //                 aSteps = [{ title: "STEP 1", text: oRec.remediationSteps }];
        //             }
        //             let pSteps = [];

        //             try {
        //                 const pParsed = JSON.parse(oClusterData.playbook.steps);
        //                 pSteps = pParsed.map((sStep, iIndex) => ({
        //                     title: "STEP " + (iIndex + 1),
        //                     text: sStep
        //                 }));
        //             } catch (e) {
        //                 pSteps = [{ title: "STEP 1", text: oClusterData.playbook.steps }];
        //             }

        //             oStepsModel.setData({ steps: aSteps });
        //             console.log("Timeline Steps:", aSteps);
        //             oPlaybookStepsModel.setData({ steps: pSteps });
        //             console.log("Timeline Steps from playbook:", oPlaybookStepsModel.getData());
        //         } else {
        //             console.warn("No recommendation found for cluster:", sID);
        //         }




        //     } catch (oError) {
        //         console.error("Failed to load incident details:", oError);
        //     }
        //     sap.ui.core.BusyIndicator.hide();

        // },

        // _onObjectMatched: async function (oEvent) {
        //     let sID = oEvent.getParameter("arguments").ID;

        //     // Target the child view inside the beginColumnPages layout area
        //     let oDetailsView = this.byId("beginView");

        //     if (oDetailsView) {
        //         // Apply the OData V4 direct element binding layout
        //         oDetailsView.bindElement({
        //             path: "/MonitoredArtifacts('" + sID + "')",
        //             parameters: {
        //                 // In OData V4, pass query options directly at the root level
        //                 $expand: "clusters"
        //             },
        //             events: {
        //                 change: function () { /* Handle empty results safely if needed */ },
        //                 dataRequested: function () { oDetailsView.setBusy(true); },
        //                 dataReceived: function () { oDetailsView.setBusy(false); }
        //             }

        //         });
        //     }
        // }
          _onObjectMatched: async function (oEvent) {
    let sID = oEvent.getParameter("arguments").ID;
    let oDetailsView = this.byId("beginView");

    if (!oDetailsView) {
        return;
    }

    oDetailsView.bindElement({
        path: "/MonitoredArtifacts('" + sID + "')",
        parameters: {
            $expand: "clusters($expand=cluster($expand=recommendations,monitoredArtifacts($expand=artifact)))"
        },
        events: {
            dataRequested: function () {
                oDetailsView.setBusy(true);
            },

            dataReceived: async function () {
                oDetailsView.setBusy(false);

                let oContext = oDetailsView.getBindingContext();
                if (!oContext) {
                    return;
                }

                try {
                    let oData = await oContext.requestObject();
                    console.log("Full data via requestObject:", oData);

                    let oViewData = JSON.parse(JSON.stringify(oData));
                    let oModel = oDetailsView.getModel();

                    // Fetch recommendations and parse remediation steps
                    let aPromises = (oViewData.clusters || []).map(async function (oClusterArtifact) {

                        let oCluster = oClusterArtifact.cluster;

                        if (!oCluster || !oCluster.recommendations) {
                            return;
                        }

                        let sRecId = oCluster.recommendations.ID;

                        let oRecBinding = oModel.bindContext(
                            "/Recommendations('" + sRecId + "')"
                        );

                        let oRecContext = oRecBinding.getBoundContext();
                        let oFullRec = await oRecContext.requestObject();

                        oCluster.recommendations = oFullRec;

                        let sStepsJson = oFullRec.remediationSteps;
                        let aSteps = [];

                        if (sStepsJson) {
                            try {
                                let aRaw = JSON.parse(sStepsJson);

                                aSteps = aRaw.map(function (sStep, iIndex) {
                                    return {
                                        title: "STEP " + (iIndex + 1),
                                        text: sStep
                                    };
                                });

                            } catch (e) {
                                console.error("Failed to parse remediationSteps", e);
                            }
                        }

                        oCluster.recommendations.parsedSteps = aSteps;
                    });

                    await Promise.all(aPromises);

                    // ==========================================
                    // Summary Calculations
                    // ==========================================

                    let aClusters = oViewData.clusters || [];

                    let iOpenClusters = aClusters.filter(function (oItem) {
                        return oItem.cluster &&
                            oItem.cluster.status === "OPEN";
                    }).length;

                    let iResolvedClusters = aClusters.filter(function (oItem) {
                        return oItem.cluster &&
                            oItem.cluster.status === "RESOLVED";
                    }).length;

                    let iTotalIncidents = aClusters.reduce(function (iTotal, oItem) {
                        return iTotal + (oItem.cluster?.incidentCount || 0);
                    }, 0);

                    let iCriticalClusters = aClusters.filter(function (oItem) {
                        return oItem.cluster &&
                            oItem.cluster.severity === "CRITICAL";
                    }).length;

                    oViewData.summary = {
                        openClusters: iOpenClusters,
                        resolvedClusters: iResolvedClusters,
                        totalIncidents: iTotalIncidents,
                        criticalClusters: iCriticalClusters
                    };

                    // ==========================================
                    // Create View Model
                    // ==========================================

                    let oViewModel = new sap.ui.model.json.JSONModel(oViewData);

                    oDetailsView.setModel(oViewModel, "view");

                    console.log("Summary:", oViewData.summary);
                    console.log("Final view model:", oViewData);

                } catch (err) {
                    console.error("Error:", err);
                }
            }
        }
    });
}
      







    });

});
