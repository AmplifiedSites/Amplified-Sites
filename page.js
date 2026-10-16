const canvas = document.getElementById("background");
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
    this.size = Math.random() * 3;
    this.opacity = Math.random();
    this.speed = 0.01 + Math.random() * 0.01;
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
  particles.length = 0;
  ribbons.length = 0;

for (let i = 0; i < 120; i++) stars.push(new Star());
for (let i = 0; i < 2; i++) beams.push(new LightBeam());
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


// =========================================
// PRIVACY POLICY / TERMS ACCORDION
// =========================================

document.addEventListener("click", (event) => {

    const header = event.target.closest(".term-header");

    if (!header) return;

    const item = header.closest(".term-item");

    if (!item) return;

    // Close all other sections
    document.querySelectorAll(".term-item").forEach(section => {

        if (section !== item) {
            section.classList.remove("active");
        }

    });

    // Open or close selected section
    item.classList.toggle("active");
});


 // =========================================
 // START YOUR JOURNEY — CONTACT FORM
 // =========================================

const journeyForm = document.getElementById("journeyForm");

if (journeyForm) {

    const submitButton = journeyForm.querySelector(
        'button[type="submit"]'
    );

    let isSubmitting = false;

    journeyForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        if (isSubmitting) return;

        isSubmitting = true;

        const originalButtonText = submitButton.textContent;

        submitButton.disabled = true;
        submitButton.textContent = "Sending Message...";

        const formData = {
            name: document.getElementById("name").value.trim(),
            email: document.getElementById("email").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            business: document.getElementById("business").value.trim(),
            subject: "New Project Inquiry",
            message: document.getElementById("message").value.trim()
        };

        try {

            const response = await fetch(
             "https://api.amplifiedsites.com/contact-message",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(formData)
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.error || "Unable to send your message."
                );
            }

            journeyForm.reset();
            window.location.href = "thankyoupage.html";

        } catch (error) {

            console.error("CONTACT FORM ERROR:", error);

            alert(
                "Your message could not be sent. Please try again."
            );

        } finally {

            isSubmitting = false;

            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;

        }

    });

}


// ==========================================
// PUBLIC PORTFOLIO - LOAD PROJECTS + GALLERY
// ==========================================

async function loadPortfolioProjects() {

    const portfolioGrid = document.getElementById("portfolioProjectGrid");

    if (!portfolioGrid) return;

    const { data: projects, error } = await supabaseClient
        .from("portfolio_projects")
        .select("id, project_name, category, description, image_url, gallery_urls, demo_video_url, website_url")
        .eq("is_published", true);

    if (error) {
        console.error("PORTFOLIO LOAD ERROR:", error);
        return;
    }

    console.log("PUBLIC PORTFOLIO PROJECTS:", projects);

    portfolioGrid.innerHTML = "";

    // ==========================================
    // CREATE PROJECT CARDS
    // ==========================================

    (projects || []).forEach(project => {

        const card = document.createElement("article");
        card.className = "portfolio-project-card";

        // CLICK IMAGE TO OPEN GALLERY
        const imageLink = document.createElement("button");
        imageLink.type = "button";
        imageLink.className = "portfolio-project-image";
        imageLink.setAttribute("aria-label", `View ${project.project_name} gallery`);

        const image = document.createElement("img");
        image.src = project.image_url || "";
        image.alt = project.project_name || "Project screenshot";
        image.loading = "lazy";

        imageLink.appendChild(image);

        imageLink.addEventListener("click", (event) => {

        const activeCard = document.querySelector(
            "#portfolioProjectGrid .portfolio-project-card[data-active='true']"
        );

        if (card !== activeCard) {
            event.preventDefault();
            return;
        }

        openPortfolioGallery(project);
    });

        const content = document.createElement("div");
        content.className = "portfolio-project-content";

        const category = document.createElement("span");
        category.className = "portfolio-project-type";
        category.textContent = project.category || "WEBSITE";

        const title = document.createElement("h3");
        title.textContent = project.project_name || "Website Project";

        const description = document.createElement("p");
        description.textContent = project.description || "";

        content.appendChild(category);
        content.appendChild(title);
        content.appendChild(description);

        // KEEP VISIT WEBSITE BUTTON
        if (project.website_url) {

            const visitLink = document.createElement("a");
            visitLink.className = "portfolio-project-link";
            visitLink.href = project.website_url;
            visitLink.target = "_blank";
            visitLink.rel = "noopener noreferrer";
            visitLink.textContent = "Visit Website →";

            content.appendChild(visitLink);
        }

        card.appendChild(imageLink);
        card.appendChild(content);

                portfolioGrid.appendChild(card);
    });

    // INITIALIZE 3D CAROUSEL
    initializePortfolioCarousel();
}


