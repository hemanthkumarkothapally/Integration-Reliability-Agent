sap.ui.define([
    "./BaseController",
], (BaseController) => {
    "use strict";

    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.UsageAnalytics", {
        async onInit() {
            this.getView().setBusy(true);

            this.getView().setBusy(false);
            const oRouter =
                this.getOwnerComponent().getRouter();

            oRouter.getRoute("RouteOverview")
                .attachPatternMatched(
                    this._onRouteMatched,
                    this
                );

        },
        _onRouteMatched: async function (oEvent) {
            await this.getSettingsData();
        },

    });
});