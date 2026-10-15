document.body.style.display = "none";

/* =========================
   AUTH
========================= */
async function checkAuth() {
    document.body.style.display = "none";

    try {
        const { data: { user }, error: authError } =
            await window.supabaseClient.auth.getUser();

        if (authError || !user) {
            window.location.replace("admin-login.html");
            return;
        }

        const { data: admin, error: adminError } =
            await window.supabaseClient
                .from("admin_users")
                .select("user_id")
                .eq("user_id", user.id)
                .maybeSingle();

        if (adminError || !admin) {
            console.error("Admin access denied:", adminError);

            await window.supabaseClient.auth.signOut();
            window.location.replace("admin-login.html");
            return;
        }

        await loadOrders();
        await loadAdminPackages();
        await loadAdminNotifications();
        startAdminNotificationsRealtime();

        document.body.style.display = "block";

    } catch (error) {
        console.error("Authentication error:", error);
        window.location.replace("admin-login.html");
    }
}

checkAuth();

/* =========================
   LOGOUT
========================= */
document.getElementById("logoutBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    await window.supabaseClient.auth.signOut();
    window.location.replace("admin-login.html");
});


/* =========================================
   LOAD ORDERS
========================================= */
let allOrders = [];
let selectedOrder = null;

// Refund tracking
let allRefunds = [];
let allOrderPayments = [];

async function loadOrders() {

    // Load orders
    const { data: orders, error: ordersError } =
        await window.supabaseClient
            .from("orders")
            .select("*")
            .order("created_at", { ascending: false });

    if (ordersError) {
        console.error("Error loading orders:", ordersError);
        return;
    }

    // Load successful refund records
    const { data: refunds, error: refundsError } =
        await window.supabaseClient
            .from("order_refunds")
            .select("*")
            .eq("refund_status", "succeeded");

    if (refundsError) {
        console.error("Error loading refunds:", refundsError);
        return;
    }

// =========================================
// LOAD STRIPE PAYMENTS FOR ANALYTICS
// =========================================

    const { data: payments, error: paymentsError } =
        await window.supabaseClient
            .from("order_payments")
            .select("*")
            .order("created_at", { ascending: true });

    if (paymentsError) {
        console.error("Error loading payment records:", paymentsError);
        return;
    }

    allOrders = orders || [];
    allRefunds = refunds || [];
    allOrderPayments = payments || [];

    filterOrders();
    updateDashboardRefunds();
    updateDashboardStats();
    renderRevenueAnalytics();
    renderDashboardRecentOrders();
}

// =========================================
// RECENT ORDERS PAGINATION
// =========================================
const recentOrdersPerPage = 10;
let recentOrdersCurrentPage = 1;

 // =========================================
 // ADMIN DASHBOARD - RECENT ORDERS
 // =========================================

function renderDashboardRecentOrders() {

    const table = document.getElementById("recentOrdersTable");

    if (!table) return;

        // =========================================
// RECENT ORDERS SEARCH + FILTER
// =========================================

const search = (
    document.getElementById("recentOrdersSearch")?.value || ""
).toLowerCase().trim();

const filteredRecentOrders = allOrders
    .filter(order => {

        // Exclude fully refunded orders
        if (getOrderRefundStatus(order) === "Fully Refunded") {
            return false;
        }

        // Search across order information
        return [
            order.order_id,
            order.client_name,
            order.client_email,
            order.business_name,
            order.web_package
        ].some(value =>
            String(value || "").toLowerCase().includes(search)
        );

    })
    .sort((a, b) =>
        new Date(b.created_at) - new Date(a.created_at)
    );

    // Calculate total pages
    const totalPages = Math.max(
        1,
        Math.ceil(filteredRecentOrders.length / recentOrdersPerPage)
    );

    // Keep current page within available pages
    recentOrdersCurrentPage = Math.min(
        Math.max(1, recentOrdersCurrentPage),
        totalPages
    );

    // Select 10 orders for the current page
    const startIndex =
        (recentOrdersCurrentPage - 1) * recentOrdersPerPage;

    const recentOrders = filteredRecentOrders.slice(
        startIndex,
        startIndex + recentOrdersPerPage
    );

    // Update pagination controls
    const pageInfo = document.getElementById("recentOrdersPageInfo");
    const prevButton = document.getElementById("recentOrdersPrev");
    const nextButton = document.getElementById("recentOrdersNext");

    if (pageInfo) {
        pageInfo.textContent =
            `Page ${recentOrdersCurrentPage} of ${totalPages}`;
    }

    if (prevButton) {
        prevButton.disabled = recentOrdersCurrentPage <= 1;
    }

    if (nextButton) {
        nextButton.disabled = recentOrdersCurrentPage >= totalPages;
    }

    if (recentOrders.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;">
                    No recent orders found.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = recentOrders.map(order => {

        const refundStatus = getOrderRefundStatus(order);

        const status = refundStatus === "Partial Refund"
            ? "Partial Refund"
            : order.order_status || "In Progress";

        const progress = Math.min(
            100,
            Math.max(0, Number(order.progress) || 0)
        );

        return `
                <tr class="dashboard-recent-order">
                <td>
                    ${escapeOrderText(order.order_id || "")}
                </td>

                <td>
                    ${escapeOrderText(order.client_name || "N/A")}
                </td>

                <td>
                    ${escapeOrderText(order.client_email || "N/A")}
                </td>

                <td>
                    ${escapeOrderText(order.business_name || "N/A")}
                </td>

                <td>
                    ${escapeOrderText(order.web_package || "N/A")}
                </td>

                <td>
                    ${formatOrderMoney(order.total_price)}
                </td>

                <td>
                    ${progress}%
                </td>

                <td>
                    ${escapeOrderText(status)}
                </td>
            </tr>
        `;
    }).join("");
}

// =========================================
// RECENT ORDERS LIVE SEARCH
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    const searchInput =
        document.getElementById("recentOrdersSearch");

    if (!searchInput) return;

    searchInput.addEventListener("input", () => {

        // Reset pagination whenever search changes
        recentOrdersCurrentPage = 1;

        // Refresh Recent Orders table
        renderDashboardRecentOrders();

    });

});

// =========================================
// RECENT ORDERS PAGINATION BUTTONS
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    const prevButton =
        document.getElementById("recentOrdersPrev");

    const nextButton =
        document.getElementById("recentOrdersNext");

    // PREVIOUS PAGE
    prevButton?.addEventListener("click", () => {

        if (recentOrdersCurrentPage > 1) {

            recentOrdersCurrentPage--;

            renderDashboardRecentOrders();
        }

    });

    // NEXT PAGE
    nextButton?.addEventListener("click", () => {

        recentOrdersCurrentPage++;

        renderDashboardRecentOrders();

    });

});

// =========================================
// ADMIN DASHBOARD - STATISTICS
// =========================================

function updateDashboardStats() {

    const totalOrdersElement =
        document.getElementById("totalOrders");

    const paidOrdersElement =
        document.getElementById("paidOrders");

    const pendingOrdersElement =
        document.getElementById("pendingOrders");

    const revenueElement =
        document.getElementById("revenue");


    // TOTAL ORDERS
    const totalOrders = allOrders.length;


    // FULLY PAID ORDERS
    const fullyPaidOrders = allOrders.filter(order =>
        order.fully_paid === true
    ).length;


    // DEPOSIT PAID ORDERS
    const depositPaidOrders = allOrders.filter(order =>
        order.deposit_paid === true &&
        order.fully_paid !== true
    ).length;


    // TOTAL SUCCESSFUL PAYMENTS
    const totalPaymentsCents = allOrderPayments.reduce(
        (total, payment) =>
            total +
            Math.round(Number(payment.amount_paid || 0) * 100),
        0
    );


    // TOTAL SUCCESSFUL REFUNDS
    const totalRefundsCents = allRefunds.reduce(
        (total, refund) =>
            total +
            Math.round(Number(refund.refund_amount || 0) * 100),
        0
    );


    // NET REVENUE
    const netRevenueCents =
        totalPaymentsCents - totalRefundsCents;


    // UPDATE DASHBOARD
    if (totalOrdersElement) {
        totalOrdersElement.textContent = totalOrders;
    }

    if (paidOrdersElement) {
        paidOrdersElement.textContent = fullyPaidOrders;
    }

    if (pendingOrdersElement) {
        pendingOrdersElement.textContent = depositPaidOrders;
    }

    if (revenueElement) {
        revenueElement.textContent =
            formatOrderMoney(netRevenueCents / 100);
    }
}

// =========================================
// ADMIN DASHBOARD - TOTAL REFUNDS
// =========================================

function updateDashboardRefunds() {

    const refundElement =
        document.getElementById("totalRefunds");

    if (!refundElement) return;

    const totalRefunds = allRefunds.reduce(
        (total, refund) => {
            return total +
                Math.round(Number(refund.refund_amount || 0) * 100);
        },
        0
    );

    refundElement.textContent =
        formatOrderMoney(totalRefunds / 100);
}

// =========================================
// CALCULATE ORDER REFUND STATUS
// =========================================
function getOrderRefundStatus(order) {

    const orderId = String(order.order_id);

    const totalRefunded = allRefunds
        .filter(refund =>
            String(refund.order_id) === orderId
        )
        .reduce((total, refund) => {
            return total +
                Math.round(Number(refund.refund_amount) * 100);
        }, 0);

    const totalPaid = allOrderPayments
        .filter(payment =>
            String(payment.order_id) === orderId
        )
        .reduce((total, payment) => {
            return total +
                Math.round(Number(payment.amount_paid) * 100);
        }, 0);

    if (totalPaid > 0 && totalRefunded >= totalPaid) {
        return "Fully Refunded";
    }

    if (totalRefunded > 0) {
        return "Partial Refund";
    }

    return "Not Refunded";
}

/* =========================================
   SEARCH / FILTER ORDERS
========================================= */

function filterOrders() {

    const searchInput = document.getElementById("orderSearch");

    const search = (searchInput?.value || "")
        .toLowerCase()
        .trim();

    const filteredOrders = allOrders.filter(order => {

        // Hide fully refunded orders from All Orders
        if (getOrderRefundStatus(order) === "Fully Refunded") {
            return false;
        }

        return [
            order.order_id,
            order.client_name,
            order.client_email,
            order.business_name
        ].some(value =>
            String(value || "").toLowerCase().includes(search)
        );

    });

    renderOrders(filteredOrders);
}


/* =========================================
   FORMAT ORDER PRICE
========================================= */

function formatOrderMoney(value) {

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(Number(value) || 0);

}


/* =========================================
   ESCAPE HTML
========================================= */

function escapeOrderText(value) {

    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);

}


/* =========================================
   RENDER ORDER CARDS
========================================= */

function renderOrders(orders) {

    const container = document.getElementById("ordersTable");

    const ordersCount = document.getElementById("ordersCount");

    if (!container) {
        console.error("Orders container not found.");
        return;
    }

    if (ordersCount) {
        ordersCount.textContent = `${orders.length} Orders`;
    }

    if (!orders.length) {

        container.innerHTML = `
            <p class="orders-empty">
                No orders found.
            </p>
        `;

        return;
    }

    container.innerHTML = orders.map(order => `

        <div class="order-list-card">

            <div class="order-card-top">

                <div>

                    <div class="order-card-name">
                        ${escapeOrderText(order.client_name || "Unnamed Client")}
                    </div>

                    <div class="order-card-number">
                       ${escapeOrderText(String(order.order_id || "").replace(/^#/, ""))}
                    </div>

                </div>

                <span class="order-card-status ${
                    getOrderRefundStatus(order) === "Partial Refund"
                        ? "partial-refund"
                        : order.order_status === "Completed"
                        ? "completed"
                        : order.order_status === "On Hold"
                        ? "on-hold"
                        : "in-progress"
                }">
                    ${escapeOrderText(
                        getOrderRefundStatus(order) === "Partial Refund"
                            ? "Partial Refund"
                            : order.order_status || "In Progress"
                    )}
                </span>

            </div>

            <div class="order-card-bottom">

                <div>

                    <div class="order-card-package">
                        ${escapeOrderText(order.web_package || "No Package")}
                    </div>

                    <div class="order-card-price">
                        ${formatOrderMoney(order.total_price)}
                    </div>

                </div>

                <button
                    type="button"
                    class="order-card-edit"
                    data-order-id="${escapeOrderText(order.id)}"
                >
                    <i class="fa-solid fa-pen"></i>
                    Edit Order
                </button>

            </div>

        </div>

    `).join("");

}


/* =========================================
   EDIT ORDER BUTTON CLICK
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    const ordersContainer = document.getElementById("ordersTable");

    if (ordersContainer) {

        ordersContainer.addEventListener("click", event => {

            const editButton = event.target.closest(
                ".order-card-edit"
            );

            if (!editButton) return;

            const orderId = editButton.dataset.orderId;

            openOrderModal(orderId);

        });

    }

            const searchInput = document.getElementById("orderSearch");

            if (searchInput) {
                searchInput.addEventListener("input", () => {

            const refundTabActive = document.querySelector(
                '.orders-history-tab[data-orders-view="refunds"].active'
            );

            if (refundTabActive) {
                filterRefundHistory();
            } else {
                filterOrders();
            }

        });
    }

});


/* =========================================
   EDIT ORDER POPUP
========================================= */

// Get an input or element by its ID
function orderField(id) {
    return document.getElementById(id);
}


/* =========================================
   OPEN EDIT ORDER POPUP
========================================= */

async function openOrderModal(orderId, readOnly = false) {

    // Find order using database ID OR order number
    let order = allOrders.find(item =>
        String(item.id) === String(orderId) ||
        String(item.order_id) === String(orderId)
    );

    // If order is not loaded, get it from Supabase
    if (!order) {

        const { data, error } = await window.supabaseClient
            .from("orders")
            .select("*")
            .or(
                `order_id.eq.${String(orderId)}`
            )
            .maybeSingle();

        if (error) {
            console.error("Error loading order:", error);
            return;
        }

        if (!data) {
            console.error("Order not found:", orderId);
            return;
        }

        order = data;
    }

    const modal = orderField("orderModal");

        if (!modal) {
            console.error("Edit Order modal not found in HTML.");
            return;
        }

        // =========================================
        // HIDE EDIT ORDER TITLE IN REFUND HISTORY
        // =========================================

        const modalTitle = Array.from(
            modal.querySelectorAll("h1, h2, h3, h4")
        ).find(element => element.textContent.trim() === "Edit Order");

        if (modalTitle) {
            modalTitle.style.display = readOnly ? "none" : "";
        }

    selectedOrder = order;
    // =========================================
// REFUND HISTORY - REMAINING REFUNDABLE
// =========================================

const refundRemainingGroup =
    document.getElementById("orderRefundRemainingGroup");

const refundRemainingField =
    document.getElementById("orderRefundRemaining");

if (refundRemainingGroup && refundRemainingField) {

    refundRemainingGroup.style.display = "none";

    if (readOnly) {

        const { data: payments, error: paymentError } =
            await window.supabaseClient
                .from("order_payments")
                .select("amount_paid")
                .eq("order_id", order.order_id);

        const { data: refunds, error: refundError } =
            await window.supabaseClient
                .from("order_refunds")
                .select("refund_amount")
                .eq("order_id", order.order_id)
                .eq("refund_status", "succeeded");

        if (paymentError || refundError) {
            console.error(
                "Unable to load refund balance:",
                paymentError || refundError
            );

            refundRemainingField.value = "Unavailable";

        } else {

            const totalPaidCents = (payments || []).reduce(
                (sum, payment) =>
                    sum + Math.round(Number(payment.amount_paid) * 100),
                0
            );

            const refundedCents = (refunds || []).reduce(
                (sum, refund) =>
                    sum + Math.round(Number(refund.refund_amount) * 100),
                0
            );

            const remainingCents = Math.max(
                0,
                totalPaidCents - refundedCents
            );

            refundRemainingField.value =
                formatOrderMoney(remainingCents / 100);
        }

        refundRemainingGroup.style.display = "";
    }
}

    orderField("orderModalNumber").textContent =
        `Order ${String(order.order_id || "").replace(/^#/, "")}`;

    const fields = {
        editOrderPackage: order.web_package || "",
        editOrderProgress: order.progress ?? 10,
        editOrderStage: order.stage || "Planning",
        editOrderStatus: order.order_status || "In Progress",
        editOrderEstimate: order.estimated_completion || "",
        editOrderCompletion: order.completion_date
            ? String(order.completion_date).slice(0, 10)
            : "",

        editOrderName: order.client_name || "",
        editOrderEmail: order.client_email || "",
        editOrderBusiness: order.business_name || "",
        editOrderPhone: order.client_phone || "",

        editOrderTotal: order.total_price ?? 0,
        editOrderDeposit: order.deposit_amount ?? 0,
        editOrderBalance: order.remaining_balance ?? 0
    };

    Object.entries(fields).forEach(([id, value]) => {
        const field = orderField(id);

        if (field) {
            field.value = value;
        }
    });

// =========================================
// LOCK PACKAGE AFTER DEPOSIT PAYMENT
// LOCK PROGRESS PERCENTAGE
// =========================================

const packageField = orderField("editOrderPackage");
const progressField = orderField("editOrderProgress");

// Lock package after deposit has been paid
if (packageField) {
    packageField.disabled =
        order.deposit_paid === true ||
        order.fully_paid === true ||
        readOnly;
}

// Progress is controlled by project stage
if (progressField) {
    progressField.readOnly = true;
}

// =========================================
// REFUND HISTORY READ-ONLY MODE
// =========================================

modal.querySelectorAll("input, select, textarea").forEach(field => {

    const paymentFields = [
        "editOrderTotal",
        "editOrderDeposit",
        "editOrderBalance",
        "orderRefundRemaining"
    ];

    const paymentCheckboxes = [
        "editOrderDepositPaid",
        "editOrderFullyPaid"
    ];

    if (paymentCheckboxes.includes(field.id)) {
        field.disabled = true;
    } else if (paymentFields.includes(field.id)) {
        field.readOnly = true;
    } else if (field.id === "editOrderPackage") {
        field.disabled =
            readOnly ||
            order.deposit_paid === true ||
            order.fully_paid === true;

    } else if (field.type === "checkbox" || field.tagName === "SELECT") {
        field.disabled = readOnly;
    } else if (field.id === "editOrderProgress") {
        field.readOnly = true;

    } else {
        field.readOnly = readOnly;
    }

});

// Hide Save and Cancel only in Refund History
const saveButton = orderField("saveOrderChanges");
const cancelButton = orderField("cancelOrderEdit");
const refundButton = orderField("openRefundModal");

if (saveButton) {
    saveButton.style.display = readOnly ? "none" : "";
}

if (cancelButton) {
    cancelButton.style.display = readOnly ? "none" : "";
}

if (refundButton) {
    refundButton.style.display = readOnly ? "none" : "";
}


    // =========================================
    // CLIENT INFORMATION - READ ONLY
    // =========================================

    [
        "editOrderName",
        "editOrderEmail",
        "editOrderBusiness",
        "editOrderPhone"
    ].forEach(id => {

        const field = orderField(id);

        if (field) {
            field.readOnly = true;
        }

    });


    orderField("editOrderDepositPaid").checked =
        Boolean(order.deposit_paid);

    orderField("editOrderFullyPaid").checked =
        Boolean(order.fully_paid);

    switchOrderTab("project");

    modal.classList.add("active");
}


    // =========================================
    // PAYMENT INFORMATION - READ ONLY
    // =========================================

    [
        "editOrderTotal",
        "editOrderDeposit",
        "editOrderBalance"
    ].forEach(id => {

        const field = orderField(id);

        if (field) {
            field.readOnly = true;
        }

    });

    [
        "editOrderDepositPaid",
        "editOrderFullyPaid"
    ].forEach(id => {

        const checkbox = orderField(id);

        if (checkbox) {
            checkbox.disabled = true;
        }

    });