// ==========================================
// 3D PORTFOLIO CAROUSEL
// AUTOMATIC + MANUAL ROTATION
// ==========================================
function initializePortfolioCarousel() {

    const cards = Array.from(
        document.querySelectorAll("#portfolioProjectGrid .portfolio-project-card")
    );

    const prev = document.getElementById("portfolioPrev");
    const next = document.getElementById("portfolioNext");
    const dotsContainer = document.getElementById("portfolioCarouselDots");

    if (!cards.length || !prev || !next || !dotsContainer) return;
    let currentIndex = 0;

    dotsContainer.innerHTML = "";

    const dots = cards.map((card, index) => {

        const dot = document.createElement("button");
        dot.type = "button";
        dot.setAttribute("aria-label", `Show project ${index + 1}`);

        dot.addEventListener("click", () => {
            currentIndex = index;
            updateCarousel();
        });

        dotsContainer.appendChild(dot);
        return dot;
    });

    function updateCarousel() {

        const mobile = window.innerWidth <= 768;

        cards.forEach((card, index) => {

            let offset = index - currentIndex;

            if (offset > cards.length / 2) offset -= cards.length;
            if (offset < -cards.length / 2) offset += cards.length;

            const distance = Math.abs(offset);
            const visible = distance <= 2;

            const x = mobile ? offset * 65 : offset * 260;
            const scale = distance === 0 ? 1 : distance === 1 ? 0.82 : 0.65;
            const rotation = mobile ? 0 : offset * -12;

            card.style.transform =
                `translateX(calc(-50% + ${x}px)) scale(${scale}) rotateY(${rotation}deg)`;

            card.style.zIndex = String(10 - distance);
            card.style.opacity = visible ? "1" : "0";
            card.style.pointerEvents = visible ? "auto" : "none";
            card.style.cursor = distance === 0 ? "default" : "pointer";
            card.style.visibility = visible ? "visible" : "hidden";
            card.dataset.active = String(distance === 0);
        });

        dots.forEach((dot, index) => {
            dot.classList.toggle("active", index === currentIndex);
            dot.setAttribute("aria-current", String(index === currentIndex));
        });
    }

// ==========================================
// CLICK SIDE PROJECT TO ROTATE
// ==========================================

cards.forEach((card, index) => {

    card.addEventListener("click", (event) => {

        if (index === currentIndex) return;

        event.preventDefault();
        event.stopPropagation();

        currentIndex = index;

        updateCarousel();
    });

});

    // ==========================================
    // MANUAL CONTROLS
    // ==========================================

    prev.addEventListener("click", () => {
        currentIndex = (currentIndex - 1 + cards.length) % cards.length;
        updateCarousel();
    });

    next.addEventListener("click", () => {
        currentIndex = (currentIndex + 1) % cards.length;
        updateCarousel();
    });

    window.addEventListener("resize", updateCarousel);

    updateCarousel();
}

// ==========================================
// PORTFOLIO GALLERY POPUP
// ==========================================

