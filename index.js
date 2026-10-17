const canvas = document.getElementById("index-background");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);

/* =========================
   MOUSE
========================= */
const mouse = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2
};

window.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

/* =========================
   ARRAYS
========================= */
const stars = [];
const beams = [];
const streaks = [];
const particles = [];
const ribbons = [];

/* =========================
   STAR
========================= */
class Star {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 5;
    this.opacity = Math.random();
    this.speed = 0.01 + Math.random() * 0.03;
  }

  update() {
    this.opacity += this.speed;

    if (this.opacity > 1 || this.opacity < 0.2) {
      this.speed *= -1;
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${this.opacity})`;
    ctx.fill();
  }
}

/* =========================
   STREAK
========================= */
class Streak {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.length = 120 + Math.random() * 250;
    this.speed = 3 + Math.random() * 15;
    this.width = 1 + Math.random() * 3;
    this.angle = Math.random() * Math.PI * 2;
    this.wave = Math.random() * 6;
    this.alpha = 0.15 + Math.random() * 0.35;
  }

  update() {
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    this.angle += Math.sin(Date.now() * 0.00025 + this.wave) * 0.002;

    if (
      this.x < -200 ||
      this.x > canvas.width + 200 ||
      this.y < -200 ||
      this.y > canvas.height + 200
    ) {
      this.reset();
    }
  }

  draw() {
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);

    ctx.quadraticCurveTo(
      this.x + Math.cos(this.angle) * 80,
      this.y + Math.sin(this.angle) * 80,
      this.x + Math.cos(this.angle) * this.length,
      this.y + Math.sin(this.angle) * this.length
    );

    ctx.strokeStyle = `rgba(37,99,235,${this.alpha})`;
    ctx.lineWidth = this.width;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#2563eb";
    ctx.stroke();
  }
}

/* =========================
   PARTICLE
========================= */
class Particle {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.size = Math.random() * 2 + 1;
    this.speed = Math.random() * 0.8+ 0.4;
  }

  update() {
    this.y -= this.speed;

    if (this.y < 0) {
      this.y = canvas.height;
      this.x = Math.random() * canvas.width;
    }
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(120,180,255,.8)";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#2563eb";
    ctx.fill();
  }
}



/* =========================
   LIGHT BEAM
========================= */
class LightBeam {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = Math.random() * canvas.width;
    this.y = -300;
    this.width = 200 + Math.random() * 400;
    this.height = canvas.height * 2;
    this.speed = 0.15 + Math.random() * 0.35;
    this.angle = -25 + Math.random() * 12;
    this.opacity = 0.025 + Math.random() * 0.03;
  }

  update() {
    this.y += this.speed;

    if (this.y > canvas.height + 400) {
      this.reset();
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.angle * Math.PI) / 180);

    const gradient = ctx.createLinearGradient(0, 0, this.width, 0);

    gradient.addColorStop(0, "rgba(37,99,235,0)");
    gradient.addColorStop(0.5, `rgba(37,99,235,${this.opacity})`);
    gradient.addColorStop(1, "rgba(37,99,235,0)");

    ctx.fillStyle = gradient;
    

    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

    ctx.restore();
  }
}

/* =========================
   RIBBON
========================= */
class Ribbon {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = -300;
    this.y = Math.random() * canvas.height;
    this.speed = 0.5 + Math.random() * 1.2;
    this.width = 180 + Math.random() * 220;
    this.opacity = 0.05 + Math.random() * 0.08;
    this.curve = (Math.random() - 0.5) * 300;
  }

  update() {
    this.x += this.speed;
    if (this.x > canvas.width + 300) this.reset();
  }

  draw() {
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);

    ctx.bezierCurveTo(
      this.x + this.width * 0.3,
      this.y - this.curve,
      this.x + this.width * 0.7,
      this.y + this.curve,
      this.x + this.width,
      this.y
    );

    ctx.strokeStyle = `rgba(37,99,235,${this.opacity})`;
    ctx.lineWidth = 6;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#2563eb";
    ctx.stroke();
  }
}

/* =========================
   INIT
========================= */
function init() {
  stars.length = 0;
  beams.length = 0;
  streaks.length = 0;
  particles.length = 0;
  ribbons.length = 0;

for (let i = 0; i < 100; i++) stars.push(new Star());
for (let i = 0; i < 2; i++) beams.push(new LightBeam());
for (let i = 0; i < 60; i++) streaks.push(new Streak());
for (let i = 0; i < 80; i++) particles.push(new Particle());
for (let i = 0; i < 4; i++) ribbons.push(new Ribbon());
}

init();

/* =========================
   ANIMATION LOOP
========================= */
function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // draw everything
  stars.forEach((o) => {
    o.update();
    o.draw();
  });

  beams.forEach((o) => {
    o.update();
    o.draw();
  });

  streaks.forEach((o) => {
    o.update();
    o.draw();
  });

  particles.forEach((o) => {
    o.update();
    o.draw();
  });

  ribbons.forEach((o) => {
    o.update();
    o.draw();
  });

  requestAnimationFrame(animate);
}

animate();


    // Services hidden section
  const cards = document.querySelectorAll(".as-feature-card");
  cards.forEach(card => {
      const arrow = card.querySelector(".as-arrow");
      arrow.addEventListener("click", () => {
          card.classList.toggle("active");
      });
});


/* =========================================
   AMPLIFIED SITES - CUSTOMER REVIEWS
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    const reviewForm = document.getElementById("asReviewForm");
    const reviewList = document.getElementById("asReviewList");

    if (!reviewForm || !reviewList) return;

    const reviewClient = publicSupabase;

    
    const nameInput = document.getElementById("asReviewName");
    const emailInput = document.getElementById("asReviewEmail");
    const businessInput = document.getElementById("asReviewBusiness");
    const ratingInput = document.getElementById("asReviewStars");
    const messageInput = document.getElementById("asReviewMessage");
    const statusText = document.getElementById("asReviewStatus");
    const submitButton = document.getElementById("asReviewSubmit");

    const ratingButtons = document.querySelectorAll(
        "#asReviewRating button"
    );

    const reviewCount = document.getElementById("asReviewCount");
    const pageText = document.getElementById("asReviewPage");
    const prevButton = document.getElementById("asReviewPrev");
    const nextButton = document.getElementById("asReviewNext");

    let reviewPage = 1;
    const reviewsPerPage = 3;
    let isSubmittingReview = false;

    if (!reviewClient) {
        console.error("Supabase public client not found.");
        statusText.textContent = "Reviews are temporarily unavailable.";
        reviewList.textContent = "Unable to load reviews.";
        return;
    }

    // =========================================
    // STAR RATING
    // =========================================

    function selectReviewRating(rating) {

        ratingInput.value = rating;

        ratingButtons.forEach(button => {

            const buttonRating = Number(button.dataset.rating);

            button.classList.toggle(
                "active",
                buttonRating <= rating
            );

            button.setAttribute(
                "aria-pressed",
                String(buttonRating === rating)
            );

        });

    }

    ratingButtons.forEach(button => {

        button.addEventListener("click", () => {
            selectReviewRating(Number(button.dataset.rating));
        });

    });


    // =========================================
    // LOAD APPROVED REVIEWS
    // =========================================

    async function loadCustomerReviews() {

        const start = (reviewPage - 1) * reviewsPerPage;

        reviewList.textContent = "Loading reviews...";

        const { data, count, error } = await reviewClient
            .from("website_reviews")
            .select(
                "name,business_name,rating,review,verified,created_at",
                { count: "exact" }
            )
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .range(start, start + reviewsPerPage - 1);

        if (error) {
            console.error("Review loading error:", error);
            reviewList.textContent = "Unable to load reviews.";
            return;
        }

        const totalReviews = count || 0;

        // =========================================
        // OVERALL CUSTOMER AVERAGE RATING
        // =========================================

        const { data: ratingData, error: ratingError } =
            await reviewClient
                .from("website_reviews")
                .select("rating")
                .eq("status", "approved");

        if (!ratingError) {

            const ratings = ratingData || [];

            const totalRating = ratings.reduce(
                (sum, review) => sum + Number(review.rating || 0),
                0
            );

            const averageRating = ratings.length
                ? totalRating / ratings.length
                : 0;

            const averageElement =
                document.getElementById("asReviewAverage");

            if (averageElement) {
                averageElement.textContent =
                    `${averageRating.toFixed(1)}/5`;
            }
        }

        const totalPages = Math.max(
            1,
            Math.ceil(totalReviews / reviewsPerPage)
        );

        if (reviewPage > totalPages) {
            reviewPage = totalPages;
            return loadCustomerReviews();
        }

        reviewCount.textContent =
            `${totalReviews} Review${totalReviews === 1 ? "" : "s"}`;

        pageText.textContent =
            `Page ${reviewPage} of ${totalPages}`;

        prevButton.disabled = reviewPage <= 1;
        nextButton.disabled = reviewPage >= totalPages;

        reviewList.replaceChildren();

        if (!data || data.length === 0) {

            const emptyMessage = document.createElement("p");
            emptyMessage.className = "as-review-loading";
            emptyMessage.textContent = "No approved reviews yet.";

            reviewList.appendChild(emptyMessage);
            return;
        }

        data.forEach(review => {
          console.log("REVIEW DATA:", review.name, review.verified);

            const card = document.createElement("div");
            card.className = "as-review-item";

            const stars = document.createElement("div");
            stars.className = "as-review-item-stars";

            const rating = Math.max(
                1,
                Math.min(5, Number(review.rating) || 1)
            );

            stars.textContent =
                "★".repeat(rating) +
                "☆".repeat(5 - rating);

            const message = document.createElement("p");
            message.className = "as-review-item-text";
            message.textContent = review.review;

            const author = document.createElement("div");
            author.className = "as-review-item-author";

            const name = document.createElement("strong");
            name.textContent = review.name;

            author.appendChild(name);

            if (review.verified === true) {
            const verifiedBadge = document.createElement("span");

            verifiedBadge.className = "as-review-verified";

            verifiedBadge.textContent = "✓ Verified";

            author.appendChild(verifiedBadge);
        }

            if (review.business_name) {
                const business = document.createElement("span");
                business.textContent = review.business_name;
                author.appendChild(business);
            }

            card.append(author, stars, message);
            console.log("AUTHOR HTML:", author.outerHTML);

            reviewList.appendChild(card);

        });

    }


    // =========================================
    // SUBMIT CUSTOMER REVIEW
    // =========================================

    reviewForm.addEventListener("submit", async event => {

    event.preventDefault();

    console.log("REVIEW FORM SUBMIT EVENT TRIGGERED");

        if (isSubmittingReview) return;

        
    const name = nameInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const business = businessInput.value.trim();
    const rating = Number(ratingInput.value);
    const review = messageInput.value.trim();

    if (!name || !email || !review || !emailInput.checkValidity()) {
        statusText.textContent =
            "Please enter your name, a valid email address, and review.";
        return;
    }


        if (!name || !review) {
            statusText.textContent =
                "Please enter your name and review.";
            return;
        }

        if (!Number.isInteger(rating) ||
            rating < 1 || rating > 5) {

            statusText.textContent =
                "Please select a star rating.";
            return;
        }

        isSubmittingReview = true;
        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";
        statusText.textContent = "Submitting your review...";

        try {

            
        const response = await fetch(
          "https://api.amplifiedsites.com/reviews/submit",
          
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name,
                email,
                business_name: business || null,
                rating,
                review
            })
        }
    );

        
        if (!response.ok) {
            const result = await response.json().catch(() => ({}));

            throw new Error(
                result.error || "Unable to submit your review."
            );
        }



          console.log("REVIEW SAVED SUCCESSFULLY TO SUPABASE");

            reviewForm.reset();
            selectReviewRating(0);

            statusText.textContent =
                "Thank you! Your review has been submitted and is awaiting approval.";

        
        } catch (error) {

            console.error("Review submission error:", error);

            statusText.textContent =
                error.message || "Unable to submit your review. Please try again.";


        } finally {

            isSubmittingReview = false;
            submitButton.disabled = false;
            submitButton.textContent = "Submit Review";

        }

    });


    // =========================================
    // REVIEW PAGINATION
    // =========================================

    prevButton.addEventListener("click", () => {

        if (reviewPage > 1) {
            reviewPage--;
            loadCustomerReviews();
        }

    });

    nextButton.addEventListener("click", () => {

        reviewPage++;
        loadCustomerReviews();

    });


    // =========================================
    // INITIAL LOAD
    // =========================================

    selectReviewRating(0);
    loadCustomerReviews();

});
console.log("AMPLIFIED SITES REVIEW SCRIPT LOADED");


/* ==========================================
   HOMEPAGE - SMOOTH SCROLL FADE IN AND OUT
========================================== */

(() => {

    function initializeScrollFade() {

        const sections = document.querySelectorAll(
            ".hero-content, .as-services-section, .as-process-section, .as-reviews-section"
        );

        if (sections.length === 0) {
            console.warn("SCROLL FADE: No sections found.");
            return;
        }

        console.log("SCROLL FADE LOADED:", sections.length, "sections");

        function updateScrollFade() {

            const screenHeight = window.innerHeight;
            const fadeDistance = screenHeight * 1.5;

            sections.forEach(section => {

                const rect = section.getBoundingClientRect();

                // Fade in when entering screen
                const fadeIn = (screenHeight - rect.top) / fadeDistance;

                // Fade out when leaving screen
                const fadeOut = rect.bottom / fadeDistance;

                // Calculate opacity
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

        window.addEventListener("scroll", handleScroll, {
            passive: true
        });

        window.addEventListener("resize", handleScroll);

        updateScrollFade();

    }

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initializeScrollFade
        );

    } else {

        initializeScrollFade();

    }

})();
