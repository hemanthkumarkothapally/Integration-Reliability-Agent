sap.ui.define([
  "./BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/m/Popover",
  "sap/m/List",
  "sap/m/StandardListItem",
  "com/cytechies/integration/reliability/incidentclustersui/controller/IRALogo"
], (BaseController, JSONModel, Popover, List, StandardListItem, IRALogo) => {
  "use strict";

  return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.App", {

    onInit: function () {
      this.getView().setBusy(true);

      const oToolPage = this.byId("toolPage1");
      const oHeader = oToolPage.getHeader();

      // Instantiate and attach the new standard 'press' event
      const oLogo = new IRALogo({ size: 50 });
      oLogo.attachPress(this.onSideNavButtonPress, this);

      oHeader.insertContent(oLogo, 0);
      this.getOwnerComponent().getModel("globalModel").setProperty("/selectedKey", "overview");

      this.getView().setBusy(false);

      const oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("RouteOverview")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: async function (oEvent) {
      await this.getSettingsData();
    },

    onSideNavButtonPress: function () {
      const oSideNav = this.byId("sideNavigation");
      oSideNav.setVisible(!oSideNav.getVisible());
    },

    onSideNavigationSelect: function (oEvent) {
      this.showBusy();
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

        case "UsageAnalytics":
          oRouter.navTo("RouteUsageAnalytics");
          break;

        case "ai":
          this.getView().getModel("globalModel").setProperty("/iflowId", null);
          oRouter.navTo("RouteAIAssistant");
          break;

        case "Settings":
          oRouter.navTo("RouteSettings");
          break;

        case "incidents":
          // future route
          break;
      }

      this.hideBusy();
    },

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
      const oSelectedItem = oEvent.getSource();
      const oContext = oSelectedItem.getBindingContext("tenants");
      const oSelectedTenantData = oContext.getObject();

      this.showToast("Selected Tenant: " + oSelectedTenantData.name);

      // TODO: Add your logic here to filter main table or update backend destination

      // Close the popover after selection
      this._oTenantPopover.close();
    }

  });
});