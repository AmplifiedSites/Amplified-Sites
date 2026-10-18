/* ==========================================
   AMPLIFIED SITES - SCROLL SLIDE ANIMATION
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    if (
        typeof gsap === "undefined" ||
        typeof ScrollTrigger === "undefined"
    ) {
        console.error("GSAP or ScrollTrigger failed to load.");
        return;
    }

    gsap.registerPlugin(ScrollTrigger);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    // ==========================================
    // SLIDE ANIMATION FUNCTION
    // ==========================================

    function slideIn(selector, direction) {

    const elements = gsap.utils.toArray(selector);

    elements.forEach(element => {

        const distance = direction === "left" ? -100 : 100;

        const timeline = gsap.timeline({
            scrollTrigger: {
                trigger: element,
                start: "top 95%",
                end: "bottom -30%",
                scrub: 2,
                invalidateOnRefresh: true
            }
        });

        timeline
            // SLIDE IN
            .fromTo(element,
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
            )

            // STAY VISIBLE
            .to(element, {
                x: 0,
                opacity: 1,
                duration: 2,
                ease: "none"
            })

            // SLIDE OUT
            .to(element, {
                x: -distance,
                opacity: 0,
                duration: 1,
                ease: "none"
            });

    });

}

    // ==========================================
    // WHAT I OFFER
    // ==========================================

    slideIn(".as-heading-wrap", "left");
    slideIn(".as-feature-card", "right");

    // ==========================================
    // OUR PROCESS
    // ==========================================

    slideIn(".as-process-header", "left");
    slideIn(".as-process-step", "right");

    // ==========================================
    // CLIENT REVIEWS
    // ==========================================

    slideIn(".as-reviews-heading", "left");
    slideIn(".as-review-form-box", "left");
    slideIn(".as-review-display-box", "right");

    // ==========================================
    // REFRESH
    // ==========================================

    window.addEventListener("load", () => {
        ScrollTrigger.refresh();
    });

    console.log("Scroll slide animations working.");

});
