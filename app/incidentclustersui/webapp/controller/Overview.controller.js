sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "../model/formatter",
  "sap/ui/model/json/JSONModel"
], (BaseController, formatter, JSONModel) => {
  "use strict";

  return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Overview", {
    formatter: formatter,
    onInit() {
      //  this.byId("sideNavigation")
      //   .setSelectedKey("overview");

      this.loadDashboardCharts();
      this.loadTopCriticalIflows();

      var oPopover = this.byId("idPopOver");

      oPopover.connect(this.byId("topErrorTypesChart").getVizUid());

      oPopover.connect(this.byId("severityChart").getVizUid());

      oPopover.connect(this.byId("idLineChart").getVizUid());



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

    onSideNavigationSelect: function (oEvent) {

      const sKey = oEvent.getParameter("item").getKey();

      switch (sKey) {

        case "overview":
          this.getOwnerComponent()
            .getRouter()
            .navTo("RouteOverview");
          break;

        case "iflows":
          this.getOwnerComponent()
            .getRouter()
            .navTo("Routemonitored_iflows");
          break;

        case "incidents":
          // Future page
          break;

        case "clusters":
          // Future page
          break;
      }
    },
    // onSideNavButtonPress: function () {
    //   const oToolPage = this.byId("toolPage1");

    //   oToolPage.setSideExpanded(
    //     !oToolPage.getSideExpanded()
    //   )
    // },

    onSideNavButtonPress: function () {

    const oSideNav = this.byId("sideNavigation");

    oSideNav.setVisible(
        !oSideNav.getVisible()
    );

},
    loadTopCriticalIflows: async function () {

      const oModel = this.getOwnerComponent().getModel();
     // const sSelectedTenant = this.getView().byId("tenantSelect").getSelectedKey();
     // console.log("Selected Tenant:", sSelectedTenant);

      try {

        const oContext = oModel.bindContext("/getTopCriticalIflows(...)");
        // if (sSelectedTenant !== "") {
        //   oContext.setParameter(
        //     "tenantId",
        //     sSelectedTenant
        //   );
        // }

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
      //const sSelectedTenant = this.getView().byId("tenantSelect").getSelectedKey();
      //console.log("Selected Tenant:", sSelectedTenant);
     
      try {

        const oContext = oModel.bindContext("/getDashboardCharts(...)");
      //  if (sSelectedTenant !== "") {
      //     oContext.setParameter(
      //       "tenantId",
      //       sSelectedTenant
      //     );
      //   }
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