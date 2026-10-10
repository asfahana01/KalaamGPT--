(function () {
    "use strict";

    const STATES = {
        IDLE: "idle",
        LISTENING: "listening",
        PROCESSING: "processing",
        SPEAKING: "speaking",
        PAUSED: "paused",
        ERROR: "error"
    };

    const elements = {
        statusChip: document.getElementById("avatarStatusChip"),
        statusText: document.getElementById("statusText"),
        avatarWrapper: document.getElementById("avatarWrapper"),
        avatarImg: document.getElementById("avatarImg"),
        avatarIdleVideo: document.getElementById("avatarIdleVideo"),
        avatarVideo: document.getElementById("avatarVideo"),
        ambientGlow: document.getElementById("ambientGlow"),
        avatarMicBtn: document.getElementById("avatarMicBtn"),
        micIconInner: document.getElementById("micIconInner"),
        micHint: document.getElementById("micHint"),
        muteAudioBtn: document.getElementById("muteAudioBtn"),
        muteIcon: document.getElementById("muteIcon"),
        muteText: document.getElementById("muteText"),
        playPauseBtn: document.getElementById("playPauseBtn"),
        playPauseIcon: document.getElementById("playPauseIcon"),
        playPauseText: document.getElementById("playPauseText"),
        replayBtn: document.getElementById("replayBtn"),
        endSessionBtn: document.getElementById("endSessionBtn"),
        transcriptToggleBtn: document.getElementById("transcriptToggleBtn"),
        transcriptPanel: document.getElementById("transcriptPanel"),
        closeTranscriptBtn: document.getElementById("closeTranscriptBtn"),
        transcriptBody: document.getElementById("transcriptBody"),
        transcriptEmpty: document.getElementById("transcriptEmpty"),
        subtitleOverlay: document.getElementById("subtitleOverlay"),
        subtitleBox: document.getElementById("subtitleBox"),
        settingsToggleBtn: document.getElementById("settingsToggleBtn"),
        settingsPopover: document.getElementById("settingsPopover"),
        voiceSelect: document.getElementById("voiceSelect"),
        speechRate: document.getElementById("speechRate"),
        rateVal: document.getElementById("rateVal"),
        avatarTextForm: document.getElementById("avatarTextForm"),
        avatarTextInput: document.getElementById("avatarTextInput"),
        avatarTextSendBtn: document.getElementById("avatarTextSendBtn"),
        responseContent: document.getElementById("responseContent"),
        responsePlaceholder: document.getElementById("responsePlaceholder"),
        responseText: document.getElementById("responseText"),
        responseState: document.getElementById("responseState")
    };

    let currentState = STATES.IDLE;
    let activeConversationId = null;
    let activeTurnId = 0;
    let requestController = null;
    let lastVideoUrl = "";
    let idleAnimationFailed = false;
    let isMuted = false;
    let recognition = null;
    let isUserListening = false;
    let recognizedText = "";

    function setState(state, message) {
        currentState = state;
        if (state === STATES.IDLE || state === STATES.LISTENING) {
            startIdleAnimation();
        } else {
            stopIdleAnimation();
        }
        elements.avatarWrapper.classList.remove("listening", "speaking", "processing");
        elements.ambientGlow.classList.remove("listening", "speaking");
        elements.avatarMicBtn.classList.remove("listening", "speaking");
        elements.statusChip.querySelector(".status-dot").className = `status-dot ${state}`;

        switch (state) {
            case STATES.IDLE:
                elements.statusText.textContent = message || "Ready to talk";
                elements.micIconInner.textContent = "🎙️";
                elements.micHint.textContent = "Tap to Speak";
                break;
            case STATES.LISTENING:
                elements.statusText.textContent = message || "Listening...";
                elements.avatarWrapper.classList.add("listening");
                elements.ambientGlow.classList.add("listening");
                elements.avatarMicBtn.classList.add("listening");
                elements.micIconInner.textContent = "⏹️";
                elements.micHint.textContent = "Listening... Tap to Stop";
                break;
            case STATES.PROCESSING:
                elements.statusText.textContent = message || "Thinking...";
                elements.avatarWrapper.classList.add("processing");
                elements.micIconInner.textContent = "⏳";
                elements.micHint.textContent = "Preparing answer...";
                break;
            case STATES.SPEAKING:
                elements.statusText.textContent = message || "KALAM-GPT is speaking";
                elements.avatarWrapper.classList.add("speaking");
                elements.ambientGlow.classList.add("speaking");
                elements.avatarMicBtn.classList.add("speaking");
                elements.micIconInner.textContent = "🔊";
                elements.micHint.textContent = "Speaking... Tap to Interrupt";
                break;
            case STATES.PAUSED:
                elements.statusText.textContent = message || "Playback paused";
                elements.micIconInner.textContent = "▶";
                elements.micHint.textContent = "Paused. Resume or ask another question.";
                break;
            case STATES.ERROR:
                elements.statusText.textContent = message || "Something went wrong";
                elements.micIconInner.textContent = "⚠️";
                elements.micHint.textContent = "Type a message or try again";
                break;
        }

        updatePlaybackButtons();
    }

    function updatePlaybackButtons() {
        const hasVideo = Boolean(lastVideoUrl);
        const hasCurrentClip = Boolean(elements.avatarVideo.currentSrc);
        const isPaused = currentState === STATES.PAUSED ||
            (elements.avatarVideo.paused && !elements.avatarVideo.ended && hasCurrentClip);
        elements.playPauseBtn.disabled = !hasVideo;
        elements.replayBtn.disabled = !hasVideo;
        const action = isPaused ? "Resume" : hasCurrentClip ? "Pause" : "Play";
        elements.playPauseIcon.textContent = action === "Pause" ? "⏸" : "▶";
        elements.playPauseText.textContent = action;
        elements.playPauseBtn.title = `${action} avatar playback`;
    }

    function showSubtitle(text) {
        elements.subtitleBox.textContent = text;
        elements.subtitleOverlay.classList.remove("hidden");
    }

    function showResponse(text) {
        elements.responseText.textContent = text;
        elements.responsePlaceholder.hidden = true;
        elements.responseText.hidden = false;
        elements.responseContent.scrollTop = 0;
    }

    function hideSubtitle() {
        elements.subtitleOverlay.classList.add("hidden");
        elements.subtitleBox.textContent = "";
    }

    function appendTranscript(role, text) {
        if (elements.transcriptEmpty) {
            elements.transcriptEmpty.style.display = "none";
        }

        const item = document.createElement("div");
        item.className = `t-item ${role}`;
        const sender = document.createElement("span");
        sender.className = "t-sender";
        sender.textContent = role === "user" ? "You" : "KALAM-GPT";
        const bubble = document.createElement("div");
        bubble.className = "t-bubble";
        bubble.textContent = text;
        item.append(sender, bubble);
        elements.transcriptBody.appendChild(item);
        elements.transcriptBody.scrollTop = elements.transcriptBody.scrollHeight;
    }

    function clearVideo() {
        elements.avatarVideo.pause();
        elements.avatarVideo.removeAttribute("src");
        elements.avatarVideo.load();
        elements.avatarVideo.hidden = true;
        elements.avatarImg.hidden = false;
        stopIdleAnimation();
        updatePlaybackButtons();
    }

    function stopIdleAnimation() {
        elements.avatarIdleVideo.pause();
        elements.avatarIdleVideo.hidden = true;
        if (elements.avatarVideo.hidden) {
            elements.avatarImg.hidden = false;
        }
    }

    function handleIdleAnimationError(error) {
        idleAnimationFailed = true;
        stopIdleAnimation();
        console.error("Idle avatar video failed.", error);
        if (currentState === STATES.IDLE || currentState === STATES.LISTENING) {
            elements.statusText.textContent = "Idle animation unavailable; showing portrait.";
        }
    }

    function startIdleAnimation() {
        const videoUrl = elements.avatarIdleVideo.dataset.idleVideoUrl.trim();
        if (!videoUrl || idleAnimationFailed) return;

        try {
            const parsedUrl = new URL(videoUrl, window.location.href);
            if (parsedUrl.protocol !== "https:") {
                throw new Error("Idle avatar video must use HTTPS.");
            }

            if (!elements.avatarIdleVideo.currentSrc) {
                elements.avatarIdleVideo.src = parsedUrl.href;
                elements.avatarIdleVideo.load();
            }
            elements.avatarVideo.hidden = true;
            elements.avatarImg.hidden = true;
            elements.avatarIdleVideo.hidden = false;
            if (elements.avatarIdleVideo.paused) {
                elements.avatarIdleVideo.play().catch(function (error) {
                    handleIdleAnimationError(error);
                });
            }
        } catch (error) {
            handleIdleAnimationError(error);
        }
    }

    function cancelActiveTurn() {
        activeTurnId += 1;
        elements.avatarTextSendBtn.disabled = false;
        if (requestController) {
            requestController.abort();
            requestController = null;
        }
        if (recognition && isUserListening) {
            isUserListening = false;
            try {
                recognition.abort();
            } catch (error) {
                console.debug("Speech recognition was already stopped.", error);
            }
        }
        clearVideo();
        return activeTurnId;
    }

    async function fetchJson(url, options) {
        const response = await fetch(url, options);
        let data;
        try {
            data = await response.json();
        } catch (error) {
            throw new Error("The server returned an invalid response.");
        }
        if (!response.ok) {
            const error = new Error(data.error || "The request failed.");
            error.status = response.status;
            error.code = data.code || "request_failed";
            throw error;
        }
        return data;
    }

    function wait(milliseconds, signal) {
        return new Promise(function (resolve, reject) {
            function cleanup() {
                clearTimeout(timer);
                signal.removeEventListener("abort", onAbort);
            }
            function onAbort() {
                cleanup();
                reject(new DOMException("Request was cancelled.", "AbortError"));
            }
            const timer = setTimeout(function () {
                cleanup();
                resolve();
            }, milliseconds);

            if (signal.aborted) {
                onAbort();
            } else {
                signal.addEventListener("abort", onAbort, { once: true });
            }
        });
    }

    async function generateAvatarVideo(text, signal) {
        const creation = await fetchJson("/api/avatar/talks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: text,
                voice_id: elements.voiceSelect.value,
                rate: Number(elements.speechRate.value)
            }),
            signal: signal
        });
        if (typeof creation.talk_token !== "string" || !creation.talk_token) {
            throw new Error("Avatar provider returned an invalid video request.");
        }

        const deadline = Date.now() + 120000;
        while (Date.now() < deadline) {
            await wait(1800, signal);
            const result = await fetchJson(`/api/avatar/talks/${encodeURIComponent(creation.talk_token)}`, {
                method: "GET",
                signal: signal
            });
            if (result.status === "done") {
                return result.video_url;
            }
            if (result.status === "error") {
                throw new Error(result.error || "Avatar video generation failed.");
            }
            setState(STATES.PROCESSING, "Rendering the synchronized avatar...");
        }
        throw new Error("Avatar video generation took too long. Please try again.");
    }

    async function playVideo(url) {
        const parsedUrl = new URL(url, window.location.href);
        if (parsedUrl.protocol !== "https:") {
            throw new Error("The avatar provider returned an insecure video link.");
        }

        lastVideoUrl = parsedUrl.href;
        elements.avatarImg.hidden = true;
        elements.avatarVideo.hidden = false;
        elements.avatarVideo.src = lastVideoUrl;
        elements.avatarVideo.muted = isMuted;
        elements.avatarVideo.load();
        updatePlaybackButtons();

        try {
            await elements.avatarVideo.play();
        } catch (error) {
            if (error.name === "NotAllowedError") {
                setState(STATES.PAUSED, "Avatar ready. Press Play to start.");
                return;
            }
            throw new Error("Could not play the generated avatar video.");
        }
    }

    async function handleUserInput(rawText) {
        const message = rawText.trim();
        if (!message) return;
        if (requestController && currentState === STATES.PROCESSING) return;

        const turnId = cancelActiveTurn();
        requestController = new AbortController();
        const signal = requestController.signal;
        elements.avatarTextInput.value = "";
        elements.avatarTextSendBtn.disabled = true;
        appendTranscript("user", message);
        elements.responseState.textContent = "Generating your response...";
        setState(STATES.PROCESSING, "Thinking & retrieving knowledge...");
        showSubtitle("Processing your question...");

        let spokenText;
        try {
            const data = await fetchJson("/api/avatar/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: message,
                    conversation_id: activeConversationId
                }),
                signal: signal
            });
            if (turnId !== activeTurnId) return;

            activeConversationId = data.conversation_id;
            const responseText = data.response || "";
            spokenText = data.spoken_text || responseText;
            if (!spokenText.trim()) {
                throw new Error("KALAM-GPT returned no text to speak.");
            }

            showResponse(responseText || spokenText);
            appendTranscript("assistant", responseText || spokenText);
            elements.responseState.textContent = "Response ready";
            hideSubtitle();
        } catch (error) {
            if (turnId !== activeTurnId || error.name === "AbortError") return;
            console.error("KALAM-GPT response request failed:", error);
            elements.responseState.textContent = "Response unavailable";
            setState(STATES.ERROR, error.message || "Unable to prepare the avatar response.");
            showSubtitle("KALAM-GPT could not create a response just now. Check your connection and try again.");
            return;
        }

        if (turnId !== activeTurnId) return;
        elements.responseState.textContent = "Preparing synchronized avatar video...";
        setState(STATES.PROCESSING, "Preparing the synthetic voice and avatar...");
        showSubtitle("Your response is ready. Preparing the avatar...");

        try {
            const videoUrl = await generateAvatarVideo(spokenText, signal);
            if (turnId !== activeTurnId) return;
            await playVideo(videoUrl);
            if (turnId === activeTurnId) {
                elements.responseState.textContent = "Response ready";
                hideSubtitle();
            }
        } catch (error) {
            if (turnId !== activeTurnId || error.name === "AbortError") return;
            console.error("Avatar video generation failed:", {
                status: error.status || null,
                code: error.code || "avatar_video_error"
            });
            elements.responseState.textContent = "Text response ready · avatar video unavailable";
            setState(STATES.ERROR, "Response ready; avatar unavailable");
            const paymentGuidance = error.status === 402
                ? " D-ID requires an account or payment action; check billing, plan access, and credits."
                : "";
            showSubtitle(
                `Your response is ready, but the avatar could not speak it right now. Please check the avatar service and try again.${paymentGuidance}`
            );
        } finally {
            if (turnId === activeTurnId) {
                requestController = null;
                elements.avatarTextSendBtn.disabled = false;
            }
        }
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    function initSpeechRecognition() {
        if (!SpeechRecognition) return;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-IN";

        recognition.onstart = function () {
            isUserListening = true;
            recognizedText = "";
            setState(STATES.LISTENING, "Listening to your voice...");
            showSubtitle("Listening... Speak now.");
        };

        recognition.onresult = function (event) {
            let finalText = "";
            let interimText = "";
            for (let index = 0; index < event.results.length; index += 1) {
                const result = event.results[index];
                if (result.isFinal) {
                    finalText += `${result[0].transcript} `;
                } else {
                    interimText += `${result[0].transcript} `;
                }
            }
            recognizedText = finalText.trim();
            const visibleText = (recognizedText || interimText.trim()).trim();
            if (visibleText) showSubtitle(`“${visibleText}”`);
        };

        recognition.onerror = function (event) {
            isUserListening = false;
            console.error("Speech recognition error:", event.error);
            if (event.error === "not-allowed" || event.error === "service-not-allowed") {
                setState(STATES.ERROR, "Microphone access was denied.");
                showSubtitle("Allow microphone access in your browser, or type your message.");
            } else if (event.error !== "no-speech" && event.error !== "aborted") {
                setState(STATES.ERROR, "Speech recognition is unavailable.");
                showSubtitle("Try speaking again or type your message.");
            }
        };

        recognition.onend = function () {
            const transcript = isUserListening ? recognizedText : "";
            isUserListening = false;
            if (transcript) {
                handleUserInput(transcript);
            } else if (currentState === STATES.LISTENING) {
                setState(STATES.IDLE, "No speech detected. Tap the microphone to try again.");
                hideSubtitle();
            }
        };
    }

    function startListening() {
        if (!recognition) {
            setState(STATES.ERROR, "Speech recognition is not supported here.");
            showSubtitle("Use the message box to type your question.");
            return;
        }
        try {
            recognition.start();
        } catch (error) {
            console.error("Could not start speech recognition:", error);
            setState(STATES.ERROR, "Could not start the microphone.");
        }
    }

    function toggleMicrophone() {
        if (isUserListening) {
            recognition.stop();
            return;
        }
        if (currentState === STATES.SPEAKING || currentState === STATES.PAUSED ||
            currentState === STATES.PROCESSING) {
            cancelActiveTurn();
        }
        startListening();
    }

    function togglePlayback() {
        if (!lastVideoUrl) return;
        if (elements.avatarVideo.paused) {
            if (!elements.avatarVideo.currentSrc) {
                playVideo(lastVideoUrl).catch(handlePlaybackError);
            } else {
                elements.avatarVideo.play().catch(handlePlaybackError);
            }
        } else {
            elements.avatarVideo.pause();
        }
    }

    function handlePlaybackError(error) {
        console.error("Avatar video playback failed:", error);
        clearVideo();
        setState(STATES.ERROR, error.message || "Could not play the avatar video.");
        showSubtitle("Video playback failed. Replay the answer or try another question.");
    }

    function cleanup() {
        cancelActiveTurn();
        elements.avatarVideo.pause();
        stopIdleAnimation();
        if (recognition && isUserListening) {
            try {
                recognition.abort();
            } catch (error) {
                console.debug("Speech recognition cleanup was already complete.", error);
            }
        }
    }

    function initEvents() {
        elements.avatarMicBtn.addEventListener("click", toggleMicrophone);
        elements.avatarTextForm.addEventListener("submit", function (event) {
            event.preventDefault();
            handleUserInput(elements.avatarTextInput.value);
        });

        elements.muteAudioBtn.addEventListener("click", function () {
            isMuted = !isMuted;
            elements.avatarVideo.muted = isMuted;
            elements.muteIcon.textContent = isMuted ? "🔇" : "🔊";
            elements.muteText.textContent = isMuted ? "Sound Off" : "Sound On";
        });
        elements.playPauseBtn.addEventListener("click", togglePlayback);
        elements.replayBtn.addEventListener("click", function () {
            if (lastVideoUrl) playVideo(lastVideoUrl).catch(handlePlaybackError);
        });
        elements.avatarVideo.addEventListener("playing", function () {
            if (!elements.avatarVideo.currentSrc) return;
            setState(STATES.SPEAKING, "KALAM-GPT is speaking");
        });
        elements.avatarVideo.addEventListener("pause", function () {
            if (elements.avatarVideo.currentSrc && !elements.avatarVideo.ended &&
                currentState === STATES.SPEAKING) {
                setState(STATES.PAUSED, "Playback paused");
            }
        });
        elements.avatarVideo.addEventListener("ended", function () {
            if (currentState !== STATES.SPEAKING || !elements.avatarVideo.currentSrc) return;
            clearVideo();
            setState(STATES.IDLE, "Ready to talk");
            hideSubtitle();
        });
        elements.avatarVideo.addEventListener("error", function () {
            if (!elements.avatarVideo.hidden) {
                handlePlaybackError(new Error("The generated avatar video could not be loaded."));
            }
        });
        elements.avatarIdleVideo.addEventListener("error", function () {
            if (!elements.avatarIdleVideo.hidden) {
                handleIdleAnimationError(new Error("The configured idle video could not be loaded."));
            }
        });

        elements.settingsToggleBtn.addEventListener("click", function (event) {
            event.stopPropagation();
            elements.settingsPopover.classList.toggle("hidden");
        });
        document.addEventListener("click", function (event) {
            if (!elements.settingsPopover.contains(event.target) &&
                !elements.settingsToggleBtn.contains(event.target)) {
                elements.settingsPopover.classList.add("hidden");
            }
        });
        elements.speechRate.addEventListener("input", function () {
            elements.rateVal.textContent = `${elements.speechRate.value}x`;
        });
        elements.transcriptToggleBtn.addEventListener("click", function () {
            elements.transcriptPanel.classList.toggle("hidden");
        });
        elements.closeTranscriptBtn.addEventListener("click", function () {
            elements.transcriptPanel.classList.add("hidden");
        });
        elements.endSessionBtn.addEventListener("click", function () {
            cleanup();
            window.location.href = "/chat";
        });
        window.addEventListener("keydown", function (event) {
            if (event.code === "Space" && event.target === document.body) {
                event.preventDefault();
                toggleMicrophone();
            }
        });
        document.addEventListener("visibilitychange", function () {
            if (document.hidden && !elements.avatarVideo.paused) {
                elements.avatarVideo.pause();
            }
            if (document.hidden) {
                stopIdleAnimation();
            } else if (currentState === STATES.IDLE || currentState === STATES.LISTENING) {
                startIdleAnimation();
            }
        });
        window.addEventListener("pagehide", cleanup, { once: true });
    }

    document.addEventListener("DOMContentLoaded", function () {
        initSpeechRecognition();
        initEvents();
        setState(STATES.IDLE, "Ready to talk");
    });
})();
