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
    let playbackRunId = 0;
    let lastResponseText = "";
    let visibleCharacterCount = 0;
    let activeVideoTurnId = 0;
    let failedVideoTurnId = 0;
    let isMuted = false;
    let recognition = null;
    let isUserListening = false;
    let recognizedText = "";
    const speechSynthesis = window.speechSynthesis;

    function setState(state, message) {
        currentState = state;
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
        const hasResponse = Boolean(lastResponseText);
        const action = currentState === STATES.PAUSED
            ? "Resume"
            : currentState === STATES.SPEAKING ? "Pause" : "Play";
        elements.playPauseBtn.disabled = !hasResponse;
        elements.replayBtn.disabled = !hasResponse;
        elements.playPauseIcon.textContent = action === "Pause" ? "⏸" : "▶";
        elements.playPauseText.textContent = action;
        elements.playPauseBtn.title = `${action} avatar playback`;
    }

    function showSubtitle(text) {
        elements.subtitleBox.textContent = text;
        elements.subtitleOverlay.classList.remove("hidden");
    }

    function showResponse(text) {
        const isFirstReveal = elements.responseText.hidden;
        elements.responseText.textContent = text;
        elements.responsePlaceholder.hidden = true;
        elements.responseText.hidden = false;
        elements.responseContent.scrollTop = isFirstReveal
            ? 0
            : elements.responseContent.scrollHeight;
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
        try {
            elements.avatarVideo.currentTime = 0;
        } catch (error) {
            console.debug("Avatar video is not ready to reset.", error);
        }
        elements.avatarVideo.hidden = true;
        elements.avatarImg.hidden = false;
        updatePlaybackButtons();
    }

    function cancelActiveTurn() {
        activeTurnId += 1;
        playbackRunId += 1;
        elements.avatarTextSendBtn.disabled = false;
        if (speechSynthesis) speechSynthesis.cancel();
        clearVideo();
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
        setState(STATES.IDLE, "Ready to talk");
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

    function splitSpeechChunks(text, startOffset) {
        const matches = text.match(/[^.!?]+[.!?]+(?:["'’”)]*)\s*|[^.!?]+$/g);
        const chunks = matches && matches.length ? matches : [text];
        let offset = startOffset;
        return chunks.map(function (chunk) {
            const result = { text: chunk, start: offset };
            offset += chunk.length;
            return result;
        });
    }

    function showAvatarVideo(turnId) {
        if (turnId !== activeTurnId || failedVideoTurnId === turnId) return;
        activeVideoTurnId = turnId;
        elements.avatarImg.hidden = true;
        elements.avatarVideo.hidden = false;
        elements.avatarVideo.muted = true;
        elements.avatarVideo.loop = true;
        try {
            const playback = elements.avatarVideo.play();
            if (playback && typeof playback.catch === "function") {
                playback.catch(function (error) {
                    handleVideoFailure(turnId, error);
                });
            }
        } catch (error) {
            handleVideoFailure(turnId, error);
        }
    }

    function handleVideoFailure(turnId, error) {
        if (turnId !== activeTurnId || failedVideoTurnId === turnId) return;
        failedVideoTurnId = turnId;
        console.error("Avatar video playback failed; continuing with speech.", error);
        clearVideo();
        if (currentState === STATES.SPEAKING || currentState === STATES.PAUSED) {
            elements.statusText.textContent = "Speaking; video unavailable";
        }
    }

    function selectedSpeechVoice() {
        if (!speechSynthesis || typeof speechSynthesis.getVoices !== "function") return null;
        const voices = speechSynthesis.getVoices();
        return voices.find(function (voice) {
            return voice.name.toLowerCase().includes(elements.voiceSelect.value.toLowerCase());
        }) || voices.find(function (voice) {
            return voice.lang.toLowerCase().startsWith("en-in");
        }) || null;
    }

    function waitForSpeechQueueToDrain(turnId, runId) {
        if (turnId !== activeTurnId || runId !== playbackRunId) return;
        if (speechSynthesis.speaking || speechSynthesis.pending) {
            window.setTimeout(function () {
                waitForSpeechQueueToDrain(turnId, runId);
            }, 50);
            return;
        }
        clearVideo();
        elements.responseText.textContent = lastResponseText;
        setState(STATES.IDLE, "Ready to talk");
        elements.responseState.textContent = "Response ready";
        hideSubtitle();
    }

    function queueSpeechFrom(text, turnId, startOffset) {
        const runId = playbackRunId + 1;
        playbackRunId = runId;
        const chunks = splitSpeechChunks(text.slice(startOffset), startOffset);
        if (!speechSynthesis || typeof window.SpeechSynthesisUtterance !== "function") {
            showResponse(text);
            clearVideo();
            setState(STATES.ERROR, "Speech synthesis is not supported in this browser.");
            elements.responseState.textContent = "Response ready · speech unavailable";
            return;
        }

        let chunkIndex = 0;
        function speakNextChunk() {
            if (turnId !== activeTurnId || runId !== playbackRunId) return;
            if (chunkIndex >= chunks.length) {
                waitForSpeechQueueToDrain(turnId, runId);
                return;
            }

            const chunk = chunks[chunkIndex];
            const utterance = new window.SpeechSynthesisUtterance(chunk.text);
            utterance.lang = "en-IN";
            utterance.rate = Number(elements.speechRate.value);
            utterance.volume = isMuted ? 0 : 1;
            const voice = selectedSpeechVoice();
            if (voice) utterance.voice = voice;

            utterance.onstart = function () {
                if (turnId !== activeTurnId || runId !== playbackRunId) return;
                setState(STATES.SPEAKING, "KALAM-GPT is speaking");
                showAvatarVideo(turnId);
                showResponse(text.slice(0, visibleCharacterCount));
            };
            utterance.onboundary = function (event) {
                if (turnId !== activeTurnId || runId !== playbackRunId) return;
                const index = Number(event.charIndex);
                if (!Number.isFinite(index)) return;
                const reportedLength = Number(event.charLength);
                const remainingText = chunk.text.slice(index);
                const fallbackBoundary = remainingText.search(/\s/);
                const characterLength = reportedLength > 0
                    ? reportedLength
                    : Math.max(1, fallbackBoundary < 0 ? remainingText.length : fallbackBoundary);
                const boundaryEnd = chunk.start + Math.min(
                    chunk.text.length,
                    index + characterLength
                );
                visibleCharacterCount = Math.max(visibleCharacterCount, boundaryEnd);
                showResponse(text.slice(0, visibleCharacterCount));
            };
            utterance.onend = function () {
                if (turnId !== activeTurnId || runId !== playbackRunId) return;
                visibleCharacterCount = Math.max(visibleCharacterCount, chunk.start + chunk.text.length);
                showResponse(text.slice(0, visibleCharacterCount));
                chunkIndex += 1;
                speakNextChunk();
            };
            utterance.onerror = function (event) {
                if (turnId !== activeTurnId || runId !== playbackRunId ||
                    event.error === "canceled" || event.error === "interrupted") return;
                console.error("Avatar speech synthesis failed:", event.error);
                playbackRunId += 1;
                speechSynthesis.cancel();
                showResponse(text);
                clearVideo();
                setState(STATES.ERROR, "Speech playback failed.");
                elements.responseState.textContent = "Response ready · speech unavailable";
            };
            speechSynthesis.speak(utterance);
        }
        speakNextChunk();
    }

    function startSpeakingResponse(text, turnId) {
        lastResponseText = text;
        visibleCharacterCount = 0;
        showResponse("");
        elements.responseState.textContent = "Speaking response...";
        hideSubtitle();
        queueSpeechFrom(text, turnId, 0);
    }

    async function handleUserInput(rawText) {
        const message = rawText.trim();
        if (!message) return;
        const turnId = cancelActiveTurn();
        requestController = new AbortController();
        const signal = requestController.signal;
        elements.avatarTextInput.value = "";
        elements.avatarTextSendBtn.disabled = true;
        appendTranscript("user", message);
        elements.responseState.textContent = "Generating your response...";
        setState(STATES.PROCESSING, "Thinking & retrieving knowledge...");
        showSubtitle("Processing your question...");

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
            if (!responseText.trim()) {
                throw new Error("KALAM-GPT returned no text to speak.");
            }

            appendTranscript("assistant", responseText);
            startSpeakingResponse(responseText, turnId);
        } catch (error) {
            if (turnId !== activeTurnId || error.name === "AbortError") return;
            console.error("KALAM-GPT response request failed:", error);
            elements.responseState.textContent = "Response unavailable";
            setState(STATES.ERROR, error.message || "Unable to prepare the avatar response.");
            showSubtitle("KALAM-GPT could not create a response just now. Check your connection and try again.");
            return;
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
        if (!lastResponseText || !speechSynthesis) return;
        if (currentState === STATES.SPEAKING) {
            speechSynthesis.pause();
            elements.avatarVideo.pause();
            setState(STATES.PAUSED, "Playback paused");
        } else if (currentState === STATES.PAUSED) {
            speechSynthesis.resume();
            setState(STATES.SPEAKING, "KALAM-GPT is speaking");
            if (!elements.avatarVideo.hidden && failedVideoTurnId !== activeTurnId) {
                elements.avatarVideo.play().catch(function (error) {
                    handleVideoFailure(activeTurnId, error);
                });
            }
        } else {
            replayLastResponse();
        }
    }

    function replayLastResponse() {
        if (!lastResponseText) return;
        const responseText = lastResponseText;
        const turnId = cancelActiveTurn();
        startSpeakingResponse(responseText, turnId);
    }

    function restartSpeechAfterMuteChange() {
        if (currentState !== STATES.SPEAKING && currentState !== STATES.PAUSED) return;
        if (visibleCharacterCount >= lastResponseText.length) return;

        const wasPaused = currentState === STATES.PAUSED;
        const turnId = activeTurnId;
        const nextCharacter = visibleCharacterCount;
        playbackRunId += 1;
        speechSynthesis.cancel();
        queueSpeechFrom(lastResponseText, turnId, nextCharacter);
        if (wasPaused) {
            speechSynthesis.pause();
            elements.avatarVideo.pause();
            setState(STATES.PAUSED, "Playback paused");
        }
    }

    function cleanup() {
        cancelActiveTurn();
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
            elements.muteIcon.textContent = isMuted ? "🔇" : "🔊";
            elements.muteText.textContent = isMuted ? "Sound Off" : "Sound On";
            restartSpeechAfterMuteChange();
        });
        elements.playPauseBtn.addEventListener("click", togglePlayback);
        elements.replayBtn.addEventListener("click", function () {
            replayLastResponse();
        });
        elements.avatarVideo.addEventListener("ended", function () {
            if (elements.avatarVideo.hidden || activeVideoTurnId !== activeTurnId ||
                currentState !== STATES.SPEAKING) return;
            elements.avatarVideo.currentTime = 0;
            elements.avatarVideo.play().catch(function (error) {
                handleVideoFailure(activeTurnId, error);
            });
        });
        elements.avatarVideo.addEventListener("error", function () {
            if (!elements.avatarVideo.hidden && activeVideoTurnId === activeTurnId) {
                handleVideoFailure(
                    activeTurnId,
                    new Error("The prepared avatar video could not be loaded.")
                );
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
            } else if (!document.hidden && currentState === STATES.SPEAKING &&
                !elements.avatarVideo.hidden && failedVideoTurnId !== activeTurnId) {
                elements.avatarVideo.play().catch(function (error) {
                    handleVideoFailure(activeTurnId, error);
                });
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
