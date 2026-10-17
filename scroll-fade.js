/* ==========================================
   AMPLIFIED SITES - GLOBAL SCROLL FADE
   Fade in and out while scrolling
========================================== */

(() => {
    function initializeScrollFade() {

        const sections = document.querySelectorAll(
            "main > section:not(.hero), body > section:not(.hero), .scroll-fade, .hero-content"
        );

        if (!sections.length) return;

        function updateScrollFade() {
            const screenHeight = window.innerHeight;
            const fadeDistance = screenHeight * 1.5;

            sections.forEach(section => {
                const rect = section.getBoundingClientRect();

                const fadeIn = (screenHeight - rect.top) / fadeDistance;
                const fadeOut = rect.bottom / fadeDistance;

                const opacity = Math.max(
                    0,
                    Math.min(1, fadeIn, fadeOut)
                );

                section.style.opacity = String(opacity);
            });
        }

        let ticking = false;

        function handleScroll() {
            if (ticking) return;

            ticking = true;

            requestAnimationFrame(() => {
                updateScrollFade();
                ticking = false;
            });
        }

        window.addEventListener("scroll", handleScroll, { passive: true });
        window.addEventListener("resize", handleScroll);

        updateScrollFade();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeScrollFade);
    } else {
        initializeScrollFade();
    }
})();