function openPortfolioGallery(project) {

    // REMOVE ANY PREVIOUS POPUP
    document.querySelector(".portfolio-gallery-overlay")?.remove();

    // BUILD IMAGE ARRAY
    let galleryUrls = project.gallery_urls || [];

    if (typeof galleryUrls === "string") {
        try {
            galleryUrls = JSON.parse(galleryUrls);
        } catch {
            galleryUrls = [];
        }
    }

    if (!Array.isArray(galleryUrls)) {
        galleryUrls = [];
    }

    const media = [];

    if (project.image_url) {
        media.push({
            type: "image",
            url: project.image_url
        });
    }

    galleryUrls.forEach(url => {
        if (typeof url === "string" && url.trim()) {
            media.push({
                type: "image",
                url: url.trim()
            });
        }
    });

    // ADD VIDEO ONLY WHEN URL EXISTS
    if (project.demo_video_url?.trim()) {
        media.push({
            type: "video",
            url: project.demo_video_url.trim()
        });
    }

    if (!media.length) return;

    let currentIndex = 0;

    // CREATE POPUP
    const overlay = document.createElement("div");
    overlay.className = "portfolio-gallery-overlay";

    const dialog = document.createElement("div");
    dialog.className = "portfolio-gallery-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", `${project.project_name} gallery`);

    const closeButton = document.createElement("button");
    closeButton.className = "portfolio-gallery-close";
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close gallery");

    const title = document.createElement("h2");
    title.className = "portfolio-gallery-title";
    title.textContent = project.project_name || "Project Gallery";

    const category = document.createElement("p");
    category.className = "portfolio-gallery-category";
    category.textContent = project.category || "WEBSITE";

    const stage = document.createElement("div");
    stage.className = "portfolio-gallery-stage";

    const mainImage = document.createElement("img");
    mainImage.className = "portfolio-gallery-main-image";
    mainImage.alt = project.project_name || "Project image";

    const mainVideo = document.createElement("video");
    mainVideo.className = "portfolio-gallery-main-video";
    mainVideo.controls = true;
    mainVideo.playsInline = true;
    mainVideo.preload = "metadata";
    mainVideo.hidden = true;

    const previousButton = document.createElement("button");
    previousButton.className = "portfolio-gallery-prev";
    previousButton.type = "button";
    previousButton.textContent = "❮";
    previousButton.setAttribute("aria-label", "Previous image");

    const nextButton = document.createElement("button");
    nextButton.className = "portfolio-gallery-next";
    nextButton.type = "button";
    nextButton.textContent = "❯";
    nextButton.setAttribute("aria-label", "Next image");

    const counter = document.createElement("span");
    counter.className = "portfolio-gallery-count";

    stage.append(
        mainImage,
        mainVideo,
        previousButton,
        nextButton,
        counter
    );

    const thumbnails = document.createElement("div");
    thumbnails.className = "portfolio-gallery-thumbs";

    const description = document.createElement("p");
    description.className = "portfolio-gallery-description";
    description.textContent = project.description || "";

    dialog.append(
        closeButton,
        title,
        category,
        stage,
        thumbnails,
        description
    );

    // VISIT WEBSITE LINK INSIDE POPUP
    if (project.website_url) {

        const visitLink = document.createElement("a");
        visitLink.className = "portfolio-gallery-visit";
        visitLink.href = project.website_url;
        visitLink.target = "_blank";
        visitLink.rel = "noopener noreferrer";
        visitLink.textContent = "Visit Website →";

        dialog.appendChild(visitLink);
    }

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // ==========================================
    // DISPLAY CURRENT IMAGE OR VIDEO
    // ==========================================

    function showMedia(index) {

        currentIndex = (index + media.length) % media.length;

        const item = media[currentIndex];

        mainVideo.pause();
        mainVideo.removeAttribute("src");
        mainVideo.load();

        if (item.type === "video") {

            mainImage.hidden = true;
            mainVideo.hidden = false;
            mainVideo.src = item.url;
            mainVideo.load();

        } else {

            mainVideo.hidden = true;
            mainImage.hidden = false;
            mainImage.src = item.url;
        }

        counter.textContent = `${currentIndex + 1}/${media.length}`;

        thumbnails.querySelectorAll(".portfolio-gallery-thumb")
            .forEach((thumb, index) => {
                thumb.classList.toggle("active", index === currentIndex);
                thumb.setAttribute(
                    "aria-pressed",
                    String(index === currentIndex)
                );
            });
    }

    // ==========================================
    // CREATE THUMBNAILS
    // ==========================================

    media.forEach((item, index) => {

        const thumb = document.createElement("button");
        thumb.type = "button";
        thumb.className = "portfolio-gallery-thumb";
        thumb.setAttribute("aria-label", `View item ${index + 1}`);

        if (item.type === "video") {

            thumb.classList.add("portfolio-gallery-video-thumb");

            const playIcon = document.createElement("span");
            playIcon.textContent = "▶";

            const videoLabel = document.createElement("small");
            videoLabel.textContent = "Demo Video";

            thumb.append(playIcon, videoLabel);

        } else {

            const thumbImage = document.createElement("img");
            thumbImage.src = item.url;
            thumbImage.alt = `Project image ${index + 1}`;
            thumbImage.loading = "lazy";

            thumb.appendChild(thumbImage);
        }

        thumb.addEventListener("click", () => showMedia(index));

        thumbnails.appendChild(thumb);
    });

    // ==========================================
    // GALLERY CONTROLS
    // ==========================================

    function closeGallery() {

        mainVideo.pause();
        mainVideo.removeAttribute("src");
        mainVideo.load();

        document.removeEventListener("keydown", handleKeydown);
        document.body.style.overflow = previousOverflow;

        overlay.remove();
    }

    function handleKeydown(event) {

        if (event.key === "Escape") {
            closeGallery();
        }

        if (event.key === "ArrowRight") {
            showMedia(currentIndex + 1);
        }

        if (event.key === "ArrowLeft") {
            showMedia(currentIndex - 1);
        }
    }

    closeButton.addEventListener("click", closeGallery);

    overlay.addEventListener("click", event => {
        if (event.target === overlay) closeGallery();
    });

    previousButton.addEventListener("click", () => {
        showMedia(currentIndex - 1);
    });

    nextButton.addEventListener("click", () => {
        showMedia(currentIndex + 1);
    });

    document.addEventListener("keydown", handleKeydown);

    showMedia(0);
    closeButton.focus();
}


