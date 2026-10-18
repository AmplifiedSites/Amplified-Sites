/* ==========================================
   AMPLIFIED SITES - GLOBAL SCROLL FADE
   Fade in and out while scrolling
========================================== */

(() => {
    function initializeScrollFade() {

        const sections = document.querySelectorAll(
            "main > section:not(.hero), body > section:not(.hero), .scroll-fade"
        );

        if (!sections.length) return;

        function updateScrollFade() {
            const screenHeight = window.innerHeight;
            const fadeDistance = screenHeight * 120;

            sections.forEach(section => {
                const rect = section.getBoundingClientRect();

                  let opacity = 1
                  
                  if (rect.bottom < fadeDistance) {
                     opacity = Math.max(
                        0,
                        rect.bottom / fadeDistance
                        );
                  }
               else if (rect.top > screenHeight - fadeDistance) {
                  opacity = Math.max(
                     0,
                     (screenHeight - rect.top) / fadeDistance
                     );
               }
                section.style.opacity = String(
                   Math.max(0, Math.min(1, opacity))
                   );
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
