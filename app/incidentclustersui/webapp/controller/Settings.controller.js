sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/Popover",
  "sap/m/List",
  "sap/m/StandardListItem",
  "sap/m/MessageToast"
], (BaseController, JSONModel, Popover, List, StandardListItem, MessageToast) => {
  "use strict";

  return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Settings", {
    async onInit() {
      const oGlobalModel = this.getOwnerComponent().getModel("globalModel");
      oGlobalModel.setProperty("/editMode", false);
    },
    onTenantChange: function (oEvent) {
      const sKey = oEvent.getSource().getSelectedKey();
      this.getOwnerComponent().getModel("globalModel").setProperty("/settings/DEFAULT_TENANT", sKey);
      console.log("Selected Key:", sKey);
    },
    onEdit() {
      this.getOwnerComponent()
        .getModel("globalModel")
        .setProperty("/editMode", true);
    },
    async onSave() {

      const oModel = this.getOwnerComponent().getModel();
      const oGlobalModel = this.getOwnerComponent().getModel("globalModel");

      const mSettings =
        oGlobalModel.getProperty("/settings");

      const aContexts =
        oGlobalModel.getProperty("/settingContexts");

      try {

        aContexts.forEach(oContext => {

          const sKey =
            oContext.getObject().settingKey;

          oContext.setProperty(
            "settingValue",
            String(mSettings[sKey])
          );
        });

        await oModel.submitBatch("$auto");

        oGlobalModel.setProperty(
          "/editMode",
          false
        );

        sap.m.MessageToast.show(
          "Settings saved successfully"
        );

      } catch (oError) {

        sap.m.MessageBox.error(
          "Error saving settings"
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
    }
  });
});