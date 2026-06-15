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
                case "HEALTHY":
                    return "sap-icon://sys-enter-2"; // The 'enter' icon
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
                    return "#b6121f"; // Red
                case "HIGH":
                    return sap.ui.core.IconColor.Critical; // Orange
                case "MEDIUM":
                    return "#0066cc";  // Blue (Theme Neutral)
                case "LOW":
                    return sap.ui.core.IconColor.Positive; // Green
                case "HEALTHY":
                    return "#6A6D70"; // Gray (Custom color for Healthy)
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

                case "HEALTHY":
                    return "Ghost";

            }

        },

        formatRoles: function (aRoles) {
            if (!aRoles || !aRoles.length) {
                return "";
            }
            return aRoles.join(" · ");
        },
        formatInitials: function (sName) {
            if (!sName) {
                return "";
            }
            var aParts = sName.trim().split(/\s+/);
            if (aParts.length > 1) {
                return (aParts[0][0] + aParts[aParts.length - 1][0]).toUpperCase();
            }
            return sName.substring(0, 2).toUpperCase();
        },
        formatLargeNumber: function (iNum) {
            // if (!iNum) {
            //     return "0";
            // }
            // For Billions
            if (iNum >= 1000000000) {
                return (iNum / 1000000000).toFixed(0) + "B";
            }
            // For Millions
            if (iNum >= 1000000) {
                return (iNum / 1000000).toFixed(0) + "M";
            }
            // For Thousands
            if (iNum >= 1000) {
                return (iNum / 1000).toFixed(0) + "k";
            }

            return iNum.toString();
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
                case "HEALTHY":
                    return "Healthy";


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


            }

        },
        formatStatusState: function (sStatus) {

            switch (sStatus) {

                case "OPEN":
                    return "Warning";

                case "RESOLVED":
                    return "Success";



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

        formatArtifactCount: function (aArtifacts) {
            if (!aArtifacts || !Array.isArray(aArtifacts)) {
                return 0;
            }
            return aArtifacts.length;
        }



    };

});
