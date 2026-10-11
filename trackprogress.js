const SUPABASE_URL = "https://obnpotxehcktfdcseocz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibnBvdHhlaGNrdGZkY3Nlb2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNjU4NTQsImV4cCI6MjA5Njk0MTg1NH0.ewsB-9T3j1V2BlhaDai9OpIAbPWK6NDQpvPf5SRNFfA"; // frontend ONLY

// IMPORTANT: ensure supabase.js is loaded in HTML before this file
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentOrderId = null;

/* =========================
   UTILITIES
========================= */
function formatOrderId(orderId) {
    if (!orderId) return null;
    return orderId.trim().toUpperCase().replace(/\s+/g, "");
}

/* =========================
   FETCH ORDER
========================= */
async function fetchOrder(orderId) {
    const cleaned = formatOrderId(orderId);
    const { data, error } = await supabaseClient
        .from("orders")
        .select("*")
        .eq("order_id", cleaned)
        .single();
    console.log("Supabase returned:", data, error);
    if (error) return null;
    return data;
}
/* =========================
   UI HELPERS
========================= */
function updateProgressCircle(progress) {
    const circle = document.getElementById("circleProgress");
    if (!circle) return;

    circle.style.background = `
        conic-gradient(
            #2563eb 0% ${progress}%,
            #03050848 ${progress}% 100%
        )
    `;
}

/* =========================
   STAGE HIGHLIGHTING (NEW)
========================= */

function renderStages(stage) {

    const stages = [
        "Planning",
        "Design",
        "Development",
        "Testing",
        "Revisions",
        "Complete"
    ];

    const normalizedStage = String(stage || "")
        .trim()
        .toLowerCase();

    const currentIndex = stages.findIndex(item =>
        item.toLowerCase() === normalizedStage ||
        (
            item === "Complete" &&
            normalizedStage === "completed"
        )
    );

    document.querySelectorAll(".stage").forEach((el, i) => {

        el.classList.remove("active", "current");

        if (currentIndex === -1) return;

        if (i < currentIndex) {
            el.classList.add("active");
        }

        if (i === currentIndex) {
            el.classList.add("current");
        }

    });
}


/* =========================
   UPDATE ORDER STATUS
========================= */

function updateOrderStatus(status) {

    const statusPill = document.getElementById("projectStatus");

    if (!statusPill) return;

    const currentStatus = String(status || "In Progress").trim();

    statusPill.classList.remove(
        "status-pending",
        "status-progress",
        "status-hold",
        "status-completed"
    );

    switch (currentStatus.toLowerCase()) {

        case "in progress":
            statusPill.textContent = "● In Progress";
            statusPill.classList.add("status-progress");
            break;

        case "on hold":
            statusPill.textContent = "● On Hold";
            statusPill.classList.add("status-hold");
            break;

        case "completed":
            statusPill.textContent = "● Completed";
            statusPill.classList.add("status-completed");
            break;

        default:
            statusPill.textContent = `● ${currentStatus}`;
    }
}

/* =========================
   RENDER ORDER
========================= */
function renderOrder(order) {
    if (!order) return;

    const dashboard = document.getElementById("dashboard");
    if (dashboard) dashboard.style.display = "block";

    // =========================================
    // AUTOMATIC PROGRESS BY PROJECT STAGE
    // =========================================

    const stageProgress = {
        "planning": 10,
        "design": 25,
        "development": 50,
        "testing": 75,
        "revisions": 90,
        "completed": 100,
        
    };

    const currentStage = String(order.stage || "Planning")
        .trim()
        .toLowerCase();

    const progress = stageProgress[currentStage] ?? 0;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    };

    setText("projectType", order.web_package || "Website Package");
    setText("orderNumber", order.order_id || "");
    updateOrderStatus(order.order_status);
    setText("progressPercent", `${progress}%`);
    setText("currentStage", order.stage || "Discover");
    setText(
    "completionDate",
    order.estimated_completion || "TBD"
);
    updateProgressCircle(progress);

    // 🔥 THIS IS WHAT ACTIVATES YOUR STAGES
    renderStages(order.stage || "Discover");
}

/* =========================
   TRACK ORDER
========================= */
async function handleTrack() {
    const input = document.getElementById("orderInput");
    if (!input) return;

    const orderId = formatOrderId(input.value);
    if (!orderId) return;

    currentOrderId = orderId;

    const order = await fetchOrder(orderId);

    if (!order) {
        alert("Order not found");
        return;
    }

    renderOrder(order);
}

/* =========================
   EVENTS
========================= */
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("trackBtn");
    const input = document.getElementById("orderInput");

    if (btn) {
        btn.addEventListener("click", handleTrack);
    }

    if (input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") handleTrack();
        });
    }

    const params = new URLSearchParams(window.location.search);
    const order = params.get("order");

    if (order) {
        if (input) input.value = order;
        handleTrack();
    }
});

/* =========================
   REALTIME UPDATES
========================= */
supabaseClient
    .channel("orders-updates")
    .on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "orders"
        },
        async () => {
            if (!currentOrderId) return;

            const order = await fetchOrder(currentOrderId);

            if (order) {
                renderOrder(order);
            }
        }
    )
    .subscribe();