/* =========================================
   CLOSE EDIT ORDER POPUP
========================================= */

function closeOrderModal() {

    orderField("orderModal")?.classList.remove("active");

    selectedOrder = null;
}


/* =========================================
   SWITCH EDIT ORDER TABS
========================================= */

function switchOrderTab(tabName) {

    document.querySelectorAll(".order-tab").forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.orderTab === tabName
        );

    });

    document.querySelectorAll(".order-tab-panel").forEach(panel => {

        panel.classList.toggle(
            "active",
            panel.dataset.orderPanel === tabName
        );

    });
}


/* =========================================
   UPDATE REMAINING BALANCE
========================================= */

function updateOrderBalance() {

    const total =
        Number(orderField("editOrderTotal").value) || 0;

    const deposit =
        Number(orderField("editOrderDeposit").value) || 0;

    const depositPaid =
        orderField("editOrderDepositPaid").checked;

    const fullyPaid =
        orderField("editOrderFullyPaid").checked;

    const balance = fullyPaid
        ? 0
        : Math.max(0, total - (depositPaid ? deposit : 0));

    orderField("editOrderBalance").value =
        balance.toFixed(2);
}


/* =========================================
   SAVE ORDER TO SUPABASE
========================================= */

async function saveOrder(event) {

    event.preventDefault();

    if (!selectedOrder) return;

    const progress =
        Number(orderField("editOrderProgress").value);

    if (
        !Number.isInteger(progress) ||
        progress < 0 ||
        progress > 100
    ) {
        alert("Please enter a valid progress percentage between 0 and 100.");
        return;
    }

    const updates = {

        // PROJECT
        web_package:
        selectedOrder.deposit_paid === true ||
        selectedOrder.fully_paid === true
            ? selectedOrder.web_package
            : orderField("editOrderPackage").value.trim(),
        progress: stageProgress[orderField("editOrderStage").value] ?? 10,
        stage: orderField("editOrderStage").value,
        order_status: orderField("editOrderStatus").value,
        estimated_completion:
            orderField("editOrderEstimate").value.trim(),
        completion_date:
            orderField("editOrderCompletion").value || null,

        // CLIENT
        client_name: orderField("editOrderName").value.trim(),
        client_email: orderField("editOrderEmail").value.trim(),
        business_name: orderField("editOrderBusiness").value.trim(),
        client_phone: orderField("editOrderPhone").value.trim(),
    };

        const saveButton = orderField("saveOrderChanges");

        if (saveButton) {
            saveButton.disabled = true;
        }

        try {

            const { data, error } = await window.supabaseClient
                .from("orders")
                .update(updates)
                .eq("id", selectedOrder.id)
                .select("id");

            if (error) throw error;

            if (!data?.length) {
                throw new Error(
                    "No order updated. Check your Supabase permissions."
                );
            }

            closeOrderModal();

            // Refresh All Orders
            await loadOrders();

            // Refresh Refund History
            await loadRefundHistory();

            showAdminToast(
                "Order updated successfully!",
                "success"
            );

        } catch (error) {

            console.error("ERROR SAVING ORDER:", error);

            showAdminToast(
                "Unable to save order. Check your Supabase permissions.",
                "error"
            );

        } finally {

            if (saveButton) {
                saveButton.disabled = false;
            }

        }
    }

// =========================================
// AUTOMATIC PROJECT PROGRESS
// =========================================

const stageProgress = {
    "Planning": 10,
    "Design": 25,
    "Development": 50,
    "Testing": 75,
    "Revisions": 90,
    "Completed": 100
};

document.addEventListener("DOMContentLoaded", () => {

    const stageSelect = document.getElementById("editOrderStage");
    const progressInput = document.getElementById("editOrderProgress");

    if (!stageSelect || !progressInput) return;

    stageSelect.addEventListener("change", () => {

        const selectedStage = stageSelect.value;

        if (stageProgress[selectedStage] !== undefined) {
            progressInput.value = stageProgress[selectedStage];
        }

    });

});

/* =========================================
   EDIT ORDER EVENT LISTENERS
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    // Switch tabs
    document.querySelectorAll(".order-tab").forEach(button => {

        button.addEventListener("click", () => {
            switchOrderTab(button.dataset.orderTab);
        });

    });

    // Close button
    orderField("closeOrderModal")?.addEventListener(
        "click",
        closeOrderModal
    );

    // Cancel button
    orderField("cancelOrderEdit")?.addEventListener(
        "click",
        closeOrderModal
    );

    // Click outside popup
    orderField("orderModal")?.addEventListener("click", event => {

        if (event.target === event.currentTarget) {
            closeOrderModal();
        }

    });

    // Save form
    orderField("orderEditForm")?.addEventListener(
        "submit",
        saveOrder
    );

    // Recalculate balance when prices change
    ["editOrderTotal", "editOrderDeposit"].forEach(id => {

        orderField(id)?.addEventListener(
            "input",
            updateOrderBalance
        );

    });

    // Recalculate balance when checkboxes change
    ["editOrderDepositPaid", "editOrderFullyPaid"].forEach(id => {

        orderField(id)?.addEventListener(
            "change",
            updateOrderBalance
        );

    });

});


/* =========================
   AUTO LOGOUT TIMER
========================= */
let timeout;

function resetTimer() {
    clearTimeout(timeout);

    timeout = setTimeout(async () => {
        await window.supabaseClient.auth.signOut();
        window.location.href = "admin-login.html";
    }, 15 * 60 * 1000);
}

document.addEventListener("mousemove", resetTimer);
document.addEventListener("keydown", resetTimer);
document.addEventListener("click", resetTimer);

resetTimer();

/* =========================
   INIT
========================= */
// Orders are loaded after admin authorization in checkAuth().

// =========================================
// ADMIN NAVIGATION
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    const adminNavButtons = document.querySelectorAll(
        ".dash-btn[data-section]"
    );

    const adminSections = document.querySelectorAll(
        ".admin-section"
    );

    const adminPageTitle = document.getElementById(
        "adminPageTitle"
    );


    // =========================================
    // PAGE TITLES
    // =========================================
    const adminPageTitles = {
        "dashboard-section": "Admin Dashboard",
        "orders-section": "Orders",
        "messages-section": "Messages",
        "reviews-section": "Customer Reviews",
        "packages-section": "Website Packages",
        "legal-section": "Legal Documents"
    };



    // =========================================
    // SWITCH ADMIN SECTION
    // =========================================

    function switchAdminSection(sectionId, clickedButton) {

        const selectedSection =
            document.getElementById(sectionId);


        // Make sure section exists
        if (!selectedSection) {

            console.error(
                `Admin section "${sectionId}" was not found.`
            );

            return;
        }


        // =========================================
        // REMOVE ACTIVE FROM NAVIGATION
        // =========================================

        adminNavButtons.forEach((button) => {
            button.classList.remove("active");
        });


        // =========================================
        // HIDE ALL SECTIONS
        // =========================================

        adminSections.forEach((section) => {
            section.classList.remove("active");
        });


        // =========================================
        // ACTIVATE NAV BUTTON
        // =========================================

        if (clickedButton) {
            clickedButton.classList.add("active");
        }


        // =========================================
        // SHOW SELECTED SECTION
        // =========================================

        selectedSection.classList.add("active");


        // =========================================
        // CHANGE HEADER TITLE
        // =========================================

        if (adminPageTitle) {

            adminPageTitle.textContent =
                adminPageTitles[sectionId] ||
                "Admin Dashboard";

        }


        // =========================================
        // SAVE CURRENT TAB
        // =========================================

        sessionStorage.setItem(
            "amplifiedAdminSection",
            sectionId
        );


        // =========================================
        // RETURN TO TOP
        // =========================================

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }


    // =========================================
    // SIDEBAR BUTTON CLICKS
    // =========================================

    adminNavButtons.forEach((button) => {

        button.addEventListener("click", (event) => {

            event.preventDefault();

            const sectionId =
                button.getAttribute("data-section");

            if (!sectionId) {
                return;
            }

            switchAdminSection(
                sectionId,
                button
            );

        });

    });


    // =========================================
    // RESTORE LAST OPEN TAB
    // =========================================

    const savedSection =
        sessionStorage.getItem(
            "amplifiedAdminSection"
        );


    if (
        savedSection &&
        document.getElementById(savedSection)
    ) {

        const savedButton =
            document.querySelector(
                `.dash-btn[data-section="${savedSection}"]`
            );

        switchAdminSection(
            savedSection,
            savedButton
        );

    }

});

// =========================================
// ADMIN TOAST NOTIFICATIONS
// =========================================

