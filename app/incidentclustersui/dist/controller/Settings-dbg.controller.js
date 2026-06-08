sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/Popover",
  "sap/m/List",
  "sap/m/StandardListItem"
], (BaseController, JSONModel, Popover, List, StandardListItem) => {
  "use strict";

  return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Settings", {
    async onInit() {
    },
     onTenantChange: function (oEvent) {
      const sKey = oEvent.getSource().getSelectedKey();
      this.getOwnerComponent().getModel("globalModel").setProperty("/settings/DEFAULT_TENANT", sKey);
        console.log("Selected Key:", sKey);
    },
  });
});