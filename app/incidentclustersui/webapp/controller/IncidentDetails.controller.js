sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/f/library",
    "../model/formatter",
    "sap/m/MessageBox",
], (BaseController, JSONModel, Filter, FilterOperator, fioriLibrary, formatter, MessageBox) => {
    "use strict";


    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.IncidentDetails", {
        formatter: formatter,
        onInit() {

            

        },
        onNavBack: function () {

            // // Clear headerDetails model
            // this.getView().getModel("headerDetails").setData({});

            // // Clear details model
            // this.getView().getModel("details").setData({});

            // // Clear remediation steps
            // this.getView().getModel("remediationSteps").setData({
            //     steps: []
            // });

            // // Clear playbook steps
            // this.getView().getModel("playbookSteps").setData({
            //     steps: []
            // });

            // // Clear incidents model
            // this.getView().getModel("incidentsModel").setData({
            //     incidents: []
            // });

            this.getOwnerComponent()
                .getRouter()
                .navTo("Routemonitored_iflows");
            this.getView().getModel("globalModel").setProperty("/iflowId", null);

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
  onResolve: async function (oEvent) {

    console.log("=== Resolve Button Clicked ===");

    const oContext =
        oEvent.getSource()
            .getBindingContext("view");

    console.log("Binding Context:", oContext);

    if (!oContext) {
        console.error("No binding context found");
        return;
    }

    const oData = oContext.getObject();

    console.log("Selected Row Data:", oData);
    console.log("Cluster ID:", oData.cluster_ID);
    console.log("Artifact ID:", oData.artifact_ID);

    this.showBusy();

    try {

        const oModel =
            this.getOwnerComponent()
                .getModel();

        console.log("OData Model:", oModel);

        const oAction =
            oModel.bindContext(
                "/resolveClusterForArtifact(...)"
            );

        console.log("Action Context Created:", oAction);

        oAction.setParameter(
            "clusterId",
            oData.cluster_ID
        );

        oAction.setParameter(
            "artifactId",
            oData.artifact_ID
        );

        oAction.setParameter(
            "note",
            "Resolved the cluster"
        );

        console.log("Parameters Set:");
        console.log("clusterId =", oData.cluster_ID);
        console.log("artifactId =", oData.artifact_ID);
        console.log("note = Resolved the cluster");

        console.log("Executing Action...");

        await oAction.execute();

        console.log("Action Executed Successfully");

        const oResponse =
            oAction.getBoundContext()
                ?.getObject();

        console.log("Resolve Response:", oResponse);

        MessageBox.success(
            "Incident resolved successfully"
        );

        console.log("Refreshing Model...");

        oModel.refresh();

        console.log("Model Refreshed");

    } catch (error) {

        console.error("=== Resolve Failed ===");
        console.error("Error Object:", error);
        console.error("Error Message:", error?.message);
        console.error("Error Response:", error?.responseText);

        MessageBox.error(
            "Failed to resolve incident"
        );

    } finally {

        console.log("Hiding Busy Indicator");

        this.hideBusy();
    }
},

        // async Rediagnose() {
        //     this.showBusy();
        //     try {

        //         const oModel = this.getModel();
        //         const sID =
        //             this.getModel("globalModel")
        //                 .getProperty("/cluster_id");

        //         const oResponse =
        //             await oModel.bindContext(
        //                 `/onReDiagnoseIncidentCluster(cluster_ID='${sID}')`
        //             ).requestObject();
        //         console.log("Re-diagnose response:", oResponse);
        //         this.showToast(
        //             "Re-diagnose successful"
        //         );

        //     }
        //     catch (error) {

        //         this.showToast(
        //             "Failed to re-diagnose incident"
        //         );

        //     } finally {
        //         this.hideBusy();
        //         this.resetDetailsPage(sID);

        //     }
        // },
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