function showAdminToast(message, type = "success") {
    const existingToast = document.querySelector(".admin-toast");

    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement("div");

    toast.className = `admin-toast ${type}`;

    const icon = type === "success"
        ? "fa-circle-check"
        : "fa-circle-exclamation";

    toast.innerHTML = `
        <div class="admin-toast-icon">
            <i class="fa-solid ${icon}"></i>
        </div>

        <div class="admin-toast-content">
            <strong>${type === "success" ? "Success" : "Error"}</strong>
            <p></p>
        </div>

        <button type="button" class="admin-toast-close" aria-label="Close notification">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    toast.querySelector("p").textContent = message;

    toast.querySelector(".admin-toast-close").addEventListener("click", () => {
        toast.remove();
    });

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("hide");

        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// =========================================
// WEBSITE PACKAGES - SUPABASE
// =========================================

let allWebsitePackages = [];

// =========================================
// LOAD WEBSITE PACKAGES
// =========================================

async function loadAdminPackages() {

    const container = document.getElementById("adminPackagesGrid");

    if (!container) return;

    container.textContent = "Loading packages...";

    const { data, error } = await window.supabaseClient
    .from("website_packages")
    .select("*")
    .order("price", { ascending: true });

    if (error) {
        console.error("Error loading packages:", error);
        container.textContent = "Unable to load packages.";
        return;
    }

    allWebsitePackages = data || [];

    renderAdminPackages();
}

// =========================================
// DISPLAY PACKAGE CARDS
// =========================================

function renderAdminPackages() {

    const container = document.getElementById("adminPackagesGrid");

    if (!container) return;

    container.innerHTML = "";

    if (allWebsitePackages.length === 0) {
        container.textContent = "No packages found.";
        return;
    }

    allWebsitePackages.forEach(pkg => {

        const card = document.createElement("div");
        card.className = "admin-package-card";

        const title = document.createElement("h3");
        title.textContent = pkg.package_name;

        const price = document.createElement("p");
        price.className = "admin-package-price";
        price.textContent = formatOrderMoney(pkg.price);

        const description = document.createElement("p");
        description.className = "admin-package-description";
        description.textContent = pkg.description || "";

        const deposit = document.createElement("p");
        deposit.textContent =
            `Deposit: ${Number(pkg.deposit_percentage)}%`;

        const status = document.createElement("p");
        status.textContent = pkg.is_active ? "Active" : "Inactive";

        const actions = document.createElement("div");
        actions.className = "admin-package-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "admin-package-edit-btn";
        editButton.textContent = "Edit";

        editButton.addEventListener("click", () => {
            openPackageModal(pkg.id);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "admin-package-delete-btn";
        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", () => {
            openDeletePackageModal(pkg.id);
        });

        actions.appendChild(editButton);
        actions.appendChild(deleteButton);

        card.appendChild(title);
        card.appendChild(price);
        card.appendChild(description);
        card.appendChild(deposit);
        card.appendChild(status);
        card.appendChild(actions);

        container.appendChild(card);
    });
}

// =========================================
// PACKAGE EDIT MODAL
// =========================================

function openPackageModal(packageId = null) {

    const modal = document.getElementById("packageModal");
    const form = document.getElementById("packageForm");

    if (!modal || !form) return;

    form.reset();

    document.getElementById("packageId").value = "";
    document.getElementById("packageFeatures").innerHTML = "";

    document.getElementById("packageDepositPercentage").value = 50;

    if (packageId) {

        const pkg = allWebsitePackages.find(
            item => item.id === packageId
        );

        if (!pkg) {
            alert("Package not found.");
            return;
        }

        document.getElementById("packageModalTitle").textContent =
            "Edit Package";

        document.getElementById("packageId").value =
            pkg.id;

        document.getElementById("packageName").value =
            pkg.package_name;

        document.getElementById("packagePrice").value =
            pkg.price;

        document.getElementById("packageDepositPercentage").value =
            pkg.deposit_percentage;

        document.getElementById("packageDescription").value =
            pkg.description || "";

        document.getElementById("packageActive").checked =
            Boolean(pkg.is_active);

        const features = Array.isArray(pkg.features)
            ? pkg.features
            : [];

        features.forEach(feature => {
            addPackageFeature(feature);
        });

    } else {

        document.getElementById("packageModalTitle").textContent =
            "Add Package";

        document.getElementById("packageActive").checked = true;
    }

    modal.classList.add("active");
}

// =========================================
// ADD / REMOVE PACKAGE FEATURE INPUTS
// =========================================

function addPackageFeature(value = "") {

    const container = document.getElementById("packageFeatures");

    const row = document.createElement("div");
    row.className = "package-feature-row";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "package-feature-input";
    input.placeholder = "Enter package feature";
    input.value = value;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "package-feature-remove";
    removeButton.textContent = "Remove";

    removeButton.addEventListener("click", () => {
        row.remove();
    });

    row.appendChild(input);
    row.appendChild(removeButton);

    container.appendChild(row);
}

// =========================================
// PACKAGE MODAL EVENT LISTENERS
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    const modal = document.getElementById("packageModal");

    document.getElementById("addPackageBtn")
        ?.addEventListener("click", () => {
            openPackageModal();
        });

    document.getElementById("addPackageFeatureBtn")
        ?.addEventListener("click", () => {
            addPackageFeature();
        });

    function closePackageModal() {
        modal?.classList.remove("active");
    }

    document.getElementById("closePackageModal")
        ?.addEventListener("click", closePackageModal);

    document.getElementById("cancelPackageBtn")
        ?.addEventListener("click", closePackageModal);

});

// =========================================
// SAVE WEBSITE PACKAGE TO SUPABASE
// =========================================

async function saveWebsitePackage(event) {

    event.preventDefault();

    const packageId =
        document.getElementById("packageId").value;

    const packageName =
        document.getElementById("packageName").value.trim();

    const price =
        Number(document.getElementById("packagePrice").value);

    const depositPercentage =
        Number(document.getElementById("packageDepositPercentage").value);

    const description =
        document.getElementById("packageDescription").value.trim();

    const isActive =
        document.getElementById("packageActive").checked;

    const features = Array.from(
        document.querySelectorAll(
            "#packageFeatures .package-feature-input"
        )
    )
    .map(input => input.value.trim())
    .filter(Boolean);

    if (
        !packageName ||
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isFinite(depositPercentage) ||
        depositPercentage < 0 ||
        depositPercentage > 100
    ) {
        showAdminToast("Please enter valid package details.", "error");
        return;
    }


    // =========================================
    // PREVENT DUPLICATE PACKAGE NAMES
    // =========================================

    const normalizedPackageName = packageName
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();

    const duplicatePackage = allWebsitePackages.find(pkg => {

        const existingName = String(pkg.package_name || "")
            .trim()
            .replace(/\s+/g, " ")
            .toLowerCase();

        return (
            existingName === normalizedPackageName &&
            pkg.id !== packageId
        );

    });

    if (duplicatePackage) {

        showAdminToast(
            "A package with this name already exists. Please choose a different name.",
            "error"
        );

        return;
    }


    const packageData = {
        package_name: packageName,
        price: price,
        deposit_percentage: depositPercentage,
        description: description,
        features: features,
        is_active: isActive
    };

    const saveButton =
        document.querySelector("#packageForm [type='submit']");

    if (saveButton) saveButton.disabled = true;

    try {

        let query = window.supabaseClient
            .from("website_packages");

        let result;

        if (packageId) {

            result = await query
                .update(packageData)
                .eq("id", packageId)
                .select("id");

        } else {

            result = await query
                .insert(packageData)
                .select("id");

        }

        if (result.error) throw result.error;

        if (!result.data?.length) {
            throw new Error(
                "No package was saved. Check your Supabase permissions."
            );
        }

        document.getElementById("packageModal")
            .classList.remove("active");

        await loadAdminPackages();

        showAdminToast(
            packageId
                ? "Package updated successfully!"
                : "Package created successfully!",
            "success"
        );

    } catch (error) {

        console.error("Error saving package:", error);

        showAdminToast(
            "Unable to save package. Check your Supabase permissions.",
            "error"
        );

    } finally {

        if (saveButton) saveButton.disabled = false;

    }
}

// =========================================
// PACKAGE FORM SUBMIT LISTENER
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("packageForm")
        ?.addEventListener("submit", saveWebsitePackage);

});

// =========================================
// DELETE WEBSITE PACKAGE
// =========================================

let packageToDeleteId = null;

// Open delete confirmation popup
function openDeletePackageModal(packageId) {

    const pkg = allWebsitePackages.find(
        item => item.id === packageId
    );

    if (!pkg) {
        showAdminToast("Package not found.", "error");
        return;
    }

    packageToDeleteId = packageId;

    document.getElementById("deletePackageModal")
        .classList.add("active");
}

// Close delete confirmation popup
function closeDeletePackageModal() {

    packageToDeleteId = null;

    document.getElementById("deletePackageModal")
        .classList.remove("active");
}

// Confirm package deletion
async function deleteWebsitePackage() {

    if (!packageToDeleteId) return;

    const packageId = packageToDeleteId;

    const deleteButton =
        document.getElementById("confirmDeletePackage");

    deleteButton.disabled = true;

    try {

        // Permanently delete package from Supabase
        const { data, error } = await window.supabaseClient
        .from("website_packages")
        .delete()
        .eq("id", packageId)
        .select("id");

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error("Package could not be updated.");
        }

        closeDeletePackageModal();

        await loadAdminPackages();

        showAdminToast(
            "Package permanently deleted!",
            "success"
        );

    } catch (error) {

        console.error("Error removing package:", error);

        showAdminToast(
            "Unable to remove package.",
            "error"
        );

    } finally {

        deleteButton.disabled = false;
    }
}

// =========================================
// DELETE PACKAGE EVENT LISTENERS
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("cancelDeletePackage")
        ?.addEventListener("click", closeDeletePackageModal);

    document.getElementById("confirmDeletePackage")
        ?.addEventListener("click", deleteWebsitePackage);

    document.getElementById("deletePackageModal")
        ?.addEventListener("click", event => {

            if (event.target.id === "deletePackageModal") {
                closeDeletePackageModal();
            }

        });

});

function confirmStripeRefund(message) {
    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.className = "stripe-confirm-overlay";

        overlay.innerHTML = `
            <div class="stripe-confirm-box">
                <div class="stripe-confirm-icon">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>

                <h3 class="stripe-confirm-title">
                    Confirm Stripe Refund
                </h3>

                <p class="stripe-confirm-message"></p>

                <div class="stripe-confirm-actions">
                    <button type="button" class="stripe-confirm-cancel">
                        Cancel
                    </button>

                    <button type="button" class="stripe-confirm-approve">
                        Confirm Refund
                    </button>
                </div>
            </div>
        `;

        overlay.querySelector(".stripe-confirm-message").textContent = message;

        function finish(approved) {
            overlay.remove();
            resolve(approved);
        }

        overlay.querySelector(".stripe-confirm-cancel")
            .addEventListener("click", () => finish(false));

        overlay.querySelector(".stripe-confirm-approve")
            .addEventListener("click", () => finish(true));

        document.body.appendChild(overlay);
    });
}

// =========================================
// CUSTOM STRIPE REFUND ERROR POPUP
// =========================================

function showStripeRefundError(message) {
    return new Promise(resolve => {

        const overlay = document.createElement("div");
        overlay.className = "stripe-error-overlay";

        overlay.innerHTML = `
            <div class="stripe-error-box"
                 role="alertdialog"
                 aria-modal="true"
                 aria-labelledby="stripeErrorTitle">

                <div class="stripe-error-icon">
                    <i class="fa-solid fa-circle-exclamation"></i>
                </div>

                <h3 class="stripe-error-title" id="stripeErrorTitle">
                    Refund Unavailable
                </h3>

                <p class="stripe-error-message"></p>

                <button type="button" class="stripe-error-ok">
                    OK, Understood
                </button>
            </div>
        `;

        overlay.querySelector(".stripe-error-message").textContent = message;

        const okButton = overlay.querySelector(".stripe-error-ok");

        okButton.addEventListener("click", () => {
            overlay.remove();
            resolve();
        });

        document.body.appendChild(overlay);
        okButton.focus();
    });
}

// =========================================
// REFUND MODAL - STRIPE TEST REFUNDS
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    const refundModal = document.getElementById("refundModal");
    const openRefundBtn = document.getElementById("openRefundModal");
    const cancelRefundBtn = document.getElementById("cancelRefund");
    const refundAmountInput = document.getElementById("refundAmount");
    const confirmRefundBtn = document.getElementById("confirmRefund");

    if (
        !refundModal ||
        !openRefundBtn ||
        !refundAmountInput ||
        !confirmRefundBtn
    ) return;

    let refundSubmitting = false;

    function closeRefundModal() {
        if (refundSubmitting) return;
        refundModal.classList.remove("active");
    }

    openRefundBtn.addEventListener("click", async () => {

    if (!selectedOrder) {
        alert("Select an order first.");
        return;
    }

    const orderId = String(selectedOrder.order_id);

    const { data: payments, error: paymentError } =
        await window.supabaseClient
            .from("order_payments")
            .select("amount_paid")
            .eq("order_id", orderId);

    const { data: refunds, error: refundError } =
        await window.supabaseClient
            .from("order_refunds")
            .select("refund_amount")
            .eq("order_id", orderId)
            .eq("refund_status", "succeeded");

    if (paymentError || refundError) {
        showAdminToast("Unable to load refundable balance.", "error");
        return;
    }

    const totalPaidCents = (payments || []).reduce(
        (sum, payment) =>
            sum + Math.round(Number(payment.amount_paid) * 100),
        0
    );

    const refundedCents = (refunds || []).reduce(
        (sum, refund) =>
            sum + Math.round(Number(refund.refund_amount) * 100),
        0
    );

    const remainingCents = Math.max(
        0,
        totalPaidCents - refundedCents
    );

    document.getElementById("refundTotalPaid").textContent =
        formatOrderMoney(totalPaidCents / 100);

    document.getElementById("refundAlreadyPaid").textContent =
        formatOrderMoney(refundedCents / 100);

    document.getElementById("refundRemaining").textContent =
        formatOrderMoney(remainingCents / 100);

    refundAmountInput.value = "";
    refundAmountInput.max = (remainingCents / 100).toFixed(2);
    confirmRefundBtn.disabled = remainingCents === 0;

    refundModal.classList.add("active");
});

    cancelRefundBtn?.addEventListener("click", closeRefundModal);

    refundModal.addEventListener("click", (event) => {
        if (event.target === refundModal) {
            closeRefundModal();
        }
    });

    confirmRefundBtn.addEventListener("click", async () => {

        if (refundSubmitting || !selectedOrder) return;

        const amount = Number(refundAmountInput.value);
        const orderId = selectedOrder.order_id;

        if (
            !Number.isFinite(amount) ||
            amount <= 0 ||
            !Number.isSafeInteger(Math.round(amount * 100)) ||
            Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001
        ) {
            await showStripeRefundError(
                "Enter a valid refund amount in dollars and cents.\n\n" +
                "Please enter an amount greater than $0.00 using no more than two decimal places."
            );
            return;
        }

        if (!orderId) {
            alert("Missing order ID.");
            return;
        }

        const approved = await confirmStripeRefund(
            `Refund $${amount.toFixed(2)} for order ${orderId}?\n\n` +
            "This will submit a Stripe refund."
        );

        if (!approved) return;

        refundSubmitting = true;
        confirmRefundBtn.disabled = true;
        confirmRefundBtn.textContent = "Processing...";

        // Generate once for this submission.
        const refundRequestId = crypto.randomUUID();

        try {

            const { data, error } =
                await window.supabaseClient.auth.getSession();

            if (error || !data?.session?.access_token) {
                throw new Error("Admin session expired. Log in again.");
            }

            const response = await fetch(
                "https://api.amplifiedsites.com/admin/refund",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization:
                            `Bearer ${data.session.access_token}`
                    },
                    body: JSON.stringify({
                        order_id: orderId,
                        amount: amount,
                        refund_request_id: refundRequestId
                    })
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.error || "Refund could not be completed."
                );
            }

            function showStripeRefundSuccess(orderId, amount) {

            return new Promise((resolve) => {

                const overlay = document.createElement("div");
                overlay.className = "stripe-success-overlay";

                overlay.innerHTML = `
                    <div class="stripe-success-box" role="alertdialog" aria-modal="true">

                        <div class="stripe-success-icon">
                            <i class="fa-solid fa-circle-check"></i>
                        </div>

                        <h3 class="stripe-success-title">
                            Refund Successful!
                        </h3>

                        <p class="stripe-success-message">
                            Your Stripe refund has been processed successfully.
                        </p>

                        <div class="stripe-success-details">
                            <div>
                                <span>Order</span>
                                <strong id="successRefundOrder"></strong>
                            </div>

                            <div>
                                <span>Amount Refunded</span>
                                <strong class="stripe-success-amount"
                                        id="successRefundAmount"></strong>
                            </div>
                        </div>

                        <button type="button" class="stripe-success-ok">
                            OK, Understood
                        </button>

                    </div>
                `;

                overlay.querySelector("#successRefundOrder").textContent = orderId;
                overlay.querySelector("#successRefundAmount").textContent =
                    `$${Number(amount).toFixed(2)}`;

                const okButton = overlay.querySelector(".stripe-success-ok");

                okButton.addEventListener("click", () => {
                    overlay.remove();
                    resolve();
                });

                document.body.appendChild(overlay);
                okButton.focus();

            });

        }

            await showStripeRefundSuccess(orderId, amount);

            refundModal.classList.remove("active");

            if (typeof loadOrders === "function") {
                await loadOrders();
            }

        } catch (error) {

            console.error("REFUND ERROR:", error);

            // Close the refund modal
            refundModal.classList.remove("active");

            // Display styled error popup
            await showStripeRefundError(
                error.message === "Stripe refunds are currently disabled."
                    ? "Stripe refunds are currently disabled.\n\nRefund processing is temporarily unavailable. No refund has been issued."
                    : `${error.message}\n\n` +
                    "If the request may have reached Stripe, " +
                    "check Stripe and Supabase before attempting it again."
            );

        } finally {

            refundSubmitting = false;
            confirmRefundBtn.disabled = false;
            confirmRefundBtn.textContent = "Refund";

        }

        });
    });

// =========================================
// ORDERS / REFUND HISTORY TABS
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    const tabs = document.querySelectorAll(
        ".orders-history-tab"
    );

    const panels = document.querySelectorAll(
        ".orders-history-panel"
    );

    tabs.forEach(button => {

        button.addEventListener("click", () => {

            const selectedView = button.dataset.ordersView;

            // Remove active tab
            tabs.forEach(tab => {
                tab.classList.remove("active");
            });

            // Activate selected tab
            button.classList.add("active");

            // Show matching panel
            panels.forEach(panel => {

                panel.classList.toggle(
                    "active",
                    panel.dataset.ordersPanel === selectedView
                );

            });

        });

    });

});

// =========================================
// SEARCH / FILTER REFUND HISTORY
// =========================================

function filterRefundHistory() {

    const search = (
        document.getElementById("orderSearch")?.value || ""
    ).toLowerCase().trim();

    const filteredRefunds = refundHistoryRecords.filter(refund => {

        const order = allOrders.find(item =>
            String(item.order_id) === String(refund.order_id)
        );

        return [
            refund.order_id,
            refund.refund_amount,
            refund.created_at,
            order?.client_name,
            order?.client_email,
            order?.business_name,
            order?.client_phone
        ].some(value =>
            String(value ?? "").toLowerCase().includes(search)
        );

    });

    renderRefundHistory(filteredRefunds);
}

// =========================================
// REFUND HISTORY DATA
// =========================================
let refundHistoryRecords = [];
let refundHistoryPayments = [];

// =========================================
// RENDER REFUND HISTORY
// =========================================

function renderRefundHistory(refunds) {

    const container = document.getElementById("refundHistoryList");
    if (!container) return;

    if (refunds.length === 0) {
        container.innerHTML = `
            <p class="orders-empty">
                ${refundHistoryRecords.length
                    ? "No matching refunds found."
                    : "No refunds recorded yet."}
            </p>
        `;
        return;
    }

    // Group matching refund transactions by order
    const groupedRefunds = new Map();

    refunds.forEach(refund => {
        const orderId = String(refund.order_id);

        if (!groupedRefunds.has(orderId)) {
            groupedRefunds.set(orderId, {
                orderId,
                latestDate: refund.created_at
            });
        }

        const group = groupedRefunds.get(orderId);

        if (new Date(refund.created_at) > new Date(group.latestDate)) {
            group.latestDate = refund.created_at;
        }
    });

    // Calculate full refund totals using ALL records,
    // not just records matching the search.
    const refundedByOrder = new Map();
    const paidByOrder = new Map();
    const refundCountByOrder = new Map();

    refundHistoryRecords.forEach(refund => {
        const id = String(refund.order_id);

        refundedByOrder.set(
            id,
            (refundedByOrder.get(id) || 0) +
            Math.round(Number(refund.refund_amount || 0) * 100)
        );

        refundCountByOrder.set(
            id,
            (refundCountByOrder.get(id) || 0) + 1
        );
    });

    refundHistoryPayments.forEach(payment => {
        const id = String(payment.order_id);

        paidByOrder.set(
            id,
            (paidByOrder.get(id) || 0) +
            Math.round(Number(payment.amount_paid || 0) * 100)
        );
    });

    container.innerHTML = Array.from(groupedRefunds.values())
        .sort((a, b) =>
            new Date(b.latestDate) - new Date(a.latestDate)
        )
        .map(group => {

            const orderId = group.orderId;
            const totalRefunded = refundedByOrder.get(orderId) || 0;
            const totalPaid = paidByOrder.get(orderId) || 0;
            const refundCount = refundCountByOrder.get(orderId) || 0;

            const fullyRefunded =
                totalPaid > 0 && totalRefunded >= totalPaid;

            const refundStatus = fullyRefunded
                ? "Fully Refunded"
                : "Partial Refund";

            const statusClass = fullyRefunded
                ? "fully-refunded"
                : "partial-refund";

            return `
                <div class="order-list-card refund-history-card"
                     data-order-id="${escapeOrderText(orderId)}"
                     role="button"
                     tabindex="0"
                     style="cursor: pointer;">

                    <div class="order-card-top">
                        <div>
                            <div class="order-card-name">
                                Order ${escapeOrderText(orderId)}
                            </div>

                            <div class="order-card-number">
                                ${escapeOrderText(
                                    new Date(group.latestDate).toLocaleString()
                                )}
                                · ${refundCount} refund ${refundCount === 1 ? "transaction" : "transactions"}
                            </div>
                        </div>

                        <span class="order-card-status ${statusClass}">
                            ${refundStatus}
                        </span>
                    </div>

                    <div class="order-card-bottom">
                        <div>
                            <div class="order-card-package">
                                Total Refunded
                            </div>

                            <div class="order-card-price">
                                ${formatOrderMoney(totalRefunded / 100)}
                            </div>
                        </div>

                        <button
                            type="button"
                            class="refund-view-btn"
                            data-order-id="${escapeOrderText(orderId)}">
                            <i class="fa-solid fa-eye"></i>
                            View Details
                        </button>
                    </div>
                </div>
            `;
        }).join("");
}


// =========================================
// LOAD REFUND HISTORY
// =========================================
async function loadRefundHistory() {

    const container = document.getElementById("refundHistoryList");
    if (!container) return;

    container.innerHTML = "<p>Loading refund history...</p>";

    const { data: refunds, error: refundError } =
        await window.supabaseClient
            .from("order_refunds")
            .select("*")
            .eq("refund_status", "succeeded")
            .order("created_at", { ascending: false });

    if (refundError) {
        console.error("Error loading refunds:", refundError);
        container.innerHTML = "<p>Unable to load refund history.</p>";
        return;
    }

    const { data: payments, error: paymentError } =
        await window.supabaseClient
            .from("order_payments")
            .select("order_id, amount_paid");

    if (paymentError) {
        console.error("Error loading payments:", paymentError);
        container.innerHTML = "<p>Unable to load payment details.</p>";
        return;
    }

    refundHistoryRecords = refunds || [];
    refundHistoryPayments = payments || [];

    filterRefundHistory();
}

// =========================================
// OPEN REFUNDED ORDER DETAILS
// =========================================

document.getElementById("refundHistoryList")
    ?.addEventListener("click", (event) => {

        const button = event.target.closest(".refund-view-btn");

        if (!button) return;

        openOrderModal(button.dataset.orderId, true);

    });

document.getElementById("refundHistoryList")
    ?.addEventListener("keydown", (event) => {

        if (event.key !== "Enter" && event.key !== " ") return;

        const card = event.target.closest(".refund-history-card");

        if (!card) return;

        event.preventDefault();

        openOrderModal(card.dataset.orderId, true);

    });

// =========================================
// REFUND HISTORY TAB
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    const refundTab = document.querySelector(
        '.orders-history-tab[data-orders-view="refunds"]'
    );

    refundTab?.addEventListener(
        "click",
        loadRefundHistory
    );

});


// =========================================
// DASHBOARD - REVENUE ANALYTICS
// =========================================

let revenueChart = null;
let revenueChartPeriod = 7;

function renderRevenueAnalytics() {

    const canvas = document.getElementById("revenueAnalyticsChart");

    if (!canvas || typeof Chart === "undefined") return;

    const now = new Date();

    // Use local calendar dates
    function dateKey(date) {
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");
    }

    function monthKey(date) {
        return date.getFullYear() + "-" +
            String(date.getMonth() + 1).padStart(2, "0");
    }

    const monthly = revenueChartPeriod === 365;

    const keys = [];
    const labels = [];

    const count = monthly ? 12 : revenueChartPeriod;

    for (let i = count - 1; i >= 0; i--) {

        let date;

        if (monthly) {
            date = new Date(
                now.getFullYear(),
                now.getMonth() - i,
                1
            );
        } else {
            date = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate() - i
            );
        }

        keys.push(monthly ? monthKey(date) : dateKey(date));

        labels.push(
            monthly
                ? date.toLocaleDateString("en-US", {
                    month: "short",
                    year: "2-digit"
                })
                : date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric"
                })
        );
    }

    // Store amounts in cents to avoid rounding errors
    const totals = Object.fromEntries(
        keys.map(key => [key, 0])
    );

    // Add successful recorded payments
    allOrderPayments.forEach(payment => {

        if (!payment.created_at) return;

        const date = new Date(payment.created_at);

        if (Number.isNaN(date.getTime())) return;

        const key = monthly ? monthKey(date) : dateKey(date);

        if (!Object.prototype.hasOwnProperty.call(totals, key)) {
            return;
        }

        totals[key] += Math.round(
            Number(payment.amount_paid || 0) * 100
        );
    });

    // Subtract successful refunds
    allRefunds.forEach(refund => {

        if (!refund.created_at) return;

        const date = new Date(refund.created_at);

        if (Number.isNaN(date.getTime())) return;

        const key = monthly ? monthKey(date) : dateKey(date);

        if (!Object.prototype.hasOwnProperty.call(totals, key)) {
            return;
        }

        totals[key] -= Math.round(
            Number(refund.refund_amount || 0) * 100
        );
    });

    const revenueData = keys.map(key => totals[key] / 100);

    if (revenueChart) {
        revenueChart.destroy();
    }

    revenueChart = new Chart(canvas, {

        type: "line",

        data: {
            labels: labels,

            datasets: [{
                label: "Net Revenue",
                data: revenueData,
                borderColor: "#2563eb",
                backgroundColor: "rgba(37, 99, 235, 0.10)",
                borderWidth: 3,
                fill: true,
                tension: 0.35,
                pointRadius: 4,
                pointHoverRadius: 7,
                pointBackgroundColor: "#2563eb"
            }]
        },

        options: {

            responsive: true,
            maintainAspectRatio: false,

            interaction: {
                intersect: false,
                mode: "index"
            },

            plugins: {

                legend: {
                    display: false
                },

                tooltip: {
                    callbacks: {
                        label: context =>
                            "Net Revenue: " +
                            formatOrderMoney(context.parsed.y)
                    }
                }
            },

            scales: {

                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: monthly ? 12 : 10
                    }
                },

                y: {
                    beginAtZero: false,

                    ticks: {
                        callback: value =>
                            "$" + Number(value).toLocaleString()
                    }
                }
            }
        }
    });
}

// =========================================
// ANALYTICS - PERIOD FILTERS
// =========================================

document.querySelectorAll(".analytics-filter").forEach(button => {

    button.addEventListener("click", () => {

        document.querySelectorAll(".analytics-filter")
            .forEach(item => item.classList.remove("active"));

        button.classList.add("active");

        revenueChartPeriod = Number(button.dataset.period);

        renderRevenueAnalytics();
    });

});


/* =========================================
   ADMIN LEGAL - EDITOR OPEN / CLOSE
========================================= */

const legalEditorModal =
    document.getElementById("legalEditorModal");

const legalEditorForm =
    document.getElementById("legalEditorForm");

const legalEditorTitle =
    document.getElementById("legalEditorTitle");

const legalDocumentType =
    document.getElementById("legalDocumentType");

const legalDocumentTitle =
    document.getElementById("legalDocumentTitle");

// =========================================
// OPEN LEGAL EDITOR
// =========================================

// =========================================
// OPEN LEGAL EDITOR - DYNAMIC CARDS
// =========================================

document.getElementById("legalDocumentsGrid")
    ?.addEventListener("click", async event => {

        const button = event.target.closest(".legal-edit-btn");

        if (!button) return;

        const documentType = button.dataset.legalDocument;

        const documentRecord = allLegalDocuments.find(
            doc => doc.slug === documentType
        );

        if (!documentRecord) {
            showAdminToast("Legal document not found.", "error");
            return;
        }

        const { data, error } = await window.supabaseClient
            .from("legal_sections")
            .select("id, title, content, sort_order")
            .eq("document_id", documentRecord.id)
            .order("sort_order", { ascending: true });

        if (error) {
            console.error("Error loading legal sections:", error);
            showAdminToast("Unable to load legal sections.", "error");
            return;
        }

        legalEditorTitle.textContent = `Edit ${documentRecord.title}`;
        legalDocumentType.value = documentRecord.slug;
        legalDocumentTitle.value = documentRecord.title;

        legalSections = (data || []).map(section => ({
            id: section.id,
            title: section.title,
            content: section.content
        }));

        renderLegalSections();

        const deleteButton =
            document.getElementById("deleteLegalDocumentBtn");

        if (deleteButton) {
            deleteButton.style.display = "";
        }

        legalEditorModal.classList.add("active");
    });


 // =========================================
 // DELETE ENTIRE LEGAL DOCUMENT
 // =========================================

let pendingLegalDocumentDelete = null;

const deleteLegalDocumentModal =
    document.getElementById("deleteLegalDocumentModal");

document.getElementById("deleteLegalDocumentBtn")
    ?.addEventListener("click", () => {

        const slug = legalDocumentType.value.trim();

        const documentRecord = allLegalDocuments.find(
            doc => doc.slug === slug
        );

        if (!documentRecord) {
            showAdminToast("Document not found.", "error");
            return;
        }

        if (slug === "terms" || slug === "privacy") {
            showAdminToast(
                "Terms and Privacy documents cannot be deleted.",
                "error"
            );
            return;
        }

        pendingLegalDocumentDelete = documentRecord;

        document.getElementById("deleteLegalDocumentName")
            .textContent = documentRecord.title;

        deleteLegalDocumentModal.classList.add("active");
    });

document.getElementById("cancelDeleteLegalDocument")
    ?.addEventListener("click", () => {

        deleteLegalDocumentModal.classList.remove("active");
        pendingLegalDocumentDelete = null;
    });

document.getElementById("confirmDeleteLegalDocument")
    ?.addEventListener("click", async () => {

        if (!pendingLegalDocumentDelete) return;

        const documentRecord = pendingLegalDocumentDelete;
        const confirmButton =
            document.getElementById("confirmDeleteLegalDocument");

        confirmButton.disabled = true;

        try {
            const { error: sectionsError } =
                await window.supabaseClient
                    .from("legal_sections")
                    .delete()
                    .eq("document_id", documentRecord.id);

            if (sectionsError) throw sectionsError;

            const { data, error } =
                await window.supabaseClient
                    .from("legal_documents")
                    .delete()
                    .eq("id", documentRecord.id)
                    .select("id");

            if (error) throw error;

            if (!data?.length) {
                throw new Error(
                    "Document was not deleted. Check Supabase permissions."
                );
            }

            deleteLegalDocumentModal.classList.remove("active");
            pendingLegalDocumentDelete = null;

            closeLegalEditorModal();
            await loadAdminLegalDocuments();

            showAdminToast(
                "Legal document permanently deleted!",
                "success"
            );

        } catch (error) {
            console.error("Error deleting legal document:", error);

            showAdminToast(
                "Unable to delete document: " + error.message,
                "error"
            );

        } finally {
            confirmButton.disabled = false;
        }
    });

deleteLegalDocumentModal?.addEventListener("click", event => {
    if (event.target === deleteLegalDocumentModal) {
        deleteLegalDocumentModal.classList.remove("active");
        pendingLegalDocumentDelete = null;
    }
});

// =========================================
// ADD NEW LEGAL DOCUMENT
// =========================================

document.getElementById("addLegalDocumentBtn")
    ?.addEventListener("click", () => {

        // Clear the existing editor
        legalEditorForm.reset();

        // Blank document ID/type means new document
        legalDocumentType.value = "";

        // Set popup heading
        legalEditorTitle.textContent = "Add Legal Document";

        // Clear document title
        legalDocumentTitle.value = "";

        // Remove previously loaded sections
        legalSections = [];

        // Display blank sections area
        renderLegalSections();

        // Hide Delete Document for new documents
        const deleteButton =
            document.getElementById("deleteLegalDocumentBtn");

        if (deleteButton) {
            deleteButton.style.display = "none";
        }

        // Open editor
        legalEditorModal.classList.add("active");

    });


// =========================================
// CLOSE LEGAL EDITOR
// =========================================

function closeLegalEditorModal() {

    legalEditorModal.classList.remove("active");

}


// CLOSE BUTTON

document.getElementById("closeLegalEditor")
    .addEventListener("click", closeLegalEditorModal);


// CANCEL BUTTON

document.getElementById("cancelLegalEditor")
    .addEventListener("click", closeLegalEditorModal);


// CLICK OUTSIDE MODAL

legalEditorModal.addEventListener("click", event => {

    if (event.target === legalEditorModal) {
        closeLegalEditorModal();
    }

});


// ESCAPE KEY

document.addEventListener("keydown", event => {

    if (
        event.key === "Escape" &&
        legalEditorModal.classList.contains("active")
    ) {
        closeLegalEditorModal();
    }

});


/* =========================================
   ADMIN LEGAL - SECTION MANAGEMENT
========================================= */

let legalSections = [];

const legalSectionsContainer =
    document.getElementById("legalEditorSections");

const addLegalSectionBtn =
    document.getElementById("addLegalSectionBtn");


// =========================================
// CREATE SECTION
// =========================================

function createLegalSection(title = "", content = "") {

    return {
        id: crypto.randomUUID(),
        title,
        content
    };

}


// =========================================
// RENDER LEGAL SECTIONS
// =========================================

function renderLegalSections() {

    legalSectionsContainer.replaceChildren();

    if (legalSections.length === 0) {

        const empty = document.createElement("div");

        empty.className = "legal-sections-empty";

        empty.textContent =
            "No sections yet. Click Add Section to create one.";

        legalSectionsContainer.appendChild(empty);

        return;
    }

    legalSections.forEach((section, index) => {

        const card = document.createElement("div");
        card.className = "legal-section-card";

        const header = document.createElement("div");
        header.className = "legal-section-card-header";

        const number = document.createElement("span");
        number.className = "legal-section-number";
        number.textContent = index + 1;

        const heading = document.createElement("span");
        heading.className = "legal-section-card-title";
        heading.textContent = section.title || "New Section";

        const actions = document.createElement("div");
        actions.className = "legal-section-actions";

        function actionButton(icon, label, callback, extraClass = "") {

            const button = document.createElement("button");

            button.type = "button";
            button.className =
                `legal-section-action-btn ${extraClass}`;

            button.setAttribute("aria-label", label);
            button.title = label;

            const iconElement = document.createElement("i");
            iconElement.className = `fa-solid fa-${icon}`;

            button.appendChild(iconElement);

            button.addEventListener("click", callback);

            return button;
        }

        actions.appendChild(actionButton(
            "arrow-up",
            "Move section up",
            () => moveLegalSection(index, -1)
        ));

        actions.appendChild(actionButton(
            "arrow-down",
            "Move section down",
            () => moveLegalSection(index, 1)
        ));

        actions.appendChild(actionButton(
            "trash",
            "Delete section",
            () => deleteLegalSection(section.id),
            "delete"
        ));

        header.append(number, heading, actions);

        const titleField = document.createElement("div");
        titleField.className = "legal-section-field";

        const titleLabel = document.createElement("label");
        titleLabel.textContent = "Section Title";

        const titleInput = document.createElement("input");
        titleInput.type = "text";
        titleInput.value = section.title;
        titleInput.placeholder = "Enter section title";
        titleInput.required = true;

        titleInput.addEventListener("input", () => {
            section.title = titleInput.value;
            heading.textContent = section.title || "New Section";
        });

        titleField.append(titleLabel, titleInput);

        const contentField = document.createElement("div");
        contentField.className = "legal-section-field";

        const contentLabel = document.createElement("label");
        contentLabel.textContent = "Section Content";

        const contentInput = document.createElement("textarea");
        contentInput.value = section.content;
        contentInput.placeholder = "Enter section content...";
        contentInput.required = true;

        contentInput.addEventListener("input", () => {
            section.content = contentInput.value;
        });

        contentField.append(contentLabel, contentInput);

        card.append(header, titleField, contentField);

        legalSectionsContainer.appendChild(card);

    });

}


// =========================================
// ADD SECTION
// =========================================

addLegalSectionBtn.addEventListener("click", () => {

    legalSections.push(createLegalSection());

    renderLegalSections();

    legalSectionsContainer
        .querySelector(".legal-section-card:last-child input")
        ?.focus();

});


// =========================================
// DELETE SECTION
// =========================================


function deleteLegalSection(id) {

    const modal = document.getElementById("legalDeleteModal");

    // Open custom confirmation popup
    if (modal) {
        modal.dataset.sectionId = id;
        modal.classList.add("active");
        return;
    }

    // Fallback if custom popup is missing
    if (!confirm("Delete this legal section?")) {
        return;
    }

    legalSections = legalSections.filter(
        section => section.id !== id
    );

    renderLegalSections();

}


// =========================================
// LEGAL DELETE MODAL BUTTONS
// =========================================

const legalDeletePopup =
    document.getElementById("legalDeleteModal");

const legalDeleteCancel =
    document.getElementById("cancelLegalDelete");

const legalDeleteConfirm =
    document.getElementById("confirmLegalDelete");

// Close popup
function closeLegalDeletePopup() {
    if (!legalDeletePopup) return;

    legalDeletePopup.classList.remove("active");
    delete legalDeletePopup.dataset.sectionId;
}

// Cancel button
legalDeleteCancel?.addEventListener("click", () => {
    closeLegalDeletePopup();
});

// Confirm delete button
legalDeleteConfirm?.addEventListener("click", () => {

    if (!legalDeletePopup) return;

    const sectionId = legalDeletePopup.dataset.sectionId;

    if (!sectionId) return;

    legalSections = legalSections.filter(
        section => section.id !== sectionId
    );

    closeLegalDeletePopup();

    renderLegalSections();

});

// Close when clicking outside popup
legalDeletePopup?.addEventListener("click", event => {

    if (event.target === legalDeletePopup) {
        closeLegalDeletePopup();
    }

});


// =========================================
// REORDER SECTIONS
// =========================================

function moveLegalSection(index, direction) {

    const newIndex = index + direction;

    if (
        newIndex < 0 ||
        newIndex >= legalSections.length
    ) {
        return;
    }

    [legalSections[index], legalSections[newIndex]] =
        [legalSections[newIndex], legalSections[index]];

    renderLegalSections();

}


// =========================================
// SAVE LEGAL DOCUMENT - ADD / EDIT
// =========================================

legalEditorForm.addEventListener("submit", async event => {

    event.preventDefault();

    const documentTitle = legalDocumentTitle.value.trim();
    const documentSlug = legalDocumentType.value.trim();

    // =========================================
    // VALIDATE DOCUMENT TITLE
    // =========================================

    if (!documentTitle) {
        showAdminToast(
            "Please enter a document title.",
            "error"
        );
        return;
    }

    // =========================================
    // VALIDATE SECTIONS
    // =========================================

    if (
        legalSections.length === 0 ||
        legalSections.some(section =>
            !String(section.title || "").trim() ||
            !String(section.content || "").trim()
        )
    ) {
        showAdminToast(
            "Add at least one section. Every section needs a title and content.",
            "error"
        );
        return;
    }

    // =========================================
    // DETERMINE ADD OR EDIT MODE
    // =========================================

    const isNewDocument = !documentSlug;

    const documentRecord = isNewDocument
        ? null
        : allLegalDocuments.find(
            doc => doc.slug === documentSlug
        );

    if (!isNewDocument && !documentRecord) {
        showAdminToast(
            "Legal document not found. Refresh the page.",
            "error"
        );
        return;
    }

    // =========================================
    // GENERATE SLUG FOR NEW DOCUMENT
    // =========================================

    const newSlug = documentTitle
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    if (isNewDocument && !newSlug) {
        showAdminToast(
            "Document title must contain letters or numbers.",
            "error"
        );
        return;
    }

    if (
        isNewDocument &&
        allLegalDocuments.some(doc => doc.slug === newSlug)
    ) {
        showAdminToast(
            "A legal document with this name already exists.",
            "error"
        );
        return;
    }

    // =========================================
    // DISABLE SAVE BUTTON
    // =========================================

    const saveButton = legalEditorForm.querySelector(
        'button[type="submit"]'
    );

    if (saveButton) saveButton.disabled = true;

    let createdDocumentId = null;

    try {

        // =========================================
        // ADD NEW LEGAL DOCUMENT
        // =========================================

        if (isNewDocument) {

            const { data: newDocument, error: createError } =
                await window.supabaseClient
                    .from("legal_documents")
                    .insert({
                        slug: newSlug,
                        title: documentTitle,
                        is_published: false
                    })
                    .select("id")
                    .single();

            if (createError) throw createError;

            createdDocumentId = newDocument.id;

            const newSections = legalSections.map(
                (section, index) => ({
                    document_id: createdDocumentId,
                    title: section.title.trim(),
                    content: section.content.trim(),
                    sort_order: index + 1
                })
            );

            const { error: sectionsError } =
                await window.supabaseClient
                    .from("legal_sections")
                    .insert(newSections);

            if (sectionsError) throw sectionsError;

        } else {

            // =========================================
            // EDIT EXISTING LEGAL DOCUMENT
            // =========================================

            const { data: existing, error: readError } =
                await window.supabaseClient
                    .from("legal_sections")
                    .select("id")
                    .eq("document_id", documentRecord.id);

            if (readError) throw readError;

            // =========================================
            // UPDATE DOCUMENT TITLE
            // =========================================

            const { data: updatedDocument, error: titleError } =
                await window.supabaseClient
                    .from("legal_documents")
                    .update({
                        title: documentTitle
                    })
                    .eq("id", documentRecord.id)
                    .select("id");

            if (titleError) throw titleError;

            if (!updatedDocument?.length) {
                throw new Error(
                    "Document was not updated. Check Supabase permissions."
                );
            }

            // =========================================
            // FIND DELETED SECTIONS
            // =========================================

            const currentIds = new Set(
                legalSections
                    .filter(section => section.id)
                    .map(section => String(section.id))
            );

            const deletedIds = (existing || [])
                .filter(section =>
                    !currentIds.has(String(section.id))
                )
                .map(section => section.id);

            // =========================================
            // UPDATE EXISTING SECTIONS
            // =========================================

            const existingRows = legalSections
                .filter(section => section.id)
                .map((section, index) => ({
                    id: section.id,
                    document_id: documentRecord.id,
                    title: section.title.trim(),
                    content: section.content.trim(),
                    sort_order: legalSections.indexOf(section) + 1
                }));

            if (existingRows.length > 0) {

                const { error: updateError } =
                    await window.supabaseClient
                        .from("legal_sections")
                        .upsert(existingRows, {
                            onConflict: "id"
                        });

                if (updateError) throw updateError;
            }

            // =========================================
            // INSERT NEW SECTIONS
            // =========================================

            const newRows = legalSections
                .map((section, index) => ({
                    ...section,
                    sort_order: index + 1
                }))
                .filter(section => !section.id)
                .map(section => ({
                    document_id: documentRecord.id,
                    title: section.title.trim(),
                    content: section.content.trim(),
                    sort_order: section.sort_order
                }));

            if (newRows.length > 0) {

                const { error: insertError } =
                    await window.supabaseClient
                        .from("legal_sections")
                        .insert(newRows);

                if (insertError) throw insertError;
            }

            // =========================================
            // DELETE REMOVED SECTIONS
            // =========================================

            if (deletedIds.length > 0) {

                const { error: deleteError } =
                    await window.supabaseClient
                        .from("legal_sections")
                        .delete()
                        .eq("document_id", documentRecord.id)
                        .in("id", deletedIds);

                if (deleteError) throw deleteError;
            }

            // =========================================
            // UPDATE EXISTING CARD TITLE
            // =========================================

            const legalCardButton = Array.from(
                document.querySelectorAll(".legal-edit-btn")
            ).find(button =>
                button.dataset.legalDocument === documentRecord.slug
            );

            const legalCardTitle = legalCardButton
                ?.closest(".legal-document-card")
                ?.querySelector(".legal-document-info h3");

            if (legalCardTitle) {
                legalCardTitle.textContent = documentTitle;
            }

            documentRecord.title = documentTitle;
        }

        // =========================================
        // REFRESH DOCUMENTS
        // =========================================

        await loadAdminLegalDocuments();

        legalEditorModal.classList.remove("active");

        showAdminToast(
            isNewDocument
                ? "Legal document created successfully!"
                : "Legal document updated successfully!",
            "success"
        );

    } catch (error) {

        console.error("Error saving legal document:", error);

        showAdminToast(
            "Unable to save legal document: " + error.message,
            "error"
        );

    } finally {

        if (saveButton) {
            saveButton.disabled = false;
        }

    }

});

// =========================================
// LEGAL DOCUMENTS - SUPABASE
// =========================================

let allLegalDocuments = [];

// =========================================
// LOAD LEGAL DOCUMENTS
// =========================================

async function loadAdminLegalDocuments() {

    const container = document.getElementById("legalDocumentsGrid");

    if (!container) {
        console.error("Legal documents grid not found.");
        return;
    }

    const { data, error } = await window.supabaseClient
        .from("legal_documents")
        .select("*")
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error loading legal documents:", error);
        container.textContent = "Unable to load legal documents.";
        showAdminToast("Unable to load legal documents.", "error");
        return;
    }

    allLegalDocuments = data || [];

    container.innerHTML = "";

    if (allLegalDocuments.length === 0) {
        container.textContent = "No legal documents found.";
        return;
    }

    allLegalDocuments.forEach(doc => {

        const card = document.createElement("div");
        card.className = "legal-document-card";

        const iconWrapper = document.createElement("div");
        iconWrapper.className = "legal-document-icon";

        const icon = document.createElement("i");

        icon.className = doc.slug === "privacy"
            ? "fa-solid fa-shield-halved"
            : "fa-solid fa-file-contract";

        iconWrapper.appendChild(icon);

        const info = document.createElement("div");
        info.className = "legal-document-info";

        const title = document.createElement("h3");
        title.textContent = doc.title;

        const description = document.createElement("p");

        description.textContent = doc.slug === "terms"
            ? "Manage the terms and conditions for Amplified Sites services."
            : doc.slug === "privacy"
            ? "Manage how customer information is collected, used, and protected."
            : "Manage this legal document and its sections.";

        const actions = document.createElement("div");
        actions.className = "legal-document-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "legal-edit-btn";
        editButton.dataset.legalDocument = doc.slug;
        editButton.innerHTML = '<i class="fa-solid fa-pen"></i> Edit';

        const previewButton = document.createElement("button");
        previewButton.type = "button";
        previewButton.className = "legal-preview-btn";
        previewButton.dataset.legalPreview = doc.slug;
        previewButton.innerHTML = '<i class="fa-regular fa-eye"></i> Preview';

        actions.appendChild(editButton);
        actions.appendChild(previewButton);

        info.appendChild(title);
        info.appendChild(description);
        info.appendChild(actions);

        card.appendChild(iconWrapper);
        card.appendChild(info);

        container.appendChild(card);
    });
}


// =========================================
// INITIALIZE LEGAL DOCUMENTS
// =========================================

document.addEventListener(
    "DOMContentLoaded",
    loadAdminLegalDocuments
);


// =========================================
// LEGAL DOCUMENT PREVIEW BUTTONS
// =========================================

document.getElementById("legalDocumentsGrid")
    ?.addEventListener("click", event => {

        const button = event.target.closest(".legal-preview-btn");

        if (!button) return;

        const documentType = button.dataset.legalPreview;

        const previewPages = {
            terms: "terms.html",
            privacy: "privacy.html"
        };

        const previewUrl = previewPages[documentType];

        if (!previewUrl) {
            showAdminToast(
                "A preview page has not been created for this document yet.",
                "error"
            );
            return;
        }

        window.open(previewUrl, "_blank", "noopener,noreferrer");
    });


/* =========================================
   ADMIN MESSAGES — LOAD INBOX
========================================= */

let adminMessages = [];
let activeMessageTab = "inbox";

async function loadAdminMessages() {

    const messageList = document.getElementById("messageList");
    const sidebarCount = document.getElementById("sidebarMessageCount");

    if (!messageList) return;

    messageList.innerHTML = `
        <div class="message-empty">Loading messages...</div>
    `;

    const { data, error } = await window.supabaseClient
        .from("Messages")
        .select("*")
        .eq("is_deleted", activeMessageTab === "deleted")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error loading messages:", error);

        messageList.innerHTML = `
            <div class="message-empty">
                Unable to load messages.
            </div>
        `;
        return;
    }

    adminMessages = data || [];

    const newMessages = adminMessages.filter(
    message =>
        message.status === "Unread" ||
        message.status === "New"
).length;

    if (sidebarCount) {
    sidebarCount.textContent = newMessages;
    sidebarCount.style.display = newMessages > 0 ? "" : "none";
}

    if (adminMessages.length === 0) {
        messageList.innerHTML = `
            <div class="message-empty">
                No messages found.
            </div>
        `;
        return;
    }

    
const searchTerm = (
    document.getElementById("messageSearch")?.value || ""
).toLowerCase().trim();

const filteredMessages = adminMessages.filter(message => {

    return [
        message.name,
        message.email,
        message.phone,
        message.business,
        message.subject,
        message.message,
        message.status
    ].some(value =>
        String(value || "").toLowerCase().includes(searchTerm)
    );

});

messageList.innerHTML = filteredMessages.length
    ? filteredMessages.map(message => `

    <div
        class="message-item"
        data-message-id="${escapeOrderText(message.id)}"
    >

        <!-- MESSAGE HEADER -->
        <div class="message-item-header">

            <input
                type="checkbox"
                class="message-item-checkbox"
                data-message-id="${escapeOrderText(message.id)}"
                aria-label="Select message from ${escapeOrderText(message.name || "Unknown")}"
            >

            <strong>
                ${escapeOrderText(message.name || "Unknown")}
            </strong>

            <span>
                ${escapeOrderText(message.status || "New")}
            </span>

        </div>

        <!-- MESSAGE SUBJECT -->
        <div class="message-item-subject">
            ${escapeOrderText(message.subject || "No Subject")}
        </div>

        <!-- MESSAGE PREVIEW -->
        <div class="message-item-preview">
            ${escapeOrderText(message.message || "").slice(0, 100)}
        </div>

        <!-- MESSAGE DATE -->
        <small>
            ${message.created_at
                ? new Date(message.created_at).toLocaleString()
                : "Unknown date"}
        </small>

    </div>

`).join("")
    : `<div class="message-empty">No matching messages found.</div>`;

}

// =========================================
// ADMIN MESSAGES — REALTIME UPDATES
// =========================================

let adminMessagesChannel = null;

function startAdminMessagesRealtime() {

    if (adminMessagesChannel) return;

    adminMessagesChannel = window.supabaseClient
        .channel("admin-messages-realtime")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "Messages"
            },
            () => {
                loadAdminMessages();
            }
        )
        .subscribe((status) => {
            console.log("ADMIN MESSAGES REALTIME:", status);
        });
}

document.addEventListener("DOMContentLoaded", async () => {

    const { data: { session } } =
        await window.supabaseClient.auth.getSession();

    if (!session) return;

    await loadAdminMessages();
    startAdminMessagesRealtime();

});

/* =========================================
   ADMIN MESSAGES — OPEN MESSAGE
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    const messageList = document.getElementById("messageList");
    const messageView = document.getElementById("messageView");

    if (!messageList || !messageView) return;

    messageList.addEventListener("click", async (event) => {

        const messageCard = event.target.closest(".message-item");

        if (!messageCard) return;

        const message = adminMessages.find(
            item => String(item.id) === messageCard.dataset.messageId
        );

if (!message) return;

// Mark unread messages as read when opened
if (message.status === "Unread" || message.status === "New") {

    const { data, error } = await window.supabaseClient
        .from("Messages")
        .update({ status: "Read" })
        .eq("id", message.id)
        .in("status", ["Unread", "New"])
        .select("id");

    if (error || !data?.length) {

        console.error(
            "Unable to mark message as read:",
            error || "No message updated"
        );

        showAdminToast(
            "Unable to mark message as read.",
            "error"
        );

    } else {

        message.status = "Read";

        // Update the status displayed in the message list
        const statusLabel = messageCard.querySelector(
            ".message-item-header span"
        );

        if (statusLabel) {
            statusLabel.textContent = "Read";
        }

        // Update the unread message count
        const sidebarCount =
            document.getElementById("sidebarMessageCount");

        if (sidebarCount) {
            sidebarCount.textContent = adminMessages.filter(
                item =>
                    item.status === "Unread" ||
                    item.status === "New"
            ).length;
        }
    }
}

// Highlight selected message

        messageList.querySelectorAll(".message-item").forEach(card => {
            card.classList.remove("active");
        });

        messageCard.classList.add("active");

        // Format date
        const date = message.created_at
            ? new Date(message.created_at).toLocaleString()
            : "Unknown";

        // Display message details
        messageView.innerHTML = `
            <div class="admin-message-detail">

                <div class="admin-message-detail-header">
                    <h2>${escapeOrderText(message.subject || "No Subject")}</h2>
                    <span>${escapeOrderText(message.status || "New")}</span>
                </div>

                <div class="admin-message-detail-info">
                    <p><strong>From:</strong> ${escapeOrderText(message.name || "Unknown")}</p>
                    <p><strong>Email:</strong> ${escapeOrderText(message.email || "N/A")}</p>
                    <p><strong>Phone:</strong> ${escapeOrderText(message.phone || "N/A")}</p>
                    <p><strong>Business:</strong> ${escapeOrderText(message.business || "N/A")}</p>
                    <p><strong>Received:</strong> ${escapeOrderText(date)}</p>
                </div>
                <div class="admin-message-detail-body">
                    <h3>Customer Message</h3>
                    <p>${escapeOrderText(message.message || "")}</p>
                </div>
                <div class="admin-message-reply">
                    <div class="admin-message-reply-header">
                        <h3>
                            <i class="fa-solid fa-reply"></i>
                            Reply to Customer
                        </h3>
                        <span>
                            To: ${escapeOrderText(message.email || "")}
                        </span>
                    </div>
                    <textarea
                        id="adminMessageReplyText"
                        placeholder="Write your reply to the customer..."
                        rows="6"
                        ></textarea>
                    <div class="admin-message-reply-actions">
                        <button
                            type="button"
                            id="sendAdminMessageReply"
                            class="primary-admin-btn"
                            data-message-id="${escapeOrderText(message.id)}">
                            <i class="fa-solid fa-paper-plane"></i>
                            Send Reply
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
});


