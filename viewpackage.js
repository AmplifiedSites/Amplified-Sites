const SUPABASE_URL = "https://obnpotxehcktfdcseocz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibnBvdHhlaGNrdGZkY3Nlb2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNjU4NTQsImV4cCI6MjA5Njk0MTg1NH0.ewsB-9T3j1V2BlhaDai9OpIAbPWK6NDQpvPf5SRNFfA";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY); 
// ===================== PAGE SETUP/EVENT START =====================
document.addEventListener("DOMContentLoaded", () => {
    const orderForm = document.getElementById("orderForm");
    if (!orderForm) return;
 // ===================== FORM SUBMIT HANDLER =====================
    orderForm.addEventListener("submit", async (e) => {

        e.preventDefault();
 // ===================== USER INPUT COLLECTION=====================
        const orderId = document
            .getElementById("paymentOrderNumber")
            .value
            .trim()
            .toUpperCase();

        const email = document
            .getElementById("paymentEmail")
            .value
            .trim()
            .toLowerCase();
 // ===================== API REQUEST SUPABASE =====================
        try {
            console.log("Searching for:", orderId);
            const { data, error } = await supabaseClient
                .from("orders")
                .select("*")
                .eq("order_id", orderId);
            console.log("Data:", data);
            console.log("Error:", error);
 // ===================== ERROR VALIDATION CHECKS =====================
            if (!data.length) {
                document.getElementById("orderFoundCard").style.display = "none";
                alert("Order not found.");
                return;
            }
            const order = data[0];
            if (
                order.client_email &&
                order.client_email.toLowerCase().trim() !== email
            ) {
                alert("Email does not match this order.");
                return;
            }
 // ===================== DATA PROCESSING NUMBERS =====================
            const total = Number(order.total_price || 0);
            const depositAmount = Number(order.deposit_amount || 0);
            const remainingBalance = Number(order.remaining_balance || 0);
 // ===================== UI DISPLAY RENDER ORDER INFO =====================
            document.getElementById("foundOrderNumber").textContent =
                order.order_id || "";
            document.getElementById("foundBusinessName").textContent =
                order.business_name || "";
            document.getElementById("foundPackage").textContent =
                order.web_package || "";
            document.getElementById("foundTotalPrice").textContent =
                "$" + total.toFixed(2);
            document.getElementById("foundDepositPaid").textContent =
                "$" + depositAmount.toFixed(2);
            document.getElementById("foundBalance").textContent =
                "$" + remainingBalance.toFixed(2);
            document.getElementById("foundOrderDate").textContent =
            new Date(order.created_at).toLocaleDateString("en-US", {
                timeZone: "America/Chicago",
                year: "numeric",
                month: "long",
                day: "numeric"
            });
// ===================== PAYMENT BUTTON LOGIC =====================
            const payButton =
                document.getElementById("payBalanceBtn");
            const paymentStatus =
                document.getElementById("paymentStatus");

 // ===================== PAID/NOT PAID STATE CONTROL =====================
            if (order.fully_paid) {
                document.getElementById("foundBalance").textContent =
                    "$0.00";
                payButton.style.display = "none";
                paymentStatus.textContent =
                    "✅ Order Paid In Full";
            } else {
                payButton.style.display = "inline-flex";
                paymentStatus.textContent = "";
            }
 // ===================== FINAL PAYMENT CLICK STRIPE FLOW=====================            
            if (payButton) {
                payButton.onclick = async (e) => {
                    e.preventDefault();
                    try {
                        const response = await fetch(
                            "https://api.amplifiedsites.com/create-final-payment-session",
                            {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    order_id: order.order_id
                                })
                            }
                        );
                        const session = await response.json();
                        if (!session.url) {
                            alert("Unable to create payment session.");
                            return;
                        }
                        window.location.href = session.url;
 // ===================== ERROR HANDLING =====================
        } catch (err) {
             console.error(err);
             alert("Unable to start payment.");
        }
            };
            }
            document.getElementById("orderFoundCard").style.display =
                "block";
        } catch (error) {
            console.error(error);
            alert("Something went wrong. Please try again.");
        }
    });
});
 
// ===================== PACKAGE SELECT SEPERATE FEATURE FROM FIND YOUR ORDER =====================
// ===================== PACKAGE SELECTION =====================

