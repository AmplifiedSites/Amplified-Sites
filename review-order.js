// ======================
// GENERATE ORDER NUMBER
// ======================

function generateOrderNumber() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "AMP";

    for (let i = 0; i < 8; i++) {
        result += chars.charAt(
            Math.floor(Math.random() * chars.length)
        );
    }

    return result;
}
const packageFeatures = JSON.parse(
    localStorage.getItem("package_features")
);

let orderNumber = localStorage.getItem("orderNumber");

if (!orderNumber) {
    orderNumber = generateOrderNumber();
    localStorage.setItem(
        "orderNumber",
        orderNumber
    );
}

// ======================
// LOAD SAVED DATA
// ======================
const packageId = localStorage.getItem("package_id");
const packageName = localStorage.getItem("package_name");
const totalPrice = localStorage.getItem("package_price");
const depositAmount = localStorage.getItem("deposit_amount");

console.log("PACKAGE:", packageName);
console.log("PRICE:", totalPrice);
console.log("DEPOSIT:", depositAmount);

const clientName = localStorage.getItem("client_name");
const clientEmail = localStorage.getItem("client_email");
const clientPhone = localStorage.getItem("client_phone");
const businessName = localStorage.getItem("business_name");

const orderId = localStorage.getItem("order_id");

const featuresList = document.getElementById("packageFeatures");

featuresList.innerHTML = "";

if (packageFeatures) {

    packageFeatures.forEach(feature => {

        const li = document.createElement("li");

        li.innerHTML = `
            <i class="fa-solid fa-check"></i>
            ${feature}
        `;

        featuresList.appendChild(li);

    });

}

// ======================
// POPULATE REVIEW PAGE
// ======================

document.getElementById(
    "reviewPackage"
).textContent = packageName;

document.getElementById(
    "summaryName"
).textContent = packageName;

document.getElementById(
    "reviewPrice"
).textContent = `$${totalPrice}`;

document.getElementById(
    "totalAmount"
).textContent = `$${totalPrice}`;

document.getElementById(
    "depositAmount"
).textContent =
    `$${depositAmount}`;

document.getElementById(
    "reviewName"
).textContent = clientName;

document.getElementById(
    "reviewEmail"
).textContent = clientEmail;

document.getElementById(
    "reviewPhone"
).textContent = clientPhone;

document.getElementById(
    "reviewBusiness"
).textContent = businessName;

// ======================
// STRIPE CHECKOUT
// ======================

const checkoutButton =
    document.getElementById(
        "checkoutBtn"
    );

// =========================================
// FREE OR PAID PACKAGE BUTTON
// =========================================

const isFreePackage =
    totalPrice !== null &&
    totalPrice.trim() !== "" &&
    Number(totalPrice) === 0;

const secureNote = document.querySelector(".secure-note");

if (isFreePackage) {
    checkoutButton.textContent = "Confirm Free Order";

    if (secureNote) {
        secureNote.textContent = "No payment required";
    }
}

checkoutButton.addEventListener(
    "click",
    async (e) => {

        e.preventDefault();

try {

    // =========================================
    // FREE WEBSITE ORDER
    // =========================================

    if (isFreePackage) {

    const validUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const missingFields = [];

    if (!packageId || !validUuid.test(packageId)) {
        missingFields.push("Package ID (Supabase UUID)");
    }

    if (!clientName?.trim()) {
        missingFields.push("Client Name");
    }

    if (!clientEmail?.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
        missingFields.push("Client Email");
    }

    if (!clientPhone?.trim()) {
        missingFields.push("Client Phone");
    }

    if (missingFields.length > 0) {
        throw new Error(
            "Missing or invalid information:\n" +
            missingFields.join("\n")
        );
    }

    checkoutButton.disabled = true;
    checkoutButton.textContent = "Creating Order...";

        const response = await fetch(
            "https://api.amplifiedsites.com/create-free-order",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    package_id: packageId,
                    client_name: clientName,
                    client_email: clientEmail,
                    client_phone: clientPhone,
                    business_name: businessName
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Unable to create free order."
            );
        }

        localStorage.setItem("order_id", data.order_id);
        localStorage.setItem("orderNumber", data.order_id);

        window.location.href =
            "success-free.html";

        return;
    }

            checkoutButton.disabled = true;
            checkoutButton.textContent = "Redirecting...";

            const deposit =
                Number(depositAmount);

            const response =
                await fetch(
                    "https://api.amplifiedsites.com/create-checkout-session",
                    { 
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body: JSON.stringify({
                        order_id: orderId,
                        package_id: packageId,
                        package_name: packageName,
                        total_price: totalPrice,
                        deposit_amount: depositAmount,
                        client_name: clientName,
                        client_email: clientEmail,
                        client_phone: clientPhone,
                        business_name: businessName
                    })
                    }
                );

            const data =
                await response.json();

            console.log(
                "SERVER RESPONSE:",
                data
            );

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Checkout failed"
                );
            }

            // REDIRECT TO STRIPE
            if (!data.url) {
                throw new Error("No Stripe URL returned from server");
            }

            window.location.href = data.url;

        } catch (error) {

            console.error(
                "CHECKOUT ERROR:",
                error
            );

            alert(
                error.message
            );

            checkoutButton.disabled =
                false;

            checkoutButton.textContent = isFreePackage
                ? "Confirm Free Order"
                : "Continue To Secure Checkout";
        }
    }
);
