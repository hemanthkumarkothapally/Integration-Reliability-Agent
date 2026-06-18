sap.ui.define([
  "./BaseController",
  "../model/formatter",
  "sap/ui/model/json/JSONModel"
], (BaseController, formatter, JSONModel) => {
  "use strict";

  // Delay (ms) before connecting the popover, to allow VizFrames to finish rendering
  const VIZ_CONNECT_DELAY = 500;

  return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Overview", {
    formatter: formatter,

    onInit: function () {
      this.getOwnerComponent().getModel("globalModel").setProperty("/selectedKey", "overview");

      const oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("RouteOverview").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: async function (oEvent) {
      this.getView().setBusy(true);

      try {
        // If either request fails, it throws immediately to the catch block.
        await Promise.all([
          this.loadDashboardCharts(),
          this.loadTopCriticalIflows()
        ]);
      } catch (oError) {
        this.showErrorDialog(oError, "Dashboard Load Error");
      } finally {
        this.getView().setBusy(false);
      }
    },

    onAfterRendering: function () {
      setTimeout(() => {
        const oPopover = this.byId("idPopOver");
        const oLineChart = this.byId("idLineChart");
        const oSeverityChart = this.byId("severityChart");
        const oTopErrorChart = this.byId("topErrorTypesChart");

        if (oPopover && oLineChart) { oPopover.connect(oLineChart.getVizUid()); }
        if (oPopover && oSeverityChart) { oPopover.connect(oSeverityChart.getVizUid()); }
        if (oPopover && oTopErrorChart) { oPopover.connect(oTopErrorChart.getVizUid()); }
      }, VIZ_CONNECT_DELAY);
    },

    onIFlowBtn: function () {
      this.getOwnerComponent()
        .getRouter()
        .navTo("Routemonitored_iflows");
    },

    _getSelectedTenant: function () {
      return this.getOwnerComponent()
        .getModel("globalModel")
        .getProperty("/settings/DEFAULT_TENANT") || "ALL";
    },

    loadTopCriticalIflows: async function () {
      const oModel = this.getOwnerComponent().getModel();
      const sSelectedTenant = this._getSelectedTenant();

      const oContext = oModel.bindContext("/getTopCriticalIflows(...)");

      if (sSelectedTenant !== "ALL") {
        oContext.setParameter("tenantId", sSelectedTenant);
      }

      // If the DB is down, this execute() throws the 500 error up to _onRouteMatched
      await oContext.execute();

      const aData = oContext.getBoundContext().getObject().value;
      this.getView().setModel(new JSONModel({ topIflows: aData }), "topIflows");
    },

    loadDashboardCharts: async function () {
      const oModel = this.getOwnerComponent().getModel();
      const sSelectedTenant = this._getSelectedTenant();

      const oContext = oModel.bindContext("/getDashboardCharts(...)");

      if (sSelectedTenant !== "ALL") {
        oContext.setParameter("tenantId", sSelectedTenant);
      }

      // If the DB is down, this execute() throws the 500 error up to _onRouteMatched
      await oContext.execute();

      const oResult = oContext.getBoundContext().getObject();
      this.getView().setModel(new JSONModel(oResult), "chart");
    },

    onTopIflowPress: function (oEvent) {
      const oItem = oEvent.getSource();
      const oContext = oItem.getBindingContext("topIflows");

      if (!oContext) {
        console.error("No binding context found");
        return;
      }

      const sID = oContext.getProperty("ID");

      if (sID) {
        const oGlobalModel = this.getOwnerComponent().getModel("globalModel");
        if (oGlobalModel) {
          oGlobalModel.setProperty("/iflowId", sID);
        }

        this.getOwnerComponent()
          .getRouter()
          .navTo("RouteIC", {
            ID: sID
          });
      } else {
        console.error(
          "ID field not found in row data. Available data:",
          oContext.getObject()
        );
      }
    }
  });
});