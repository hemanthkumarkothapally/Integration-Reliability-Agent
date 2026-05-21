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

        resetDetailsPage: async function (clusterID) {
            sap.ui.core.BusyIndicator.show(100);
            const sID = clusterID;
            const oModel = this.getView().getModel();
            this.getOwnerComponent().getModel("globalModel").setProperty("/cluster_id", sID);
            console.log("Cluster ID set in global model:", sID);
            try {
                const [oClusterData, oRecommendationData] = await Promise.all([

                    // 1️⃣ Cluster with incidents expanded
                    oModel
                        .bindContext("/IncidentClusters('" + sID + "')", undefined, {
                            $expand: "incidents,playbook,monitoredArtifacts($expand=artifact)"
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
                const oPlaybookStepsModel = new JSONModel({ steps: [] });
                this.getView().setModel(oPlaybookStepsModel, "playbookSteps");
                if (oRecommendationData.length > 0) {
                    const oRec = oRecommendationData[0].getObject();
                    console.log("Recommendation Data:", oRec);

                    // Set rootCause, businessImpact, confidenceScore, etc.
                    oDetailsModel.setData({
                        rootCause: oRec.rootCause || "",
                        businessImpact: oRec.businessImpact || "",
                        confidenceScore: oRec.confidenceScore || 0,
                        affectedAdapter: oRec.affectedAdapter || "",
                        generatedAt: oRec.generatedAt || ""
                    });

                    // Parse remediationSteps — handle both JSON string and plain string
                    let aSteps = [];
                    try {
                        console.log("remediation Steps:", oRec.remediationSteps);
                        console.log("Playbook Data:", oClusterData.playbook.steps);
                        const aParsed = JSON.parse(oRec.remediationSteps);
                        aSteps = aParsed.map((sStep, iIndex) => ({
                            title: "STEP " + (iIndex + 1),
                            text: sStep
                        }));

                    } catch (e) {
                        // If it's a plain string, show as single step
                        aSteps = [{ title: "STEP 1", text: oRec.remediationSteps }];
                    }
                    let pSteps = [];

                    try {
                        const pParsed = JSON.parse(oClusterData.playbook.steps);
                        pSteps = pParsed.map((sStep, iIndex) => ({
                            title: "STEP " + (iIndex + 1),
                            text: sStep
                        }));
                    } catch (e) {
                        pSteps = [{ title: "STEP 1", text: oClusterData.playbook.steps }];
                    }

                    oStepsModel.setData({ steps: aSteps });
                    console.log("Timeline Steps:", aSteps);
                    oPlaybookStepsModel.setData({ steps: pSteps });
                    console.log("Timeline Steps from playbook:", oPlaybookStepsModel.getData());
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