// ==========================================
// LOAD PORTFOLIO ON PAGE LOAD
// ==========================================

document.addEventListener("DOMContentLoaded", loadPortfolioProjects);


// ==========================================
// PORTFOLIO GALLERY POPUP
// ==========================================

function openPortfolioGallery(project) {

    // REMOVE ANY PREVIOUS POPUP
    document.querySelector(".portfolio-gallery-overlay")?.remove();

    // BUILD IMAGE ARRAY
    let galleryUrls = project.gallery_urls || [];

    if (typeof galleryUrls === "string") {
        try {
            galleryUrls = JSON.parse(galleryUrls);
        } catch {
            galleryUrls = [];
        }
    }

    if (!Array.isArray(galleryUrls)) {
        galleryUrls = [];
    }

    const media = [];

    if (project.image_url) {
        media.push({
            type: "image",
            url: project.image_url
        });
    }

    galleryUrls.forEach(url => {
        if (typeof url === "string" && url.trim()) {
            media.push({
                type: "image",
                url: url.trim()
            });
        }
    });

    // ADD VIDEO ONLY WHEN URL EXISTS
    if (project.demo_video_url?.trim()) {
        media.push({
            type: "video",
            url: project.demo_video_url.trim()
        });
    }

    if (!media.length) return;

    let currentIndex = 0;

    // CREATE POPUP
    const overlay = document.createElement("div");
    overlay.className = "portfolio-gallery-overlay";

    const dialog = document.createElement("div");
    dialog.className = "portfolio-gallery-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", `${project.project_name} gallery`);

    const closeButton = document.createElement("button");
    closeButton.className = "portfolio-gallery-close";
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "Close gallery");

    const title = document.createElement("h2");
    title.className = "portfolio-gallery-title";
    title.textContent = project.project_name || "Project Gallery";

    const category = document.createElement("p");
    category.className = "portfolio-gallery-category";
    category.textContent = project.category || "WEBSITE";

    const stage = document.createElement("div");
    stage.className = "portfolio-gallery-stage";

    const mainImage = document.createElement("img");
    mainImage.className = "portfolio-gallery-main-image";
    mainImage.alt = project.project_name || "Project image";

    const mainVideo = document.createElement("video");
    mainVideo.className = "portfolio-gallery-main-video";
    mainVideo.controls = true;
    mainVideo.playsInline = true;
    mainVideo.preload = "metadata";
    mainVideo.hidden = true;

    const previousButton = document.createElement("button");
    previousButton.className = "portfolio-gallery-prev";
    previousButton.type = "button";
    previousButton.textContent = "❮";
    previousButton.setAttribute("aria-label", "Previous image");

    const nextButton = document.createElement("button");
    nextButton.className = "portfolio-gallery-next";
    nextButton.type = "button";
    nextButton.textContent = "❯";
    nextButton.setAttribute("aria-label", "Next image");

    const counter = document.createElement("span");
    counter.className = "portfolio-gallery-count";

    stage.append(
        mainImage,
        mainVideo,
        previousButton,
        nextButton,
        counter
    );

    const thumbnails = document.createElement("div");
    thumbnails.className = "portfolio-gallery-thumbs";

    const description = document.createElement("p");
    description.className = "portfolio-gallery-description";
    description.textContent = project.description || "";

    dialog.append(
        closeButton,
        title,
        category,
        stage,
        thumbnails,
        description
    );

    // VISIT WEBSITE LINK INSIDE POPUP
    if (project.website_url) {

        const visitLink = document.createElement("a");
        visitLink.className = "portfolio-gallery-visit";
        visitLink.href = project.website_url;
        visitLink.target = "_blank";
        visitLink.rel = "noopener noreferrer";
        visitLink.textContent = "Visit Website →";

        dialog.appendChild(visitLink);
    }

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // ==========================================
    // DISPLAY CURRENT IMAGE OR VIDEO
    // ==========================================

    function showMedia(index) {

        currentIndex = (index + media.length) % media.length;

        const item = media[currentIndex];

        mainVideo.pause();
        mainVideo.removeAttribute("src");
        mainVideo.load();

        if (item.type === "video") {

            mainImage.hidden = true;
            mainVideo.hidden = false;
            mainVideo.src = item.url;
            mainVideo.load();

        } else {

            mainVideo.hidden = true;
            mainImage.hidden = false;
            mainImage.src = item.url;
        }

        counter.textContent = `${currentIndex + 1}/${media.length}`;

        thumbnails.querySelectorAll(".portfolio-gallery-thumb")
            .forEach((thumb, index) => {
                thumb.classList.toggle("active", index === currentIndex);
                thumb.setAttribute(
                    "aria-pressed",
                    String(index === currentIndex)
                );
            });
    }

    // ==========================================
    // CREATE THUMBNAILS
    // ==========================================

    media.forEach((item, index) => {

        const thumb = document.createElement("button");
        thumb.type = "button";
        thumb.className = "portfolio-gallery-thumb";
        thumb.setAttribute("aria-label", `View item ${index + 1}`);

        if (item.type === "video") {

            thumb.classList.add("portfolio-gallery-video-thumb");

            const playIcon = document.createElement("span");
            playIcon.textContent = "▶";

            const videoLabel = document.createElement("small");
            videoLabel.textContent = "Demo Video";

            thumb.append(playIcon, videoLabel);

        } else {

            const thumbImage = document.createElement("img");
            thumbImage.src = item.url;
            thumbImage.alt = `Project image ${index + 1}`;
            thumbImage.loading = "lazy";

            thumb.appendChild(thumbImage);
        }

        thumb.addEventListener("click", () => showMedia(index));

        thumbnails.appendChild(thumb);
    });

    // ==========================================
    // GALLERY CONTROLS
    // ==========================================

    function closeGallery() {

        mainVideo.pause();
        mainVideo.removeAttribute("src");
        mainVideo.load();

        document.removeEventListener("keydown", handleKeydown);
        document.body.style.overflow = previousOverflow;

        overlay.remove();
    }

    function handleKeydown(event) {

        if (event.key === "Escape") {
            closeGallery();
        }

        if (event.key === "ArrowRight") {
            showMedia(currentIndex + 1);
        }

        if (event.key === "ArrowLeft") {
            showMedia(currentIndex - 1);
        }
    }

    closeButton.addEventListener("click", closeGallery);

    overlay.addEventListener("click", event => {
        if (event.target === overlay) closeGallery();
    });

    previousButton.addEventListener("click", () => {
        showMedia(currentIndex - 1);
    });

    nextButton.addEventListener("click", () => {
        showMedia(currentIndex + 1);
    });

    document.addEventListener("keydown", handleKeydown);

    showMedia(0);
    closeButton.focus();
}

// ==========================================
// LOAD PORTFOLIO ON PAGE LOAD
// ==========================================
document.addEventListener("DOMContentLoaded", loadPortfolioProjects);

  
