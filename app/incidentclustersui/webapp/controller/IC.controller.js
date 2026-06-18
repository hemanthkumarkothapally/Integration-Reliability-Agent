sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/f/library",
    "../model/formatter",
    "./BaseController"
], (JSONModel, Filter, FilterOperator, fioriLibrary, formatter, BaseController) => {
    "use strict";

    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.IC", {
        formatter: formatter,

        onInit() {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteIC")
                .attachPatternMatched(this._onObjectMatched, this);
        },

        onAipress() {
            const oFCL = this.getView().byId("flexibleColumnLayout");

            if (!oFCL) {
                console.error("Could not find FlexibleColumnLayout. Check the ID in your XML view.");
                return;
            }

            const sCurrentLayout = oFCL.getLayout();

            // If the FCL is already showing two columns, collapse it; otherwise open it.
            if (sCurrentLayout === fioriLibrary.LayoutType.TwoColumnsMidExpanded ||
                sCurrentLayout === fioriLibrary.LayoutType.TwoColumnsBeginExpanded) {
                oFCL.setLayout(fioriLibrary.LayoutType.OneColumn);
            } else {
                oFCL.setLayout(fioriLibrary.LayoutType.TwoColumnsBeginExpanded);
            }
        },

        _onObjectMatched: async function (oEvent) {
            const sID = oEvent.getParameter("arguments").ID;
            const oDetailsView = this.byId("beginView");

            this.getView().getModel("globalModel").setProperty("/iflowId", sID);

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

                        const oContext = oDetailsView.getBindingContext();
                        if (!oContext) {
                            return;
                        }

                        try {
                            const oData = await oContext.requestObject();
                            const oViewData = JSON.parse(JSON.stringify(oData));
                            const oModel = oDetailsView.getModel();

                            // Fetch full recommendations and parse remediation steps
                            const aPromises = (oViewData.clusters || []).map(async function (oClusterArtifact) {
                                const oCluster = oClusterArtifact.cluster;

                                if (!oCluster || !oCluster.recommendations) {
                                    return;
                                }

                                const sRecId = oCluster.recommendations.ID;
                                const oRecBinding = oModel.bindContext("/Recommendations('" + sRecId + "')");
                                const oFullRec = await oRecBinding.getBoundContext().requestObject();

                                oCluster.recommendations = oFullRec;

                                const sStepsJson = oFullRec.remediationSteps;
                                let aSteps = [];

                                if (sStepsJson) {
                                    try {
                                        const aRaw = JSON.parse(sStepsJson);
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

                            // Summary calculations
                            const aClusters = oViewData.clusters || [];

                            const iOpenClusters = aClusters.filter(function (oItem) {
                                return oItem.cluster && oItem.cluster.status === "OPEN";
                            }).length;

                            const iResolvedClusters = aClusters.filter(function (oItem) {
                                return oItem.cluster && oItem.cluster.status === "RESOLVED";
                            }).length;

                            const iTotalIncidents = aClusters.reduce(function (iTotal, oItem) {
                                return iTotal + (oItem?.incidentCount || 0);
                            }, 0);

                            const iCriticalClusters = aClusters.filter(function (oItem) {
                                return oItem.cluster && oItem.cluster.severity === "CRITICAL";
                            }).length;

                            oViewData.summary = {
                                openClusters: iOpenClusters,
                                resolvedClusters: iResolvedClusters,
                                totalIncidents: iTotalIncidents,
                                criticalClusters: iCriticalClusters
                            };

                            // Create view model
                            const oViewModel = new JSONModel(oViewData);
                            oDetailsView.setModel(oViewModel, "view");

                        } catch (err) {
                            console.error("Error loading incident details:", err);
                        }
                    }
                }
            });
        }
    });
});