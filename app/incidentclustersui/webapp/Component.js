sap.ui.define([
    "sap/ui/core/UIComponent",
    "com/cytechies/integration/reliability/incidentclustersui/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("com.cytechies.integration.reliability.incidentclustersui.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        // 1. Remove 'async' so UI5 accepts this as a valid lifecycle method
        init: function() { 
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");
            
            // 2. Call the data load WITHOUT 'await' so it runs in the background
            this._loadSettings();

            // enable routing
            this.getRouter().initialize();
        },

        // 3. Keep 'async' here, but wrap the logic in a try/catch
        _loadSettings: async function() {
            try {
                const oModel = this.getModel();
                const oGlobalModel = this.getModel("globalModel");

                const aSettings = await oModel
                    .bindList("/ApplicationSettings")
                    .requestContexts();

                const mSettings = {};

                aSettings.forEach(ctx => {
                    const o = ctx.getObject();
                    mSettings[o.settingKey] = o.settingValue;
                });

                oGlobalModel.setProperty(
                    "/settings",
                    mSettings
                );
            } catch (oError) {
                // 4. If the backend throws a 500 timeout, it lands here!
                // The app container survives, and the screen will still load.
                console.error("Component safely caught the settings timeout:", oError);
            }
        }
    });
});