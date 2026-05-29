sap.ui.define([], function () {

    "use strict";

    return {
        severityIconColor: function (sSeverity) {
        if (!sSeverity) {
            return sap.ui.core.IconColor.Positive; // Green
        }
        
        switch (sSeverity.toUpperCase()) {
            case "CRITICAL":
                return sap.ui.core.IconColor.Negative; // Red
            case "HIGH":
                return sap.ui.core.IconColor.Critical; // Orange
            case "MEDIUM":
                return "#0066cc";  // Blue (Theme Neutral)
            case "LOW":
            default:
                return sap.ui.core.IconColor.Positive; // Green
        }
    },

        formatSeverityState: function (sSeverity) {

            switch (sSeverity) {

                case "CRITICAL":
                    return "Error";

                case "HIGH":
                    return "Warning";

                case "MEDIUM":
                    return "Information";

                case "LOW":
                    return "Success";

                default:
                    return "None";
            }

        },
        formatRowHighlight: function (sSeverity) {

            switch (sSeverity) {

                case "CRITICAL":
                    return "Error";

                case "HIGH":
                    return "Warning";

                case "MEDIUM":
                    return "Information";

                case "LOW":
                    return "Success";

                default:
                    return "None";
            }

        },
        formatStatusState: function (sStatus) {

            switch (sStatus) {

                case "OPEN":
                    return "Warning";

                case "RESOLVED":
                    return "Success";

                default:
                    return "None";

            }

        },
        formatDateTime: function (sDate) {

            if (!sDate) {
                return "";
            }

            const oDate =
                new Date(sDate);

            return sap.ui.core.format.DateFormat
                .getDateTimeInstance({
                    pattern: "MMM dd, yyyy, h:mm:ss a"
                })
                .format(oDate);

        },

      

    };

});
