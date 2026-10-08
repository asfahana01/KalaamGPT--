(function () {
    // 1. Preloader
    const loader = document.getElementById("landingLoader");
    function hideLoader() {
        if (!loader) return;
        loader.classList.add("hide");
        setTimeout(() => {
            if (loader.parentNode) loader.parentNode.removeChild(loader);
        }, 600);
    }
    window.addEventListener("load", hideLoader);
    setTimeout(hideLoader, 2000); // Fallback

    // 2. FAB Back to Top
    const fabTop = document.getElementById("fab-top");
    const heroSection = document.getElementById("hero");

    function updateFab() {
        if (!fabTop || !heroSection) return;
        const heroBottom = heroSection.getBoundingClientRect().bottom;
        if (heroBottom < 100) {
            fabTop.classList.add("visible");
        } else {
            fabTop.classList.remove("visible");
        }
    }
    window.addEventListener("scroll", updateFab, { passive: true });
    updateFab();

    // 3. Quotes Switcher
    const quotes = [
        {
            text: "Dream, dream, dream. Dreams transform into thoughts and thoughts result in action.",
            author: "— Dr. A.P.J. Abdul Kalam"
        },
        {
            text: "If you fail, never give up because F.A.I.L. means 'First Attempt In Learning'.",
            author: "— Dr. A.P.J. Abdul Kalam"
        },
        {
            text: "You have to dream before your dreams can come true.",
            author: "— Dr. A.P.J. Abdul Kalam"
        },
        {
            text: "Excellence is a continuous process and not an accident.",
            author: "— Dr. A.P.J. Abdul Kalam"
        },
        {
            text: "To succeed in your mission, you must have single-minded devotion to your goal.",
            author: "— Dr. A.P.J. Abdul Kalam"
        },
        {
            text: "Learning gives creativity, creativity leads to thinking, thinking provides knowledge, knowledge makes you great.",
            author: "— Dr. A.P.J. Abdul Kalam"
        }
    ];

    let currentQuoteIndex = 0;
    const quoteTextEl = document.getElementById("quoteText");
    const quoteAuthorEl = document.getElementById("quoteAuthor");
    const prevQuoteBtn = document.getElementById("prevQuoteBtn");
    const nextQuoteBtn = document.getElementById("nextQuoteBtn");

    function renderQuote(index) {
        if (!quoteTextEl || !quoteAuthorEl) return;
        quoteTextEl.style.opacity = "0";
        quoteAuthorEl.style.opacity = "0";

        setTimeout(() => {
            quoteTextEl.textContent = quotes[index].text;
            quoteAuthorEl.textContent = quotes[index].author;
            quoteTextEl.style.opacity = "1";
            quoteAuthorEl.style.opacity = "1";
        }, 200);
    }

    if (prevQuoteBtn && nextQuoteBtn) {
        prevQuoteBtn.addEventListener("click", () => {
            currentQuoteIndex = (currentQuoteIndex - 1 + quotes.length) % quotes.length;
            renderQuote(currentQuoteIndex);
        });

        nextQuoteBtn.addEventListener("click", () => {
            currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
            renderQuote(currentQuoteIndex);
        });
    }

    // Auto rotate quotes every 7 seconds
    setInterval(() => {
        if (quoteTextEl) {
            currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
            renderQuote(currentQuoteIndex);
        }
    }, 7000);

    // 4. Smooth Anchor Scrolling
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener("click", function (e) {
            const targetId = this.getAttribute("href");
            if (targetId === "#") return;
            const targetEl = document.querySelector(targetId);
            if (targetEl) {
                e.preventDefault();
                targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    });
})();
