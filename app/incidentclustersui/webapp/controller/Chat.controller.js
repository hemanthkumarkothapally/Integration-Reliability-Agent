sap.ui.define([
    "./BaseController",
    "sap/m/FormattedText",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/ObjectStatus",
    "sap/m/Avatar",
    "sap/m/AvatarSize",
    "sap/m/AvatarColor",
    "sap/m/MessageBox",
    "sap/m/FlexJustifyContent",
    "sap/m/FlexAlignItems",
    "sap/f/library"
], function (BaseController, FormattedText, VBox, HBox, ObjectStatus, Avatar, AvatarSize, AvatarColor, MessageBox,FlexJustifyContent, FlexAlignItems, fioriLibrary) {
    "use strict";

    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Chat", {

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
            const oRouter = this.getRouter();

            oRouter.getRoute("RouteIC")
                .attachPatternMatched(function () {
                    this._resetToWelcomePage();
                    this.onBackPress();
                }, this);
            // this.getView().setModel(new JSONModel({ currentConversationId: null }), "appView");
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
            var oJsonModel = this.getModel("chatJSONModel");
            var bCurrentState = oJsonModel.getProperty("/clusterDataEnabled");
            oJsonModel.setProperty("/clusterDataEnabled", !bCurrentState);

            console.log("Cluster data active:", !bCurrentState);
        },

        _resetToWelcomePage: function () {
            var oJsonModel = this.getModel("chatJSONModel");

            oJsonModel.setProperty("/currentConversationId", null);
            oJsonModel.setProperty("/currentConversationTitle", "New Chat");
            oJsonModel.setProperty("/clusterDataEnabled", true);
            this.byId("historyList").removeSelections(true);;
            this.byId("historyPopover").close();
            this.byId("chatContainer").removeAllItems();
            this.byId("welcomePage").setVisible(true);

        },

        onNewChat() {
            this._resetToWelcomePage();
        },

        onConversationSelect: function (oEvent) {
            this.showBusy();
            debugger;
            let oListItem = oEvent.getParameter("listItem");
            let oCtx = oListItem.getBindingContext("chatModel");
            let sKey = oCtx.getProperty("ID");
            console.log("Selected conversation ID:", sKey);
            let oPopover = this.byId("historyPopover"); // Ensure this ID matches your view/fragment
            if (oPopover) {
                oPopover.close();
            }
            let sTitle = oCtx.getProperty("title");
            var oJsonModel = this.getModel("chatJSONModel");
            oJsonModel.setProperty("/currentConversationTitle", sTitle);
            oJsonModel.setProperty("/clusterDataEnabled", false);
            this._loadConversationMessages(sKey);
            this.hideBusy();
        },

        onHistoryMenuPress(oEvent) {
            const oButton = oEvent.getSource();
            const oPopover = this.byId("historyPopover");
            oPopover.openBy(oButton);
        },

        onDeleteConversation: function () {
            let sConvId = this.getModel("chatJSONModel").getProperty("/currentConversationId");
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
                                this.showToast("Chat deleted");
                                this._resetToWelcomePage();
                                oModel.refresh();
                            }).catch((oError) => {
                                this.showToast("Deletion failed: " + oError.message);
                            });
                        }).catch((oError) => {
                            this.showToast("Could not locate entry: " + oError.message);
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
            let oModel = this.getView().getModel("chatModel");
            let oJsonModel = this.getModel("chatJSONModel");
            let sCurrentConvId = oJsonModel.getProperty("/currentConversationId");
            let bClusterEnabled = oJsonModel.getProperty("/clusterDataEnabled");

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


            if (!sCurrentConvId) {
                try {
                    sCurrentConvId = await this._executeCreateConversation(sQuery.substring(0, 20).replace(/[\r\n]+/g, " ") + "...");
                } catch (e) {
                    this.showToast("Failed to create conversation");
                    return;
                }
            }
            let referenceID = null;
            if (bClusterEnabled) {
                oJsonModel.setProperty("/clusterDataEnabled", false);
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
            this.showBusy(100)
            return new Promise((resolve, reject) => {
                let oModel = this.getView().getModel("chatModel");
                let oJsonModel = this.getModel("chatJSONModel");
                let oAction = oModel.bindContext("/createConversation(...)");
                let clusterId = this.getView().getModel("headerDetails").getProperty("/ID");

                // 3. Set parameters
                oAction.setParameter("title", sTitle);
                if (clusterId) {
                    oAction.setParameter("clusterId", clusterId);
                }
                oAction.execute().then(() => {
                    return oAction.getBoundContext().requestObject();
                }).then((oResult) => {
                    let sNewId = oResult.ID || (oResult.value && oResult.value.ID);
                    oJsonModel.setProperty("/currentConversationId", sNewId);
                    oJsonModel.setProperty("/currentConversationTitle", oResult.title);
                    this.byId("chatContainer").removeAllItems();
                    oModel.refresh();
                    resolve(sNewId);
                }).catch((oError) => {

                    console.error("Conversation creation failed:", oError);
                    reject(oError);
                }).finally(() => {
                    this.hideBusy();
                });
            });


        },

        _updateTotalSessionTokens: function () {
            let oJsonModel = this.getModel("chatJSONModel");
            let oModel = this.getView().getModel("chatModel");
            let sConversationId = oJsonModel.getProperty("/currentConversationId");

            let sPath = "/ChatSessions(" + sConversationId + ")";
            let oSessionContextBinding = oModel.bindContext(sPath);

            oSessionContextBinding.requestObject().then(function (oSession) {
                if (oSession) {
                    oJsonModel.setProperty("/currentConversationTokens", oSession.totalSessionTokenUsage);
                    console.log("Tokens loaded:", oSession.totalSessionTokenUsage);
                }
            }).catch(function (oError) {
                console.error("Failed to load session details:", oError);
            });
        },

        _loadConversationMessages: function (sConversationId) {
            console.log("Loading conversation with ID:", sConversationId);
            this.showBusy();

            let oModel = this.getView().getModel("chatModel");
            let oJsonModel = this.getModel("chatJSONModel");

            oJsonModel.setProperty("/currentConversationId", sConversationId);
            this._updateTotalSessionTokens();
            let oContainer = this.byId("chatContainer");
            oContainer.removeAllItems();

            if (this.byId("welcomePage")) {
                this.byId("welcomePage").setVisible(false);
            }

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
                this.showToast("Error loading conversation history.");
            });
            this.hideBusy();
        },

        _updateUserTokenCount: function (iCount) {
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

                const oUserTokenInfo = new ObjectStatus({
                    state: "Error",
                    text: sTokenDisplay
                });
                this._lastUserTokenStatus = oUserTokenInfo; // Store reference for later updates
                const oUserAvatar = new Avatar({
                    src: "sap-icon://person",
                    displaySize: AvatarSize.XS,
                    backgroundColor: AvatarColor.Accent1
                });

                const oUserText = new FormattedText({
                    htmlText: `${bStream ? '' : sText}`
                });

                oMessageItem = new VBox({
                    alignItems: FlexAlignItems.End,
                    width: "100%",
                    items: [
                        new HBox({
                            width: "100%",
                            justifyContent: FlexJustifyContent.End,
                            alignItems: FlexAlignItems.Start,
                            fitContainer: false,
                            items: [
                                // Wrapped Text inside layout panel container to retain structural width
                                new VBox({
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
                    new ObjectStatus({
                        state: "Information",
                        text: (oData.tokenCount || "No") + " Tokens"
                    });

                const oAiAvatar = new Avatar({
                    src: "sap-icon://ai",
                    displaySize: AvatarSize.XS
                });

                const oTextControl = new FormattedText({
                    htmlText: `${bStream ? '' : sText}`
                });

                oMessageItem = new VBox({
                    alignItems: FlexAlignItems.Start,
                    width: "100%",
                    items: [
                        new HBox({
                            width: "100%",
                            justifyContent: FlexJustifyContent.Start,
                            alignItems: FlexAlignItems.Start,
                            fitContainer: false,
                            items: [
                                oAiAvatar,
                                new VBox({
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