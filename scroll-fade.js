
/* ==========================================
   AMPLIFIED SITES - SCROLL SLIDE ANIMATION
   WORKS ACROSS ALL WEBSITE PAGES
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 1. CHECK GSAP
    // ==========================================

    if (
        typeof gsap === "undefined" ||
        typeof ScrollTrigger === "undefined"
    ) {
        console.error("GSAP or ScrollTrigger failed to load.");
        return;
    }

    gsap.registerPlugin(ScrollTrigger);

    // ==========================================
    // 2. ACCESSIBILITY
    // ==========================================

    if (
        window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches
    ) {
        return;
    }

    // ==========================================
    // 3. PREVENT DUPLICATE ANIMATIONS
    // ==========================================

    const animatedElements = new WeakSet();

    // ==========================================
    // 4. SLIDE ANIMATION FUNCTION
    // ==========================================

    function slideIn(selector, direction) {

        const elements = gsap.utils.toArray(selector);

        elements.forEach(element => {

            if (animatedElements.has(element)) {
                return;
            }

            animatedElements.add(element);

            const distance =
                direction === "left" ? -60 : 60;

            // ==========================================
            // SLIDE IN ON SCROLL
            // ==========================================

            gsap.fromTo(element,
                {
                    x: distance,
                    opacity: 0
                },
                {
                    x: 0,
                    opacity: 1,
                    ease: "none",

                    scrollTrigger: {
                    trigger: element,

                    start: "top 90%",
                    end: "top 55%",

                    scrub: 1,

                    invalidateOnRefresh: true,
                    refreshPriority: -1
                }
                }
            );

        });

    }

    // ==========================================
    // 5. HOMEPAGE - WHAT I OFFER
    // ==========================================

    slideIn(".as-heading-wrap", "left");
    slideIn(".as-feature-card", "right");

    // ==========================================
    // 6. HOMEPAGE - OUR PROCESS
    // ==========================================

    slideIn(".as-process-header", "left");
    slideIn(".as-process-step", "right");

    // ==========================================
    // 7. HOMEPAGE - CLIENT REVIEWS
    // ==========================================

    slideIn(".as-reviews-heading", "left");
    slideIn(".as-review-form-box", "left");
    slideIn(".as-review-display-box", "right");

    // ==========================================
    // 8. UNIVERSAL - ALL WEBSITE PAGES
    // ==========================================

    slideIn(".slide-left", "left");
    slideIn(".slide-right", "right");

// ==========================================
// REFRESH WHEN PAGE CONTENT CHANGES
// ==========================================

window.addEventListener("load", () => {
    ScrollTrigger.refresh();
});

// Detect changes to page height
const resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(() => {
        ScrollTrigger.refresh();
    });
});

resizeObserver.observe(document.body);
});
