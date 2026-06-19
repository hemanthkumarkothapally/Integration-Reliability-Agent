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
                return "#107e3e"; // Green (Healthy)
            }

            switch (sSeverity.toUpperCase()) {
                case "CRITICAL":
                    return "#b6121f"; // Red    (~Indication02)
                case "HIGH":
                    return "#e9730c"; // Orange (~Indication03)
                case "MEDIUM":
                    return "#481cff"; // Purple (~Indication07)

                case "LOW":
                    return "#0a6ed1"; // Blue   (~Indication05)
                case "HEALTHY":
                    return "#107e3e"; // Green  (~Indication04)
                default:
                    return "#107e3e"; // Green
            }
        },

        formatSeverityState: function (sSeverity) {

            switch (sSeverity) {

                case "CRITICAL":
                    return "Indication02"; // red

                case "HIGH":
                    return "Indication03"; // orange

                case "MEDIUM":
                    return "Indication07"; // purple

                case "LOW":
                    return "Information"; // blue

                case "HEALTHY":
                    return "Indication04"; // green

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
            // Treat null/undefined/empty as zero, but keep a real 0 and negatives working
            if (iNum === null || iNum === undefined || iNum === "") {
                return "0";
            }

            let fNum = parseFloat(iNum);
            if (isNaN(fNum)) {
                return "0";
            }

            let sSign = fNum < 0 ? "-" : "";
            let fAbs = Math.abs(fNum);

            // Values below 1 (but not exactly 0): show the full value, no suffix
            if (fAbs > 0 && fAbs < 1) {
                return sSign + fAbs.toString();
            }

            // Largest first; extend the list to go further (Q = quadrillion, etc.)
            let aTiers = [
                { value: 1e12, suffix: "T" },
                { value: 1e9, suffix: "B" },
                { value: 1e6, suffix: "M" },
                { value: 1e3, suffix: "k" }
            ];

            for (let i = 0; i < aTiers.length; i++) {
                if (fAbs >= aTiers[i].value) {
                    // Round to 2 decimals, then drop only trailing zeros: 1.50 -> 1.5, 2.00 -> 2
                    let sScaled = String(parseFloat((fAbs / aTiers[i].value).toFixed(2)));
                    return sSign + sScaled + aTiers[i].suffix;
                }
            }

            // Between 1 and 999 — keep meaningful decimals, drop trailing zeros
            return sSign + String(parseFloat(fAbs.toFixed(2)));
        },

        // Between 1 and

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
