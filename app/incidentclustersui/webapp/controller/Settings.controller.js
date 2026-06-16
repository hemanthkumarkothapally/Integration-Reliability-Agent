sap.ui.define([
  "./BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/m/Popover",
  "sap/m/List",
  "sap/m/StandardListItem",
  "sap/m/MessageToast",
  "sap/ui/core/Fragment"
], (BaseController, JSONModel, Popover, List, StandardListItem, MessageToast, Fragment) => {
  "use strict";

  return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Settings", {
    onInit: function () { // 1. Remove 'async' from here
      const oGlobalModel = this.getOwnerComponent().getModel("globalModel");
      oGlobalModel.setProperty("/editMode", false);
      oGlobalModel.setProperty("/selectedKey", "settings");
      
      const oRouter = this.getOwnerComponent().getRouter();
      oRouter.getRoute("RouteSettings").attachPatternMatched(this._onRouteMatched, this);

      // 2. Call your async logic here, but DO NOT use 'await'
      this._loadApplicationSettings(); 
    },

    // 3. Create a new async helper method for your OData calls
    _loadApplicationSettings: async function () {
      try {
        const oModel = this.getOwnerComponent().getModel();
        const oBinding = oModel.bindList("/ApplicationSettings");
        
        // This is safe to await here because it's not blocking the UI5 lifecycle
        const aContexts = await oBinding.requestContexts(); 
        const mSettings = {};
        
        aContexts.forEach(oContext => {
          const oSetting = oContext.getObject();
          mSettings[oSetting.settingKey] = oContext;
        });
        
        this._mSettings = mSettings;
      } catch (oError) {
        // This acts as a safety net if the backend 500s during settings load
        console.error("Failed to load application settings:", oError);
      }
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

      const oModel = this.getOwnerComponent().getModel();
      const oGlobalModel = this.getOwnerComponent().getModel("globalModel");

      const mSettings =
        oGlobalModel.getProperty("/settings");

      const aContexts =
        oGlobalModel.getProperty("/settingContexts");

      try {

        // aContexts.forEach(oContext => {

        //   const sKey =
        //     oContext.getObject().settingKey;

        //   oContext.setProperty(
        //     "settingValue",
        //     String(mSettings[sKey])
        //   );
        // });

        // await oModel.submitBatch("$auto");

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
    }
  });
});