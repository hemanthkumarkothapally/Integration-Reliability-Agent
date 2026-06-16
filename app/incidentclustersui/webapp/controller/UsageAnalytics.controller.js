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
            this.getView().setBusy(true);
            Format.numericFormatter(ChartFormatter.getInstance());

            // set empty model first; fill it after the async call resolves
            this.getView().setModel(new JSONModel({}), "chart");

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteUsageAnalytics").attachPatternMatched(
                this._onRouteMatched,
                this
            );
        },

        _getCurrentMonthRange: function () {
            var oNow = new Date();
            var oFrom = new Date(oNow.getFullYear(), oNow.getMonth(), 1);
            var oTo = oNow; // "this month so far"; use new Date(y, m+1, 0) for full month
            var fmt = function (d) {
                var m = String(d.getMonth() + 1).padStart(2, "0");
                var day = String(d.getDate()).padStart(2, "0");
                return d.getFullYear() + "-" + m + "-" + day;
            };
            return { from: fmt(oFrom), to: fmt(oTo), fromDate: oFrom, toDate: oTo };
        },

        /**
         * Normalize HANA storage rows so every active tenant key exists on every
         * row as a Number. Sparse/missing keys break the stacked_column VizFrame,
         * so we backfill them with 0.
         */
        _normalizeHanaStorage: function (oData) {
            if (!oData) { return oData; }

            var oLabels = oData.hanaStorageConfig && oData.hanaStorageConfig.labels;
            var aRows = oData.hanaStorage;
            if (!oLabels || !Array.isArray(aRows)) { return oData; }

            // Only the tenant keys that actually have a (non-empty) label are charted.
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

            ["idSeverityDonut", "idIncidentTrend", "idTokenUsage", "idHanaStorage"]
                .forEach(function (sId) {
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

            // HANA stacked column feeds — only build if we actually have labels + rows
            try {
                var oHana = oView.byId("idHanaStorage");
                var oLabels = oChartModel.getProperty("/hanaStorageConfig/labels");
                var aRows = oChartModel.getProperty("/hanaStorage");

                // Feed values MUST match the MeasureDefinition names in the view,
                // which are the label strings (e.g. "IRA Schema").
                var aValueFeeds = oLabels ? Object.keys(oLabels)
                    .map(function (k) { return oLabels[k]; })
                    .filter(Boolean) : [];

                if (oHana && aValueFeeds.length && aRows && aRows.length) {
                    // clear any feeds added on a previous run to avoid duplicates
                    oHana.removeAllFeeds();

                    oHana.addFeed(new FeedItem({
                        uid: "valueAxis",
                        type: "Measure",
                        values: aValueFeeds
                    }));
                    oHana.addFeed(new FeedItem({
                        uid: "categoryAxis",
                        type: "Dimension",
                        values: ["Date"]
                    }));
                }
            }
            catch (oError) {
                console.error("Error initializing HANA storage chart feeds:", oError);
            }
        },

        _onRouteMatched: async function (oEvent) {
            this.getOwnerComponent().getModel("globalModel").setProperty("/selectedKey", "UsageAnalytics");

            var oRange = this._getCurrentMonthRange();

            // default the DynamicDateRange control to this month.
            // Control id in the view is "idAnalyticsDateRangeFilter".
            var oDDR = this.byId("idAnalyticsDateRangeFilter");
            if (oDDR) {
                oDDR.setValue({
                    operator: "DATERANGE",
                    values: [oRange.fromDate, oRange.toDate]
                });
            }

            await this._loadChartData(oRange.from, oRange.to);

            this.getSettingsData().catch(function (err) { /* log */ });
        },

        /**
         * Loads chart data for the given range, normalizes it, pushes it to the
         * "chart" model and (re)builds the VizFrame feeds.
         */
        _loadChartData: async function (sFrom, sTo) {
            try {
                this.getView().setBusy(true);
                var oData = await this._getChartData(sFrom, sTo);
                oData = this._normalizeHanaStorage(oData);
                this.getView().getModel("chart").setData(oData || {});
                this._initVizFrames();          // build feeds AFTER data is present
            } catch (err) {
                jQuery.sap.log.error("Usage analytics load failed", err);
            } finally {
                this.getView().setBusy(false);
            }
        },

        /* =========================================================== */
        /* data                                                        */
        /* =========================================================== */

        _getChartData: async function (sFrom, sTo) {
            var oRange = this._getCurrentMonthRange();
            var oModel = this.getOwnerComponent().getModel("AdminModel");
            var oContext = oModel.bindContext("/getUsageAnalytics(...)");
            oContext.setParameter("fromDate", sFrom || oRange.from);
            oContext.setParameter("toDate", sTo || oRange.to);
            await oContext.execute();
            var oData = oContext.getBoundContext().getObject();
            console.log("Usage analytics data: ", oData);
            return oData;
        },

        /* =========================================================== */
        /* filter                                                      */
        /* =========================================================== */

        onFilterChange: function (oEvent) {
            var oParams = oEvent.getParameters();

            if (!oParams.valid) {
                console.log("Invalid date range entered");
                return;
            }

            var oValue = oParams.value;

            if (!oValue) {
                // cleared -> fall back to current month
                console.log("Date range cleared, reverting to current month");
                var oRange = this._getCurrentMonthRange();
                this._loadChartData(oRange.from, oRange.to);
                return;
            }

            var aDates = sap.m.DynamicDateRange.toDates(oValue);
            var oFromDate = aDates[0];
            var oToDate = aDates[1];

            var fmt = function (d) {
                var m = String(d.getMonth() + 1).padStart(2, "0");
                var day = String(d.getDate()).padStart(2, "0");
                return d.getFullYear() + "-" + m + "-" + day;
            };

            this._loadChartData(fmt(oFromDate), fmt(oToDate));
        }

    });
});