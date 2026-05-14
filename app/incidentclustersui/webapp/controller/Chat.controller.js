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
            this.getView().setModel(new JSONModel({ currentConversationId: null }), "appView");
            this._resetToWelcomePage();
        },
        onBackPress() {
            var oFCL = this.oView.getParent().getParent();
            oFCL.setLayout(sap.f.LayoutType.OneColumn);
            console.log("Closing chat side panel");
        },
        _resetToWelcomePage: function () {
            this.getView().getModel("appView").setProperty("/currentConversationId", null);
            this.getView().getModel("appView").setProperty("/currentConversationTitle", "New Chat");
            this.byId("historyList").removeSelections(true);;
            this.byId("historyPopover").close();
            this.byId("chatContainer").removeAllItems();
            this.byId("welcomePage").setVisible(true);

        },

        onNewChat() {
            this._resetToWelcomePage();
        },

        onConversationSelect: function (oEvent) {
            var oListItem = oEvent.getParameter("listItem");
            var oCtx = oListItem.getBindingContext("chatModel");
            var sKey = oCtx.getProperty("ID");
            console.log("Selected conversation ID:", sKey);
            var sTitle = oCtx.getProperty("title");
            this.getView().getModel("appView").setProperty("/currentConversationTitle", sTitle);
            this._loadConversationMessages(sKey);
        },
        onHistoryMenuPress(oEvent) {
            const oButton = oEvent.getSource();
            const oPopover = this.byId("historyPopover");

            oPopover.openBy(oButton);
        },

        onDeleteConversation: function () {
            var sConvId = this.getView().getModel("appView").getProperty("/currentConversationId");
            if (!sConvId) return;

            MessageBox.confirm("Are you sure you want to delete this chat? This action cannot be undone.", {
                title: "Delete Chat",
                icon: MessageBox.Icon.WARNING,
                actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.DELETE,
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.DELETE) {
                        console.log("Deleting conversation with ID:", sConvId);
                        var oModel = this.getView().getModel("chatModel");
                        var sPath = "/ChatSessions('" + sConvId + "')";
                        var oContextBinding = oModel.bindContext(sPath);
                        oContextBinding.requestObject().then(() => {
                            var oBoundContext = oContextBinding.getBoundContext();
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
            const sQuery = oEvent.getParameter("value").trim();
            if (!sQuery) return;

            let sCurrentConvId = this.getView().getModel("appView").getProperty("/currentConversationId");
            var oModel = this.getView().getModel("chatModel");

            if (!sCurrentConvId) {
                try {
                    sCurrentConvId = await this._executeCreateConversation(sQuery.substring(0, 20).replace(/[\r\n]+/g, " ") + "...");
                    // this._selectConversationInNav(sCurrentConvId);
                } catch (e) {
                    sap.m.MessageToast.show("Failed to create conversation");
                    return;
                }
            }

            this._appendMessage(sQuery, "user");
            this.byId("typingIndicator").setVisible(true);
            this._scrollToBottom();

            try {
                const oAction = oModel.bindContext("/chat(...)");
                oAction.setParameter("conversationId", sCurrentConvId);
                oAction.setParameter("userMessage", sQuery);

                await oAction.execute();
                const oResult = oAction.getBoundContext().getObject();

                this._appendMessage(oResult.content, "assistant", oResult, true);

            } catch (oError) {
                console.error("Chat action failed", oError);
                this._appendMessage("Sorry, I encountered an error processing your request.", "assistant");
            } finally {
                this.byId("typingIndicator").setVisible(false);
                this._scrollToBottom();
            }
        },

        _executeCreateConversation: function (sTitle) {
            return new Promise((resolve, reject) => {
                // 1. Explicitly get the named model 'chatModel'
                var oModel = this.getView().getModel("chatModel");

                // 2. Bind the action. If it's a top-level action, the path starts with /
                var oAction = oModel.bindContext("/createConversation(...)");

                oAction.setParameter("title", sTitle || "New Chat");

                oAction.execute().then(() => {
                    // 3. Request the result object from the bound context
                    return oAction.getBoundContext().requestObject();
                }).then((oResult) => {
                    // 4. Extract the ID (OData V4 often wraps results in a 'value' property)
                    var sNewId = oResult.ID || (oResult.value && oResult.value.ID);

                    // 5. Update UI state
                    this.getView().getModel("appView").setProperty("/currentConversationId", sNewId);
                    this.byId("chatContainer").removeAllItems();

                    // 6. Refresh the model so the side list shows the new entry
                    oModel.refresh();

                    resolve(sNewId);
                }).catch((oError) => {
                    console.error("Conversation creation failed:", oError);
                    reject(oError);
                });
            });
        },

        _loadConversationMessages: function (sConversationId) {
            console.log("Loading conversation with ID:", sConversationId);
            this.getView().getModel("appView").setProperty("/currentConversationId", sConversationId);
            var oContainer = this.byId("chatContainer");
            oContainer.removeAllItems();

            if (this.byId("welcomePage")) {
                this.byId("welcomePage").setVisible(false);
            }

            var oModel = this.getView().getModel("chatModel");

            var oListBinding = oModel.bindList("/Messages", null, [
                new sap.ui.model.Sorter("createdAt", false)
            ], [
                new sap.ui.model.Filter("conversation_ID", sap.ui.model.FilterOperator.EQ, sConversationId)
            ]);
            console.log("Chat model:", oListBinding);
            oListBinding.requestContexts(0, 100).then(function (aContexts) {
                var aMessages = aContexts.map(function (ctx) { return ctx.getObject(); });

                aMessages.sort(function (a, b) {
                    var timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    var timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

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
            }.bind(this)).catch(function (oError) {
                console.error("Failed to load V4 messages", oError);
                sap.m.MessageToast.show("Error loading conversation history.");
            });
        },

        _appendMessage: function (sText, sSender, oData, bStream = false) {
            const oContainer = this.byId("chatContainer");
            const isAssistant = sSender === "assistant";
            if (this.byId("welcomePage")) {
                this.byId("welcomePage").setVisible(false);
            }

            let oMessageItem;


            if (!isAssistant) {
                // Standard User Avatar Layout Fallback
                const oUserLabel = new sap.m.Avatar({
                    src: "sap-icon://person",
                    displaySize: sap.m.AvatarSize.XS,
                    backgroundColor: sap.m.AvatarColor.Accent1
                });

                const oUserText = new sap.m.Text({ text: sText });

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
                                    items: [oUserText]
                                }).addStyleClass("userChatBubbleNew sapUiSmallMarginEnd"),
                                oUserLabel
                            ]
                        }).addStyleClass("sapUiTinyMargin")
                    ]
                });
            } else {
                // Balanced AI Message Layout Panel
                const oAiLabel = new sap.m.Avatar({
                    src: "sap-icon://ai",
                    displaySize: sap.m.AvatarSize.XS
                });

                const oTextControl = new sap.m.FormattedText({
                    htmlText: `<b>CandyAssist</b><br/>${bStream ? '' : sText}`
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
                                oAiLabel,
                                new sap.m.VBox({
                                    items: [oTextControl]
                                }).addStyleClass("aiChatBubbleNew sapUiSmallMarginBegin")
                            ]
                        }).addStyleClass("sapUiTinyMarginBegin")
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
        }
    });
});