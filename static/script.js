const appState = {
    user: null,
    conversations: [],
    activeConversationId: null,
    recognition: null,
    isListening: false,
    searchQuery: ""
};

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options,
        headers: {
            ...(options.headers || {}),
            ...(options.method && options.method !== "GET" ? { "Content-Type": "application/json" } : {})
        }
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
        throw new Error(data.error || "Request failed.");
    }

    return data;
}

async function loadCurrentUser() {
    try {
        const data = await fetchJson("/api/auth/me");
        appState.user = data.user;
        document.getElementById("userChip").textContent = data.user.name;
        return data.user;
    } catch (error) {
        window.location.href = "/login";
        return null;
    }
}

async function loadConversations() {
    try {
        const data = await fetchJson("/api/conversations");
        appState.conversations = data.conversations || [];
        renderConversationList();
        if (!appState.activeConversationId && appState.conversations.length) {
            openConversation(appState.conversations[0].id);
        }
        if (!appState.activeConversationId) {
            showEmptyState();
        }
    } catch (error) {
        console.error(error);
    }
}

function renderConversationList() {
    const list = document.getElementById("conversationList");
    const query = appState.searchQuery.trim().toLowerCase();
    const filtered = appState.conversations.filter((conversation) => {
        if (!query) return true;
        return conversation.title.toLowerCase().includes(query);
    });

    list.innerHTML = "";

    if (!filtered.length) {
        list.innerHTML = '<div class="user-chip">No conversations found</div>';
        return;
    }

    for (const conversation of filtered) {
        const row = document.createElement("div");
        row.className = "conversation-item" + (conversation.id === appState.activeConversationId ? " active" : "");

        const mainButton = document.createElement("button");
        mainButton.type = "button";
        mainButton.className = "conversation-title";
        mainButton.textContent = conversation.title;
        mainButton.addEventListener("click", () => openConversation(conversation.id));

        const menuButton = document.createElement("button");
        menuButton.type = "button";
        menuButton.className = "conversation-menu";
        menuButton.textContent = "⋮";
        menuButton.setAttribute("data-id", String(conversation.id));
        menuButton.addEventListener("click", (event) => {
            event.stopPropagation();
            showConversationMenu(conversation.id);
        });

        row.appendChild(mainButton);
        row.appendChild(menuButton);
        list.appendChild(row);
    }
}

