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
    "sap/m/MessageBox"
], function (Controller, FormattedText, VBox, HBox, Panel, Text, Label, Avatar, JSONModel, MessageBox) {
    "use strict";

    return Controller.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Chat", {

        onInit: function () {
            this.getView().setModel(new JSONModel({ currentConversationId: null }), "appView");
            this._resetToWelcomePage();
        },

        _resetToWelcomePage: function () {
            var oAppViewModel = this.getView().getModel("appView");
            if (oAppViewModel) {
                oAppViewModel.setProperty("/currentConversationId", null);
                oAppViewModel.setProperty("/currentConversationTitle", "");
            }

            var oHistoryList = this.byId("historyList");
            if (oHistoryList) {
                oHistoryList.removeSelections(true);
            }

        },

        onConversationSelect: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            var sKey = oItem.getKey();

            if (sKey === "NEW_CHAT") {
                this._resetToWelcomePage();
            } else {
                var sTitle = oItem.getText();
                this.getView().getModel("appView").setProperty("/currentConversationTitle", sTitle);
                this._loadConversationMessages(sKey);
            }

            if (sap.ui.Device.system.phone) {
                this.byId("toolPage").setSideExpanded(false);
            }
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

                        var oNavList = this.byId("_IDGenNavigationList1");
                        var aItems = oNavList.getItems();

                        var oTargetItem = aItems.find(function (item) {
                            return item.getKey() === sConvId;
                        });

                        if (oTargetItem && oTargetItem.getBindingContext()) {
                            oTargetItem.getBindingContext().delete().then(() => {
                                sap.m.MessageToast.show("Chat deleted successfully.");
                                this._resetToWelcomePage();
                            }).catch((oError) => {
                                console.error("Failed to delete", oError);
                                MessageBox.error("An error occurred while deleting the chat.");
                            });
                        } else {
                            MessageBox.error("Could not find the chat context to delete.");
                        }
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
            var oModel = this.getView().getModel();

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

        onSideNavButtonPress: function () {
            var oToolPage = this.byId("toolPage");
            oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
        },

        _executeCreateConversation: function (sTitle) {
            return new Promise((resolve, reject) => {
                var oModel = this.getView().getModel();
                var oAction = oModel.bindContext("/createConversation(...)");
                oAction.setParameter("title", sTitle || "New Chat");

                oAction.execute().then(() => {
                    return oAction.getBoundContext().requestObject();
                }).then((oResult) => {
                    var sNewId = oResult.ID || (oResult.value && oResult.value.ID);
                    oModel.refresh();
                    this.getView().getModel("appView").setProperty("/currentConversationId", sNewId);
                    this.byId("chatContainer").removeAllItems();
                    resolve(sNewId);
                }).catch(reject);
            });
        },

        _selectConversationInNav: function (sId) {
            var oNavList = this.byId("_IDGenNavigationList1");
            var oBinding = oNavList.getBinding("item");
            if (oBinding) {
                oBinding.attachEventOnce("dataReceived", () => this.byId("sideNavigation").setSelectedKey(sId));
            } else {
                setTimeout(() => this.byId("sideNavigation").setSelectedKey(sId), 300);
            }
        },

        _loadConversationMessages: function (sConversationId) {
            this.getView().getModel("appView").setProperty("/currentConversationId", sConversationId);
            var oContainer = this.byId("chatContainer");
            oContainer.removeAllItems();

            if (this.byId("welcomePage")) {
                this.byId("welcomePage").setVisible(false);
            }

            var oModel = this.getView().getModel();
            var oListBinding = oModel.bindList("/Message", null, [
                new sap.ui.model.Sorter("createdAt", false)
            ], [
                new sap.ui.model.Filter("conversation_ID", sap.ui.model.FilterOperator.EQ, sConversationId)
            ]);
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
                const oUserLabel = new Avatar({ src: "sap-icon://person-placeholder",displaySize: sap.m.AvatarSize.XS,backgroundColor : sap.m.AvatarColor.Random  })
                const oUserText = new Text({ text: sText });
                oMessageItem = new VBox({
                    alignItems: "End",
                    width: "100%",
                    items: [
                        new HBox({
                            alignItems: sap.m.FlexAlignItems.End,
                            items: [
                               
                                oUserText.addStyleClass("sapUiTinyMarginEnd"),
                                oUserLabel
                            ],
                        }).addStyleClass("sapUiContentPadding userChatBubbleNew sapUiTinyMarginEnd")
                    ]
                });
            } else {
                const oAiLabel = new Avatar({ src: "sap-icon://ai",displaySize: sap.m.AvatarSize.XS })
                const oTextControl = new FormattedText({ htmlText: `<b>CandyAssist</b><br/>${bStream ? '' : sText}` });

                oMessageItem = new VBox({
                    width: "98%",
                    items: [new HBox({
                            alignItems: sap.m.FlexAlignItems.End,
                            items:[
                        oAiLabel,
                        oTextControl.addStyleClass("sapUiTinyMarginBegin"),
                            ]})]
                }).addStyleClass("sapUiTinyMarginBegin sapUiContentPadding aiChatBubbleNew");

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