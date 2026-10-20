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

            // Don't animate the same element twice
            if (animatedElements.has(element)) {
                return;
            }

            animatedElements.add(element);

            const distance =
                direction === "left" ? -100 : 100;

            // ==========================================
            // SCROLL TIMELINE
            // ==========================================

            const timeline = gsap.timeline({

                scrollTrigger: {
                    trigger: element,

                    // Begin entering the screen
                    start: "top 95%",

                    // Finish after leaving the screen
                    end: "bottom -30%",

                    // Smooth scroll movement
                    scrub: 2,

                    invalidateOnRefresh: true
                }

            });

            // ==========================================
            // SLIDE IN
            // ==========================================

            timeline.fromTo(element,
                {
                    x: distance,
                    opacity: 0
                },
                {
                    x: 0,
                    opacity: 1,
                    duration: 1,
                    ease: "none"
                }
            );

            // ==========================================
            // STAY VISIBLE
            // ==========================================

            timeline.to(element, {
                x: 0,
                opacity: 1,
                duration: 2,
                ease: "none"
            });

            // ==========================================
            // SLIDE OUT
            // ==========================================
            timeline.to(element, {
                x: distance,
                opacity: 0,
                duration: 1,
                ease: "none"
            });

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

    // Slide content from the left
    slideIn(".slide-left", "left");

    // Slide content from the right
    slideIn(".slide-right", "right");


    // ==========================================
    // 9. REFRESH SCROLLTRIGGER
    // ==========================================

    window.addEventListener("load", () => {
        ScrollTrigger.refresh();
    });

    console.log(
        "Amplified Sites scroll animations loaded successfully."
    );

});