/* =========================================
   ADMIN MESSAGES — SEND REPLY
========================================= */

document.addEventListener("click", async (event) => {

    const sendButton = event.target.closest("#sendAdminMessageReply");

    if (!sendButton || sendButton.disabled) return;

    const replyInput = document.getElementById("adminMessageReplyText");
    const replyText = replyInput?.value.trim();

    if (!replyText) {
        alert("Please enter a reply before sending.");
        return;
    }

    if (replyText.length > 5000) {
        alert("Reply cannot exceed 5000 characters.");
        return;
    }

    const messageId = sendButton.dataset.messageId;

    if (!messageId) {
        alert("Message ID is missing.");
        return;
    }

    const { data: sessionData, error: sessionError } =
        await window.supabaseClient.auth.getSession();

    const token = sessionData?.session?.access_token;

    if (sessionError || !token) {
        alert("Your admin session has expired. Please log in again.");
        return;
    }

    sendButton.disabled = true;
    sendButton.textContent = "Sending...";

    try {

        const response = await fetch(
            "https://api.amplifiedsites.com/admin/messages/reply",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "ngrok-skip-browser-warning": "true"
                },
                body: JSON.stringify({
                    message_id: messageId,
                    reply_text: replyText
                })
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || "Unable to send reply.");
        }

        showAdminMessageAlert("Your reply was sent to the customer successfully.", "success");

        replyInput.value = "";

        await loadAdminMessages();

    } catch (error) {

        console.error("SEND REPLY ERROR:", error);
        showAdminMessageAlert(error.message, "error");

    } finally {

        sendButton.disabled = false;
        sendButton.innerHTML =
            '<i class="fa-solid fa-paper-plane"></i> Send Reply';

    }

});


