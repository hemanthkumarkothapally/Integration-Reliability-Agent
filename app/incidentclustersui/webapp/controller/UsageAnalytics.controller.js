sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "../model/formatter",
    "sap/viz/ui5/format/ChartFormatter",
    "sap/viz/ui5/api/env/Format",
    "sap/viz/ui5/controls/common/feeds/FeedItem"
], function (BaseController, JSONModel, formatter, ChartFormatter, Format, FeedItem) {
    "use strict";

    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.UsageAnalytics", {
        formatter: formatter,

        onInit: function () {
            Format.numericFormatter(ChartFormatter.getInstance());
            this.getView().setModel(new JSONModel({}), "chart");

            var oToday = new Date();
            oToday.setHours(0, 0, 0, 0);
            this.byId("idAnalyticsDateRangeFilter").setMaxDate(oToday);

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteUsageAnalytics").attachPatternMatched(this._onRouteMatched, this);
        },

        // Helper to prevent code duplication
        _formatDate: function (d) {
            var m = String(d.getMonth() + 1).padStart(2, "0");
            var day = String(d.getDate()).padStart(2, "0");
            return d.getFullYear() + "-" + m + "-" + day;
        },

        _getCurrentMonthRange: function () {
            var oNow = new Date();
            var oFrom = new Date(oNow.getFullYear(), oNow.getMonth(), 1);
            return {
                from: this._formatDate(oFrom),
                to: this._formatDate(oNow),
                fromDate: oFrom,
                toDate: oNow
            };
        },

        _normalizeHanaStorage: function (oData) {
            if (!oData || !oData.hanaStorageConfig || !Array.isArray(oData.hanaStorage)) {
                return oData;
            }

            var oLabels = oData.hanaStorageConfig.labels;
            var aRows = oData.hanaStorage;

            var aTenantKeys = Object.keys(oLabels).filter(function (sKey) {
                return !!oLabels[sKey];
            });

            aRows.forEach(function (oRow) {
                aTenantKeys.forEach(function (sKey) {
                    var v = oRow[sKey];
                    oRow[sKey] = (v === undefined || v === null || isNaN(v)) ? 0 : Number(v);
                });
            });

            return oData;
        },

        _initVizFrames: function () {
            var oView = this.getView();
            var oChartModel = oView.getModel("chart");

            // Fixed ID array to match your XML View (idHanaUsage instead of idHanaStorage)
            ["idSeverityDonut", "idIncidentTrend", "idTokenUsage", "idHanaUsage"].forEach(function (sId) {
                var oVizFrame = oView.byId(sId);
                if (!oVizFrame) { return; }

                var oPopover = new sap.viz.ui5.controls.Popover();
                oPopover.connect(oVizFrame.getVizUid());

                oVizFrame.setVizProperties({
                    valueAxis: {
                        label: { formatString: ChartFormatter.DefaultPattern.SHORTFLOAT }
                    }
                });
            });

            try {
                // Fixed Reference here to match XML
                var oHana = oView.byId("idHanaUsage");
                var oLabels = oChartModel.getProperty("/hanaStorageConfig/labels");
                var aRows = oChartModel.getProperty("/hanaStorage");

                var aValueFeeds = oLabels ? Object.keys(oLabels).map(function (k) { return oLabels[k]; }).filter(Boolean) : [];

                if (oHana && aValueFeeds.length && aRows && aRows.length) {
                    oHana.removeAllFeeds();
                    oHana.addFeed(new FeedItem({ uid: "valueAxis", type: "Measure", values: aValueFeeds }));
                    oHana.addFeed(new FeedItem({ uid: "categoryAxis", type: "Dimension", values: ["Date"] }));
                }
            } catch (oError) {
                console.error("Error initializing HANA storage chart feeds:", oError);
            }
        },

        _onRouteMatched: async function () {
            this.getOwnerComponent().getModel("globalModel").setProperty("/selectedKey", "UsageAnalytics");

            var oRange = this._getCurrentMonthRange();
            var oDDR = this.byId("idAnalyticsDateRangeFilter");

            if (oDDR) {
                // Correct API for DateRangeSelection
                oDDR.setDateValue(oRange.fromDate);
                oDDR.setSecondDateValue(oRange.toDate);
            }

            await this._loadChartData(oRange.from, oRange.to);

            if (typeof this.getSettingsData === "function") {
                this.getSettingsData().catch(function (err) { /* silent log */ });
            }
        },

        _loadChartData: async function (sFrom, sTo) {
            try {
                this.getView().setBusy(true);
                var oData = await this._getChartData(sFrom, sTo);
                oData = this._normalizeHanaStorage(oData);
                this.getView().getModel("chart").setData(oData || {});
                this._initVizFrames();
            } catch (err) {
                // Removed deprecated jQuery.sap.log.error
                console.error("Usage analytics load failed", err);
            } finally {
                this.getView().setBusy(false);
            }
        },

        _getChartData: async function (sFrom, sTo) {
            var oRange = this._getCurrentMonthRange();
            var oModel = this.getOwnerComponent().getModel("AdminModel");
            var oContext = oModel.bindContext("/getUsageAnalytics(...)");

            oContext.setParameter("fromDate", sFrom || oRange.from);
            oContext.setParameter("toDate", sTo || oRange.to);

            await oContext.execute();
            return oContext.getBoundContext().getObject();
        },

        onFilterChange: function (oEvent) {
            var oParams = oEvent.getParameters();

            if (!oParams.valid) {
                console.log("Invalid date range entered");
                return;
            }

            var oDateRangeSelection = oEvent.getSource();
            var oFromDate = oDateRangeSelection.getDateValue();
            var oToDate = oDateRangeSelection.getSecondDateValue();

            if (!oFromDate) {
                // Cleared -> fall back to current month
                console.log("Date range cleared, reverting to current month");
                var oRange = this._getCurrentMonthRange();
                this._loadChartData(oRange.from, oRange.to);
                return;
            }

            // If the user selects a single day, the second date might be null
            if (!oToDate) {
                oToDate = oFromDate;
            }

            // Prevent future dates
            var oToday = new Date();
            oToday.setHours(0, 0, 0, 0);

            if (oToDate > oToday) {
                oToDate = new Date(oToday);
            }

            this._loadChartData(this._formatDate(oFromDate), this._formatDate(oToDate));
        }
    });
});