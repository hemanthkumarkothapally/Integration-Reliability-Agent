sap.ui.define([
  "sap/ui/core/mvc/Controller"
], (BaseController) => {
  "use strict";

  return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.App", {
      onInit() {
        
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

        case "incidents":
            // future route
            break;
    }
}
  });
});