sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "../model/formatter",
  "sap/ui/model/json/JSONModel"
], (BaseController, formatter, JSONModel) => {
  "use strict";

  return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Overview", {
     formatter: formatter,
    onInit() {

      this.loadDashboardCharts();
      this.loadTopCriticalIflows();

    },
    onSideNavButtonPress: function () {
      const oToolPage = this.byId("toolPage1");

      oToolPage.setSideExpanded(
        !oToolPage.getSideExpanded()
      )
    },
    loadTopCriticalIflows: async function () {

      const oModel = this.getOwnerComponent().getModel();

      try {

        const oContext = oModel.bindContext("/getTopCriticalIflows(...)");

        await oContext.execute();

        const aData =
          oContext.getBoundContext().getObject().value;

        const oTopIflowsModel = new JSONModel({
          topIflows: aData
        });

        this.getView().setModel(
          oTopIflowsModel,
          "topIflows"
        );

        console.log("Top Critical iFlows:", aData);

      } catch (oError) {
        console.error(
          "Error loading Top Critical iFlows",
          oError
        );
      }
    },
    loadDashboardCharts: async function () {

      const oModel = this.getOwnerComponent().getModel();

      try {

        const oContext = oModel.bindContext("/getDashboardCharts(...)");

        await oContext.execute();

        const oResult = oContext.getBoundContext().getObject();

        console.log("Dashboard Charts:", oResult);

        const oChartModel = new sap.ui.model.json.JSONModel(oResult);

        this.getView().setModel(oChartModel, "chart");

      } catch (oError) {

        console.error("Error loading dashboard charts", oError);

      }
    }

  });
});