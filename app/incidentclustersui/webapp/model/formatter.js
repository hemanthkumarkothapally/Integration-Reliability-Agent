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
 
        }
 
    };
 
});