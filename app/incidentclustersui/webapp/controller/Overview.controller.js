sap.ui.define([
  "./BaseController",
  "../model/formatter",
  "sap/ui/model/json/JSONModel"
], (BaseController, formatter, JSONModel) => {
  "use strict";

  return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Overview", {
    formatter: formatter,
    onInit: function () {
      this.getOwnerComponent().getModel("globalModel").setProperty("/selectedKey", "overview");

      // Call the async function, but do not return it or await it here
      this._initializeDashboardData();

      const oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("RouteOverview").attachPatternMatched(this._onRouteMatched, this);
    },

    // Create a separate async helper
    _initializeDashboardData: async function () {
      this.getView().setBusy(true);
      try {
        await Promise.all([
          this.loadDashboardCharts(),
          this.loadTopCriticalIflows()
        ]);
      } catch (oError) {
        this.showErrorDialog(oError, "Dashboard Load Failed");
      } finally {
        this.getView().setBusy(false);
      }
    },
    _onRouteMatched: async function (oEvent) {
      this.getView().setBusy(true);

      try {
        // Use standard Promise.all. If either fails, it throws immediately to the catch block.
        await Promise.all([
          this.loadDashboardCharts(),
          this.loadTopCriticalIflows()
        ]);
      } catch (oError) {
        // Use the NEW dialog function we built in BaseController
        this.showErrorDialog(oError, "Dashboard Load Error");
      } finally {
        this.getView().setBusy(false);
      }
    },
    onAfterRendering: function () {
      setTimeout(function () {
        var oPopover = this.byId("idPopOver");
        var oLineChart = this.byId("idLineChart");
        var oSeverityChart = this.byId("severityChart");
        var oTopErrorChart = this.byId("topErrorTypesChart");

        console.log("idLineChart:", oLineChart);
        console.log("severityChart:", oSeverityChart);
        console.log("topErrorTypesChart:", oTopErrorChart);
        console.log("idPopOver:", oPopover);

        if (oPopover && oLineChart) oPopover.connect(oLineChart.getVizUid());
        if (oPopover && oSeverityChart) oPopover.connect(oSeverityChart.getVizUid());
        if (oPopover && oTopErrorChart) oPopover.connect(oTopErrorChart.getVizUid());

      }.bind(this), 500);
    },

    onIFlowBtn: function () {

      this.getOwnerComponent()
        .getRouter()
        .navTo("Routemonitored_iflows");

    },


    // onSideNavigationSelect: function (oEvent) {

    //   const sKey = oEvent.getParameter("item").getKey();

    //   switch (sKey) {

    //     case "overview":
    //       this.getOwnerComponent()
    //         .getRouter()
    //         .navTo("RouteOverview");
    //       break;

    //     case "iflows":
    //       this.getOwnerComponent()
    //         .getRouter()
    //         .navTo("Routemonitored_iflows");
    //       break;

    //     case "incidents":
    //       // Future page
    //       break;

    //     case "clusters":
    //       // Future page
    //       break;
    //   }
    // },


    // onSideNavButtonPress: function () {
    //   const oToolPage = this.byId("toolPage1");

    //   oToolPage.setSideExpanded(
    //     !oToolPage.getSideExpanded()
    //   )
    // },


    loadTopCriticalIflows: async function () {
      const oModel = this.getOwnerComponent().getModel();
      
      // FIX: Add || "ALL" fallback so undefined doesn't crash the parameter assignment
      const sSelectedTenant = this.getOwnerComponent().getModel("globalModel").getProperty("/settings/DEFAULT_TENANT") || "ALL";
      console.log("Selected Tenant (iFlows):", sSelectedTenant);

      const oContext = oModel.bindContext("/getTopCriticalIflows(...)");
      
      if (sSelectedTenant !== "ALL") {
        oContext.setParameter("tenantId", sSelectedTenant);
      }

      // If the DB is down, this execute() will throw the 500 error up to _onRouteMatched
      await oContext.execute(); 

      const aData = oContext.getBoundContext().getObject().value;
      this.getView().setModel(new JSONModel({ topIflows: aData }), "topIflows");
    },

    loadDashboardCharts: async function () {
      const oModel = this.getOwnerComponent().getModel();
      
      // FIX: Add || "ALL" fallback
      const sSelectedTenant = this.getOwnerComponent().getModel("globalModel").getProperty("/settings/DEFAULT_TENANT") || "ALL";
      console.log("Selected Tenant (Charts):", sSelectedTenant);

      const oContext = oModel.bindContext("/getDashboardCharts(...)");
      
      if (sSelectedTenant !== "ALL") {
        oContext.setParameter("tenantId", sSelectedTenant);
      }
      
      // If the DB is down, this execute() will throw the 500 error up to _onRouteMatched
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

      // Debug - check what data is available in the selected row
      console.log("Selected Row Data:", oContext.getObject());

      // If your service returns ID use this
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