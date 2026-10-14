
/* =========================================
   AMPLIFIED SITES - LIVE CHAT
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    // =========================================
    // BACKEND CONFIGURATION
    // =========================================

    const CHAT_API = "https://api.amplifiedsites.com/chat";

    // =========================================
    // CHAT ELEMENTS
    // =========================================

    const chatToggle = document.getElementById("asChatToggle");
    const chatWindow = document.getElementById("asChatWindow");
    const chatClose = document.getElementById("asChatClose");

    const chatInput = document.getElementById("asChatInput");
    const chatSend = document.getElementById("asChatSend");
    const chatMessages = document.getElementById("asChatMessages");

    const chatCustomerForm = document.getElementById("asChatCustomerForm");
    const chatCustomerName = document.getElementById("asChatCustomerName");
    const chatCustomerEmail = document.getElementById("asChatCustomerEmail");

    const chatEnd = document.getElementById("asChatEnd");

    const endConfirm = document.getElementById("asChatEndConfirm");
    const cancelEnd = document.getElementById("asChatCancelEnd");
    const confirmEnd = document.getElementById("asChatConfirmEnd");

    // =========================================
    // CHECK REQUIRED ELEMENTS
    // =========================================

    if (
        !chatToggle ||
        !chatWindow ||
        !chatClose ||
        !chatInput ||
        !chatSend ||
        !chatMessages ||
        !chatCustomerForm ||
        !chatCustomerName ||
        !chatCustomerEmail ||
        !chatEnd ||
        !endConfirm ||
        !cancelEnd ||
        !confirmEnd
    ) {
        console.error("Live Chat: Required HTML elements are missing.");
        return;
    }

    // =========================================
    // CHAT STATE
    // =========================================

    let chatStarted = false;
    let currentCustomer = null;

    let conversationId = null;
    let chatToken = null;

    let startingChat = false;
    let sendingMessage = false;
    let endingChat = false;

    // =========================================
    // BACKEND REQUEST HELPER
    // =========================================

    async function chatRequest(endpoint, body) {

        const response = await fetch(`${CHAT_API}${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.error || "Unable to complete chat request."
            );
        }

        return result;
    }

    // =========================================
    // DISPLAY CHAT MESSAGE
    // =========================================

    function displayChatMessage(message, sender) {

        const messageBubble = document.createElement("div");

        messageBubble.className = `as-chat-message ${sender}`;

        messageBubble.textContent = message;

        chatMessages.appendChild(messageBubble);

        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

        // =========================================
        // LIVE CHAT - AUTOMATIC MESSAGE UPDATES
        // =========================================

        let chatHistoryTimer = null;
        let chatHistoryLoading = false;
        const displayedChatMessageIds = new Set();

        async function loadCustomerChatHistory() {

            if (
                !chatStarted ||
                !conversationId ||
                !chatToken ||
                chatHistoryLoading ||
                endingChat ||
                sendingMessage
            ) {
                return;
            }

            chatHistoryLoading = true;

            const requestedConversationId = conversationId;

            try {

                const result = await chatRequest("/history", {
                    conversation_id: conversationId,
                    chat_token: chatToken
                });

                // Ignore results from an old conversation
                if (
                    !chatStarted ||
                    conversationId !== requestedConversationId
                ) {
                    return;
                }

                // Display messages that haven't appeared yet
                result.messages.forEach(message => {

                    if (displayedChatMessageIds.has(message.id)) {
                        return;
                    }

                    displayedChatMessageIds.add(message.id);

                    displayChatMessage(
                        message.message,
                        message.sender === "admin"
                            ? "support"
                            : "customer"
                    );

                });

                // =========================================
                // CHAT CLOSED BY ADMIN
                // =========================================

                if (result.status === "closed") {

            // Clear saved conversation credentials
                localStorage.removeItem("asChatConversationId");
                localStorage.removeItem("asChatToken");
                localStorage.removeItem("asChatCustomerName");
                localStorage.removeItem("asChatCustomerEmail");

                    // Stop checking for new messages
                    stopCustomerChatUpdates();

                    // Prevent customer from sending messages
                    chatInput.disabled = true;
                    chatSend.disabled = true;

                    chatInput.value = "";
                    chatInput.placeholder = "Live chat has been closed.";

                    // Hide the End Chat confirmation popup
                    endConfirm.hidden = true;

                    // Allow customer to leave the closed chat
                    chatEnd.disabled = false;

                    // Display the closure notification only once
                    if (!chatMessages.querySelector(".as-chat-closed-notice")) {

                        const notice = document.createElement("div");

                        notice.className = "as-chat-closed-notice";
                        notice.style.display = "block";
                        notice.style.padding = "12px";
                        notice.style.margin = "12px 0";
                        notice.style.backgroundColor = "#e8eefc";
                        notice.style.color = "#1e3a8a";
                        notice.style.borderRadius = "8px";
                        notice.style.textAlign = "center";
                        notice.style.fontSize = "14px";

                        notice.textContent =
                            "This live chat has been closed by support. Thank you for contacting Amplified Sites!";

                        chatMessages.appendChild(notice);

                        chatMessages.scrollTop = chatMessages.scrollHeight;

                    }

                }

            } catch (error) {

                console.error(
                    "CUSTOMER CHAT HISTORY ERROR:",
                    error
                );

            } finally {

                chatHistoryLoading = false;

            }
        }


        // Start checking for new messages every 3 seconds
        function startCustomerChatUpdates() {

            stopCustomerChatUpdates();

            loadCustomerChatHistory();

            chatHistoryTimer = setInterval(() => {
                loadCustomerChatHistory();
            }, 3000);

        }


        // Stop automatic message updates
        function stopCustomerChatUpdates() {

            if (chatHistoryTimer !== null) {
                clearInterval(chatHistoryTimer);
                chatHistoryTimer = null;
            }

        }

    // =========================================
    // DISPLAY CHAT ERROR
    // =========================================

    function showChatError(message) {

        console.error("Live Chat:", message);

        displayChatMessage(message, "support");
    }

    // =========================================
    // OPEN CHAT WINDOW
    // =========================================

    chatToggle.addEventListener("click", () => {

        chatWindow.hidden = false;

        chatToggle.setAttribute("aria-expanded", "true");

        if (chatStarted) {
            chatInput.focus();
        } else {
            chatCustomerName.focus();
        }
    });

    // =========================================
    // CLOSE CHAT WINDOW
    // =========================================

    chatClose.addEventListener("click", () => {

        endConfirm.hidden = true;

        chatWindow.hidden = true;

        chatToggle.setAttribute("aria-expanded", "false");

        chatToggle.focus();
    });

    // =========================================
    // START CUSTOMER CHAT
    // =========================================

    chatCustomerForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        if (startingChat || chatStarted) {
            return;
        }

        if (!chatCustomerForm.reportValidity()) {
            return;
        }

        const customerName = chatCustomerName.value.trim();
        const customerEmail = chatCustomerEmail.value.trim().toLowerCase();

        if (!customerName || !customerEmail) {
            return;
        }

        startingChat = true;

        const startButton = chatCustomerForm.querySelector(
            'button[type="submit"]'
        );

        if (startButton) {
            startButton.disabled = true;
        }

        try {

            const result = await chatRequest("/start", {
                name: customerName,
                email: customerEmail
            });

            if (
                !result.conversation?.id ||
                !/^[0-9a-f]{64}$/i.test(result.chat_token || "")
            ) {
                throw new Error("Invalid conversation response.");
            }

            conversationId = result.conversation.id;
            chatToken = result.chat_token;

            // Remember this conversation after a page refresh
            localStorage.setItem("asChatConversationId", conversationId);
            localStorage.setItem("asChatToken", chatToken);
            localStorage.setItem("asChatCustomerName", customerName);
            localStorage.setItem("asChatCustomerEmail", customerEmail);

            currentCustomer = {
                name: customerName,
                email: customerEmail
            };

            chatStarted = true;

            // Start receiving admin replies automatically
displayedChatMessageIds.clear();
startCustomerChatUpdates();

            const welcomeMessage = chatMessages.querySelector(
                ".as-chat-message.support"
            );

            if (welcomeMessage) {
                welcomeMessage.textContent =
                    `Hey ${customerName}! How can we help you today?`;
            }

            chatWindow.classList.add("as-chat-started");

            chatInput.focus();

            console.log("Live Chat conversation created.");

        } catch (error) {

            console.error("START CHAT ERROR:", error);

            alert(
                `Unable to start chat: ${error.message}`
            );

        } finally {

            startingChat = false;

            if (startButton) {
                startButton.disabled = false;
            }
        }
    });

    // =========================================
    // SEND CUSTOMER MESSAGE
    // =========================================

    async function sendChatMessage() {

        if (
            !chatStarted ||
            !conversationId ||
            !chatToken ||
            sendingMessage ||
            endingChat
        ) {
            return;
        }

        const message = chatInput.value.trim();

        if (!message || message.length > 2000) {
            return;
        }

        sendingMessage = true;
        chatSend.disabled = true;
        chatInput.disabled = true;

        try {

            const result = await chatRequest("/message", {
                conversation_id: conversationId,
                chat_token: chatToken,
                message: message
            });

            // Record this message so polling doesn't display it twice
            if (result.chat_message.id) {
                displayedChatMessageIds.add(result.chat_message.id);
            }

            displayChatMessage(
                result.chat_message.message,
                "customer"
            );

            chatInput.value = "";

            console.log("Customer message saved.");

        } catch (error) {

            showChatError(
                `Message could not be sent: ${error.message}`
            );

        } finally {

            sendingMessage = false;

            const chatClosed =
                chatInput.placeholder === "This conversation has ended.";

            chatSend.disabled = chatClosed;
            chatInput.disabled = chatClosed;

            if (!chatWindow.hidden) {
                chatInput.focus();
            }
        }
    }

    // =========================================
    // SEND BUTTON
    // =========================================

    chatSend.addEventListener("click", () => {
        sendChatMessage();
    });

    // =========================================
    // ENTER KEY TO SEND
    // =========================================

    chatInput.addEventListener("keydown", (event) => {

        if (event.key === "Enter" && !event.isComposing) {

            event.preventDefault();

            sendChatMessage();
        }
    });

    // =========================================
    // SHOW END CHAT CONFIRMATION
    // =========================================

    chatEnd.addEventListener("click", () => {

        if (!chatStarted || endingChat) {
            return;
        }

        // If admin already closed the chat, return to the start screen
if (chatInput.placeholder === "Live chat has been closed.") {

    stopCustomerChatUpdates();
    displayedChatMessageIds.clear();

    chatStarted = false;
    currentCustomer = null;
    conversationId = null;
    chatToken = null;

    chatWindow.classList.remove("as-chat-started");
    chatCustomerForm.reset();
    chatMessages.replaceChildren();

    displayChatMessage(
        "Welcome to Amplified Sites! How can we help you today?",
        "support"
    );

    chatInput.value = "";
    chatInput.disabled = false;
    chatSend.disabled = false;
    chatEnd.disabled = false;
    chatInput.placeholder = "Type your message...";

    endConfirm.hidden = true;

    return;
}

        endConfirm.hidden = false;

        confirmEnd.focus();
    });

    // =========================================
    // CANCEL END CHAT
    // =========================================

    cancelEnd.addEventListener("click", () => {

        if (endingChat) {
            return;
        }

        endConfirm.hidden = true;

        chatEnd.focus();
    });

    // =========================================
    // CONFIRM END CHAT
    // =========================================

    confirmEnd.addEventListener("click", async () => {

        if (
            !chatStarted ||
            !conversationId ||
            !chatToken ||
            endingChat ||
            sendingMessage
        ) {
            return;
        }

        endingChat = true;

        confirmEnd.disabled = true;
        cancelEnd.disabled = true;

        try {

            await chatRequest("/end", {
                conversation_id: conversationId,
                chat_token: chatToken
            });

            // Stop checking for new messages
            stopCustomerChatUpdates();
            displayedChatMessageIds.clear();

            // Clear saved conversation from browser
            localStorage.removeItem("asChatConversationId");
            localStorage.removeItem("asChatToken");
            localStorage.removeItem("asChatCustomerName");
            localStorage.removeItem("asChatCustomerEmail");

            // Clear current conversation credentials
            chatStarted = false;
            currentCustomer = null;
            conversationId = null;
            chatToken = null;

            // Reset frontend
            chatWindow.classList.remove("as-chat-started");

            chatCustomerForm.reset();
            chatMessages.replaceChildren();

            displayChatMessage(
                "Welcome to Amplified Sites! How can we help you today?",
                "support"
            );

            chatInput.value = "";

            endConfirm.hidden = true;
            chatWindow.hidden = true;

            chatToggle.setAttribute("aria-expanded", "false");

            chatToggle.focus();

            console.log("Live Chat ended. History retained in Supabase.");

        } catch (error) {

            console.error("END CHAT ERROR:", error);

            const alreadyClosed =
                /already closed|active conversation not found/i.test(
                    error.message
                );

            if (alreadyClosed) {

                // Admin already ended this conversation
                stopCustomerChatUpdates();

                endConfirm.hidden = true;

                chatInput.disabled = true;
                chatSend.disabled = true;
                chatEnd.disabled = true;

                chatInput.value = "";
                chatInput.placeholder = "Live chat has been closed.";

                if (!chatMessages.querySelector(".as-chat-closed-notice")) {

                    const notice = document.createElement("div");

                    notice.className = "as-chat-closed-notice";
                    notice.style.display = "block";
                    notice.style.padding = "12px";
                    notice.style.margin = "12px 0";
                    notice.style.backgroundColor = "#e8eefc";
                    notice.style.color = "#1e3a8a";
                    notice.style.borderRadius = "8px";
                    notice.style.textAlign = "center";
                    notice.style.fontSize = "14px";
                    notice.textContent =
                        "This live chat has been closed by support. Thank you for contacting Amplified Sites!";

                    chatMessages.appendChild(notice);

                    chatMessages.scrollTop = chatMessages.scrollHeight;

                }

            } else {

                alert(`Unable to end chat: ${error.message}`);

            }

} finally {

            endingChat = false;

            confirmEnd.disabled = false;
            cancelEnd.disabled = false;
        }
    });

// =========================================
// RESTORE CUSTOMER CHAT AFTER REFRESH
// =========================================

async function restoreCustomerChat() {

    const savedId = localStorage.getItem("asChatConversationId");
    const savedToken = localStorage.getItem("asChatToken");
    const savedName = localStorage.getItem("asChatCustomerName");
    const savedEmail = localStorage.getItem("asChatCustomerEmail");

    if (!savedId || !savedToken) return;

    try {

        // Verify the saved conversation with the backend
        const result = await chatRequest("/history", {
            conversation_id: savedId,
            chat_token: savedToken
        });

        // Only restore ongoing conversations
        if (result.status !== "active") {

            // Remove saved credentials for closed conversations
            localStorage.removeItem("asChatConversationId");
            localStorage.removeItem("asChatToken");
            localStorage.removeItem("asChatCustomerName");
            localStorage.removeItem("asChatCustomerEmail");

            return;
        }

        conversationId = savedId;
        chatToken = savedToken;

        currentCustomer = {
            name: savedName,
            email: savedEmail
        };

        chatStarted = true;

        chatCustomerName.value = savedName || "";
        chatCustomerEmail.value = savedEmail || "";

        chatWindow.classList.add("as-chat-started");

        // Clear default welcome message
        chatMessages.replaceChildren();
        displayedChatMessageIds.clear();

        // Restore previous messages
        result.messages.forEach(message => {

            displayedChatMessageIds.add(message.id);

            displayChatMessage(
                message.message,
                message.sender === "admin"
                    ? "support"
                    : "customer"
            );

        });

        // Continue receiving new messages
        startCustomerChatUpdates();

        console.log("Previous customer chat restored.");

    } catch (error) {

        console.error("Unable to restore chat:", error);

    }

}

    // =========================================
    // INITIAL CHAT STATE
    // =========================================

    chatWindow.hidden = true;
    endConfirm.hidden = true;

    chatToggle.setAttribute("aria-expanded", "false");

    console.log("AMPLIFIED SITES LIVE CHAT LOADED");

    restoreCustomerChat();
});
