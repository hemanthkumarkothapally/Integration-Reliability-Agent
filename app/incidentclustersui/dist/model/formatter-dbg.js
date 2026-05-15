sap.ui.define([], function () {
 
    "use strict";
 
    return {
 
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
 
        }
    };
 
});
 