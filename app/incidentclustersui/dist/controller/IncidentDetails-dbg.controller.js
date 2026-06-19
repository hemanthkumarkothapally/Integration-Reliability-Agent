sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/f/library",
    "../model/formatter",
    "sap/m/MessageBox"
], (BaseController, JSONModel, Filter, FilterOperator, fioriLibrary, formatter, MessageBox) => {
    "use strict";

    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.IncidentDetails", {
        formatter: formatter,

        onInit() {
        },

        onNavBack: function () {
            this.showBusy();

            this.getOwnerComponent()
                .getRouter()
                .navTo("Routemonitored_iflows");
            this.getView().getModel("globalModel").setProperty("/iflowId", null);

            this.hideBusy();
        },

        onAipress: function () {
            // Navigate up to the FlexibleColumnLayout instance
            const oFCL = this.getView().getParent().getParent();

            if (!oFCL || !oFCL.getLayout) {
                console.error("Could not find FlexibleColumnLayout from IncidentDetails view.");
                return;
            }

            const sCurrentLayout = oFCL.getLayout();

            if (sCurrentLayout === sap.f.LayoutType.OneColumn) {
                // If it is closed, expand to two columns
                oFCL.setLayout(sap.f.LayoutType.TwoColumnsBeginExpanded);
            } else {
                // If it is already open, collapse it back to one column
                oFCL.setLayout(sap.f.LayoutType.OneColumn);
            }
        },

        onResolve: async function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("view");

            if (!oContext) {
                console.error("No binding context found");
                return;
            }

            const oData = oContext.getObject();

            this.showBusy();

            try {
                const oModel = this.getOwnerComponent().getModel();
                const oAction = oModel.bindContext("/resolveClusterForArtifact(...)");

                oAction.setParameter("clusterId", oData.cluster_ID);
                oAction.setParameter("artifactId", oData.artifact_ID);
                oAction.setParameter("note", "Resolved the cluster");

                await oAction.execute();

                MessageBox.success("Incident resolved successfully");

                oModel.refresh();

            } catch (error) {
                MessageBox.error("Failed to resolve incident");
            } finally {
                this.hideBusy();
            }
        },

        onExpandAll: function () {
            const oModel = this.getView().getModel("view");
            const aClusters = oModel.getProperty("/clusters") || [];

            aClusters.forEach(function (oCluster) {
                oCluster.expanded = true;
            });

            oModel.setProperty("/clusters", aClusters);
        },

        onCollapseAll: function () {
            const oModel = this.getView().getModel("view");
            const aClusters = oModel.getProperty("/clusters") || [];

            aClusters.forEach(function (oCluster) {
                oCluster.expanded = false;
            });

            oModel.setProperty("/clusters", aClusters);
        }

    });
});