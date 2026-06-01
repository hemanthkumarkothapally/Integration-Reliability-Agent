sap.ui.define([
  "sap/ui/core/mvc/Controller"
], (BaseController) => {
  "use strict";

  return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Overview", {
    onInit() {

   

    },
    onSideNavButtonPress: function () {
      const oToolPage = this.byId("toolPage1");

      oToolPage.setSideExpanded(
        !oToolPage.getSideExpanded()
      );
    }
  });
});