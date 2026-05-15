sap.ui.define([
  "sap/ui/core/mvc/ControllerExtension",
  "sap/ui/model/json/JSONModel"
], function (ControllerExtension, JSONModel) {
  "use strict";

  return ControllerExtension.extend(
    "com.cytechies.integration.reliability.incidentclusters.ext.controller.ListReportExt",
    {
      override: {
        onInit: function () {
          const oView = this.base.getView();

          oView.setModel(new JSONModel({
            totalIncidents24h: 0,
            activeClusters: 0,
            criticalCount: 0,
            resolved24h: 0,
            criticalStatus: "Success"
          }), "kpi");

          setTimeout(() => {
            this._loadKpis();
          }, 500);
        }
      },

      _loadKpis: async function () {
        const oView = this.base.getView();
        const oModel =
          oView.getModel() ||
          this.base.getAppComponent().getModel();

        if (!oModel) {
          console.error("Main OData model not available yet");
          return;
        }

        const oListBinding = oModel.bindList(
          "/IncidentClusters",
          undefined,
          undefined,
          undefined,
          {
            $select: "totalIncidents24h,activeClusters,criticalCount,resolved24h,criticalCriticality"
          }
        );

        const aContexts = await oListBinding.requestContexts(0, 1);

        if (!aContexts.length) return;

        const oData = aContexts[0].getObject();
        const oKpiModel = oView.getModel("kpi");

        oKpiModel.setData({
          totalIncidents24h: oData.totalIncidents24h || 0,
          activeClusters: oData.activeClusters || 0,
          criticalCount: oData.criticalCount || 0,
          resolved24h: oData.resolved24h || 0,
          criticalStatus: Number(oData.criticalCount) > 0 ? "Error" : "Success"
        });
      }
    }
  );
});