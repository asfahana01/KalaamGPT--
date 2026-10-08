(function () {
    const urlParams = new URLSearchParams(window.location.search);
    const userEmail = urlParams.get("email") || sessionStorage.getItem("pending_email") || "";

    const emailEl = document.getElementById("targetEmail");
    const otpBoxes = Array.from(document.querySelectorAll(".otp-box"));
    const form = document.getElementById("otpForm");
    const verifyBtn = document.getElementById("verifyBtn");
    const resendBtn = document.getElementById("resendBtn");
    const timerEl = document.getElementById("timerCountdown");
    const messageEl = document.getElementById("otpMessage");

    let timerInterval = null;
    let secondsLeft = 300; // 5 minutes
    let resendCooldown = 0;
    let resendInterval = null;

    function maskEmail(email) {
        if (!email || !email.includes("@")) return email || "your email";
        const [local, domain] = email.split("@");
        if (local.length <= 2) return `${local[0]}***@${domain}`;
        return `${local[0]}***${local[local.length - 1]}@${domain}`;
    }

    if (userEmail) {
        emailEl.textContent = maskEmail(userEmail);
    } else {
        emailEl.textContent = "your email address";
    }

    function startTimer() {
        clearInterval(timerInterval);
        secondsLeft = 300;
        updateTimerDisplay();

        timerInterval = setInterval(() => {
            secondsLeft--;
            if (secondsLeft <= 0) {
                clearInterval(timerInterval);
                timerEl.textContent = "00:00";
                messageEl.textContent = "This verification code has expired. Please request a new code.";
                messageEl.className = "form-message error";
            } else {
                updateTimerDisplay();
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
        const secs = String(secondsLeft % 60).padStart(2, "0");
        timerEl.textContent = `${mins}:${secs}`;
    }

    function startResendCooldown() {
        resendCooldown = 60;
        resendBtn.disabled = true;

        resendInterval = setInterval(() => {
            resendCooldown--;
            if (resendCooldown <= 0) {
                clearInterval(resendInterval);
                resendBtn.disabled = false;
                resendBtn.textContent = "Resend OTP";
            } else {
                resendBtn.textContent = `Resend (${resendCooldown}s)`;
            }
        }, 1000);
    }

    // Input handlers
    otpBoxes.forEach((box, index) => {
        box.addEventListener("input", (e) => {
            const val = e.target.value.replace(/[^0-9]/g, "");
            e.target.value = val ? val[val.length - 1] : "";

            if (e.target.value && index < otpBoxes.length - 1) {
                otpBoxes[index + 1].focus();
            }
        });

        box.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !box.value && index > 0) {
                otpBoxes[index - 1].focus();
            }
        });

        box.addEventListener("paste", (e) => {
            e.preventDefault();
            const pasteData = (e.clipboardData || window.clipboardData).getData("text").trim();
            const digits = pasteData.replace(/[^0-9]/g, "").slice(0, 6);

            digits.split("").forEach((digit, i) => {
                if (otpBoxes[i]) {
                    otpBoxes[i].value = digit;
                }
            });

            const nextIndex = Math.min(digits.length, otpBoxes.length - 1);
            otpBoxes[nextIndex].focus();
        });
    });

    function getEnteredOtp() {
        return otpBoxes.map((box) => box.value.trim()).join("");
    }

    // Submit handler
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        messageEl.textContent = "";
        messageEl.className = "form-message";

        const otp = getEnteredOtp();
        if (otp.length < 6) {
            messageEl.textContent = "Please enter all 6 digits of the verification code.";
            messageEl.className = "form-message error";
            return;
        }

        if (!userEmail) {
            messageEl.textContent = "Email address is missing. Please return to signup.";
            messageEl.className = "form-message error";
            return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = "Verifying...";

        try {
            const response = await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: userEmail, otp })
            });

            const data = await response.json();

            if (!response.ok) {
                messageEl.textContent = data.error || "Verification failed.";
                messageEl.className = "form-message error";
                verifyBtn.disabled = false;
                verifyBtn.textContent = "Verify Email";
                return;
            }

            // Success state
            messageEl.textContent = "Email verified successfully! Redirecting to login...";
            messageEl.className = "form-message success";
            verifyBtn.textContent = "Verified ✓";

            setTimeout(() => {
                window.location.href = "/login";
            }, 1500);
        } catch (err) {
            messageEl.textContent = "Network error. Please try again.";
            messageEl.className = "form-message error";
            verifyBtn.disabled = false;
            verifyBtn.textContent = "Verify Email";
        }
    });

    // Resend handler
    resendBtn.addEventListener("click", async () => {
        if (!userEmail || resendCooldown > 0) return;

        messageEl.textContent = "Sending new verification code...";
        messageEl.className = "form-message";

        try {
            const response = await fetch("/api/auth/resend-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: userEmail })
            });

            const data = await response.json();

            if (!response.ok) {
                messageEl.textContent = data.error || "Failed to resend verification code.";
                messageEl.className = "form-message error";
                return;
            }

            messageEl.textContent = data.message || "New code sent to your email!";
            messageEl.className = "form-message success";

            // Clear boxes & restart timer & start cooldown
            otpBoxes.forEach((box) => (box.value = ""));
            otpBoxes[0].focus();
            startTimer();
            startResendCooldown();
        } catch (err) {
            messageEl.textContent = "Failed to resend verification code.";
            messageEl.className = "form-message error";
        }
    });

    // Start timer on load
    startTimer();
})();
