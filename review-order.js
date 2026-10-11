// ======================
// GENERATE ORDER NUMBER
// ======================

function generateOrderNumber() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "AMP-";

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

checkoutButton.addEventListener(
    "click",
    async (e) => {

        e.preventDefault();

        try {

            checkoutButton.disabled = true;
            checkoutButton.textContent = "Redirecting...";

            const deposit =
                Number(depositAmount);

            const response =
                await fetch(
                    "http://localhost:3000/create-checkout-session",
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

            checkoutButton.textContent =
                "Continue To Secure Checkout";
        }
    }
);