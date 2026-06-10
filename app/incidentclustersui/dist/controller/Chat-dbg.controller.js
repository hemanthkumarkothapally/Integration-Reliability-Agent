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
    "sap/m/library",
    "sap/m/MessageStrip",
    "sap/f/library",
    "../model/formatter"

], function (BaseController, FormattedText, VBox, HBox, ObjectStatus, Avatar, AvatarSize, AvatarColor, MessageBox, library, MessageStrip, fioriLibrary, formatter) {
    "use strict";

    return BaseController.extend("com.cytechies.integration.reliability.incidentclustersui.controller.Chat", {
        formatter: formatter,
        onInit: function () {


            let oChatInput = this.byId("chatInput1");
            if (oChatInput) {
                oChatInput.attachBrowserEvent("keydown", function (oEvent) {
                    if (oEvent.key === "Enter" && !oEvent.shiftKey) {
                        oEvent.preventDefault();
                        let sValue = oChatInput.getValue().trim();
                        if (sValue) {
                            this.onPost(sValue); // Pass the string
                            oChatInput.setValue("");
                        }
                    }
                }.bind(this));
            };
            const oRouter = this.getRouter();

            oRouter.getRoute("RouteAIAssistant")
                .attachPatternMatched(function () {
                    // console.log("AIAssistant route matched!");
                                this.getOwnerComponent().getModel("globalModel").setProperty("/selectedKey","ai");
                    this._resetToWelcomePage();
                    // this.onBackPress();
                }, this);

            oRouter.getRoute("RouteIC")
                .attachPatternMatched(function () {
                    this._resetToWelcomePage();
                    // this.onBackPress();
                }, this);
            // this.getView().setModel(new JSONModel({ currentConversationId: null }), "appView");
            // this._resetToWelcomePage();
        },

        onBackPress: function () {
            let oFCL = this.getView().getParent().getParent();
            if (oFCL && oFCL.setLayout) {
                oFCL.setLayout(sap.f.LayoutType.OneColumn);
            }
            else {
                this.getOwnerComponent()
                    .getRouter()
                    .navTo("Routemonitored_iflows");
            }
            // console.log("Closing chat side panel");
        },

        onRemoveClusterPress: function (oEvent) {
            // 1. Close the popover
            if (this._oClusterPopover) {
                this._oClusterPopover.close();
            }

            // 2. Clear the cluster data from your model to hide the main button
            let oModel = this.getView().getModel("chatJSONModel");

            oModel.setProperty("/clusterName", "");
            oModel.setProperty("/clusterDataEnabled", false);

            // 3. Provide feedback to the user
            this.showToast("Cluster detached successfully");

            // Note: Add any backend API calls here if you need to delete the linkage in the database
        },

        onRemoveiFlowPress: function (oEvent) {
            // 1. Close the popover
            if (this._oClusterPopover) {
                this._oClusterPopover.close();
            }

            // 2. Clear the cluster data from your model to hide the main button
            let oModel = this.getView().getModel("chatJSONModel");

            oModel.setProperty("/iFlowName", "");
            oModel.setProperty("/iFlowDataEnabled", false);

            // 3. Provide feedback to the user
            this.showToast("iFlow detached successfully");

            // Note: Add any backend API calls here if you need to delete the linkage in the database
        },

        onClusterInfoPopover: function (oEvent) {
            const oButton = oEvent.getSource();
            const oPopover = this.byId("activeClusterPopover");

            // Check if the popover is already open
            if (oPopover.isOpen()) {
                oPopover.close();
            } else {
                oPopover.openBy(oButton);
            }
            // let oJsonModel = this.getModel("chatJSONModel");
            // let bCurrentState = oJsonModel.getProperty("/clusterDataEnabled");
            // oJsonModel.setProperty("/clusterDataEnabled", !bCurrentState);
            // this.byId("actionDataPopover").close();

            // console.log("Cluster data active:", !bCurrentState);
        },

        oniflowInfoPopover: function (oEvent) {
            const oButton = oEvent.getSource();
            const oPopover = this.byId("activeiFlowPopover");

            // Check if the popover is already open
            if (oPopover.isOpen()) {
                oPopover.close();
            } else {
                oPopover.openBy(oButton);
            }

        },

        // onSelectClusterData: function (oEvent) {
        //     let oGlobalModel = this.getView().getModel("globalModel");
        //     let sIflowId = oGlobalModel ? oGlobalModel.getProperty("/iflowId") : null;
        //     // let sTenantId = oGlobalModel ? oGlobalModel.getProperty("/settings/DEFAULT_TENANT/ID") : null;
        //     // let sTenantId = "22222222-2222-2222-2222-222222222222";
        //     let sTenantId = null
        //     // Save the event source control immediately (oEvent falls out of scope inside async functions)

        //     let oSource = oEvent.getSource();
        //     let oList = this.byId("clusterList");
        //     let oPopover = this.byId("clusterPopover");

        //     // console.log("Selected cluster data with iFlow ID:", sIflowId);
        //     if (sIflowId || sTenantId !== "ALL") {
        //         if (oList && oPopover) {
        //             let oBinding = oList.getBinding("items");

        //             if (oBinding) {
        //                 // Set global app view or parent view to busy so user knows a click action is running
        //                 this.getView().setBusy(true);

        //                 // 1. Create a promise that resolves ONLY when the backend returns the updated V4 payload
        //                 let oDataLoadPromise = new Promise(function (resolve) {
        //                     oBinding.attachEventOnce("dataReceived", function () {
        //                         resolve();
        //                     });
        //                 });

        //                 // 2. Set your custom filter paths
        //                 let aFilters = [];
        //                 if (sIflowId) {
        //                     aFilters.push(new sap.ui.model.Filter("monitoredArtifacts/artifact_ID", sap.ui.model.FilterOperator.EQ, sIflowId));
        //                 }
        //                 if (sTenantId) {
        //                     aFilters.push(new sap.ui.model.Filter("tenant_ID", sap.ui.model.FilterOperator.EQ, sTenantId));
        //                 }
        //                 // 3. Delegate the actual binding update to your central helper method
        //                 this.applyCentralBindingFilter("clusterList", "items", aFilters);

        //                 // 4. Wait for the data payload to land before executing UI transitions
        //                 oDataLoadPromise.then(function () {
        //                     this.getView().setBusy(false);
        //                     oPopover.openBy(oSource);
        //                 }.bind(this)).catch(function (oError) {
        //                     this.getView().setBusy(false);
        //                 }.bind(this));
        //             }
        //         }
        //     }
        //     return; // Exit execution early; the popover is managed inside the Promise resolution

        //     // Fallback if list components or bindings aren't loaded into view context yet
        //     if (oPopover) {
        //         oPopover.openBy(oSource);
        //     }
        // },

        onSelectClusterData: function (oEvent) {
            let oGlobalModel = this.getView().getModel("globalModel");
            let sIflowId = oGlobalModel ? oGlobalModel.getProperty("/iflowId") : null;
            let sTenantId = oGlobalModel ? oGlobalModel.getProperty("/tenantId") : null; // Included for multi-tenant safety

            let oSource = oEvent.getSource();
            let oList = this.byId("clusterList");
            let oPopover = this.byId("clusterPopover");

            if (!oList || !oPopover) {
                return; // Exit if UI elements are missing
            }

            let oBinding = oList.getBinding("items");
            if (!oBinding) {
                oPopover.openBy(oSource); // Fallback
                return;
            }

            // 1. Build the exact filter array
            let aFilters = [];
            if (sIflowId) {
                aFilters.push(new sap.ui.model.Filter("monitoredArtifacts/artifact_ID", sap.ui.model.FilterOperator.EQ, sIflowId));
            }
            if (sTenantId && sTenantId !== "ALL") {
                aFilters.push(new sap.ui.model.Filter("tenant_ID", sap.ui.model.FilterOperator.EQ, sTenantId));
            }

            // 2. Set UI to Busy
            this.getView().setBusy(true);

            // 3. Create a SAFE Promise with a Timeout Fallback
            let oDataLoadPromise = new Promise(function (resolve) {
                // Option A: The network request fires and succeeds
                let fnDataReceived = function () {
                    resolve("network_success");
                };
                oBinding.attachEventOnce("dataReceived", fnDataReceived);

                // Option B: The timeout catches the cache/no-network scenario.
                // 500ms is usually enough time for UI5 to decide if it needs to make a network call.
                setTimeout(function () {
                    // Detach the event just in case it fires way later
                    oBinding.detachEvent("dataReceived", fnDataReceived);
                    resolve("timeout_or_cached");
                }, 800);
            });

            // 4. Apply Filters via your central method
            this.applyCentralBindingFilter("clusterList", "items", aFilters);

            // 5. Force the refresh as requested
            // Note: Calling refresh() immediately after filter() might abort the filter request
            // in some OData V4 implementations. We wrap it in a micro-delay to ensure the filter registers first.
            setTimeout(function () {
                if (oBinding.isSuspended && oBinding.isSuspended()) {
                    oBinding.resume();
                }
                oBinding.refresh();
            }, 50);

            // 6. Handle the Promise Resolution
            oDataLoadPromise.then(function (sStatus) {
                // console.log("Promise resolved via:", sStatus);
                this.getView().setBusy(false);
                oPopover.openBy(oSource);
            }.bind(this)).catch(function (oError) {
                this.getView().setBusy(false);
                // Fallback open even on error so user doesn't think the button is broken
                oPopover.openBy(oSource);
            }.bind(this));
        },
        onSelectiFlowData: function (oEvent) {
            let oGlobalModel = this.getView().getModel("globalModel");
            let sIflowId = oGlobalModel ? oGlobalModel.getProperty("/iflowId") : null;
            let sTenantId = oGlobalModel ? oGlobalModel.getProperty("/tenantId") : null; // Included for multi-tenant safety
            // let sTenantId = "22222222-2222-2222-2222-222222222222"; // Testing condition
            // let sTenantId = "11111111-1111-1111-1111-111111111111"; // Testing condition
            // Save the event source control immediately
            let oSource = oEvent.getSource();
            let oList = this.byId("iFlowList");
            let oPopover = this.byId("iFlowPopover");

            if (!oList || !oPopover) {
                return; // Exit if UI elements are missing
            }

            let oBinding = oList.getBinding("items");
            if (!oBinding) {
                oPopover.openBy(oSource); // Fallback
                return;
            }

            // 1. Build the exact filter array
            let aFilters = [];
            if (sIflowId) {
                // Your original code used ["ID"] as the field
                aFilters.push(new sap.ui.model.Filter("ID", sap.ui.model.FilterOperator.EQ, sIflowId));
            }
            if (sTenantId && sTenantId !== "ALL") {
                aFilters.push(new sap.ui.model.Filter("tenant_ID", sap.ui.model.FilterOperator.EQ, sTenantId));
            }

            // 2. Set UI to Busy
            this.getView().setBusy(true);

            // 3. Create a SAFE Promise with a Timeout Fallback (Prevents the Promise Trap)
            let oDataLoadPromise = new Promise(function (resolve) {
                let fnDataReceived = function () {
                    resolve("network_success");
                };
                oBinding.attachEventOnce("dataReceived", fnDataReceived);

                // 800ms race condition. If no network request fires, this forces the popover to open.
                setTimeout(function () {
                    oBinding.detachEvent("dataReceived", fnDataReceived);
                    resolve("timeout_or_cached");
                }, 800);
            });

            // 4. Apply Filters via your central method (replaces applyListSearch)
            this.applyCentralBindingFilter("iFlowList", "items", aFilters);

            // 5. Force the refresh as requested
            setTimeout(function () {
                if (oBinding.isSuspended && oBinding.isSuspended()) {
                    oBinding.resume();
                }
                oBinding.refresh();
            }, 50);

            // 6. Handle the Promise Resolution
            oDataLoadPromise.then(function (sStatus) {
                this.getView().setBusy(false);
                oPopover.openBy(oSource);
            }.bind(this)).catch(function (oError) {
                this.getView().setBusy(false);
                // Fallback open even on error so user doesn't think the button is broken
                oPopover.openBy(oSource);
            }.bind(this));
        },
        _resetToWelcomePage: function () {
            this.showBusy();
            let oJsonModel = this.getModel("chatJSONModel");
            // console.log("oJsonModel before reset:", oJsonModel.getData());

            oJsonModel.setProperty("/currentConversationId", null);
            oJsonModel.setProperty("/currentConversationTitle", "New Chat");
            oJsonModel.setProperty("/clusterDataEnabled", false);
            oJsonModel.setProperty("/iFlowDataEnabled", false);
            oJsonModel.setProperty("/allMessagesLoaded", false);
            oJsonModel.setProperty("/messageSkip", 0);
            oJsonModel.setProperty("/showScrollButton", false);

            this.byId("historyList").removeSelections(true);
            this.byId("historyPopover").close();
            this.byId("chatContainer").removeAllItems();
            this.byId("welcomePage").setVisible(true);
            // console.log("oJsonModel after reset:", oJsonModel.getData());
            this.hideBusy();
        },

        onNewChat() {
            this._resetToWelcomePage();
        },

        onConversationSelect: function (oEvent) {
            this.showBusy();
            let oListItem = oEvent.getParameter("listItem");
            let oCtx = oListItem.getBindingContext("chatModel");
            let sKey = oCtx.getProperty("ID");
            // console.log("Selected conversation ID:", sKey);
            let oPopover = this.byId("historyPopover"); // Ensure this ID matches your view/fragment
            if (oPopover) {
                oPopover.close();
            }
            let sTitle = oCtx.getProperty("title");
            let oJsonModel = this.getModel("chatJSONModel");
            oJsonModel.setProperty("/currentConversationTitle", sTitle);
            oJsonModel.setProperty("/clusterDataEnabled", false);
            this._loadConversationMessages(sKey);
            this.hideBusy();
        },

        onHistoryMenuPress: function (oEvent) {
            const oButton = oEvent.getSource();
            const oPopover = this.byId("historyPopover");

            // Check if the popover is already open
            if (oPopover.isOpen()) {
                oPopover.close();
            } else {
                oPopover.openBy(oButton);
            }
        },

        onOpenActionsPopover: function (oEvent) {
            const oButton = oEvent.getSource();
            const oPopover = this.byId("actionDataPopover");

            // Check if the popover is already open
            if (oPopover.isOpen()) {
                oPopover.close();
            } else {
                oPopover.openBy(oButton);
            }
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
                        // console.log("Deleting conversation with ID:", sConvId);
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

            const oInput = this.byId("chatInput1");
            oInput.setValue(sText);
        },

        onPost: async function (oEvent) {
            let oModel = this.getView().getModel("chatModel");
            let oJsonModel = this.getModel("chatJSONModel");
            let sCurrentConvId = oJsonModel.getProperty("/currentConversationId");
            let bClusterEnabled = oJsonModel.getProperty("/clusterDataEnabled");
            let biFlowEnabled = oJsonModel.getProperty("/iFlowDataEnabled");

            let sQuery;
            let oSource = oEvent.getSource ? oEvent.getSource() : null;

            if (oSource && typeof oSource.getValue === "function") {
                sQuery = oSource.getValue().trim();
            } else {
                let oInput = this.byId("chatInput1");
                sQuery = oInput ? oInput.getValue().trim() : "";
                if (oInput) oInput.setValue("");
            }

            if (!sQuery) return;

            if (!sCurrentConvId) {
                try {
                    sCurrentConvId = await this._executeCreateConversation(sQuery.substring(0, 150).replace(/[\r\n]+/g, " ") + "...");
                } catch (e) {
                    this.showToast("Failed to create conversation");
                    return;
                }
            }

            // --- NEW: Prepare the UI Data object for the chat bubble ---
            let oMessageData = {
                tokenCount: "Calculating",
                referCluster: null,
                referiFlow: null
            };

            const oAction = oModel.bindContext("/chat(...)");
            oAction.setParameter("conversationId", sCurrentConvId);

            if (biFlowEnabled) {
                let sIflowId = oJsonModel.getProperty("/iFlowId");
                let sIflowName = oJsonModel.getProperty("/iFlowName");

                // Mock the structure expected by _buildMessageItem
                oMessageData.referiFlow = { ID: sIflowId, iFlowName: sIflowName };

                oAction.setParameter("referiFlowID", sIflowId);
                oJsonModel.setProperty("/iFlowDataEnabled", false);
            }

            if (bClusterEnabled) {
                let sClusterId = oJsonModel.getProperty("/clusterId");
                let sClusterName = oJsonModel.getProperty("/clusterName");

                // Mock the structure expected by _buildMessageItem
                oMessageData.referCluster = { ID: sClusterId, errorType: sClusterName };

                oAction.setParameter("referClusterID", sClusterId);
                oJsonModel.setProperty("/clusterDataEnabled", false);
            }
            // -----------------------------------------------------------

            // Pass the rich oMessageData object to the UI
            this._appendMessage(sQuery, "user", oMessageData);

            this.byId("typingIndicator").setVisible(true);
            this._scrollToBottom();

            try {
                oAction.setParameter("userMessage", sQuery);
                await oAction.execute();

                const oResult = oAction.getBoundContext().getObject();
                this._updateUserTokenCount(oResult.inputTokens);
                this._appendMessage(oResult.content, "assistant", oResult, true);
                this._updateTotalSessionTokens();
            } catch (oError) {
                // console.error("Chat action failed", oError);
                this._updateUserTokenCount("No");
                this._appendMessage("Sorry, I encountered an error processing your request.", "assistant", {}, true);
            } finally {
                this.byId("typingIndicator").setVisible(false);
                this._scrollToBottom();
            }
        },

        _executeCreateConversation: async function (sTitle) {

            this.showBusy();

            try {
                // 1. Setup Models
                let oModel = this.getView().getModel("chatModel");
                let oJsonModel = this.getModel("chatJSONModel");
                let oAction = oModel.bindContext("/createConversation(...)");
                let clusterId = oJsonModel.getProperty("/clusterId") || null;
                oAction.setParameter("title", sTitle);
                if (clusterId) {
                    oAction.setParameter("clusterId", clusterId);
                }
                await oAction.execute();
                let oContext = oAction.getBoundContext();
                let oResult = await oContext.requestObject();
                let sNewId = oResult.ID || (oResult.value && oResult.value.ID);
                let sNewTitle = oResult.title || (oResult.value && oResult.value.title);
                oJsonModel.setProperty("/currentConversationId", sNewId);
                oJsonModel.setProperty("/currentConversationTitle", sNewTitle);
                this.byId("chatContainer").removeAllItems();
                oModel.refresh();
                return sNewId;

            } catch (oError) {
                // console.error("Conversation creation failed:", oError);
                throw oError; // This automatically rejects the async function's promise

            } finally {
                this.hideBusy();
            }
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
                    // console.log("Tokens loaded:", oSession.totalSessionTokenUsage);
                }
            }).catch(function (oError) {
                // console.error("Failed to load session details:", oError);
            });
        },

        _loadConversationMessages: function (sConversationId) {
            // console.log("Loading conversation with ID:", sConversationId);
            this.showBusy();

            let oJsonModel = this.getModel("chatJSONModel");
            oJsonModel.setProperty("/currentConversationId", sConversationId);
            oJsonModel.setProperty("/allMessagesLoaded", false);
            oJsonModel.setProperty("/messageSkip", 0); // tracks how many old messages loaded
            this._sCurrentConversationId = sConversationId; // store for pagination

            this._updateTotalSessionTokens();

            let oContainer = this.byId("chatContainer");
            oContainer.removeAllItems();

            if (this.byId("welcomePage")) {
                this.byId("welcomePage").setVisible(false);
            }

            this._loadMessageBatch(sConversationId, false); // false = append (normal, bottom-up)
            this.hideBusy();
        },
        _loadMessageBatch: function (sConversationId, bPrepend) {
            if (this._bLoadingMessages) return;
            this._bLoadingMessages = true;

            const PAGE_SIZE = 10;
            let oModel = this.getView().getModel("chatModel");
            let oJsonModel = this.getModel("chatJSONModel");
            let nSkip = oJsonModel.getProperty("/messageSkip") || 0;

            let oListBinding = oModel.bindList("/Messages", null, [
                new sap.ui.model.Sorter("createdAt", true)
            ], [
                new sap.ui.model.Filter("conversation_ID", sap.ui.model.FilterOperator.EQ, sConversationId)
            ], {
                $expand: "referiFlow,referCluster"
            });

            oListBinding.requestContexts(nSkip, PAGE_SIZE).then(function (aContexts) {
                // debugger
                // ✅ Stale check: if conversation changed or reset happened, discard results
                let sActiveId = oJsonModel.getProperty("/currentConversationId");
                if (sActiveId !== sConversationId) {
                    // console.log("Discarding stale batch for:", sConversationId);
                    return;
                }

                if (aContexts.length < PAGE_SIZE) {
                    oJsonModel.setProperty("/allMessagesLoaded", true);
                }

                if (aContexts.length === 0) return;

                oJsonModel.setProperty("/messageSkip", nSkip + aContexts.length);

                let aMessages = aContexts.map(ctx => ctx.getObject());

                aMessages.sort((a, b) => {
                    let tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    let tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    if (tA === tB) {
                        if (a.role === "user" && b.role !== "user") return -1;
                        if (a.role !== "user" && b.role === "user") return 1;
                        return 0;
                    }
                    return tA - tB;
                });

                let oContainer = this.byId("chatContainer");
                let oScroll = this.byId("chatScroll");

                if (bPrepend) {
                    let nOldScrollHeight = oScroll.getDomRef()?.scrollHeight || 0;

                    aMessages.forEach((msg, i) => {
                        let oItem = this._buildMessageItem(msg.content, msg.role, msg);
                        oContainer.insertItem(oItem, i);
                    });

                    setTimeout(() => {
                        let oDom = oScroll.getDomRef();
                        if (oDom) {
                            oScroll.scrollTo(0, oDom.scrollHeight - nOldScrollHeight);
                        }
                    }, 50);

                } else {
                    aMessages.forEach(msg => {
                        this._appendMessage(msg.content, msg.role, msg);
                    });
                    this._scrollToBottom();
                }

            }.bind(this)).catch((err) => {
                // console.error("Failed to load messages for conversation:", sConversationId, err);
                this.showToast("Error loading conversation history.");
            }).finally(() => {
                this._bLoadingMessages = false;
            });
        },

        onAfterRendering: function () {
            // Prevent attaching multiple listeners
            if (this._scrollListenerAttached) return;
            this._scrollListenerAttached = true;

            let oScroll = this.byId("chatScroll");
            let oDom = oScroll?.getDomRef();

            if (oDom) {
                oDom.addEventListener("scroll", () => {
                    let oJsonModel = this.getModel("chatJSONModel");

                    // --- 1. EXISTING LOGIC: Pagination (Scroll to Top) ---
                    if (oDom.scrollTop < 50) {
                        let bAllLoaded = oJsonModel.getProperty("/allMessagesLoaded");
                        // Guard: only load if a real conversation is active
                        if (!bAllLoaded && this._sCurrentConversationId && !this._bLoadingMessages) {
                            this._loadMessageBatch(this._sCurrentConversationId, true);
                        }
                    }

                    // --- 2. NEW LOGIC: Floating Button Visibility (Scroll to Bottom) ---
                    // Calculate how far the scrollbar is from the absolute bottom
                    let nDistanceToBottom = oDom.scrollHeight - oDom.scrollTop - oDom.clientHeight;

                    // If we are more than 20 pixels away from the bottom, show the button
                    let bNotAtBottom = nDistanceToBottom > 20;

                    // Only update the model if the state actually needs to change (prevents flickering)
                    if (oJsonModel.getProperty("/showScrollButton") !== bNotAtBottom) {
                        oJsonModel.setProperty("/showScrollButton", bNotAtBottom);
                    }
                });
            }
        },

        _createReferenceData: function (oRefData, sType) {
            const isCluster = sType === "Cluster";
            return new MessageStrip({
                text: isCluster ? oRefData.errorType : oRefData.iFlowName,
                type: isCluster ? sap.ui.core.MessageType.Warning : sap.ui.core.MessageType.Information,
                showIcon: true,
                customIcon: isCluster ? "sap-icon://chain-link" : "sap-icon://process"
            }).addStyleClass("sapUiTinyMarginBottom")
        }
        ,

        _buildMessageItem: function (sText, sSender, oData, bStream = false) {
            // console.log("Building message item. Sender:", sSender, "Data:", oData);

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

                const oUserText = new FormattedText();
                if (!bStream) {
                    oUserText.setHtmlText(sText);
                }

                let aBubbleItems = [];

                if (oData && oData.referCluster) {
                    aBubbleItems.push(this._createReferenceData(oData.referCluster, "Cluster"));
                }
                if (oData && oData.referiFlow) {
                    aBubbleItems.push(this._createReferenceData(oData.referiFlow, "iFlow"));
                }

                // 4. Add the actual message text and token info
                aBubbleItems.push(oUserText);
                aBubbleItems.push(oUserTokenInfo.addStyleClass("sapUiTinyMarginTop"));

                oMessageItem = new VBox({
                    alignItems: library.FlexAlignItems.End,
                    width: "100%",
                    items: [
                        new HBox({
                            width: "100%",
                            justifyContent: library.FlexJustifyContent.End,
                            alignItems: library.FlexAlignItems.Start,
                            fitContainer: false,
                            items: [
                                // Wrapped Text inside layout panel container to retain structural width
                                new VBox({
                                    items: [...aBubbleItems, oUserText, oUserTokenInfo.addStyleClass("sapUiTinyMarginTop")]
                                }).addStyleClass("userChatBubbleNew sapUiSmallMarginEnd"),
                                oUserAvatar
                            ]
                        }).addStyleClass("sapUiTinyMargin")
                    ]
                });
            } else {

                // console.log("AI response data for message item:", oData);

                const oAiTokenInfo =
                    new ObjectStatus({
                        state: "Information",
                        text: (oData.tokenCount || "No") + " Tokens"
                    });

                const oAiAvatar = new Avatar({
                    src: "sap-icon://ai",
                    displaySize: AvatarSize.XS
                });

                const oTextControl = new FormattedText(); // Instantiate empty
                if (!bStream) {
                    oTextControl.setHtmlText(sText);      // Set text explicitly to bypass binding engine
                }

                oMessageItem = new VBox({
                    alignItems: library.FlexAlignItems.Start,
                    width: "100%",
                    items: [
                        new HBox({
                            width: "100%",
                            justifyContent: library.FlexJustifyContent.Start,
                            alignItems: library.FlexAlignItems.Start,
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
            return oMessageItem;
        },

        _appendMessage: function (sText, sSender, oData, bStream = false) {
            // debugger
            const oContainer = this.byId("chatContainer");
            if (this.byId("welcomePage")) {
                this.byId("welcomePage").setVisible(false);
            }
            let oItem = this._buildMessageItem(sText, sSender, oData, bStream);
            oContainer.addItem(oItem);
            if (!bStream) {
                this._scrollToBottom();
            }
        },

        _updateUserTokenCount: function (iCount) {
            if (this._lastUserTokenStatus && !this._lastUserTokenStatus.bIsDestroyed) {
                this._lastUserTokenStatus.setText(iCount + " tokens");
            } else {
                // console.warn("Could not find the last user token status control.");
            }
        },

        _scrollToBottom: function () {
            const oScroll = this.byId("chatScroll");
            // Parameters: x-coordinate, y-coordinate, time (in milliseconds)

            setTimeout(() => oScroll.scrollTo(0, 100000, 1000), 100);
        },

        onUploadFilePress: function (oEvent) {
            // 1. Close the popover menu
            this.byId("actionDataPopover").close();

            // 2. Trigger your file upload logic here
            // (e.g., opening a sap.ui.unified.FileUploader dialog)
            // console.log("File upload triggered");
        },

        onVoiceInputPress: function (oEvent) {
            // 1. Close the popover menu immediately
            this.byId("actionDataPopover").close();

            // 2. Check if the user's browser supports Speech Recognition
            let SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                this.showToast("Sorry, voice input is not supported in this browser.");
                return;
            }

            // 3. Initialize the speech recognition engine
            let recognition = new SpeechRecognition();
            recognition.lang = 'en-US'; // You can change this to match your user's locale
            recognition.interimResults = false; // Set to true if you want to see words as they speak
            recognition.maxAlternatives = 1;

            // Grab your specific TextArea
            let oTextArea = this.byId("chatInput1");

            // Optional: Let the user know it is 
            this.byId("_IDGenBusyIndicator1").setVisible(true);
            this.showToast("Listening... Speak now.");

            // 4. Handle the successful result
            recognition.onresult = function (event) {
                // Extract the spoken text
                let sTranscript = event.results[0][0].transcript;

                // Get whatever is currently in the text box
                let sCurrentText = oTextArea.getValue();

                // Append the new voice text (add a space if there's already text)
                let sNewText = sCurrentText ? sCurrentText + " " + sTranscript : sTranscript;

                // Set the final text back into the UI5 TextArea
                oTextArea.setValue(sNewText);
            };

            // 5. Handle any errors (like microphone denied)
            recognition.onerror = (event) => {
                if (event.error === 'network') {
                    this.showToast("Network Error: Cannot reach speech servers. Check your VPN.");
                } else if (event.error === 'not-allowed') {
                    this.showToast("Microphone access denied. Please check browser permissions.");
                } else if (event.error === 'no-speech') {
                    // NEW: Catch the silent timeout
                    this.showToast("No speech detected. Please check your mic settings and speak immediately.");
                } else {
                    this.showToast("Microphone error: " + event.error);
                }
            };
            recognition.onend = () => {
                this.byId("_IDGenBusyIndicator1").setVisible(false);
            };

            // 6. Start the microphone!
            recognition.start();
        },

        onClusterSearch: function (oEvent) {
            let sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
            this.applyListSearch("clusterList", sQuery, ["errorType", "severity", "status"]);
        },

        oniFlowSearch: function (oEvent) {
            let sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
            // console.log("Searching iFlows with query:", sQuery);
            this.applyListSearch("iFlowList", sQuery, ["iFlowName"]);
        },

        onHistorySearch: function (oEvent) {
            let sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
            this.applyListSearch("historyList", sQuery, ["title"]);
        },

        oniFlowSelect(oEvent) {
            let oListItem = oEvent.getParameter("listItem");

            if (!oListItem) {
                return;
            }
            let oCtx = oEvent.getParameter("listItem").getBindingContext();
            // console.log("Selected iFlow context data : ", oCtx);
            let sKey = oCtx.getProperty("ID");

            let oJsonModel = this.getModel("chatJSONModel");
            // console.log("iFlow ID set to:", sKey);
            oJsonModel.setProperty("/iFlowId", sKey);
            oJsonModel.setProperty("/iFlowName", oCtx.getProperty("iFlowName"));

            oJsonModel.setProperty("/iFlowDataEnabled", true);
            this.byId("actionDataPopover").close();
            let oList = oListItem.getParent();
            if (oList) {
                // Unselect the specific item visually
                oListItem.setSelected(false);
                // Clear the master selection tracking on the list itself
                if (typeof oList.setSelectedItem === "function") {
                    oList.setSelectedItem(null);
                }
            }

            // console.log("Cluster data active:", !bCurrentState);
            const oInput = this.byId("chatInput1");
            oInput.setValue("I want to talk about iFlow: " + oCtx.getProperty("iFlowName"));
            this.byId("actionDataPopover").close();

        },

        onClusterSelect: function (oEvent) {
            let oListItem = oEvent.getParameter("listItem");

            // Check if the item exists before working with it
            if (!oListItem) {
                return;
            }
            let oCtx = oEvent.getParameter("listItem").getBindingContext();
            // console.log("Selected cluster context data : ", oCtx);
            let sKey = oCtx.getProperty("ID");

            let oJsonModel = this.getModel("chatJSONModel");
            // console.log("Cluster ID set to:", sKey);
            oJsonModel.setProperty("/clusterId", sKey);
            oJsonModel.setProperty("/clusterName", oCtx.getProperty("errorType"));

            oJsonModel.setProperty("/clusterDataEnabled", true);
            this.byId("actionDataPopover").close();
            let oList = oListItem.getParent();
            if (oList) {
                // Unselect the specific item visually
                oListItem.setSelected(false);
                // Clear the master selection tracking on the list itself
                if (typeof oList.setSelectedItem === "function") {
                    oList.setSelectedItem(null);
                }
            }

            // console.log("Cluster data active:", !bCurrentState);
            const oInput = this.byId("chatInput1");
            oInput.setValue("I want to talk about cluster: " + oCtx.getProperty("errorType"));
            this.byId("actionDataPopover").close();

        }

    });
});