/* =========================================
   ADMIN MESSAGES — CUSTOM NOTIFICATIONS
========================================= */

function showAdminMessageAlert(message, type = "success") {

    const existingAlert = document.getElementById("adminMessageAlert");

    if (existingAlert) {
        existingAlert.remove();
    }

    const icons = {
        success: "fa-circle-check",
        error: "fa-circle-xmark",
        warning: "fa-triangle-exclamation"
    };

    const titles = {
        success: "Success",
        error: "Something Went Wrong",
        warning: "Attention"
    };

    const alertType = icons[type] ? type : "warning";

    const notification = document.createElement("div");

    notification.id = "adminMessageAlert";
    notification.className = `admin-message-alert ${alertType}`;

    notification.innerHTML = `
        <div class="admin-message-alert-icon">
            <i class="fa-solid ${icons[alertType]}"></i>
        </div>

        <div class="admin-message-alert-content">
            <strong>${titles[alertType]}</strong>
            <p></p>
        </div>

        <button type="button" class="admin-message-alert-close"
            aria-label="Close notification">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    notification.querySelector("p").textContent = message;

    document.body.appendChild(notification);

    const closeAlert = () => {
        notification.classList.add("hide");

        setTimeout(() => {
            notification.remove();
        }, 300);
    };

    notification
        .querySelector(".admin-message-alert-close")
        .addEventListener("click", closeAlert);

    setTimeout(() => {
        if (notification.isConnected) {
            closeAlert();
        }
    }, 4500);
}


/* =========================================
   ADMIN MESSAGES — SELECT AND BULK DELETE
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    const messageList = document.getElementById("messageList");
    const selectAll = document.getElementById("selectAllMessages");
    const deleteButton = document.getElementById("deleteSelectedMessages");

    if (!messageList || !selectAll || !deleteButton) return;

    function updateSelection() {
        const boxes = Array.from(
            messageList.querySelectorAll(".message-item-checkbox")
        );

        const checked = boxes.filter(box => box.checked);

        deleteButton.disabled = checked.length === 0;

        selectAll.checked =
            boxes.length > 0 && checked.length === boxes.length;

        selectAll.indeterminate =
            checked.length > 0 && checked.length < boxes.length;
    }

    selectAll.addEventListener("change", () => {
        messageList.querySelectorAll(".message-item-checkbox")
            .forEach(box => {
                box.checked = selectAll.checked;
            });

        updateSelection();
    });

    messageList.addEventListener("change", event => {
        if (event.target.matches(".message-item-checkbox")) {
            updateSelection();
        }
    });

    // Don't open message details when checking a box
    messageList.addEventListener("click", event => {
        if (event.target.closest(".message-item-checkbox")) {
            event.stopPropagation();
        }
    }, true);

    deleteButton.addEventListener("click", async () => {

        if (deleteButton.disabled) return;

        const selectedIds = Array.from(
            messageList.querySelectorAll(
                ".message-item-checkbox:checked"
            )
        ).map(box => box.dataset.messageId);

        if (!selectedIds.length) return;

        deleteButton.disabled = true;

        try {
            const { data, error } =
                await window.supabaseClient.auth.getSession();

            const token = data?.session?.access_token;

            if (error || !token) {
                throw new Error("Admin session expired. Please log in again.");
            }

            const response = await fetch(
                "https://api.amplifiedsites.com/admin/messages/bulk-delete",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                        "ngrok-skip-browser-warning": "true"
                    },
                    body: JSON.stringify({
                        message_ids: selectedIds
                    })
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.error || "Unable to delete selected messages."
                );
            }

            selectAll.checked = false;
            selectAll.indeterminate = false;

            await loadAdminMessages();

            // Clear the previously opened message
            const messageView = document.getElementById("messageView");

            if (messageView) {
                messageView.innerHTML = `
                    <div class="message-placeholder">
                        <i class="fa-regular fa-envelope"></i>
                        <h3>Select a message</h3>
                        <p>Choose a message from your inbox to view it.</p>
                    </div>
                `;
            }

            showAdminMessageAlert(
                `${result.deleted_count} message(s) moved to Recently Deleted.`,
                "success"
            );

        } catch (error) {
            console.error("BULK DELETE ERROR:", error);

            showAdminMessageAlert(error.message, "error");

        } finally {
            updateSelection();
        }
    });

});


/* =========================================
   ADMIN MESSAGES — INBOX / DELETED TABS
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    const tabs = document.querySelectorAll(
        "[data-message-filter]"
    );

    tabs.forEach(tab => {

        tab.addEventListener("click", async () => {

            const selectedTab = tab.dataset.messageFilter;

            if (!["inbox", "deleted"].includes(selectedTab)) {
                return;
            }

            
            activeMessageTab = selectedTab;

            document.getElementById("messages-section")
                ?.classList.toggle(
                    "recently-deleted-active",
                    activeMessageTab === "deleted"
                );

            // SHOW RESTORE ONLY IN RECENTLY DELETED
            const restoreButton =
                document.getElementById("restoreSelectedMessages");

            if (restoreButton) {
                const isDeletedTab = activeMessageTab === "deleted";

                restoreButton.hidden = !isDeletedTab;
                restoreButton.style.display = isDeletedTab
                    ? "inline-flex"
                    : "none";

                restoreButton.disabled = true;
            }

            tabs.forEach(button => {
                button.classList.toggle(
                    "active",
                    button === tab
                );
            });


            const selectAll =
                document.getElementById("selectAllMessages");

            const deleteButton =
                document.getElementById("deleteSelectedMessages");

            if (selectAll) {
                selectAll.checked = false;
                selectAll.indeterminate = false;
            }

            if (deleteButton) {
                deleteButton.disabled = true;
            }

            const messageView =
                document.getElementById("messageView");

            if (messageView) {
                messageView.innerHTML = `
                    <div class="message-placeholder">
                        <i class="fa-regular fa-envelope"></i>
                        <h3>Select a message</h3>
                        <p>Choose a message to view its details.</p>
                    </div>
                `;
            }

            await loadAdminMessages();
        });

    });

});


/* =========================================
   ADMIN MESSAGES - RESTORE SELECTED
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    const restoreButton =
        document.getElementById("restoreSelectedMessages");

    const messageList =
        document.getElementById("messageList");

    const selectAll =
        document.getElementById("selectAllMessages");

    if (!restoreButton || !messageList) return;

    // Enable Restore Selected when messages are checked
    function updateRestoreSelection() {

        const selected = messageList.querySelectorAll(
            ".message-item-checkbox:checked"
        );

        restoreButton.disabled =
            activeMessageTab !== "deleted" ||
            selected.length === 0;
    }

    messageList.addEventListener(
        "change",
        updateRestoreSelection
    );

    selectAll?.addEventListener(
        "change",
        updateRestoreSelection
    );

    // Restore checked messages
    restoreButton.addEventListener("click", async () => {

        if (
            restoreButton.disabled ||
            activeMessageTab !== "deleted"
        ) return;

        const selectedIds = Array.from(
            messageList.querySelectorAll(
                ".message-item-checkbox:checked"
            )
        ).map(box => box.dataset.messageId);

        if (!selectedIds.length) return;

        restoreButton.disabled = true;

        try {

            const { data, error } =
                await window.supabaseClient.auth.getSession();

            const token = data?.session?.access_token;

            if (error || !token) {
                throw new Error(
                    "Admin session expired. Please log in again."
                );
            }

            const response = await fetch(
                "https://api.amplifiedsites.com/admin/messages/bulk-restore",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`,
                        "ngrok-skip-browser-warning": "true"
                    },
                    body: JSON.stringify({
                        message_ids: selectedIds
                    })
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.error || "Unable to restore messages."
                );
            }

            if (selectAll) {
                selectAll.checked = false;
                selectAll.indeterminate = false;
            }

            await loadAdminMessages();

            const deleteButton =
                document.getElementById("deleteSelectedMessages");

            if (deleteButton) {
                deleteButton.disabled = true;
            }

            const messageView =
                document.getElementById("messageView");

            if (messageView) {
                messageView.innerHTML = `
                    <div class="message-placeholder">
                        <i class="fa-regular fa-envelope"></i>
                        <h3>Select a message</h3>
                        <p>Choose a message to view its details.</p>
                    </div>
                `;
            }

            showAdminMessageAlert(
                `${result.restored_count} message(s) restored to Inbox.`,
                "success"
            );

        } catch (error) {

            console.error("RESTORE MESSAGES ERROR:", error);

            showAdminMessageAlert(
                error.message,
                "error"
            );

        } finally {
            updateRestoreSelection();
        }
    });

});


