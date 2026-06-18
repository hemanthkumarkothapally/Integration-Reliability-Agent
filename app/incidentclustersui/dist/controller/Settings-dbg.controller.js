sap.ui.define([
  "./BaseController",
    "../model/formatter",
  "sap/ui/model/json/JSONModel",
  "sap/m/Popover",
  "sap/m/List",
  "sap/m/StandardListItem",
  "sap/m/MessageToast",
  "sap/ui/core/Fragment",
  "sap/m/MessageBox"
], (BaseController, formatter,JSONModel, Popover, List, StandardListItem, MessageToast, Fragment, MessageBox) => {
  "use strict";
  
  return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Settings", {
        formatter: formatter,
    async onInit() {
      const oGlobalModel = this.getOwnerComponent().getModel("globalModel");
      oGlobalModel.setProperty("/editMode", false);
      this.getOwnerComponent().getModel("globalModel").setProperty("/selectedKey", "settings");
      const oRouter = this.getOwnerComponent().getRouter();

      oRouter.getRoute("RouteSettings")
        .attachPatternMatched(
          this._onRouteMatched,
          this
        );

    },
    _onRouteMatched: async function (oEvent) {
      await this.getSettingsData();

      this.getOwnerComponent().getModel("globalModel").setProperty("/selectedKey", "Settings");
      this._loadSettings();
      console.log("global model data:", this.getOwnerComponent().getModel("globalModel").getData());
    },
    onTenantChange: function (oEvent) {
      const sKey = oEvent.getSource().getSelectedKey();
      this.getOwnerComponent().getModel("globalModel").setProperty("/settings/DEFAULT_TENANT", sKey);
      console.log("Selected Key:", sKey);

      this.setSelectedTenant(sKey, oEvent.getSource().getSelectedItem().getProperty('text'));
    },
    onEdit() {
      this.getOwnerComponent()
        .getModel("globalModel")
        .setProperty("/editMode", true);
    },
    async onSave() {

    const oModel = this.getOwnerComponent()
        .getModel("AdminModel");

    try {

        await oModel.submitBatch("$auto");

        const bHasPendingChanges = oModel.hasPendingChanges();

        if (bHasPendingChanges) {
            throw new Error("Some changes could not be saved");
        }

        this.getOwnerComponent()
            .getModel("globalModel")
            .setProperty("/editMode", false);

        MessageToast.show(
            "Settings saved successfully"
        );

    } catch (err) {

        console.error(err);

        MessageBox.error(
            err.message || "Failed to save settings"
        );
    }
},
    async onCancel() {

      await this._loadSettings();

      this.getOwnerComponent()
        .getModel("globalModel")
        .setProperty("/editMode", false);
    },
    async _loadSettings() {
       const oModel = this.getOwnerComponent().getModel('AdminModel');

      const aContexts = await oModel
        .bindList("/ApplicationSettings")
        .requestContexts();

      this._settings = {};

      aContexts.forEach(oContext => {
        const oSetting = oContext.getObject();
        this._settings[oSetting.settingKey] = oContext;
      });
      console.log("Settings Contexts: ", this._settings);

      this.byId("aiProvider")
        .setBindingContext(this._settings.AI_PROVIDER, "AdminModel");

      this.byId("aiModel")
        .setBindingContext(this._settings.AI_MODEL, "AdminModel");

      this.byId("maxIncidents")
        .setBindingContext(this._settings.MAX_INCIDENTS_FOR_AI, "AdminModel");

      this.byId("historyCount")
        .setBindingContext(this._settings.HISTORY_MESSAGE_COUNT, "AdminModel");

      this.byId("pollingMode")
        .setBindingContext(this._settings.POLLING_MODE, "AdminModel");

      this.byId("pollingInterval")
        .setBindingContext(this._settings.POLLING_INTERVAL_MINUTES, "AdminModel");

      this.byId("incidentRetention")
        .setBindingContext(this._settings.INCIDENT_RETENTION_DAYS, "AdminModel");

      this.byId("clusterRetention")
        .setBindingContext(this._settings.CLUSTER_RETENTION_DAYS, "AdminModel");

      this.byId("iflowRetention")
        .setBindingContext(this._settings.MONITORING_RETENTION_DAYS, "AdminModel");

      await this.loadTenantPollInfo();
    },
    async onAddTenant() {
      let oGlobalModel = this.getOwnerComponent().getModel("globalModel");
      if (!this._aDestinations) {
        const oModel = this.getOwnerComponent().getModel("AdminModel");
        const oContext = oModel.bindContext("/getDestinations(...)");
        await oContext.execute();
        const aData = oContext.getBoundContext().getObject().value;
        this._aDestinations = aData;
        oGlobalModel.setProperty("/destinations", aData);
        console.log("Destinations: ", aData);
      }
      oGlobalModel.setProperty("/TenantDetails", {
        tenantName: "",
        tenantId: "",
        destinationName: "",
        url: "",
        isActive: true
      });
      if (!this._oTenantDialog) {

        this._oTenantDialog = await Fragment.load({
          name: "com.cytechies.integration.reliability.incidentclustersui.fragments.AddTenant",
          controller: this
        });

        this.getView().addDependent(
          this._oTenantDialog
        );
      }

      this._oTenantDialog.open();
    },
    onDestinationChange: function (oEvent) {
      const sSelectedKey = oEvent.getSource().getSelectedKey();
      const oSelectedDestination = this._aDestinations.find(dest => dest.Name === sSelectedKey);
      if (oSelectedDestination) {
        this.getOwnerComponent().getModel("globalModel")
          .setProperty(
            "/TenantDetails/destinationName",
            oSelectedDestination.Name
          ); this.getOwnerComponent().getModel("globalModel").setProperty("/TenantDetails/url", oSelectedDestination.URL);
      }
    },
    async onCreateTenant() {

      const oModel =
        this.getOwnerComponent()
          .getModel("AdminModel");

      const oPayload =
        this.getOwnerComponent()
          .getModel("globalModel")
          .getProperty("/TenantDetails");
      const aRequiredFields = [
        "tenantName",
        "tenantId",
        "destinationName",
         "url",
        "isActive"
    ];

    const aMissingFields = aRequiredFields.filter(
        field => !oPayload[field] || !oPayload[field].toString().trim()
    );

    if (aMissingFields.length > 0) {
        sap.m.MessageBox.error(
            `Please fill all required fields.\n\nMissing: ${aMissingFields.join(", ")}`
        );
        return;
    }

      try {

        if (!oPayload.ID) {

          const oBinding =
            oModel.bindList("/Tenants");

          const oContext =
            oBinding.create(oPayload);

          await oContext.created();

          MessageToast.show(
            "Tenant created successfully"
          );

        } else {

          Object.keys(oPayload).forEach(key => {

            this._oEditContext.setProperty(
              key,
              oPayload[key]
            );

          });

          await oModel.submitBatch("$auto");

          MessageToast.show(
            "Tenant updated successfully"
          );

        }

        this._oTenantDialog.close();

        await this.getSettingsData();
        this.byId("tenantTable").getBinding("items").refresh();

      } catch (err) {

        sap.m.MessageBox.error(
          err.message
        );

        console.error(err);
      }
    },
    onCloseTenantDialog: function () {
      this._oTenantDialog.close();
    },

    onDeleteTenant: async function (oEvent) {
      const oContext = oEvent.getSource().getBindingContext();
      try {
        await oContext.delete();
        sap.m.MessageToast.show(
          "Tenant deleted successfully"
        );
      } catch (err) {
        sap.m.MessageBox.error(
          "Failed to delete tenant"
        );
        console.error(err);
      }
    },
    onEditTenant: async function (oEvent) {
      let oGlobalModel = this.getOwnerComponent().getModel("globalModel");
      if (!this._aDestinations) {
        const oModel = this.getOwnerComponent().getModel("AdminModel");
        const oContext = oModel.bindContext("/getDestinations(...)");
        await oContext.execute();
        const aData = oContext.getBoundContext().getObject().value;
        this._aDestinations = aData;
        oGlobalModel.setProperty("/destinations", aData);
        console.log("Destinations: ", aData);
      }
      const oContext = oEvent.getSource().getBindingContext();
      this._oEditContext = oContext;
      const oTenantData = oContext.getObject();
      this.getOwnerComponent().getModel("globalModel").setProperty("/TenantDetails", oTenantData);
      if (!this._oTenantDialog) {
        Fragment.load({
          name: "com.cytechies.integration.reliability.incidentclustersui.fragments.AddTenant",
          controller: this
        }).then(oDialog => {
          this._oTenantDialog = oDialog;
          this.getView().addDependent(this._oTenantDialog);
          this._oTenantDialog.open();
        });
      } else {
        this._oTenantDialog.open();
      }
    },
    async onPollNow() {

    const oView = this.getView();

    try {

        oView.setBusy(true);
        oView.setBusyIndicatorDelay(0);

        const oModel =
            this.getOwnerComponent()
                .getModel("AdminModel");

        const oAction =
            oModel.bindContext(
                "/triggerManualPoll(...)"
            );

        await oAction.execute();

        const oResult =
            oAction
                .getBoundContext()
                .getObject();
console.log("Polling Result: ", oResult.value[0].processedLogs);
        MessageToast.show(
            `Polling completed. Processed ${oResult.value[0].processedLogs} logs`
        );

    } catch (err) {

        MessageBox.error(
            "Polling failed"
        );

    } finally {

        oView.setBusy(false);
        oModel.refresh();
    }
},
onPollingModeChange: function (oEvent) {

    const iIndex =
        oEvent.getSource().getSelectedIndex();

    const bAutomatic = iIndex === 0;

    this.getOwnerComponent()
        .getModel("globalModel")
        .setProperty(
            "/isAutomaticPolling",
            bAutomatic
        );

},
async loadTenantPollInfo() {

    const oModel = this.getOwnerComponent()
        .getModel("AdminModel");

   const aContexts = await oModel.bindList(
    "/DailyMetrics",
    undefined,
    [
        new sap.ui.model.Sorter("lastPollAt", true)
    ],
    [],
    {
        $expand: "tenant"
    }
).requestContexts(0, 500);

console.log("Tenant Poll Info Contexts: ", aContexts);
    const aMetrics = aContexts.map(
        oContext => oContext.getObject()
    );

    // Keep latest record per tenant
    const mTenantMap = {};

    aMetrics.forEach(oMetric => {

        const sTenantId = oMetric.tenant_ID;

        if (!mTenantMap[sTenantId]) {

            mTenantMap[sTenantId] = {
                tenantId: sTenantId,
                tenantName: oMetric.tenant?.tenantName,
                lastPollAt: oMetric.lastPollAt,
                lastPollStatus: oMetric.lastPollStatus,
                pollRuns: oMetric.pollRuns,
                pollFailures: oMetric.pollFailures
            };
        }
    });

    const aTenantPollStatus =
        Object.values(mTenantMap);
console.log("Tenant Poll Status: ", aTenantPollStatus);
    this.getOwnerComponent()
        .getModel("globalModel")
        .setProperty(
            "/tenantPollStatus",
            aTenantPollStatus
        );
}
  });
});