sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/Popover",            // 6th dependency
  "sap/m/List",               // 7th dependency
  "sap/m/StandardListItem"
], (BaseController, JSONModel, Popover, List, StandardListItem) => {
  "use strict";

  return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.App", {
    onInit() {
      var aStaticTenants = [
        { id: "T1", name: "Tenant 1 (Development)", region: "US East" },
        { id: "T2", name: "Tenant 2 (Staging)", region: "Europe West" },
        { id: "T3", name: "Tenant 3 (Production)", region: "US West" }
      ];

      // Set it to a JSON model named "tenants"
      var oTenantModel = new JSONModel({ Tenants: aStaticTenants });
      this.getView().setModel(oTenantModel, "tenants");
      this.getSettingsData();
    },
    async getSettingsData() {

      const oODataModel = this.getOwnerComponent().getModel();
      const oGlobalModel = this.getOwnerComponent().getModel("globalModel");

      // Load Tenants
      const aTenants = [{
        ID: "ALL",
        tenantName: "All Tenants"
      }];

      const aBackendTenants = await oODataModel
        .bindList("/Tenants")
        .requestContexts();

      aBackendTenants.forEach(oContext => {
        aTenants.push(oContext.getObject());
      });

      oGlobalModel.setProperty("/tenants", aTenants);

      // Load Settings
      const aSettingsContexts = await oODataModel
        .bindList("/ApplicationSettings")
        .requestContexts();

      const mSettings = {};

      aSettingsContexts.forEach(oContext => {
        const oSetting = oContext.getObject();

        mSettings[oSetting.settingKey] =
          oSetting.settingValue;
      });

      oGlobalModel.setProperty("/settings", mSettings);
      console.log("Default Tenant: " + oGlobalModel.getProperty("/settings/DEFAULT_TENANT"));

    },

    onSideNavButtonPress: function () {

      const oSideNav = this.byId("sideNavigation");

      oSideNav.setVisible(
        !oSideNav.getVisible()
      );

    },
    onSideNavigationSelect: function (oEvent) {

      const sKey = oEvent.getParameter("item").getKey();
      const oRouter = this.getOwnerComponent().getRouter();

      switch (sKey) {

        case "overview":
          oRouter.navTo("RouteOverview");
          break;

        case "iflows":
          oRouter.navTo("Routemonitored_iflows");
          break;

        case "clusters":
          oRouter.navTo("RouteClusters");
          break;

        case "ai":
          oRouter.navTo("RouteAIAssistant");
          break;

        case "Settings":
          oRouter.navTo("RouteSettings");
          break;

        case "incidents":
          // future route
          break;
      }
    },
    // onSideNavigationSetting: function (oEvent) {
    //   let oItem = oEvent.getParameter("item");
    //   let sKey = oItem.getKey();

    //   if (sKey === "settings") {
    //     // Prevent navigation/selection state if you just want a popup
    //     // Open the tenant popover anchoring it to the clicked setting item
    //     this._showTenantPopover(oItem);
    //   }
    // },
    _showTenantPopover: function (oAnchor) {
      if (!this._oTenantPopover) {
        // Create the popover lazily
        this._oTenantPopover = new Popover({
          title: "Select Tenant",
          placement: "Right", // Pops out to the right of the side navigation
          contentWidth: "250px",
          content: new List({
            // Bind items to your static JSON model
            items: {
              path: "tenants>/Tenants",
              template: new StandardListItem({
                title: "{tenants>name}",
                description: "{tenants>region}",
                type: "Active",
                icon: "sap-icon://tenant",
                press: this.onTenantSelect.bind(this)
              })
            }
          })
        });

        // Add popover dependent to view so models are inherited
        this.getView().addDependent(this._oTenantPopover);
      }

      // Open popover pointing to the clicked settings item
      this._oTenantPopover.openBy(oAnchor);
    },

    /**
     * Event handler when a tenant from the list is clicked
     */
    onTenantSelect: function (oEvent) {
      var oSelectedItem = oEvent.getSource();
      var oContext = oSelectedItem.getBindingContext("tenants");
      var oSelectedTenantData = oContext.getObject();

      sap.m.MessageToast.show("Selected Tenant: " + oSelectedTenantData.name);

      // TODO: Add your logic here to filter main table or update backend destination

      // Close the popover after selection
      this._oTenantPopover.close();
    },
  });
});