document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("clientForm");

    if (!form) return;

    form.addEventListener("submit", async (e) => {

        e.preventDefault();

        // 🧾 package data
        // 🧾 package data
        const packageName = localStorage.getItem("package_name");
        const totalPrice = localStorage.getItem("package_price");
        const depositAmount = localStorage.getItem("deposit_amount");

        // 👤 client data (YOU WERE MISSING THIS PART)
        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const phone = document.getElementById("phone").value;
        const business = document.getElementById("business").value;

        // 🔑 generate order id
        const orderId = "AMPX" + Math.random().toString(36).substring(2, 10).toUpperCase();

        console.log("Order ID:", orderId);

       // 💾 store for later pages
            localStorage.setItem("order_id", orderId);

            localStorage.setItem("client_name", name);
            localStorage.setItem("client_email", email);
            localStorage.setItem("client_phone", phone);
            localStorage.setItem("business_name", business);

            localStorage.setItem("package_name", packageName);
            localStorage.setItem("package_price", totalPrice);
            localStorage.setItem("deposit_amount", depositAmount);

        // 🧾 show review (temporary for now)
        

        // 🚀 NEXT STEP (we will replace this with Supabase + Stripe redirect)
        window.location.href = "review-order.html";
    });

});