/* =========================================
   ADMIN MESSAGES - LIVE SEARCH
========================================= */

document.addEventListener("DOMContentLoaded", () => {

    const searchInput =
        document.getElementById("messageSearch");

    if (!searchInput) return;

    searchInput.addEventListener("input", () => {

        const searchTerm = searchInput.value
            .toLowerCase()
            .trim();

        document.querySelectorAll(
            "#messageList .message-item"
        ).forEach(card => {

            const message = adminMessages.find(
                item => String(item.id) === card.dataset.messageId
            );

            if (!message) return;

            const searchableText = [
                message.name,
                message.email,
                message.phone,
                message.business,
                message.subject,
                message.message,
                message.status
            ].join(" ").toLowerCase();

            card.style.display =
                searchableText.includes(searchTerm)
                    ? ""
                    : "none";
        });

    });

});


/* =========================================
   ADMIN NOTIFICATIONS
========================================= */

let adminNotifications = [];

async function loadAdminNotifications() {
    const list = document.getElementById("notificationList");
    const count = document.getElementById("notificationCount");

    if (!list || !count || !window.supabaseClient) return;

    const { data, error } = await window.supabaseClient
        .from("admin_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

    if (error) {
        console.error("Notification loading error:", error);
        return;
    }

    adminNotifications = data || [];

    const unreadCount = adminNotifications.filter(
        notification => !notification.is_read
    ).length;

    count.textContent = unreadCount;
    count.hidden = unreadCount === 0;

    if (!adminNotifications.length) {
        list.innerHTML = `
            <div class="notification-empty">
                No notifications yet.
            </div>
        `;
        return;
    }

    list.innerHTML = adminNotifications.map(notification => {
        const isMessage = notification.notification_type === "message";
        const icon = isMessage ? "fa-envelope" : "fa-cart-shopping";

        return `
            <div class="notification-item ${notification.is_read ? "" : "unread"}"
                 data-notification-id="${escapeOrderText(notification.id)}">

                <div class="notification-item-icon">
                    <i class="fa-solid ${icon}"></i>
                </div>

                <div class="notification-item-content"
                     role="button"
                     tabindex="0">
                    <h4>${escapeOrderText(notification.title)}</h4>
                    <p>${escapeOrderText(notification.message)}</p>
                    <small>${new Date(notification.created_at).toLocaleString()}</small>
                </div>

                <button type="button"
                        class="notification-delete-btn"
                        aria-label="Delete notification">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
    }).join("");
}


/* =========================================
   REAL-TIME ADMIN NOTIFICATIONS
========================================= */

let adminNotificationsChannel = null;

function startAdminNotificationsRealtime() {

    if (adminNotificationsChannel) {
        return;
    }

    adminNotificationsChannel = window.supabaseClient
    .channel("admin-notifications-realtime")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "admin_notifications"
            },
            () => {
                loadAdminNotifications();
            }
        )
        .subscribe((status) => {
            console.log("ADMIN NOTIFICATIONS REALTIME:", status);
        });
}


document.addEventListener("DOMContentLoaded", () => {
    const bell = document.getElementById("notificationBtn");
    const dropdown = document.getElementById("notificationDropdown");
    const list = document.getElementById("notificationList");
    const markAll = document.getElementById("markAllNotificationsRead");

    if (!bell || !dropdown || !list) return;

    bell.addEventListener("click", () => {
        const opening = dropdown.hidden;

        dropdown.hidden = !opening;
        dropdown.classList.toggle("active", opening);
        bell.setAttribute("aria-expanded", String(opening));

        if (opening) loadAdminNotifications();
    });

    document.addEventListener("click", event => {
        if (event.target.closest(".notification-wrapper")) return;

        dropdown.hidden = true;
        dropdown.classList.remove("active");
        bell.setAttribute("aria-expanded", "false");
    });

    list.addEventListener("click", async event => {
        const item = event.target.closest(".notification-item");
        if (!item) return;

        const notification = adminNotifications.find(
            n => n.id === item.dataset.notificationId
        );

        if (!notification) return;

        if (event.target.closest(".notification-delete-btn")) {
            const { error } = await window.supabaseClient
                .from("admin_notifications")
                .delete()
                .eq("id", notification.id);

            if (error) {
                console.error(error);
                showAdminToast("Unable to delete notification.", "error");
                return;
            }

            await loadAdminNotifications();
            return;
        }

        if (!event.target.closest(".notification-item-content")) return;

        if (!notification.is_read) {
            const { error } = await window.supabaseClient
                .from("admin_notifications")
                .update({ is_read: true })
                .eq("id", notification.id);

            if (error) {
                console.error(error);
                showAdminToast("Unable to mark notification as read.", "error");
                return;
            }
        }

        await loadAdminNotifications();

        dropdown.hidden = true;
        dropdown.classList.remove("active");
        bell.setAttribute("aria-expanded", "false");

        if (notification.notification_type === "message") {
            document.querySelector(
                '.dash-btn[data-section="messages-section"]'
            )?.click();

            const inboxTab = document.querySelector(
                '.message-tab[data-message-filter="inbox"]'
            );

            inboxTab?.click();

            await loadAdminMessages();

            const messageCard = [...document.querySelectorAll(".message-item")]
                .find(card => card.dataset.messageId === notification.reference_id);

            if (messageCard) {
                messageCard.click();
                messageCard.scrollIntoView({ block: "nearest" });
            } else {
                showAdminToast("Message not found in inbox.", "error");
            }
        }

        if (notification.notification_type === "order") {
            document.querySelector(
                '.dash-btn[data-section="orders-section"]'
            )?.click();

            await loadOrders();
            openOrderModal(notification.reference_id);
        }


        if (notification.notification_type === "review") {
            document.querySelector(
                '.dash-btn[data-section="reviews-section"]'
            )?.click();

            await loadAdminReviews();

            const reviewId = String(notification.reference_id || "");

            if (reviewId && adminReviews.some(
                review => String(review.id) === reviewId
            )) {
                openAdminReviewModal(reviewId);
            } else {
                showAdminToast(
                    "Review not found. It may have been deleted.",
                    "error"
                );
            }
        }

    });

    markAll?.addEventListener("click", async () => {
        const unreadIds = adminNotifications
            .filter(n => !n.is_read)
            .map(n => n.id);

        if (!unreadIds.length) return;

        const { error } = await window.supabaseClient
            .from("admin_notifications")
            .update({ is_read: true })
            .in("id", unreadIds);

        if (error) {
            console.error(error);
            showAdminToast("Unable to mark notifications as read.", "error");
            return;
        }

        await loadAdminNotifications();
    });

    loadAdminNotifications();
});


/* =========================================
   AMPLIFIED SITES - ADMIN REVIEWS
========================================= */

let adminReviews = [];
let adminReviewPage = 1;
let selectedReviewIds = new Set();

const ADMIN_REVIEWS_PER_PAGE = 10;
const reviewElement = id => document.getElementById(id);

function escapeReviewHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function formatReviewDate(value) {
    if (!value) return "N/A";

    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "N/A"
        : date.toLocaleString();
}

/* LOAD REVIEWS */

async function loadAdminReviews() {
    const { data, error } = await window.supabaseClient
        .from("website_reviews")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Review loading failed:", error);

        const table = reviewElement("adminReviewsTableBody");
        if (table) {
            table.innerHTML =
                '<tr><td colspan="7">Unable to load reviews.</td></tr>';
        }
        return;
    }

    adminReviews = data || [];

    const validIds = new Set(adminReviews.map(r => String(r.id)));
    selectedReviewIds = new Set(
        [...selectedReviewIds].filter(id => validIds.has(id))
    );

    renderAdminReviews();
}

/* FILTER REVIEWS */

function getFilteredAdminReviews() {
    const search = (
        reviewElement("adminReviewSearch")?.value || ""
    ).toLowerCase().trim();

    const rating = reviewElement("adminReviewRatingFilter")?.value || "all";

    return adminReviews.filter(review => {
        const matchesSearch = [
            review.name,
            review.email,
            review.business_name,
            review.review
        ].some(value =>
            String(value || "").toLowerCase().includes(search)
        );

        const matchesRating =
            rating === "all" ||
            Number(review.rating) === Number(rating);

        return matchesSearch && matchesRating;
    });
}

/* RENDER TABLE */

function renderAdminReviews() {
    const pending = adminReviews.filter(
        review => review.status === "pending"
    ).length;

    const approvedReviews = adminReviews.filter(
        review => review.status === "approved"
    );

    const average = approvedReviews.length
        ? approvedReviews.reduce(
            (sum, review) => sum + Number(review.rating || 0), 0
        ) / approvedReviews.length
        : 0;

    reviewElement("adminTotalReviews").textContent =
        adminReviews.length;

    reviewElement("adminPendingReviews").textContent = pending;

    reviewElement("adminApprovedReviews").textContent =
        approvedReviews.length;

    const averageElement = reviewElement("adminAverageRating");
    if (averageElement) {
        averageElement.textContent = average.toFixed(1);
    }

    const badge = reviewElement("sidebarReviewCount");
    if (badge) {
        badge.textContent = pending;
        badge.hidden = pending === 0;
    }

    const filtered = getFilteredAdminReviews();

    reviewElement("adminReviewsCount").textContent =
        `${filtered.length} Reviews`;

    const totalPages = Math.max(
        1,
        Math.ceil(filtered.length / ADMIN_REVIEWS_PER_PAGE)
    );

    adminReviewPage = Math.min(
        Math.max(1, adminReviewPage),
        totalPages
    );

    const start = (adminReviewPage - 1) * ADMIN_REVIEWS_PER_PAGE;
    const current = filtered.slice(start, start + ADMIN_REVIEWS_PER_PAGE);

    reviewElement("adminReviewsPage").textContent =
        `Page ${adminReviewPage} of ${totalPages}`;

    reviewElement("adminReviewsPrev").disabled =
        adminReviewPage <= 1;

    reviewElement("adminReviewsNext").disabled =
        adminReviewPage >= totalPages;

    const table = reviewElement("adminReviewsTableBody");
    if (!table) return;

    if (!current.length) {
        table.innerHTML =
            '<tr><td colspan="8" style="text-align:center;">No reviews found.</td></tr>';
    } else {
        table.innerHTML = current.map(review => {
            const rating = Math.max(
                1, Math.min(5, Number(review.rating) || 1)
            );

            const approved = review.status === "approved";

            // Only trust a server-established verification flag.
            const verified = review.verified === true;

            return `
                <tr data-review-id="${escapeReviewHTML(review.id)}"
                    class="admin-review-clickable-row">

                    <td>
                        <input type="checkbox"
                            class="admin-review-row-checkbox"
                            aria-label="Select review"
                            ${selectedReviewIds.has(String(review.id)) ? "checked" : ""}>
                    </td>

                    <td>
                        <div class="admin-review-customer">
                            <strong>${escapeReviewHTML(review.name || "Anonymous")}</strong>
                            <small>${escapeReviewHTML(review.email || "Not provided")}</small>
                        </div>
                    </td>

                    <td>
                        <span class="admin-review-stars">
                            ${"★".repeat(rating)}${"☆".repeat(5 - rating)}
                        </span>
                    </td>

                    <td>
                        <span class="admin-review-verification ${verified ? "verified" : "unverified"}">
                            ${verified ? "Verified" : "Unverified"}
                        </span>
                    </td>

                    <td>
                        <span class="admin-review-status ${approved ? "approved" : "pending"}">
                            ${approved ? "Approved" : "Pending"}
                        </span>
                    </td>

                    <td>${escapeReviewHTML(
                        review.created_at
                            ? new Date(review.created_at).toLocaleDateString()
                            : "N/A"
                    )}</td>

                    <td>
                        <div class="admin-review-actions">
                            <button type="button"
                                class="admin-review-view"
                                data-action="view">
                                <i class="fa-regular fa-eye"></i> View
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    }

    const selectAll = reviewElement("adminReviewsSelectAll");
    if (selectAll) {
        selectAll.checked = current.length > 0 &&
            current.every(r => selectedReviewIds.has(String(r.id)));
    }

    const deleteSelected = reviewElement("adminReviewsDeleteSelected");
    if (deleteSelected) {
        deleteSelected.disabled = selectedReviewIds.size === 0;
    }
}

/* UPDATE REVIEW */

async function updateAdminReview(id, status) {
    const { data, error } = await window.supabaseClient
        .from("website_reviews")
        .update({ status })
        .eq("id", id)
        .select("id");

    if (error || !data?.length) {
        console.error("Review update failed:", error);
        showAdminToast("Unable to update review.", "error");
        return false;
    }

    await loadAdminReviews();
    showAdminToast("Review updated successfully!", "success");
    return true;
}


function confirmReviewDeletion(count = 1) {
    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.className = "review-delete-overlay";

        overlay.innerHTML = `
            <div class="review-delete-modal" role="dialog"
                 aria-modal="true"
                 aria-labelledby="reviewDeleteTitle">

                <div class="review-delete-icon">
                    <i class="fa-solid fa-trash-can"></i>
                </div>

                <h2 id="reviewDeleteTitle">Delete Reviews?</h2>

                <p>
                    Are you sure you want to permanently delete
                    <strong>${count} selected review${count === 1 ? "" : "s"}</strong>?
                </p>

                <div class="review-delete-warning">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    This action cannot be undone.
                </div>

                <div class="review-delete-actions">
                    <button type="button" class="review-delete-cancel">
                        Cancel
                    </button>

                    <button type="button" class="review-delete-confirm">
                        <i class="fa-solid fa-trash-can"></i>
                        Permanently Delete
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const finish = result => {
            document.removeEventListener("keydown", onKeyDown);
            overlay.remove();
            resolve(result);
        };

        const onKeyDown = event => {
            if (event.key === "Escape") finish(false);
        };

        document.addEventListener("keydown", onKeyDown);

        overlay.querySelector(".review-delete-cancel")
            .addEventListener("click", () => finish(false));

        overlay.querySelector(".review-delete-confirm")
            .addEventListener("click", () => finish(true));

        overlay.addEventListener("click", event => {
            if (event.target === overlay) finish(false);
        });

        overlay.querySelector(".review-delete-cancel").focus();
    });
}

/* DELETE REVIEW */
async function deleteAdminReview(id) {
    if (!(await confirmReviewDeletion(1))) return false;


    const { data, error } = await window.supabaseClient
        .from("website_reviews")
        .delete()
        .eq("id", id)
        .select("id");

    if (error || !data?.length) {
        console.error("Review deletion failed:", error);
        showAdminToast("Unable to delete review.", "error");
        return false;
    }

    selectedReviewIds.delete(String(id));
    await loadAdminReviews();
    showAdminToast("Review deleted.", "success");
    return true;
}

/* REVIEW DETAILS POPUP */

function closeAdminReviewModal() {
    document.getElementById("adminReviewDetailsOverlay")?.remove();
}

function openAdminReviewModal(id) {
    const review = adminReviews.find(
        item => String(item.id) === String(id)
    );

    if (!review) return;

    closeAdminReviewModal();

    const approved = review.status === "approved";
    const verified = review.verified === true;
    const rating = Math.max(
        1, Math.min(5, Number(review.rating) || 1)
    );

    const overlay = document.createElement("div");
    overlay.id = "adminReviewDetailsOverlay";
    overlay.className = "admin-review-modal-overlay";

    overlay.innerHTML = `
        <div class="admin-review-modal"
             role="dialog"
             aria-modal="true"
             aria-labelledby="adminReviewModalTitle">

            <div class="admin-review-modal-header">
                <h2 id="adminReviewModalTitle">Review Details</h2>
                <button type="button" data-modal-action="close"
                        aria-label="Close review details">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <div class="admin-review-modal-grid">
                <div>
                    <small>Customer Name</small>
                    <strong>${escapeReviewHTML(review.name || "Anonymous")}</strong>
                </div>
                <div>
                    <small>Verification</small>
                    <span class="admin-review-verification ${verified ? "verified" : "unverified"}">
                        ${verified ? "Verified" : "Unverified"}
                    </span>
                </div>
                <div>
                    <small>Email Address</small>
                    <strong>${escapeReviewHTML(review.email || "Not provided")}</strong>
                </div>
                <div>
                    <small>Business Name</small>
                    <strong>${escapeReviewHTML(review.business_name || "Not provided")}</strong>
                </div>
                <div>
                    <small>Rating</small>
                    <span class="admin-review-stars">
                        ${"★".repeat(rating)}${"☆".repeat(5 - rating)}
                    </span>
                </div>
                <div>
                    <small>Review Status</small>
                    <span class="admin-review-status ${approved ? "approved" : "pending"}">
                        ${approved ? "Approved" : "Pending Approval"}
                    </span>
                </div>
            </div>
            <div class="admin-review-message-section">
                <small>Customer Review Message</small>
                <p class="admin-review-message-text">${escapeReviewHTML(review.review || "No review message provided.")}</p>
            </div>
            <p class="admin-review-modal-date">
                Submitted: ${escapeReviewHTML(formatReviewDate(review.created_at))}
            </p>
            <div class="admin-review-modal-actions">
                <button type="button" data-modal-action="close">Close</button>
                <button type="button" data-modal-action="delete">Delete</button>
                <button type="button" data-modal-action="status">
                    ${approved ? "Unapprove Review" : "Approve Review"}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    overlay.addEventListener("click", async event => {
        if (event.target === overlay) {
            closeAdminReviewModal();
            return;
        }

        const button = event.target.closest("[data-modal-action]");
        if (!button || button.disabled) return;

        const action = button.dataset.modalAction;

        if (action === "close") {
            closeAdminReviewModal();
            return;
        }

        button.disabled = true;

        try {
            let success = false;

            if (action === "status") {
                success = await updateAdminReview(
                    review.id,
                    approved ? "pending" : "approved"
                );
            }

            if (action === "delete") {
                success = await deleteAdminReview(review.id);
            }

            if (success) closeAdminReviewModal();
        } finally {
            button.disabled = false;
        }
    });

    overlay.querySelector('[data-modal-action="close"]')?.focus();
}

/* EVENTS */

document.addEventListener("DOMContentLoaded", () => {
    const table = reviewElement("adminReviewsTableBody");
    if (!table) return;

    reviewElement("adminReviewSearch")?.addEventListener("input", () => {
        adminReviewPage = 1;
        renderAdminReviews();
    });

    reviewElement("adminReviewRatingFilter")?.addEventListener("change", () => {
        adminReviewPage = 1;
        renderAdminReviews();
    });

    reviewElement("adminReviewsRefresh")?.addEventListener(
        "click", loadAdminReviews
    );

    reviewElement("adminReviewsPrev")?.addEventListener("click", () => {
        if (adminReviewPage > 1) {
            adminReviewPage--;
            renderAdminReviews();
        }
    });

    reviewElement("adminReviewsNext")?.addEventListener("click", () => {
        adminReviewPage++;
        renderAdminReviews();
    });

    
    table.addEventListener("click", event => {
        if (event.target.closest('input[type="checkbox"]')) return;

        const row = event.target.closest("[data-review-id]");
        if (!row) return;

        console.log("REVIEW VIEW CLICKED:", row.dataset.reviewId);

        openAdminReviewModal(row.dataset.reviewId);
    });


    table.addEventListener("change", event => {
        const checkbox = event.target.closest(".admin-review-row-checkbox");
        if (!checkbox) return;

        const row = checkbox.closest("[data-review-id]");
        const id = row?.dataset.reviewId;
        if (!id) return;

        if (checkbox.checked) selectedReviewIds.add(id);
        else selectedReviewIds.delete(id);

        renderAdminReviews();
    });

    reviewElement("adminReviewsSelectAll")?.addEventListener("change", event => {
        const filtered = getFilteredAdminReviews();
        const start = (adminReviewPage - 1) * ADMIN_REVIEWS_PER_PAGE;
        const current = filtered.slice(start, start + ADMIN_REVIEWS_PER_PAGE);

        current.forEach(review => {
            if (event.target.checked) {
                selectedReviewIds.add(String(review.id));
            } else {
                selectedReviewIds.delete(String(review.id));
            }
        });

        renderAdminReviews();
    });

    reviewElement("adminReviewsDeleteSelected")?.addEventListener(
        "click", async () => {
            const ids = [...selectedReviewIds];
            if (!ids.length) return;

            if (!(await confirmReviewDeletion(ids.length))) {
                return;
            }

            const { data, error } = await window.supabaseClient
                .from("website_reviews")
                .delete()
                .in("id", ids)
                .select("id");

            if (error || data?.length !== ids.length) {
                console.error("Bulk delete failed or incomplete:", error);
                showAdminToast("Some reviews could not be deleted.", "error");
            } else {
                showAdminToast("Selected reviews deleted.", "success");
            }

            selectedReviewIds.clear();
            await loadAdminReviews();
        }
    );

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeAdminReviewModal();
    });

    loadAdminReviews();
});

