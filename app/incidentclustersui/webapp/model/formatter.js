sap.ui.define([], function () {

    "use strict";

    return {


        formatSeverityIcon: function (sSeverity) {
            if (!sSeverity) {
                return "";
            }

            switch (sSeverity.toUpperCase()) {
                case "CRITICAL":
                    return "sap-icon://error";       // The white 'X' on red
                case "HIGH":
                    return "sap-icon://warning";     // The warning triangle
                case "MEDIUM":
                    return "sap-icon://information"; // The 'i' icon
                case "LOW":
                    return "sap-icon://incident";    // The green question mark/incident icon
                default:
                    return "sap-icon://process";     // Fallback icon
            }
        },

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

         formatButtonState: function (sSeverity) {

            switch (sSeverity) {

                case "CRITICAL":
                    return "Reject";

                case "HIGH":
                    return "Attention";

                case "MEDIUM":
                    return "Neutral";

                case "LOW":
                    return "Accept";

                default:
                    return "None";
            }

        },
        formatButtonText: function (sSeverity) {

            switch (sSeverity) {

                case "CRITICAL":
                    return "Critical";

                case "HIGH":
                    return "High";

                case "MEDIUM":
                    return "Medium";

                case "LOW":
                    return "Low";

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
