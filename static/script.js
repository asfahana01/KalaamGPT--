// ── Send message when Enter key is pressed ──
document.getElementById("userInput").addEventListener("keypress", function(e) {
    if (e.key === "Enter") sendMessage();
});

// ── Main send function ──
async function sendMessage() {
    const input = document.getElementById("userInput");
    const message = input.value.trim();

    // Don't send empty messages
    if (!message) return;

    // Clear input
    input.value = "";

    // Show user message in chat
    addMessage(message, "user");

    // Show typing indicator
    showTyping(true);

    // Disable send button while waiting
    document.getElementById("sendBtn").disabled = true;

    try {
        // Send to Flask backend
        const res = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: message })
        });

        const data = await res.json();

        // Hide typing indicator
        showTyping(false);

        // Show KalaamGPT's response
        if (data.response) {
            addMessage(data.response, "bot");
        } else {
            addMessage("I apologize, something went wrong. Please try again.", "bot");
        }

    } catch (error) {
        showTyping(false);
        addMessage("Connection error. Please check if the server is running.", "bot");
    }

    // Re-enable send button
    document.getElementById("sendBtn").disabled = false;

    // Focus back on input
    input.focus();
}

// ── Add a message bubble to chat window ──
function addMessage(text, sender) {
    const chatWindow = document.getElementById("chatWindow");

    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", sender === "user" ? "user-message" : "bot-message");

    const avatar = document.createElement("div");
    avatar.classList.add("avatar");
    avatar.textContent = sender === "user" ? "🧑" : "🚀";

    const bubble = document.createElement("div");
    bubble.classList.add("bubble");
    bubble.textContent = text;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(bubble);
    chatWindow.appendChild(messageDiv);

    // Auto scroll to latest message
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// ── Show or hide typing indicator ──
function showTyping(show) {
    const indicator = document.getElementById("typingIndicator");
    indicator.style.display = show ? "flex" : "none";

    // Scroll to show typing indicator
    const chatWindow = document.getElementById("chatWindow");
    chatWindow.scrollTop = chatWindow.scrollHeight;
}