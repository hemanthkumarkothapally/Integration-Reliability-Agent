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

        async init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");
    await this._loadSettings();

            // enable routing
            this.getRouter().initialize();
        },
        async _loadSettings() {

    const oModel = this.getModel();
    const oGlobalModel =
        this.getModel("globalModel");

    const aSettings =
        await oModel
            .bindList("/ApplicationSettings")
            .requestContexts();

    const mSettings = {};

    aSettings.forEach(ctx => {

        const o =
            ctx.getObject();

        mSettings[
            o.settingKey
        ] = o.settingValue;
    });

    oGlobalModel.setProperty(
        "/settings",
        mSettings
    );
}
    });
});