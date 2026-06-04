sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "../model/formatter",
], (BaseController, formatter) => {
    "use strict";

    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Clusters", {
        formatter: formatter,
        onInit() {

        },

          onRefreshPress: function () {
            var oTable = this.byId("idClusters");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").refresh();
            }
        },


    });
});