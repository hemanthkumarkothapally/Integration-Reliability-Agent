// webapp/controller/IRALogo.js
sap.ui.define(["sap/ui/core/Control"], function (Control) {
    "use strict";

    const DARK_THEMES = ["dark", "hcb", "belize_plus"];

    function isDark() {
        const t = sap.ui.getCore().getConfiguration().getTheme();
        return DARK_THEMES.some(d => t.includes(d));
    }

    function svg(s) {
        const d = isDark();

        // Transparent outer box ensures perfect header integration
        const box = "transparent";
        const circle = d ? "#27272A" : "#F4F4F5";
        const hole = d ? "#18181B" : "#FFFFFF"; // Matches standard header BG

        // Colors based on your image (Fiori Blue & Amber)
        const intBlue = "#0070F2"; // Standard SAP Blue
        const relAmber = "#F59E0B"; // Rich Amber

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" width="${Math.round(s * 1.5)}" height="${s}">
      <rect width="60" height="40" rx="10" fill="${box}"/>
      <circle cx="30" cy="20" r="14" fill="${circle}"/>
      
      <g fill="none" stroke="${intBlue}" stroke-width="2.5" stroke-linecap="round">
        <line x1="12" y1="10" x2="25" y2="20"/>
        <line x1="12" y1="20" x2="25" y2="20"/>
        <line x1="12" y1="30" x2="25" y2="20"/>
      </g>
      <circle cx="25" cy="20" r="4.5" fill="${intBlue}"/>
      <circle cx="25" cy="20" r="2" fill="${hole}"/>
      
      <path d="M31,20 L34,15.5 L39,20 L34,24.5 Z" fill="${relAmber}"/>
      <path d="M31,20 L34,17 L37,20 L34,23 Z" fill="#FCD34D"/>
      
      <g stroke="${relAmber}" stroke-width="1.8" stroke-linecap="round">
        <line x1="34" y1="11.5" x2="34" y2="10.5"/>
        <line x1="34" y1="28.5" x2="34" y2="29.5"/>
        <line x1="41" y1="15" x2="42.5" y2="13.5"/>
        <line x1="41" y1="25" x2="42.5" y2="26.5"/>
      </g>
      
      <g fill="none" stroke="${relAmber}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="39" y1="20" x2="48" y2="20"/>
        <polyline points="43,15.5 49,20 43,24.5"/>
      </g>
    </svg>`;
    }

    return Control.extend(
        "com.cytechies.integration.reliability.incidentclustersui.controller.IRALogo", {

        metadata: {
            properties: { size: { type: "int", defaultValue: 36 } },
            events: {
                // Expose a standard UI5 event
                press: {}
            }
        },

        init() {
            this._fnTheme = () => this.invalidate();
            sap.ui.getCore().attachThemeChanged(this._fnTheme);
        },

        renderer(rm, ctrl) {
            rm.openStart("div", ctrl);
            rm.style("display", "inline-flex");
            rm.style("align-items", "center");
            rm.style("justify-content", "center");
            rm.style("margin", "0 4px 0 0");   // <-- was "0 8px", now tight left
            rm.style("cursor", "pointer"); // Add pointer for button UX
            rm.style("transition", "transform 0.15s ease, opacity 0.15s ease");

            // Accessibility attributes
            rm.attr("role", "button");
            rm.attr("tabindex", "0");
            rm.attr("title", "Toggle Side Navigation");

            rm.openEnd();
            rm.unsafeHtml(svg(ctrl.getSize()));
            rm.close("div");
        },

        // --- Native UI5 DOM Event Handlers ---
        onclick(oEvent) {
            this.firePress();
        },

        onmouseover() {
            this.getDomRef().style.opacity = "0.85";
        },

        onmouseout() {
            this.getDomRef().style.opacity = "1";
            this.getDomRef().style.transform = "scale(1)";
        },

        onmousedown() {
            this.getDomRef().style.transform = "scale(0.88)";
            this.getDomRef().style.opacity = "0.7";
        },

        onmouseup() {
            this.getDomRef().style.transform = "scale(1)";
            this.getDomRef().style.opacity = "1";
        },

        // Keyboard support for accessibility (Enter or Space to click)
        onkeydown(oEvent) {
            if (oEvent.key === "Enter" || oEvent.key === " ") {
                oEvent.preventDefault();
                this.getDomRef().style.transform = "scale(0.88)";
            }
        },

        onkeyup(oEvent) {
            if (oEvent.key === "Enter" || oEvent.key === " ") {
                this.getDomRef().style.transform = "scale(1)";
                this.firePress();
            }
        },

        exit() {
            sap.ui.getCore().detachThemeChanged(this._fnTheme);
        }
    });
});