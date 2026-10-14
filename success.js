// Console log (debugging check)
console.log("SUCCESS JS LOADED");
// ================= DOM CONTENT LOADED (PAGE INITIALIZATION) =================
document.addEventListener("DOMContentLoaded", async () => {
// ================= SUPABASE KEYS =================
    const supabaseUrl = "https://obnpotxehcktfdcseocz.supabase.co";
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibnBvdHhlaGNrdGZkY3Nlb2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNjU4NTQsImV4cCI6MjA5Njk0MTg1NH0.ewsB-9T3j1V2BlhaDai9OpIAbPWK6NDQpvPf5SRNFfA";
// ================= INITIALIZATION (SUPABASE + URL ORDER ID FETCH) =================
    const supabase =
        window.supabase.createClient(
            supabaseUrl,
            supabaseKey
        );
    const urlParams =
    new URLSearchParams(window.location.search);
    console.log("FULL URL:", window.location.href);
    console.log("SESSION ID:", urlParams.get("session_id"));
    const sessionId = urlParams.get("session_id");
    if (!sessionId) {
        console.error("No session ID found in URL");
        return;
    }
    const response = await fetch(
       `https://api.amplifiedsites.com/get-order-by-session?session_id=${encodeURIComponent(sessionId)}`
    );
    const result = await response.json();
    if (!result.order) {
        console.error("Order not found");
        return;
    }
    const data = result.order;
    console.log("SESSION ID:", sessionId);
    console.log("DATA:", data);
    // ================= DISPLAY ORDER DATA (UI RENDERING) =================
        document.getElementById("orderNumber").textContent =
            data.order_id;
        document.getElementById("packageName").innerHTML =
            `<strong>${data.web_package}</strong>`;
        document.getElementById("depositPaid").innerHTML =
            `<strong>$${data.deposit_amount}</strong>`;
        document.getElementById("projectStatus").innerHTML =
            `<strong>${data.stage}</strong>`;
        document.getElementById("trackBtn").href =
            `trackprogress.html?order=${data.order_id}`;
    setInterval(async () => {
    const res = await fetch(
   `https://api.amplifiedsites.com/get-order-by-session?session_id=${encodeURIComponent(sessionId)}`
    );
    const { order } = await res.json();
    document.getElementById("projectStatus").textContent = order.stage;
    }, 3000);
    // ================= COPY ORDER ID BUTTON FUNCTIONALITY =================
        const copyBtn =
            document.getElementById("copyBtn");
        copyBtn.addEventListener("click", async () => {
            await navigator.clipboard.writeText(
                data.order_id
            );
            copyBtn.innerHTML =
                `<i class="fa-solid fa-check"></i> Copied!`;
            setTimeout(() => {
                copyBtn.innerHTML =
                    `<i class="far fa-copy"></i> Copy`;
            }, 2000);
        });
    }); 