// =========================================
// MESSAGES - EMAIL & LIVE CHAT NAVIGATION
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    const messagesMainTabs = document.querySelectorAll(
        ".messages-main-tab"
    );

    const messagesMainPanels = document.querySelectorAll(
        ".messages-main-panel"
    );

    messagesMainTabs.forEach(button => {

        button.addEventListener("click", () => {

            const selectedTab = button.dataset.messagesMainTab;

            // Load customer conversations when Live Chat opens
            if (selectedTab === "live") {
                loadAdminChatConversations();
            }

            // Update active tab button
            messagesMainTabs.forEach(tab => {
                tab.classList.toggle(
                    "active",
                    tab.dataset.messagesMainTab === selectedTab
                );
            });

            // Show the selected panel
            messagesMainPanels.forEach(panel => {
                panel.classList.toggle(
                    "active",
                    panel.dataset.messagesMainPanel === selectedTab
                );
            });

        });

    });

});

// =========================================
// LIVE CHAT - STATUS TAB NAVIGATION
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    const liveChatStatusTabs = document.querySelectorAll(
        ".live-chat-status-tab"
    );

    liveChatStatusTabs.forEach(button => {

        button.addEventListener("click", async () => {

            const selectedStatus = button.dataset.chatStatus;

            // Update active status button
            liveChatStatusTabs.forEach(tab => {

                tab.classList.toggle(
                    "active",
                    tab.dataset.chatStatus === selectedStatus
                );

            });

            // Load conversations for selected status
            await loadAdminChatConversations();

        });

    });

});

// =========================================
// LIVE CHAT - LOAD ADMIN CONVERSATIONS
// =========================================

const ADMIN_CHAT_API = "http://localhost:3000/chat";

let adminChatConversations = [];

async function loadAdminChatConversations() {

    const chatList = document.getElementById("adminLiveChatList");

    if (!chatList) return;

    // Show loading only when the list is completely empty
    if (!chatList.hasChildNodes()) {
        chatList.textContent = "Loading conversations...";
    }

    try {

        // Use the existing Supabase admin session
        const { data: { session }, error } =
        await window.supabaseClient.auth.getSession();

        if (error || !session?.access_token) {
            throw new Error("Admin login required.");
        }

        const response = await fetch(
            `${ADMIN_CHAT_API}/admin/conversations`,
            {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error(
                `Unable to load conversations (${response.status}).`
            );
        }

        const result = await response.json();

        adminChatConversations = result.conversations || [];

        // =========================================
        // GET UNREAD COUNTS FOR EACH CONVERSATION
        // =========================================

        const unreadResponse = await fetch(
            `${ADMIN_CHAT_API}/admin/unread-by-conversation`,
            {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            }
        );

        if (!unreadResponse.ok) {
            throw new Error("Unable to load conversation unread counts.");
        }

        const unreadResult = await unreadResponse.json();

        const unreadCounts = unreadResult.unread_counts || {};

        const selectedStatus = document.querySelector(
            ".live-chat-status-tab.active"
        )?.dataset.chatStatus || "active";

        const filtered = adminChatConversations.filter(
            conversation => conversation.status === selectedStatus
        );

        chatList.replaceChildren();

        if (filtered.length === 0) {
            const empty = document.createElement("p");
            empty.textContent = `No ${selectedStatus} conversations.`;
            chatList.appendChild(empty);
            return;
        }

        filtered.forEach(conversation => {

            const item = document.createElement("div");
            item.className = "admin-chat-conversation";
            item.dataset.conversationId = conversation.id;
            // Open this customer's conversation when clicked
            item.addEventListener("click", () => {
                openAdminChatConversation(conversation);
            });
            const name = document.createElement("strong");
            name.textContent = conversation.customer_name;

            const email = document.createElement("p");
            email.textContent = conversation.customer_email;

            const status = document.createElement("span");
            status.textContent = conversation.status;

            // Get unread messages for this customer
            const unreadCount = unreadCounts[conversation.id] || 0;

            item.append(name, email, status);

            // Show unread notification beside the customer
            if (unreadCount > 0) {

                const unreadBadge = document.createElement("span");

                unreadBadge.className = "admin-chat-customer-unread";

                unreadBadge.textContent =
                    unreadCount > 99 ? "99+" : unreadCount;

                unreadBadge.title =
                    `${unreadCount} unread customer message(s)`;

                item.appendChild(unreadBadge);

                item.classList.add("has-unread");

            }
            chatList.appendChild(item);
            // Restore the selected conversation after reloading the list
if (selectedAdminChatId === conversation.id) {
    item.classList.add("selected");
}

        });

    } catch (error) {

        console.error("ADMIN LIVE CHAT ERROR:", error);

        chatList.textContent = error.message;

    }
}

// =========================================
// LIVE CHAT - OPEN CUSTOMER CONVERSATION
// =========================================

let selectedAdminChatId = null;

async function openAdminChatConversation(conversation) {

        selectedAdminChatId = conversation.id;
        // Enable End Chat only for Active conversations
        const endChatButton = document.getElementById("adminChatEndBtn");

        if (endChatButton) {
            endChatButton.disabled = conversation.status === "closed";
        }

        // Enable replies only for conversations that are not closed
    const replyInput = document.getElementById("adminChatReplyInput");
    const sendButton = document.getElementById("adminChatSendBtn");

    const canReply = conversation.status !== "closed";

    if (replyInput) {
        replyInput.disabled = !canReply;
    }

    if (sendButton) {
        sendButton.disabled = !canReply;
    }

    const nameElement = document.getElementById(
        "adminChatCustomerName"
    );

    const emailElement = document.getElementById(
        "adminChatCustomerEmail"
    );

    const statusElement = document.getElementById(
        "adminChatStatus"
    );

    const messagesContainer = document.getElementById(
        "adminChatMessages"
    );

    if (!messagesContainer) return;

    // Update customer information
    nameElement.textContent = conversation.customer_name;
    emailElement.textContent = conversation.customer_email;
    statusElement.textContent = conversation.status;

    // Highlight selected conversation
    document.querySelectorAll(".admin-chat-conversation")
        .forEach(card => {
            card.classList.toggle(
                "selected",
                card.dataset.conversationId === conversation.id
            );
        });

    // Only show loading when switching to a different conversation
        if (messagesContainer.dataset.loadedConversation !== conversation.id) {
            messagesContainer.textContent = "Loading messages...";
        }

    try {

        const { data: { session }, error: sessionError } =
            await window.supabaseClient.auth.getSession();

        if (sessionError || !session?.access_token) {
            throw new Error("Admin login required.");
        }

        const response = await fetch(
            `${ADMIN_CHAT_API}/admin/conversations/${conversation.id}/messages`,
            {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error("Unable to load customer messages.");
        }

        const result = await response.json();

        // =========================================
        // MARK CUSTOMER MESSAGES AS READ
        // =========================================

        if (selectedAdminChatId === conversation.id) {

            const readResponse = await fetch(
                `${ADMIN_CHAT_API}/admin/conversations/${conversation.id}/read`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${session.access_token}`
                    }
                }
            );

            if (!readResponse.ok) {
                console.error("Unable to mark chat messages as read.");
            } else {

                // Update unread notifications
                await updateAdminChatUnreadCount();
                await loadAdminChatConversations();

            }

        }

        // Prevent older requests from replacing a newly selected chat
        if (selectedAdminChatId !== conversation.id) return;

        // Create a signature of the latest message history
        const messagesSignature = JSON.stringify(
            (result.messages || []).map(message => [
                message.id,
                message.sender,
                message.message
            ])
        );

        // Skip redrawing if nothing changed
        if (
            messagesContainer.dataset.loadedConversation === conversation.id &&
            messagesContainer.dataset.messagesSignature === messagesSignature
        ) {
            return;
        }

        // Only redraw when messages change
        messagesContainer.replaceChildren();

        messagesContainer.dataset.loadedConversation = conversation.id;
        messagesContainer.dataset.messagesSignature = messagesSignature;

        if (!result.messages?.length) {
            messagesContainer.textContent = "No messages yet.";
            return;
        }

        result.messages.forEach(message => {

            const bubble = document.createElement("div");

            bubble.className =
                `admin-chat-message ${
                    message.sender === "admin" ? "admin" : "customer"
                }`;

            bubble.textContent = message.message;

            messagesContainer.appendChild(bubble);

        });

        // Scroll to newest message
        messagesContainer.scrollTop =
            messagesContainer.scrollHeight;

    } catch (error) {

        console.error("ADMIN CHAT HISTORY ERROR:", error);

        if (selectedAdminChatId === conversation.id) {
            messagesContainer.textContent = error.message;
        }

    }
}

// =========================================
// ADMIN LIVE CHAT - SEND REPLY
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    const sendButton = document.getElementById("adminChatSendBtn");
    const replyInput = document.getElementById("adminChatReplyInput");

    if (!sendButton || !replyInput) return;

    sendButton.addEventListener("click", async () => {

        const conversationId = selectedAdminChatId;
        const message = replyInput.value.trim();

        if (!conversationId || !message || sendButton.disabled) return;

        sendButton.disabled = true;
        sendButton.textContent = "Sending...";

        try {

            const { data: { session }, error: sessionError } =
                await window.supabaseClient.auth.getSession();

            if (sessionError || !session?.access_token) {
                throw new Error("Admin login required.");
            }

            const response = await fetch(
                `${ADMIN_CHAT_API}/admin/conversations/${conversationId}/reply`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({ message })
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || "Unable to send reply.");
            }

            // Show the sent message
            if (selectedAdminChatId === conversationId) {

                const messagesContainer =
                    document.getElementById("adminChatMessages");

                const bubble = document.createElement("div");

                bubble.className = "admin-chat-message admin";
                bubble.textContent = result.chat_message.message;

                messagesContainer.appendChild(bubble);

                messagesContainer.scrollTop =
                    messagesContainer.scrollHeight;

                replyInput.value = "";
            }

        } catch (error) {

            console.error("ADMIN CHAT REPLY ERROR:", error);
            alert(error.message);

        } finally {

            sendButton.textContent = "Send";

            // Do not re-enable a closed or different conversation
            if (selectedAdminChatId === conversationId) {

                const conversation = adminChatConversations.find(
                    chat => chat.id === conversationId
                );

                sendButton.disabled = !conversation ||
                    conversation.status === "closed";
            }
        }

    });

});

// =========================================
// ADMIN LIVE CHAT - AUTOMATIC UPDATES
// =========================================

let adminChatRefreshTimer = null;
let adminChatRefreshing = false;

function startAdminChatAutoRefresh() {

    if (adminChatRefreshTimer !== null) {
        return;
    }

    adminChatRefreshTimer = setInterval(async () => {

        // Only refresh while the Live Chat tab is visible
        const liveChatPanel = document.querySelector(
            '[data-messages-main-panel="live"]'
        );

        if (!liveChatPanel?.classList.contains("active")) {
            return;
        }

        if (adminChatRefreshing) {
            return;
        }

        adminChatRefreshing = true;

        try {

            // Refresh conversation list
            await loadAdminChatConversations();

            // Refresh currently selected conversation
            if (selectedAdminChatId) {

                const conversation = adminChatConversations.find(
                    chat => chat.id === selectedAdminChatId
                );

                if (conversation) {
                    await openAdminChatConversation(conversation);
                }

            }

        } catch (error) {

            console.error("ADMIN CHAT REFRESH ERROR:", error);

        } finally {

            adminChatRefreshing = false;

        }

    }, 3000);

}

// Start automatic updates
document.addEventListener("DOMContentLoaded", () => {
    startAdminChatAutoRefresh();
});

// =========================================
// ADMIN LIVE CHAT - END CONVERSATION
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    const endChatButton = document.getElementById("adminChatEndBtn");

    if (!endChatButton) return;

    let endingAdminChat = false;

    endChatButton.addEventListener("click", async () => {

        if (endingAdminChat || !selectedAdminChatId) return;

        const conversationId = selectedAdminChatId;

        const conversation = adminChatConversations.find(
            chat => chat.id === conversationId
        );

        if (!conversation || conversation.status === "closed") return;

        const confirmed = await new Promise((resolve) => {

        const modal = document.getElementById("adminEndChatModal");
        const cancelBtn = document.getElementById("adminCancelEndChat");
        const confirmBtn = document.getElementById("adminConfirmEndChat");

        if (!modal || !cancelBtn || !confirmBtn) {
            resolve(false);
            return;
        }

        const previousFocus = document.activeElement;

        function finish(result) {
            modal.hidden = true;

            cancelBtn.removeEventListener("click", cancel);
            confirmBtn.removeEventListener("click", accept);
            modal.removeEventListener("click", backdrop);
            document.removeEventListener("keydown", escape);

            previousFocus?.focus?.();
            resolve(result);
        }

        function cancel() {
            finish(false);
        }

        function accept() {
            finish(true);
        }

        function backdrop(event) {
            if (event.target === modal) cancel();
        }

        function escape(event) {
            if (event.key === "Escape") cancel();
        }

        cancelBtn.addEventListener("click", cancel);
        confirmBtn.addEventListener("click", accept);
        modal.addEventListener("click", backdrop);
        document.addEventListener("keydown", escape);

        modal.hidden = false;
        cancelBtn.focus();

    });

    if (!confirmed) return;

        endingAdminChat = true;
        endChatButton.disabled = true;

        try {

            const { data: { session }, error: sessionError } =
                await window.supabaseClient.auth.getSession();

            if (sessionError || !session?.access_token) {
                throw new Error("Admin login required.");
            }

            const response = await fetch(
                `${ADMIN_CHAT_API}/admin/conversations/${conversationId}/end`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${session.access_token}`
                    }
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || "Unable to end chat.");
            }

            // Update the local conversation status
            conversation.status = "closed";

            // Disable replies
            document.getElementById("adminChatReplyInput").disabled = true;
            document.getElementById("adminChatSendBtn").disabled = true;

            // Clear the selected conversation
            selectedAdminChatId = null;

            document.getElementById("adminChatCustomerName").textContent =
                "Select a conversation";

            document.getElementById("adminChatCustomerEmail").textContent =
                "Choose a customer to view their messages.";

            document.getElementById("adminChatStatus").textContent = "";

            const messagesContainer =
                document.getElementById("adminChatMessages");

            messagesContainer.replaceChildren();
            delete messagesContainer.dataset.loadedConversation;
            delete messagesContainer.dataset.messagesSignature;
            // Refresh Active/Closed conversation list
            await loadAdminChatConversations();

            showAdminChatSuccess("Conversation closed successfully.");

        } catch (error) {

            console.error("ADMIN END CHAT ERROR:", error);
            alert(error.message);

        } finally {

            endingAdminChat = false;

            const selectedConversation = adminChatConversations.find(
                chat => chat.id === selectedAdminChatId
            );

            endChatButton.disabled =
                !selectedConversation ||
                selectedConversation.status === "closed";

        }

    });

});

