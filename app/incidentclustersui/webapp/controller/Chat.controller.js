sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/FormattedText",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Panel",
    "sap/m/Text",
    "sap/m/Label",
    "sap/m/Avatar",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/f/library"
], function (Controller, FormattedText, VBox, HBox, Panel, Text, Label, Avatar, JSONModel, MessageBox, fioriLibrary) {
    "use strict";

    return Controller.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Chat", {

        onInit: function () {


            var oChatInput = this.byId("chatInput1");
            if (oChatInput) {
                oChatInput.attachBrowserEvent("keydown", function (oEvent) {
                    if (oEvent.key === "Enter" && !oEvent.shiftKey) {
                        oEvent.preventDefault();
                        var sValue = oChatInput.getValue().trim();
                        if (sValue) {
                            this.onPost(sValue); // Pass the string
                            oChatInput.setValue("");
                        }
                    }
                }.bind(this));
            };
            const oRouter =
                this.getOwnerComponent().getRouter();

            oRouter.getRoute("RouteIC")
                .attachPatternMatched(function () {
                    this._resetToWelcomePage();
                    this.onBackPress();
                }, this);
            this.getView().setModel(new JSONModel({ currentConversationId: null }), "appView");
            this._resetToWelcomePage();
        },

        onBackPress: function () {
            let oFCL = this.getView().getParent().getParent();
            if (oFCL) {
                oFCL.setLayout(sap.f.LayoutType.OneColumn);
            }
            console.log("Closing chat side panel");
        },

        onToggleClusterData: function (oEvent) {
            var oAppModel = this.getView().getModel("appView");

            // Read the current state directly from the model
            var bCurrentState = oAppModel.getProperty("/clusterDataEnabled");

            // Toggle the value (true becomes false, false becomes true)
            oAppModel.setProperty("/clusterDataEnabled", !bCurrentState);

            console.log("Cluster data active:", !bCurrentState);
        },

        _resetToWelcomePage: function () {
            this.getView().getModel("appView").setProperty("/currentConversationId", null);
            this.getView().getModel("appView").setProperty("/currentConversationTitle", "New Chat");
            this.getView().getModel("appView").setProperty("/clusterDataEnabled", true);
            this.byId("historyList").removeSelections(true);;
            this.byId("historyPopover").close();
            this.byId("chatContainer").removeAllItems();
            this.byId("welcomePage").setVisible(true);

        },

        onNewChat() {
            this._resetToWelcomePage();
        },

        onConversationSelect: function (oEvent) {
            let oListItem = oEvent.getParameter("listItem");
            let oCtx = oListItem.getBindingContext("chatModel");
            let sKey = oCtx.getProperty("ID");
            console.log("Selected conversation ID:", sKey);
            let oPopover = this.byId("historyPopover"); // Ensure this ID matches your view/fragment
            if (oPopover) {
                oPopover.close();
            }
            let sTitle = oCtx.getProperty("title");
            this.getView().getModel("appView").setProperty("/currentConversationTitle", sTitle);
            var oAppModel = this.getView().getModel("appView");
            oAppModel.setProperty("/currentConversationTitle", sTitle);
            oAppModel.setProperty("/clusterDataEnabled", false);
            this._loadConversationMessages(sKey);
        },

        onHistoryMenuPress(oEvent) {
            const oButton = oEvent.getSource();
            const oPopover = this.byId("historyPopover");

            oPopover.openBy(oButton);
        },

        onDeleteConversation: function () {
            let sConvId = this.getView().getModel("appView").getProperty("/currentConversationId");
            if (!sConvId) return;

            MessageBox.confirm("Are you sure you want to delete this chat? This action cannot be undone.", {
                title: "Delete Chat",
                icon: MessageBox.Icon.WARNING,
                actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.DELETE,
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.DELETE) {
                        console.log("Deleting conversation with ID:", sConvId);
                        let oModel = this.getView().getModel("chatModel");
                        let sPath = "/ChatSessions('" + sConvId + "')";
                        let oContextBinding = oModel.bindContext(sPath);
                        oContextBinding.requestObject().then(() => {
                            let oBoundContext = oContextBinding.getBoundContext();
                            oBoundContext.delete().then(() => {
                                sap.m.MessageToast.show("Chat deleted");
                                this._resetToWelcomePage();
                                oModel.refresh();
                            }).catch((oError) => {
                                sap.m.MessageToast.show("Deletion failed: " + oError.message);
                            });
                        }).catch((oError) => {
                            sap.m.MessageToast.show("Could not locate entry: " + oError.message);
                        });
                    }
                }
            });
        },

        onSuggestionPress: function (oEvent) {
            const sText = oEvent.getSource().getText();

            const oInput = this.byId("chatInput");
            oInput.setValue(sText);
        },

        onPost: async function (oEvent) {
            let sQuery;
            var oSource = oEvent.getSource ? oEvent.getSource() : null;

            if (oSource && typeof oSource.getValue === "function") {
                sQuery = oSource.getValue().trim();
            } else {
                var oInput = this.byId("chatInput1");
                sQuery = oInput ? oInput.getValue().trim() : "";
                if (oInput) oInput.setValue("");
            }

            if (!sQuery) return;
            let sCurrentConvId = this.getView().getModel("appView").getProperty("/currentConversationId");
            let oModel = this.getView().getModel("chatModel");

            if (!sCurrentConvId) {
                try {
                    sCurrentConvId = await this._executeCreateConversation(sQuery.substring(0, 20).replace(/[\r\n]+/g, " ") + "...");
                    // this._selectConversationInNav(sCurrentConvId);
                } catch (e) {
                    sap.m.MessageToast.show("Failed to create conversation");
                    return;
                }
            }
            let referenceID = null;

            // Unified approach: Check the state using your model property
            var bClusterEnabled = this.getView().getModel("appView").getProperty("/clusterDataEnabled");

            if (bClusterEnabled) {
                // Automatically reset the model state; the UI text, tooltip, and color switch instantly
                this.getView().getModel("appView").setProperty("/clusterDataEnabled", false);

                referenceID = this.getView().getModel("headerDetails").getProperty("/ID");
                let referenceName = this.getView().getModel("headerDetails").getProperty("/errorType");
                sQuery = `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px 4px 8px;border:0.5px solid #f97316;border-radius:999px;color:#c05407;">🔗 ${referenceName}</span><br /><br/>${sQuery}`;
            }

            this._appendMessage(sQuery, "user", { tokenCount: "Calculating" });
            this.byId("typingIndicator").setVisible(true);
            this._scrollToBottom();

            try {
                const oAction = oModel.bindContext("/chat(...)");
                oAction.setParameter("conversationId", sCurrentConvId);
                oAction.setParameter("referenceID", referenceID);
                oAction.setParameter("userMessage", sQuery);

                await oAction.execute();
                const oResult = oAction.getBoundContext().getObject();
                this._updateUserTokenCount(oResult.inputTokens);
                this._appendMessage(oResult.content, "assistant", oResult, true);
                this._updateTotalSessionTokens();
            } catch (oError) {
                console.error("Chat action failed", oError);
                this._appendMessage("Sorry, I encountered an error processing your request.", "assistant");
            } finally {
                this.byId("typingIndicator").setVisible(false);
                this._scrollToBottom();
            }
        },

        _executeCreateConversation: function (sTitle) {
            sap.ui.core.BusyIndicator.show(100);
            return new Promise((resolve, reject) => {

                // 1. Explicitly get the named model 'chatModel'
                let oModel = this.getView().getModel("chatModel");

                // 2. Bind the action. If it's a top-level action, the path starts with /
                let oAction = oModel.bindContext("/createConversation(...)");


                let clusterId =  this.getView().getModel("headerDetails").getProperty("/ID");

                // 3. Set parameters
                oAction.setParameter("title", sTitle);
                if (clusterId) {
                    oAction.setParameter("clusterId", clusterId);
                }
                oAction.execute().then(() => {
                    // 3. Request the result object from the bound context
                    return oAction.getBoundContext().requestObject();
                }).then((oResult) => {
                    // 4. Extract the ID (OData V4 often wraps results in a 'value' property)
                    let sNewId = oResult.ID || (oResult.value && oResult.value.ID);

                    // 5. Update UI state
                    this.getView().getModel("appView").setProperty("/currentConversationId", sNewId)
                    this.getView().getModel("appView").setProperty("/currentConversationTitle", oResult.title);

                    this.byId("chatContainer").removeAllItems();

                    // 6. Refresh the model so the side list shows the new entry
                    oModel.refresh();

                    resolve(sNewId);
                }).catch((oError) => {

                    console.error("Conversation creation failed:", oError);
                    reject(oError);
                }).finally(() => {
                    // Hide only after the async work is done
                    sap.ui.core.BusyIndicator.hide();
                });
            });


        },

        _updateTotalSessionTokens: function () {
            // This function can be called after each message to update the total session tokens
            let oAppViewModel = this.getView().getModel("appView");
            let oModel = this.getView().getModel("chatModel");
            let sConversationId = oAppViewModel.getProperty("/currentConversationId");

            let sPath = "/ChatSessions(" + sConversationId + ")";
            let oSessionContextBinding = oModel.bindContext(sPath);

            oSessionContextBinding.requestObject().then(function (oSession) {
                if (oSession) {
                    oAppViewModel.setProperty("/currentConversationTokens", oSession.totalSessionTokenUsage);
                    console.log("Tokens loaded:", oSession.totalSessionTokenUsage);
                }
            }).catch(function (oError) {
                console.error("Failed to load session details:", oError);
            });
        },

        _loadConversationMessages: function (sConversationId) {
            console.log("Loading conversation with ID:", sConversationId);

            let oModel = this.getView().getModel("chatModel");

            this.getView().getModel("appView").setProperty("/currentConversationId", sConversationId);
            this._updateTotalSessionTokens();
            // 2. Clear container and setup view
            let oContainer = this.byId("chatContainer");
            oContainer.removeAllItems();

            if (this.byId("welcomePage")) {
                this.byId("welcomePage").setVisible(false);
            }

            // 3. Fetch Messages (Your existing code)
            let oListBinding = oModel.bindList("/Messages", null, [
                new sap.ui.model.Sorter("createdAt", false)
            ], [
                new sap.ui.model.Filter("conversation_ID", sap.ui.model.FilterOperator.EQ, sConversationId)
            ]);

            oListBinding.requestContexts(0, 100).then(function (aContexts) {
                let aMessages = aContexts.map(function (ctx) { return ctx.getObject(); });

                aMessages.sort(function (a, b) {
                    let timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    let timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

                    if (timeA === timeB) {
                        if (a.role === "user" && b.role !== "user") return -1;
                        if (a.role !== "user" && b.role === "user") return 1;
                        return 0;
                    }
                    return timeA - timeB;
                });

                aMessages.forEach(function (msg) {
                    this._appendMessage(msg.content, msg.role, msg);
                }.bind(this));

                this._scrollToBottom();
                console.log("Loaded messages:", aMessages);
            }.bind(this)).catch(function (oError) {
                console.error("Failed to load V4 messages", oError);
                sap.m.MessageToast.show("Error loading conversation history.");
            });
        },

        _updateUserTokenCount: function (iCount) {
            // Check if the reference exists and the control is still alive
            if (this._lastUserTokenStatus && !this._lastUserTokenStatus.bIsDestroyed) {
                this._lastUserTokenStatus.setText(iCount + " tokens");
            } else {
                console.warn("Could not find the last user token status control.");
            }
        },

        _appendMessage: function (sText, sSender, oData, bStream = false) {
            const oContainer = this.byId("chatContainer");

            const isAssistant = sSender === "assistant";
            if (this.byId("welcomePage")) {
                this.byId("welcomePage").setVisible(false);
            }

            let oMessageItem;


            if (!isAssistant) {
                let sTokenDisplay;

                if (oData?.tokenCount === "Calculating") {
                    // Condition 2: Still fetching
                    sTokenDisplay = "Calculating...";
                } else if (typeof oData?.tokenCount === 'number') {
                    // Condition 1: Success
                    sTokenDisplay = oData.tokenCount + " Tokens";
                } else {
                    // Condition 3: Failure or no data
                    sTokenDisplay = "No Tokens";
                }

                const oUserTokenInfo = new sap.m.ObjectStatus({
                    state: "Error",
                    text: sTokenDisplay
                });
                this._lastUserTokenStatus = oUserTokenInfo; // Store reference for later updates
                const oUserAvatar = new sap.m.Avatar({
                    src: "sap-icon://person",
                    displaySize: sap.m.AvatarSize.XS,
                    backgroundColor: sap.m.AvatarColor.Accent1
                });

                const oUserText = new sap.m.FormattedText({
                    htmlText: `${bStream ? '' : sText}`
                });

                oMessageItem = new sap.m.VBox({
                    alignItems: sap.m.FlexAlignItems.End,
                    width: "100%",
                    items: [
                        new sap.m.HBox({
                            width: "100%",
                            justifyContent: sap.m.FlexJustifyContent.End,
                            alignItems: sap.m.FlexAlignItems.Start,
                            fitContainer: false,
                            items: [
                                // Wrapped Text inside layout panel container to retain structural width
                                new sap.m.VBox({
                                    items: [oUserText, oUserTokenInfo.addStyleClass("sapUiTinyMarginTop")]
                                }).addStyleClass("userChatBubbleNew sapUiSmallMarginEnd"),
                                oUserAvatar
                            ]
                        }).addStyleClass("sapUiTinyMargin")
                    ]
                });
            } else {

                console.log("AI response data for message item:", oData);

                const oAiTokenInfo =
                    new sap.m.ObjectStatus({
                        state: "Information",
                        text: (oData.tokenCount || "No") + " Tokens"
                    });

                const oAiAvatar = new sap.m.Avatar({
                    src: "sap-icon://ai",
                    displaySize: sap.m.AvatarSize.XS
                });

                const oTextControl = new sap.m.FormattedText({
                    htmlText: `${bStream ? '' : sText}`
                });

                oMessageItem = new sap.m.VBox({
                    alignItems: sap.m.FlexAlignItems.Start,
                    width: "100%",
                    items: [
                        new sap.m.HBox({
                            width: "100%",
                            justifyContent: sap.m.FlexJustifyContent.Start,
                            alignItems: sap.m.FlexAlignItems.Start,
                            fitContainer: false,
                            items: [
                                oAiAvatar,
                                new sap.m.VBox({
                                    items: [oTextControl,
                                        oAiTokenInfo.addStyleClass("sapUiTinyMarginTop")]
                                }).addStyleClass("aiChatBubbleNew sapUiSmallMarginBegin")
                            ]
                        }).addStyleClass("sapUiTinyMarginBegin"),

                    ]
                });


                if (bStream) {
                    let i = 0;
                    let sCurrentText = "";
                    const streamInterval = setInterval(() => {
                        sCurrentText += sText.charAt(i);
                        oTextControl.setHtmlText(`<b>CandyAssist</b><br/>${sCurrentText}`);
                        this._scrollToBottom();
                        i++;
                        if (i >= sText.length) {
                            clearInterval(streamInterval);
                        }
                    }, 5);
                }
            }

            oContainer.addItem(oMessageItem);

            if (!bStream) {
                this._scrollToBottom();
            }
        },

        _scrollToBottom: function () {
            const oScroll = this.byId("chatScroll");
            setTimeout(() => oScroll.scrollTo(0, 10000), 100);
        },
        
    });
});