function showConversationMenu(conversationId) {
    const target = appState.conversations.find((item) => item.id === conversationId);
    if (!target) return;

    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.inset = "0";
    wrapper.style.background = "rgba(0,0,0,0.44)";
    wrapper.style.display = "grid";
    wrapper.style.placeItems = "center";
    wrapper.style.zIndex = "1000";

    const panel = document.createElement("div");
    panel.style.width = "min(300px, 90vw)";
    panel.style.background = "#0f1c27";
    panel.style.border = "1px solid rgba(255,255,255,0.08)";
    panel.style.borderRadius = "18px";
    panel.style.padding = "16px";
    panel.style.boxShadow = "0 15px 40px rgba(0,0,0,0.32)";

    const title = document.createElement("div");
    title.textContent = "Conversation";
    title.style.fontWeight = "700";
    title.style.marginBottom = "14px";

    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.textContent = "Rename";
    renameBtn.style.display = "block";
    renameBtn.style.width = "100%";
    renameBtn.style.marginBottom = "10px";
    renameBtn.style.padding = "12px";
    renameBtn.style.borderRadius = "10px";
    renameBtn.style.border = "1px solid rgba(255,255,255,0.08)";
    renameBtn.style.background = "rgba(255,255,255,0.03)";
    renameBtn.style.color = "white";
    renameBtn.addEventListener("click", () => {
        const nextTitle = window.prompt("Rename conversation", target.title);
        if (nextTitle && nextTitle.trim()) {
            renameConversation(conversationId, nextTitle.trim());
        }
        document.body.removeChild(wrapper);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.style.display = "block";
    deleteBtn.style.width = "100%";
    deleteBtn.style.padding = "12px";
    deleteBtn.style.borderRadius = "10px";
    deleteBtn.style.border = "1px solid rgba(255,93,93,0.32)";
    deleteBtn.style.background = "rgba(255,93,93,0.08)";
    deleteBtn.style.color = "#ffd1d1";
    deleteBtn.addEventListener("click", () => {
        document.body.removeChild(wrapper);
        deleteConversation(conversationId);
    });

    panel.appendChild(title);
    panel.appendChild(renameBtn);
    panel.appendChild(deleteBtn);
    wrapper.appendChild(panel);
    document.body.appendChild(wrapper);

    wrapper.addEventListener("click", (event) => {
        if (event.target === wrapper) {
            document.body.removeChild(wrapper);
        }
    });
}

async function renameConversation(conversationId, title) {
    try {
        const data = await fetchJson(`/api/conversations/${conversationId}`, {
            method: "PUT",
            body: JSON.stringify({ title })
        });

        const index = appState.conversations.findIndex((item) => item.id === conversationId);
        if (index >= 0) {
            appState.conversations[index] = data.conversation;
        }
        renderConversationList();
        if (appState.activeConversationId === conversationId) {
            document.getElementById("activeConversationTitle").textContent = data.conversation.title;
        }
    } catch (error) {
        alert(error.message);
    }
}

async function deleteConversation(conversationId) {
    const conversation = appState.conversations.find((item) => item.id === conversationId);
    if (!conversation) return;

    const confirmed = window.confirm(`Delete conversation?\n\nThis conversation and all its messages will be permanently deleted.`);
    if (!confirmed) return;

    try {
        await fetchJson(`/api/conversations/${conversationId}`, {
            method: "DELETE"
        });

        appState.conversations = appState.conversations.filter((item) => item.id !== conversationId);
        if (appState.activeConversationId === conversationId) {
            appState.activeConversationId = null;
            hideTyping();
            showEmptyState();
            renderConversationList();
        } else {
            renderConversationList();
        }
    } catch (error) {
        alert(error.message);
    }
}

function showEmptyState() {
    const emptyState = document.getElementById("emptyState");
    const chatWindow = document.getElementById("chatWindow");
    emptyState.classList.remove("hidden");
    chatWindow.innerHTML = "";
}

function hideEmptyState() {
    document.getElementById("emptyState").classList.add("hidden");
}

async function createConversation(title = "New Conversation") {
    const data = await fetchJson("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ title })
    });

    appState.conversations = [data.conversation, ...appState.conversations];
    appState.activeConversationId = data.conversation.id;
    renderConversationList();
    hideEmptyState();
    document.getElementById("chatWindow").innerHTML = "";
    document.getElementById("activeConversationTitle").textContent = data.conversation.title;
    return data.conversation.id;
}

async function openConversation(conversationId) {
    try {
        const data = await fetchJson(`/api/conversations/${conversationId}`);
        appState.activeConversationId = conversationId;
        hideEmptyState();
        document.getElementById("activeConversationTitle").textContent = data.conversation.title;
        renderConversationList();
        renderMessages(data.messages || []);
    } catch (error) {
        console.error(error);
    }
}

function renderMessages(messages) {
    const chatWindow = document.getElementById("chatWindow");
    chatWindow.innerHTML = "";

    if (!messages.length) {
        showEmptyState();
        return;
    }

    hideEmptyState();

    for (const message of messages) {
        const row = document.createElement("div");
        row.className = `message-row ${message.role === "user" ? "user" : "assistant"}`;

        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.textContent = message.role === "user" ? "👤" : "🚀";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";
        bubble.innerHTML = markdownToHtml(message.content);

        row.appendChild(avatar);
        row.appendChild(bubble);
        chatWindow.appendChild(row);
    }

    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function markdownToHtml(text) {
    const escaped = escapeHtml(text || "");
    const withParagraphs = escaped
        .replace(/\n\n+/g, "</p><p>")
        .replace(/\n/g, "<br>");
    return `<p>${withParagraphs}</p>`;
}

function showTyping() {
    document.getElementById("typingIndicator").classList.remove("hidden");
    const chatWindow = document.getElementById("chatWindow");
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function hideTyping() {
    document.getElementById("typingIndicator").classList.add("hidden");
}

async function sendCurrentMessage() {
    const input = document.getElementById("userInput");
    const message = input.value.trim();
    if (!message) return;

    if (!appState.activeConversationId) {
        appState.activeConversationId = await createConversation();
    }

    const currentConversationId = appState.activeConversationId;
    input.value = "";
    showTyping();

    try {
        const data = await fetchJson("/chat", {
            method: "POST",
            body: JSON.stringify({ message, conversation_id: currentConversationId })
        });

        if (data.conversation) {
            const index = appState.conversations.findIndex((item) => item.id === currentConversationId);
            if (index >= 0) {
                appState.conversations[index] = data.conversation;
            } else {
                appState.conversations = [data.conversation, ...appState.conversations];
            }
            renderConversationList();
            document.getElementById("activeConversationTitle").textContent = data.conversation.title;
        }

        const existingMessages = await fetchJson(`/api/conversations/${currentConversationId}/messages`);
        renderMessages(existingMessages.messages || []);
        hideTyping();
    } catch (error) {
        hideTyping();
        alert(error.message || "Something went wrong while sending the message.");
    }
}

function bindEvents() {
    document.getElementById("sendBtn").addEventListener("click", sendCurrentMessage);
    document.getElementById("tapToChatBtn").addEventListener("click", async () => {
        await createConversation("New Conversation");
    });

    document.getElementById("renameConversationBtn").addEventListener("click", () => {
        if (!appState.activeConversationId) return;
        const current = appState.conversations.find((item) => item.id === appState.activeConversationId);
        if (!current) return;
        const nextTitle = window.prompt("Rename conversation", current.title);
        if (nextTitle && nextTitle.trim()) {
            renameConversation(appState.activeConversationId, nextTitle.trim());
        }
    });

    document.getElementById("logoutBtn").addEventListener("click", async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
    });

    document.getElementById("userInput").addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            sendCurrentMessage();
        }
    });

    document.getElementById("conversationSearch").addEventListener("input", (event) => {
        appState.searchQuery = event.target.value;
        renderConversationList();
    });

    document.querySelectorAll(".suggestion-card").forEach((button) => {
        button.addEventListener("click", () => {
            const question = button.getAttribute("data-question");
            document.getElementById("userInput").value = question;
            sendCurrentMessage();
        });
    });

    const micButton = document.getElementById("micBtn");
    micButton.addEventListener("click", () => toggleSpeechRecognition());
}

function toggleSpeechRecognition() {
    const micButton = document.getElementById("micBtn");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert("Speech-to-text is not supported in this browser. Please use Chrome or Edge.");
        return;
    }

    if (appState.isListening) {
        if (appState.recognition) {
            appState.recognition.stop();
        }
        appState.isListening = false;
        micButton.classList.remove("listening");
        micButton.textContent = "🎤";
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        appState.isListening = true;
        micButton.classList.add("listening");
        micButton.textContent = "🔴";
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById("userInput").value = transcript;
        document.getElementById("userInput").focus();
    };

    recognition.onerror = () => {
        appState.isListening = false;
        micButton.classList.remove("listening");
        micButton.textContent = "🎤";
        alert("Speech recognition could not be started. Please check your microphone permissions.");
    };

    recognition.onend = () => {
        appState.isListening = false;
        micButton.classList.remove("listening");
        micButton.textContent = "🎤";
    };

    appState.recognition = recognition;
    recognition.start();
}

window.addEventListener("DOMContentLoaded", async () => {
    const user = await loadCurrentUser();
    if (!user) return;
    bindEvents();
    await loadConversations();
    if (!appState.conversations.length) {
        showEmptyState();
    }
});