// =========================================
// ADMIN LIVE CHAT - SUCCESS TOAST
// =========================================

function showAdminChatSuccess(message) {

    // Remove existing notification
    document.querySelectorAll(".admin-chat-success-toast")
        .forEach(toast => toast.remove());

    const toast = document.createElement("div");
    toast.className = "admin-chat-success-toast";
    toast.setAttribute("role", "status");

    const icon = document.createElement("i");
    icon.className = "fa-solid fa-circle-check";

    const text = document.createElement("span");
    text.textContent = message;

    toast.append(icon, text);
    document.body.appendChild(toast);

    // Automatically disappear after 3 seconds
    setTimeout(() => {

        if (!toast.isConnected) return;

        toast.classList.add("hide");

        setTimeout(() => toast.remove(), 300);

    }, 3000);
}

// =========================================
// ADMIN LIVE CHAT - UNREAD COUNTER
// =========================================

let adminChatUnreadLoading = false;

async function updateAdminChatUnreadCount() {

    if (adminChatUnreadLoading) return;

    const badge = document.getElementById(
        "adminLiveChatUnreadCount"
    );

    if (!badge) return;

    adminChatUnreadLoading = true;

    try {

        const { data: { session }, error: sessionError } =
            await window.supabaseClient.auth.getSession();

        if (sessionError || !session?.access_token) {
            badge.hidden = true;
            return;
        }

        const response = await fetch(
            `${ADMIN_CHAT_API}/admin/unread-count`,
            {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error("Unable to load unread count.");
        }

        const result = await response.json();

        const count = result.unread_count || 0;

        badge.textContent = count > 99 ? "99+" : count;
        badge.hidden = count === 0;

    } catch (error) {

        console.error("LIVE CHAT UNREAD COUNT ERROR:", error);

    } finally {

        adminChatUnreadLoading = false;

    }

}


// =========================================
// AUTOMATIC UNREAD COUNT UPDATES
// =========================================

document.addEventListener("DOMContentLoaded", () => {

    // Load unread count immediately
    updateAdminChatUnreadCount();

    // Refresh every 3 seconds
    setInterval(() => {
        updateAdminChatUnreadCount();
    }, 3000);

});

/* ==========================================
   ADMIN PORTFOLIO - TAB NAVIGATION
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    const portfolioBtn = document.querySelector(
        '[data-section="portfolio-section"]'
    );

    portfolioBtn?.addEventListener("click", () => {

        // Update page title
        const pageTitle = document.getElementById("adminPageTitle");

        if (pageTitle) {
            pageTitle.textContent = "Portfolio Management";
        }

    });

});

// ==========================================
// PORTFOLIO IMAGE EDITING STATE
// ==========================================
let portfolioMainImageUrl = null;
let portfolioGalleryImageUrls = [];

/* ==========================================
   PORTFOLIO - ADD PROJECT POPUP
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    const modal = document.getElementById("portfolioModal");
    const addBtn = document.getElementById("addPortfolioProjectBtn");
    const closeBtn = document.getElementById("closePortfolioModal");
    const cancelBtn = document.getElementById("cancelPortfolioModal");
    const form = document.getElementById("portfolioProjectForm");

    // Open popup
    addBtn?.addEventListener("click", () => {

        form.reset();

        document.getElementById("portfolioProjectId").value = "";
        document.getElementById("portfolioModalTitle").textContent = "Add Project";

        // Reset saved image state
        portfolioMainImageUrl = null;
        portfolioGalleryImageUrls = [];

        // Clear image previews
        document.getElementById("portfolioMainPreview").innerHTML = "";
        document.getElementById("portfolioGalleryPreview").innerHTML = "";

        // Reset gallery counter
        document.getElementById("portfolioGalleryCount").textContent = "0 / 4";

        // Clear selected images
        document.getElementById("portfolioProjectImage").value = "";
        document.getElementById("portfolioProjectGallery").value = "";

        modal.hidden = false;
    });

    // Close popup
    function closeModal() {
        modal.hidden = true;
    }

    closeBtn?.addEventListener("click", closeModal);
    cancelBtn?.addEventListener("click", closeModal);

});


/* ==========================================
   PORTFOLIO - SAVE PROJECT
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("portfolioProjectForm");
    const saveBtn = document.getElementById("savePortfolioProject");

    form?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const projectName = document.getElementById("portfolioProjectName").value.trim();

        if (!projectName) {
            alert("Please enter a project name.");
            return;
        }

        const projectData = {
            project_name: projectName,
            category: document.getElementById("portfolioProjectCategory").value.trim(),
            description: document.getElementById("portfolioProjectDescription").value.trim(),
            website_url: document.getElementById("portfolioProjectWebsite").value.trim() || null,
            video_url: document.getElementById("portfolioProjectVideo").value.trim() || null,
            is_published: document.getElementById("portfolioProjectPublished").checked
        };

        // ==========================================
        // SAVE EXISTING PORTFOLIO IMAGE CHANGES
        // ==========================================

        const projectId = document.getElementById("portfolioProjectId").value;

        if (projectId) {
            projectData.image_url = portfolioMainImageUrl;
            projectData.gallery_urls = [...portfolioGalleryImageUrls];
        }

        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        try {

    // Upload Main Screenshot if one was selected
    const mainImageFile = document.getElementById("portfolioProjectImage").files[0];

    if (mainImageFile) {
        projectData.image_url = await uploadPortfolioImage(mainImageFile);
    }

    // ==========================================
    // UPLOAD ADDITIONAL PORTFOLIO SCREENSHOTS
    // ==========================================

    const galleryInput = document.getElementById("portfolioProjectGallery");

    const galleryFiles = Array.from(galleryInput.files);

    const existingGallery = projectId
        ? [...portfolioGalleryImageUrls]
        : [];

    if (existingGallery.length + galleryFiles.length > 4) {
        throw new Error("You can have a maximum of 4 additional screenshots.");
    }

    const galleryUrls = [...existingGallery];

    for (const file of galleryFiles) {
        const imageUrl = await uploadPortfolioImage(file);
        galleryUrls.push(imageUrl);
    }

    projectData.gallery_urls = galleryUrls;

    let result;

    if (projectId) {
        result = await window.supabaseClient
            .from("portfolio_projects")
            .update({
                ...projectData,
                updated_at: new Date().toISOString()
            })
            .eq("id", projectId)
            .select()
            .single();
    } else {
        result = await window.supabaseClient
            .from("portfolio_projects")
            .insert(projectData)
            .select()
            .single();
    }

    if (result.error) throw result.error;

            // Verify that Supabase saved the project

            const toast = document.createElement("div");
            toast.className = "admin-toast";

            toast.innerHTML = `
                <div class="admin-toast-icon">
                    <i class="fa-solid fa-circle-check"></i>
                </div>

                <div class="admin-toast-content">
                    <strong>Project Saved Successfully</strong>
                    <p>Your portfolio project has been saved.</p>
                </div>

                <button type="button" class="admin-toast-close">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            `;

            document.querySelectorAll(".admin-toast").forEach(el => el.remove());
            document.body.appendChild(toast);

            const dismissToast = () => {
                toast.classList.add("hide");
                setTimeout(() => toast.remove(), 300);
            };

            toast.querySelector(".admin-toast-close")
                .addEventListener("click", dismissToast);

            setTimeout(dismissToast, 3500);


        } catch (error) {
            console.error("Portfolio save error:", error);
            alert("Failed to save project: " + error.message);

        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Project';
        }
    });

});


/* ==========================================
   PORTFOLIO - LOAD PROJECTS
========================================== */

async function loadPortfolioProjects() {

    const grid = document.getElementById("portfolioAdminGrid");

    if (!grid) return;

    const { data, error } = await window.supabaseClient
        .from("portfolio_projects")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Portfolio load error:", error);
        grid.textContent = "Failed to load portfolio projects.";
        return;
    }

    if (!data || data.length === 0) {
        grid.textContent = "No portfolio projects added yet.";
        return;
    }

    grid.innerHTML = data.map(project => `
        <div class="admin-package-card">

            <h3>${escapeOrderText(project.project_name)}</h3>

            <div class="portfolio-category-row">
                <p class="admin-package-description">
                    ${escapeOrderText(project.category || "No category")}
                </p>
                <span class="status ${project.is_published ? "success" : "warning"}">
                    ${project.is_published ? "Published" : "Draft"}
                </span>
            </div>

        <div class="admin-package-actions" style="margin-top: 20px;">

            <button
                type="button"
                class="admin-package-edit portfolio-edit-btn"
                data-id="${project.id}">
                <i class="fa-solid fa-pen"></i> Edit
            </button>

            <button
                type="button"
                class="admin-package-delete portfolio-delete-btn"
                data-id="${project.id}">
                <i class="fa-solid fa-trash"></i> Delete
            </button>

        </div>


                </div>
            `).join("");
        }

document.addEventListener("DOMContentLoaded", () => {

    const portfolioBtn = document.querySelector(
        '[data-section="portfolio-section"]'
    );

    // Load projects whenever Portfolio becomes active
    document.querySelectorAll('[data-section="portfolio-section"]')
        .forEach(button => {
            button.addEventListener("click", () => {
                loadPortfolioProjects();
            });
        });

});


/* ==========================================
   PORTFOLIO - EDIT PROJECT
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    const grid = document.getElementById("portfolioAdminGrid");

    grid?.addEventListener("click", async (event) => {

        const editBtn = event.target.closest(".portfolio-edit-btn");

        if (!editBtn) return;

        const projectId = editBtn.dataset.id;

        const { data: project, error } = await window.supabaseClient
            .from("portfolio_projects")
            .select("*")
            .eq("id", projectId)
            .single();

        if (error || !project) {
            console.error("Portfolio edit error:", error);
            alert("Failed to load project.");
            return;
        }

        // Fill form with existing project information
        document.getElementById("portfolioProjectId").value = project.id;
        document.getElementById("portfolioProjectName").value = project.project_name || "";
        document.getElementById("portfolioProjectCategory").value = project.category || "";
        document.getElementById("portfolioProjectDescription").value = project.description || "";
        document.getElementById("portfolioProjectWebsite").value = project.website_url || "";
        document.getElementById("portfolioProjectVideo").value = project.video_url || "";
        document.getElementById("portfolioProjectPublished").checked = project.is_published;

        // Clear file inputs
        document.getElementById("portfolioProjectImage").value = "";
        document.getElementById("portfolioProjectGallery").value = "";

portfolioMainImageUrl = project.image_url || null;

portfolioGalleryImageUrls = Array.isArray(project.gallery_urls)
    ? [...project.gallery_urls]
    : [];

// ==========================================
// DISPLAY SAVED PORTFOLIO SCREENSHOTS
// ==========================================

// Main Screenshot
const mainPreview = document.getElementById("portfolioMainPreview");

if (mainPreview) {
    mainPreview.innerHTML = "";

    if (project.image_url) {
        mainPreview.innerHTML = `
            <div class="portfolio-image-item">
                <img src="${escapeOrderText(project.image_url)}"
                    alt="Main Screenshot">
                <button type="button"
                        class="portfolio-image-remove"
                        data-image-type="main"
                        aria-label="Remove main screenshot">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
    }
}

        // Additional Screenshots
        const galleryPreview = document.getElementById("portfolioGalleryPreview");

        const savedGallery = Array.isArray(project.gallery_urls)
            ? project.gallery_urls
            : [];

        if (galleryPreview) {
            galleryPreview.innerHTML = savedGallery.map(url => `
                <div class="portfolio-image-item">
                    <img src="${escapeOrderText(url)}"
                        alt="Additional Screenshot">
                    <button type="button"
                            class="portfolio-image-remove"
                            data-image-type="gallery"
                            data-image-index="${savedGallery.indexOf(url)}"
                            aria-label="Remove additional screenshot">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `).join("");
        }

        // Update Gallery Counter
        const galleryCount = document.getElementById("portfolioGalleryCount");

// ==========================================
// REMOVE SAVED PORTFOLIO IMAGES
// ==========================================

const portfolioImageSection = document.querySelector(
    ".portfolio-images-section"
);

if (portfolioImageSection && !portfolioImageSection.dataset.removeHandler) {

    portfolioImageSection.dataset.removeHandler = "true";

    portfolioImageSection.addEventListener("click", (event) => {

        const removeButton = event.target.closest(
            ".portfolio-image-remove"
        );

        if (!removeButton) return;

        const imageType = removeButton.dataset.imageType;

        if (imageType === "main") {

            portfolioMainImageUrl = null;

            document.getElementById("portfolioMainPreview")
                .innerHTML = "";

        }

        if (imageType === "gallery") {

            const index = Number(removeButton.dataset.imageIndex);

            portfolioGalleryImageUrls.splice(index, 1);

            const galleryPreview = document.getElementById(
                "portfolioGalleryPreview"
            );

            galleryPreview.innerHTML = portfolioGalleryImageUrls.map(
                (url, index) => `
                    <div class="portfolio-image-item">
                        <img src="${escapeOrderText(url)}"
                             alt="Additional Screenshot">

                        <button type="button"
                                class="portfolio-image-remove"
                                data-image-type="gallery"
                                data-image-index="${index}"
                                aria-label="Remove additional screenshot">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                `
            ).join("");

            document.getElementById("portfolioGalleryCount")
                .textContent = `${portfolioGalleryImageUrls.length} / 4`;
        }

    });
}

        if (galleryCount) {
            galleryCount.textContent = `${savedGallery.length} / 4`;
        }

        // Update popup title
        document.getElementById("portfolioModalTitle").textContent = "Edit Project";

        // Open popup
        document.getElementById("portfolioModal").hidden = false;

    });

});

    loadPortfolioProjects();

// ==========================================
// PORTFOLIO - CUSTOM DELETE CONFIRMATION
// ==========================================

function confirmPortfolioDelete() {
    return new Promise(resolve => {
        const overlay = document.createElement("div");
        overlay.className = "portfolio-delete-overlay";

        overlay.innerHTML = `
            <div class="portfolio-delete-box">
                <div class="portfolio-delete-icon">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>

                <h3>Delete Portfolio Project?</h3>

                <p>
                    Are you sure you want to permanently delete
                    this project? This action cannot be undone.
                </p>

                <div class="portfolio-delete-actions">
                    <button type="button" class="portfolio-delete-cancel">
                        Cancel
                    </button>

                    <button type="button" class="portfolio-delete-confirm">
                        Delete Project
                    </button>
                </div>
            </div>
        `;

        function finish(confirmed) {
            overlay.remove();
            resolve(confirmed);
        }

        overlay.querySelector(".portfolio-delete-cancel")
            .addEventListener("click", () => finish(false));

        overlay.querySelector(".portfolio-delete-confirm")
            .addEventListener("click", () => finish(true));

        overlay.addEventListener("click", event => {
            if (event.target === overlay) finish(false);
        });

        document.body.appendChild(overlay);
    });
}

// ==========================================
// PORTFOLIO - DELETE PROJECT
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById("portfolioAdminGrid");

    grid?.addEventListener("click", async (event) => {
        const deleteBtn = event.target.closest(".portfolio-delete-btn");

        if (!deleteBtn) return;

        const projectId = deleteBtn.dataset.id;

        const confirmed = await confirmPortfolioDelete();

        if (!confirmed) return;

        deleteBtn.disabled = true;

        try {
            const { data, error } = await window.supabaseClient
                .from("portfolio_projects")
                .delete()
                .eq("id", projectId)
                .select("id");

            if (error) throw error;

            if (!data?.length) {
                throw new Error("Project was not deleted.");
            }

            await loadPortfolioProjects();

            showAdminToast("Project deleted successfully!", "success");

        } catch (error) {
            console.error("Portfolio delete error:", error);
            showAdminToast("Unable to delete project.", "error");
            deleteBtn.disabled = false;
        }
    });
});
console.log(typeof confirmPortfolioDelete);

/* ==========================================
   PORTFOLIO - UPLOAD IMAGE
========================================== */

async function uploadPortfolioImage(file) {

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        throw new Error("Only JPG, PNG, and WebP images are allowed.");
    }

    if (file.size > 10 * 1024 * 1024) {
        throw new Error("Image must be 10MB or smaller.");
    }

    const extension = file.name.split(".").pop().toLowerCase();

    const filePath = `${crypto.randomUUID()}.${extension}`;

    const { error } = await window.supabaseClient.storage
        .from("portfolio-images")
        .upload(filePath, file, {
            contentType: file.type
        });

    if (error) throw error;

    const { data } = window.supabaseClient.storage
        .from("portfolio-images")
        .getPublicUrl(filePath);

    return data.publicUrl;
}

// Keep additional screenshots selected one at a time
const portfolioGalleryInput =
    document.getElementById("portfolioProjectGallery");

const portfolioSelectedFiles = new DataTransfer();

portfolioGalleryInput?.addEventListener("change", function () {
console.log("Gallery photos selected:", this.files.length);
    for (const file of this.files) {
        if (![...portfolioSelectedFiles.files].some(
            existing => existing.name === file.name &&
                        existing.size === file.size
        )) {
            portfolioSelectedFiles.items.add(file);
        }
    }

    this.files = portfolioSelectedFiles.files;

    const galleryPreview = document.getElementById("portfolioGalleryPreview");
const galleryCount = document.getElementById("portfolioGalleryCount");

const savedCount = portfolioGalleryImageUrls.length;
const availableSlots = Math.max(0, 4 - savedCount);

while (portfolioSelectedFiles.files.length > availableSlots) {
    portfolioSelectedFiles.items.remove(
        portfolioSelectedFiles.files.length - 1
    );
}

this.files = portfolioSelectedFiles.files;

galleryPreview.querySelectorAll(".portfolio-pending-image").forEach(
    item => item.remove()
);

Array.from(this.files).forEach(file => {
    const imageUrl = URL.createObjectURL(file);

    const imageItem = document.createElement("div");
    imageItem.className = "portfolio-image-item portfolio-pending-image";

    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = "New Screenshot";
    img.onload = () => URL.revokeObjectURL(imageUrl);

    imageItem.appendChild(img);
    galleryPreview.appendChild(imageItem);
});

galleryCount.textContent = `${savedCount + this.files.length} / 4`;
});
