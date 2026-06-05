sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "../model/formatter",
  "sap/ui/model/json/JSONModel"
], (BaseController, formatter, JSONModel) => {
  "use strict";

  return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Overview", {
    formatter: formatter,
    onInit: function() {
      // Set an initial empty/default state so the UI doesn't crash while loading
      this.getView().setModel(
        new JSONModel({
          tenants: [{ ID: "ALL", tenantName: "All Tenants" }]
        }),
        "tenantModel"
      );

      // Call your async initialization separately (do NOT use await here)
      this._initializeAsyncData();
      
      // ❌ Do not call this.onAfterRendering() manually!

      var oPopover = this.byId("idPopOver");
      var oTopErrorChart = this.byId("topErrorTypesChart");
      var oSeverityChart = this.byId("severityChart");
      var oLineChart = this.byId("idLineChart");

      if (oPopover) {
        // Wait for each chart to fully draw before connecting the popover
        if (oTopErrorChart) {
          oTopErrorChart.attachRenderComplete(function() {
            oPopover.connect(oTopErrorChart.getVizUid());
          });
        }

        if (oSeverityChart) {
          oSeverityChart.attachRenderComplete(function() {
            oPopover.connect(oSeverityChart.getVizUid());
          });
        }

        if (oLineChart) {
          oLineChart.attachRenderComplete(function() {
            oPopover.connect(oLineChart.getVizUid());
          });
        }
      }
    },

    // 2. New custom helper method for the async work
    _initializeAsyncData: async function() {
      try {
        const aTenants = [
          {
            ID: "ALL",
            tenantName: "All Tenants"
          }
        ];

        const aBackendTenants = await this.getOwnerComponent().getModel().bindList("/Tenants").requestContexts();

        aBackendTenants.forEach(oContext => {
          aTenants.push(oContext.getObject());
        });
        
        console.log("Tenants", aTenants);
        
        // Update the model we created in onInit
        this.getView().getModel("tenantModel").setProperty("/tenants", aTenants);
        console.log(this.getView().getModel("tenantModel").getData());
        
        this.loadDashboardCharts();
        this.loadTopCriticalIflows();
      } catch (oError) {
        console.error("Failed to initialize backend data", oError);
      }
    },

    // 3. The framework will automatically call this when the UI is drawn
    onAfterRendering: function () {
      var oPopover = this.byId("idPopOver");
      
      if (oPopover) {
        var oTopErrorChart = this.byId("topErrorTypesChart");
        var oSeverityChart = this.byId("severityChart");
        var oLineChart = this.byId("idLineChart");

        if (oTopErrorChart) oPopover.connect(oTopErrorChart.getVizUid());
        if (oSeverityChart) oPopover.connect(oSeverityChart.getVizUid());
        if (oLineChart) oPopover.connect(oLineChart.getVizUid());
      }
    },

    onTenantChange: function (oEvent) {

      const sKey =
        oEvent.getSource().getSelectedKey();

      console.log("Selected Key:", sKey);
      this.loadDashboardCharts();
      this.loadTopCriticalIflows();

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
      const sSelectedTenant = this.getView().byId("tenantSelect").getSelectedKey();
      console.log("Selected Tenant:", sSelectedTenant);

      try {

        const oContext = oModel.bindContext("/getTopCriticalIflows(...)");
        if (sSelectedTenant !== "ALL") {
          oContext.setParameter(
            "tenantId",
            sSelectedTenant
          );
        }

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
      debugger
      const sSelectedTenant = this.getView().byId("tenantSelect").getSelectedKey();
      console.log("Selected Tenant:", sSelectedTenant);

      try {

        const oContext = oModel.bindContext("/getDashboardCharts(...)");
        if (sSelectedTenant !== "ALL") {
          oContext.setParameter(
            "tenantId",
            sSelectedTenant
          );
        }
        await oContext.execute();

        const oResult = oContext.getBoundContext().getObject();

        console.log("Dashboard Charts:", oResult);

        const oChartModel = new sap.ui.model.json.JSONModel(oResult);

        this.getView().setModel(oChartModel, "chart");

      } catch (oError) {

        console.error("Error loading dashboard charts", oError);

      }
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