async function selectPackage(packageName, totalPrice, depositAmount, features) {

    try {

        // GET PACKAGE FROM SUPABASE
        const { data: selectedPackage, error } = await supabaseClient
            .from("website_packages")
            .select("id, package_name, price, deposit_percentage, description, features")
            .eq("package_name", packageName)
            .eq("is_active", true)
            .limit(1)
            .single();

        if (error || !selectedPackage) {
            console.error("PACKAGE ERROR:", error);
            alert("This package is currently unavailable.");
            return;
        }

        // CALCULATE CURRENT PRICES
        const totalCents = Math.round(
            Number(selectedPackage.price) * 100
        );

        const depositCents = Math.round(
            totalCents *
            Number(selectedPackage.deposit_percentage) / 100
        );

        const currentPrice = totalCents / 100;
        const currentDeposit = depositCents / 100;

        // SAVE PACKAGE DETAILS
        localStorage.setItem(
            "package_id",
            selectedPackage.id
        );

        localStorage.setItem(
            "package_name",
            selectedPackage.package_name
        );

        localStorage.setItem(
            "package_price",
            String(currentPrice)
        );

        localStorage.setItem(
            "deposit_amount",
            String(currentDeposit)
        );

        // SAVE FEATURES FROM SUPABASE
        localStorage.setItem(
            "package_features",
            JSON.stringify(
                Array.isArray(selectedPackage.features)
                    ? selectedPackage.features
                    : []
            )
        );

        // CONTINUE TO CLIENT INFORMATION
        window.location.href = "client-info.html";

    } catch (error) {

        console.error("PACKAGE SELECTION ERROR:", error);

        alert("Unable to select package. Please try again.");

    }
}

// =========================================
// LOAD WEBSITE PACKAGES FROM SUPABASE
// =========================================

async function loadWebsitePackages() {

    const pricingGrid = document.getElementById("pricingGrid");

    if (!pricingGrid) return;

    const { data: packages, error } = await supabaseClient
    .from("website_packages")
    .select("id, package_name, price, deposit_percentage, description, features")
    .eq("is_active", true)
    .order("price", { ascending: true });

    if (error) {
        console.error("PACKAGE LOAD ERROR:", error);
        pricingGrid.textContent = "Unable to load website packages.";
        return;
    }
 
    pricingGrid.innerHTML = "";

    if (!packages || packages.length === 0) {
        pricingGrid.textContent = "No website packages are currently available.";
        return;
    }

    packages.forEach(pkg => {

        // PACKAGE CARD
        const card = document.createElement("div");
        card.className = "pricing-card";

        // PACKAGE NAME
        const title = document.createElement("h3");
        title.textContent = pkg.package_name;

        // PACKAGE PRICE
        const price = document.createElement("div");
        price.className = "price";
        price.textContent = "$" + Number(pkg.price).toFixed(2);

        // PACKAGE DESCRIPTION
        const description = document.createElement("p");
        description.className = "card-description";
        description.textContent = pkg.description || "";

        // PACKAGE FEATURES
        const featuresList = document.createElement("ul");

        const features = Array.isArray(pkg.features)
            ? pkg.features.filter(feature => typeof feature === "string")
            : [];

        features.forEach(feature => {

            const li = document.createElement("li");

            const icon = document.createElement("i");
            icon.className = "fa-solid fa-check";

            li.appendChild(icon);
            li.appendChild(document.createTextNode(" " + feature));

            featuresList.appendChild(li);
        });

        // CHOOSE PLAN BUTTON
        const button = document.createElement("a");
        button.href = "#";
        button.className = "pricing-btn featured-btn";
        button.textContent = "Choose Plan";

        button.addEventListener("click", async (e) => {
            e.preventDefault();

            button.style.pointerEvents = "none";

            try {
                await selectPackage(
                    pkg.package_name,
                    pkg.price,
                    Number(pkg.price) *
                        Number(pkg.deposit_percentage) / 100,
                    features
                );
            } finally {
                button.style.pointerEvents = "";
            }
        });

        // BUILD CARD
        card.appendChild(title);
        card.appendChild(price);
        card.appendChild(description);
        card.appendChild(featuresList);
        card.appendChild(button);

        pricingGrid.appendChild(card);
    });
}

// =========================================
// INITIALIZE PACKAGE LOADING
// =========================================

document.addEventListener("DOMContentLoaded", loadWebsitePackages);
