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
                .navTo("RouteOrderList");

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
        onResolve: async function () {

            this.showBusy();

            try {

                const sID =
                    this.getModel("globalModel")
                        .getProperty("/cluster_id");

                const oModel =
                    this.getModel();

                const oContext =
                    oModel.bindContext(
                        `/IncidentClusters('${sID}')`
                    );

                await oContext.requestObject();

                const oBoundContext =
                    oContext.getBoundContext();

                oBoundContext.setProperty(
                    "status",
                    "RESOLVED"
                );

                await oModel.submitBatch(
                    "$auto"
                );

                // Update JSON Model
                this.getView().getModel("headerDetails")
                    .setProperty(
                        "/status",
                        "RESOLVED"
                    );

                MessageBox.success(
                    "Incident resolved successfully"
                );

            } catch (error) {

                console.error(
                    "Resolve Failed",
                    error
                );

                MessageBox.error(
                    "Failed to resolve incident"
                );

            } finally {

                this.hideBusy();

            }

        },

        async Rediagnose() {
            this.showBusy();
            try {

                const oModel = this.getModel();
                const sID =
                    this.getModel("globalModel")
                        .getProperty("/cluster_id");

                const oResponse =
                    await oModel.bindContext(
                        `/onReDiagnoseIncidentCluster(cluster_ID='${sID}')`
                    ).requestObject();
                console.log("Re-diagnose response:", oResponse);
                this.showToast(
                    "Re-diagnose successful"
                );

            }
            catch (error) {

                this.showToast(
                    "Failed to re-diagnose incident"
                );

            } finally {
                this.hideBusy();
                this.resetDetailsPage(sID);

            }
        },




    });
});
