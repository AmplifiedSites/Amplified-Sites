
/* =========================================
   SUCCESS FREE PAGE
========================================= */

document.addEventListener("DOMContentLoaded", async () => {

    const orderNumberElement =
        document.getElementById("freeOrderNumber");

    const packageNameElement =
        document.getElementById("packageName");

    const depositPaidElement =
        document.getElementById("depositPaid");

    const paymentStatusElement =
        document.getElementById("paymentStatus");

    const projectStatusElement =
        document.getElementById("projectStatus");

    const copyButton =
        document.getElementById("copyFreeOrder");


    // =========================================
    // GET ORDER NUMBER
    // =========================================

    const params = new URLSearchParams(window.location.search);

    const orderNumber =
        params.get("order_id") ||
        params.get("orderNumber") ||
        localStorage.getItem("order_id") ||
        localStorage.getItem("orderNumber");


    if (!orderNumber) {

        orderNumberElement.textContent = "Order Not Found";

        packageNameElement.textContent = "Unavailable";
        depositPaidElement.textContent = "Unavailable";
        paymentStatusElement.textContent = "Unavailable";
        projectStatusElement.textContent = "Unavailable";

        return;
    }


    orderNumberElement.textContent = orderNumber;


    // =========================================
    // FREE ORDER SUMMARY
    // =========================================

    // This page is only for free website orders.
    // No payment is collected.

    packageNameElement.textContent = "Free Website";

    depositPaidElement.textContent = "$0.00";

    paymentStatusElement.textContent = "No Payment Required";

    projectStatusElement.textContent = "Planning";


    // =========================================
    // COPY ORDER NUMBER
    // =========================================

    copyButton.addEventListener("click", async () => {

        try {

            await navigator.clipboard.writeText(orderNumber);

            copyButton.innerHTML =
                '<i class="fa-solid fa-check"></i>';

            copyButton.title = "Copied!";

            setTimeout(() => {

                copyButton.innerHTML =
                    '<i class="fa-regular fa-copy"></i>';

                copyButton.title = "Copy order number";

            }, 2000);

        } catch (error) {

            console.error("Failed to copy order number:", error);

        }

    });

// =========================================
// TRACK FREE WEBSITE ORDER
// =========================================

const trackBtn = document.getElementById("trackBtn");

if (trackBtn) {
    trackBtn.addEventListener("click", (event) => {
        event.preventDefault();

        const orderId =
            localStorage.getItem("order_id");

        const clientEmail =
            localStorage.getItem("client_email");

        if (!orderId || !clientEmail) {
            alert("Missing order information.");
            return;
        }

        sessionStorage.setItem(
            "tracking_email",
            clientEmail.trim().toLowerCase()
        );

                window.location.assign(
            `trackprogress.html?order_id=${encodeURIComponent(orderId)}`
        );
    });
}

// END DOMContentLoaded
});