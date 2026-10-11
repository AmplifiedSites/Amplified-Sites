require("dotenv").config();

// =========================================
// EMAILJS CONFIGURATION
// =========================================

const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const EMAILJS_REPLY_TEMPLATE_ID = process.env.EMAILJS_REPLY_TEMPLATE_ID;
const EMAILJS_ORDER_TEMPLATE_ID = process.env.EMAILJS_ORDER_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;
// ================= IMPORTS / DEPENDENCIES =================
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { randomUUID, createHash } = require("node:crypto");
const cors = require("cors");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

// ================= APP SETUP =================
const app = express();
app.use(cors());

// Cloudflare Tunnel proxy configuration
app.set("trust proxy", false);

// ================= STRIPE KEYS =================
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
// ================= SUPABASE KEYS =================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// =========================================
// ADMIN LOGIN SECURITY CONFIGURATION
// =========================================
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
const ADMIN_LOGIN_LOCK_MINUTES = 15;
const ADMIN_LOGIN_LOCK_MS =
    ADMIN_LOGIN_LOCK_MINUTES * 60 * 1000;

// =========================================
// EMAILJS — SEND EMAIL
// =========================================

async function sendEmailJS(templateId, templateParams) {

    const response = await fetch(
        "https://api.emailjs.com/api/v1.0/email/send",
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                service_id: EMAILJS_SERVICE_ID,
                template_id: templateId,
                user_id: EMAILJS_PUBLIC_KEY,
                accessToken: EMAILJS_PRIVATE_KEY,
                template_params: templateParams
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
            `EmailJS failed (${response.status}): ${errorText}`
        );
    }

    return true;
}

// =========================================
// EMAILJS — ORDER CONFIRMATION
// =========================================

async function sendOrderConfirmationEmail({
    email,
    customerName,
    orderNumber,
    packageName,
    totalPrice,
    depositPaid,
    remainingBalance,
    paymentStatus,
    estimatedCompletion,
    receiptUrl,
    trackingUrl = `${process.env.WEBSITE_URL}/trackprogress.html`,
    contactUrl = `${process.env.WEBSITE_URL}/start-journey.html`
}) {


await sendEmailJS(
    EMAILJS_ORDER_TEMPLATE_ID,
    {
        email: email,
        email_subject: `Order Confirmation #${orderNumber} — Amplified Sites`,
        email_body: `Thank You for Your Purchase!
Hi ${customerName},
Thank you for choosing Amplified Sites! Your payment has been confirmed, and we're excited to begin working on your website.

ORDER DETAILS
Order Number: ${orderNumber}
Website Package: ${packageName}
Package Price: $${Number(totalPrice).toFixed(2)}
Deposit Paid: $${Number(depositPaid).toFixed(2)}
Remaining Balance: $${Number(remainingBalance).toFixed(2)}
Payment Status: ${paymentStatus}
Estimated Completion: ${estimatedCompletion}

PAYMENT RECEIPT
View your official Stripe payment receipt:
${receiptUrl}

TRACK YOUR WEBSITE PROJECT
You can check your project's progress, payment status, and updates using your order number and email address.
Track Your Order:
${trackingUrl}

QUESTIONS ABOUT YOUR ORDER?
If you have questions about your website project, please contact us through our contact form.
Contact Amplified Sites:
${contactUrl}

Thank you for trusting Amplified Sites with your project!
Amplified Sites
Amplifiedsites@outlook.com`,
        customer_name: customerName,
        order_number: orderNumber,
        package_name: packageName,
        total_price: `$${Number(totalPrice).toFixed(2)}`,
        deposit_paid: `$${Number(depositPaid).toFixed(2)}`,
        remaining_balance: `$${Number(remainingBalance).toFixed(2)}`,
        payment_status: paymentStatus,
        estimated_completion: estimatedCompletion,
        receipt_url: receiptUrl,
        tracking_url: trackingUrl,
        contact_url: contactUrl
    }
);

console.log("ORDER CONFIRMATION EMAIL SENT:", orderNumber);
}

// =========================================
// EMAILJS — REFUND CONFIRMATION
// =========================================

async function sendRefundConfirmationEmail({
    email,
    customerName,
    orderNumber,
    refundAmount,
    refundType
}) {
    await sendEmailJS(
        EMAILJS_ORDER_TEMPLATE_ID,
        {
            email: email,
            email_subject: `Refund Confirmation #${orderNumber} — Amplified Sites`,
            email_body: `Your Refund Has Been Processed
Hi ${customerName},
Your refund has been successfully processed.

REFUND DETAILS
Order Number: ${orderNumber}
Refund Type: ${refundType}
Refund Amount: $${Number(refundAmount).toFixed(2)}
Refund Status: Successful

Your refund will be returned to your original payment method. The time it takes to appear depends on your bank or card provider.

QUESTIONS ABOUT YOUR REFUND?
If you have any questions about your refund, please contact Amplified Sites.
Contact Amplified Sites:
${process.env.WEBSITE_URL}/start-journey.html

Thank you for choosing Amplified Sites!
Amplified Sites
Amplifiedsites@outlook.com`
        }
    );
    console.log("REFUND CONFIRMATION EMAIL SENT:", orderNumber);
}


// =========================================
// UPDATE ORDER EMAIL DELIVERY STATUS
// =========================================

async function updateOrderEmailStatus(paymentIntentId, status) {
    const updates = {
        status: status
    };

    if (status === "sent") {
        updates.sent_at = new Date().toISOString();
    }

    const { error } = await supabase
        .from("order_confirmation_emails")
        .update(updates)
        .eq("stripe_payment_intent_id", paymentIntentId)
        .eq("status", "sending");

    if (error) {
        throw new Error(
            `Unable to update order email status: ${error.message}`
        );
    }
}

// =========================================
// VERIFY AUTHORIZED ADMIN
// =========================================

async function requireAdmin(req, res, next) {
    try {
        const authorization = req.headers.authorization || "";

        const token = authorization.startsWith("Bearer ")
            ? authorization.slice(7)
            : null;

        if (!token) {
            return res.status(401).json({
                error: "Authentication required."
            });
        }

        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data?.user) {
            return res.status(401).json({
                error: "Invalid or expired session."
            });
        }

        if (
            !process.env.ADMIN_USER_ID ||
            data.user.id !== process.env.ADMIN_USER_ID
        ) {
            return res.status(403).json({
                error: "Not authorized to issue refunds."
            });
        }

        req.adminUser = data.user;

        next();

    } catch (error) {
        console.error("ADMIN AUTH ERROR:", error);

        return res.status(500).json({
            error: "Unable to verify admin."
        });
    }
}

// ================= STRIPE WEBHOOK =================
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      endpointSecret
    );
  } catch (err) {
    console.log("❌ Webhook signature error:", err.message);
    return res.sendStatus(400);
  }

  if (event.type !== "checkout.session.completed") {
    return res.json({ received: true });
  }

const session = event.data.object;
const m = session.metadata || {};
const amount = (session.amount_total || 0) / 100;

// ================= SAVE STRIPE PAYMENT =================

if (session.payment_status !== "paid") {
    console.log("Payment not completed.");
    return res.json({ received: true });
}

const paymentIntentId = session.payment_intent;

if (!paymentIntentId) {
    console.error("Missing Stripe Payment Intent ID.");
    return res.sendStatus(500);
}

// =========================================
// GET OFFICIAL STRIPE PAYMENT RECEIPT
// =========================================

let receiptUrl = "";

try {
    const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        {
            expand: ["latest_charge"]
        }
    );

    const charge = paymentIntent.latest_charge;

    if (charge && typeof charge === "object") {
        receiptUrl = charge.receipt_url || "";
    }

    console.log("STRIPE RECEIPT URL:", receiptUrl);

} catch (error) {
    console.error(
        "STRIPE RECEIPT LOOKUP FAILED:",
        error.message
    );
}

const { error: paymentError } = await supabase
    .from("order_payments")
    .upsert(
        {
            order_id: m.order_id,
            payment_type: m.payment_type === "final"
                ? "final"
                : "deposit",
            stripe_payment_intent_id: paymentIntentId,
            amount_paid: amount
        },
        {
            onConflict: "stripe_payment_intent_id",
            ignoreDuplicates: true
        }
    );

if (paymentError) {
    console.error("❌ PAYMENT TRACKING ERROR:", paymentError);
    return res.sendStatus(500);
}

console.log("✅ Stripe payment recorded:", paymentIntentId);

  console.log("🔥 PAYMENT SUCCESS:", m.order_id);
  console.log("🔥 PAYMENT SUCCESS:", m.order_id);

  let estimatedCompletion;

  switch (m.package_name) {
    case "Starter Website":
      estimatedCompletion = "7-10 business days";
      break;
    case "Standard Website":
      estimatedCompletion = "10-14 business days";
      break;
    case "Advanced Website":
      estimatedCompletion = "4-6 weeks";
      break;
    case "Premium Website":
      estimatedCompletion = "6-8 weeks";
      break;
    default:
      estimatedCompletion = "";
  }

  // ===================== CHECK IF FINAL PAYMENT =====================
  const isFinal = m.payment_type === "final";

    if (isFinal) {

        // FINAL PAYMENT → UPDATE PAYMENT INFORMATION ONLY

        if (session.payment_status !== "paid") {
            return res.json({ received: true });
        }

        const { error } = await supabase
            .from("orders")
            .update({
                fully_paid: true,
                remaining_balance: 0
            })
            .eq("order_id", m.order_id);

        if (error) {
        console.error("❌ FINAL PAYMENT ERROR:", error);

        return res.status(500).json({
            received: false,
            error: "Failed to update final payment in Supabase."
        });
    } else {
        console.log("✅ FINAL PAYMENT UPDATED SUCCESSFULLY");
    }

     } else {

    // DEPOSIT PAYMENT → VERIFY PAYMENT FIRST

    if (session.payment_status !== "paid") {
        console.log("Deposit payment not completed.");
        return res.json({ received: true });
    }

    // CREATE ORDER AFTER CONFIRMED PAYMENT

    const { data: insertedOrders, error } = await supabase.from("orders").upsert([

      {
        order_id: m.order_id,

        client_name: m.client_name,
        client_email: m.client_email,
        client_phone: m.client_phone,
        business_name: m.business_name,

        web_package: m.package_name,
        total_price: Number(m.total_price),

        deposit_amount: Number(amount),
        remaining_balance:
          Number(m.total_price) - Number(amount),

        deposit_paid: true,
        fully_paid: false,

        order_status: "In Progress",
        stage: "Planning",
        progress: 0,

        created_at: new Date().toISOString(),
            estimated_completion: estimatedCompletion
        }
    ], {
        onConflict: "order_id",
        ignoreDuplicates: true
    })
    .select("order_id");

      if (error) {

      console.error("❌ SUPABASE ORDER SAVE FAILED:", {
          order_id: m.order_id,
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
      });

      return res.status(500).json({
          received: false,
          error: "Failed to save order in Supabase."
      });

    
} else {

    console.log("✅ SUPABASE ORDER SAVED:", m.order_id);

    // =========================================
    // CREATE NEW ORDER ADMIN NOTIFICATION
    // =========================================

    if (insertedOrders && insertedOrders.length > 0) {

        try {
            const { error: notificationError } = await supabase
                .from("admin_notifications")
                .insert({
                    notification_type: "order",
                    title: "New Website Order",
                    message: `New order #${m.order_id} from ${m.client_name}`,
                    reference_id: String(m.order_id),
                    is_read: false
                });

            if (notificationError) {
                console.error(
                    "ORDER NOTIFICATION SAVE ERROR:",
                    notificationError
                );
            } else {
                console.log(
                    "ADMIN ORDER NOTIFICATION CREATED:",
                    m.order_id
                );
            }

        } catch (notificationError) {
            console.error(
                "ORDER NOTIFICATION ERROR:",
                notificationError
            );
        }
    }
}

  }

  // =========================================
  // CLAIM ORDER CONFIRMATION EMAIL
  // =========================================

  const { data: emailClaimed, error: emailClaimError } =
      await supabase.rpc("claim_order_confirmation_email", {
          p_payment_intent_id: paymentIntentId,
          p_order_id: m.order_id,
          p_payment_type: isFinal ? "final" : "deposit"
      });

  if (emailClaimError) {
      console.error(
          "ORDER EMAIL CLAIM ERROR:",
          emailClaimError.message
      );

      return res.sendStatus(500);
  }

if (emailClaimed) {
    console.log("ORDER EMAIL CLAIMED:", m.order_id);

    try {
        const { data: order, error: orderError } = await supabase
            .from("orders")
            .select("*")
            .eq("order_id", m.order_id)
            .single();

        if (orderError || !order) {
            throw new Error("Unable to retrieve order for confirmation email.");
        }

        await sendOrderConfirmationEmail({
            email: order.client_email,
            customerName: order.client_name,
            orderNumber: order.order_id,
            packageName: order.web_package,
            totalPrice: order.total_price,
            depositPaid: isFinal
                ? Number(order.deposit_amount)
                : amount,
            remainingBalance: order.remaining_balance,
            paymentStatus: isFinal ? "Paid in Full" : "Deposit Paid",
            estimatedCompletion: order.estimated_completion || "To be determined",
            receiptUrl: receiptUrl || "Receipt unavailable"
        });

        await updateOrderEmailStatus(paymentIntentId, "sent");

        console.log("ORDER EMAIL MARKED SENT:", m.order_id);

    } catch (emailError) {
        console.error(
            "ORDER CONFIRMATION EMAIL ERROR:",
            emailError.message
        );

        try {
            await updateOrderEmailStatus(paymentIntentId, "needs_review");
        } catch (statusError) {
            console.error(
                "ORDER EMAIL STATUS UPDATE FAILED:",
                statusError.message
            );
        }
    }

} else {
    console.log("ORDER EMAIL ALREADY CLAIMED:", m.order_id);
}

  res.json({ received: true });
});

app.use(express.json());

// =========================================
// ADMIN LOGIN RATE LIMITER
// =========================================

const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        error: "Too many login requests. Please try again later."
    }
});

// =========================================
// ADMIN LOGIN — SERVER-SIDE AUTHENTICATION
// =========================================

app.post("/admin/login", adminLoginLimiter, async (req, res) => {
    try {
        const email = String(req.body?.email || "")
            .trim()
            .toLowerCase();

        const password = req.body?.password;

        if (
            !email ||
            email.length > 254 ||
            typeof password !== "string" ||
            !password ||
            password.length > 1024
        ) {
            return res.status(400).json({
                error: "Invalid email or password."
            });
        }

        const { data: attempt, error: lookupError } =
            await supabase
                .from("login_attempts")
                .select("failed_count, last_attempt")
                .eq("email", email)
                .maybeSingle();

        if (lookupError) throw lookupError;

        const count = Number(attempt?.failed_count || 0);

        const lastAttempt = attempt?.last_attempt
            ? new Date(attempt.last_attempt).getTime()
            : 0;

        const withinWindow =
            Number.isFinite(lastAttempt) &&
            Date.now() - lastAttempt < ADMIN_LOGIN_LOCK_MS;

        if (
            count >= ADMIN_LOGIN_MAX_ATTEMPTS &&
            withinWindow
        ) {
            return res.status(429).json({
                error: "Too many failed attempts. Try again in 15 minutes."
            });
        }

        const currentCount = withinWindow ? count : 0;

        const authClient = createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        const { data, error } =
            await authClient.auth.signInWithPassword({
                email,
                password
            });

        const authorized =
            !error &&
            data?.user &&
            process.env.ADMIN_USER_ID &&
            data.user.id === process.env.ADMIN_USER_ID;

        if (!authorized) {
            const { error: saveError } = await supabase
                .from("login_attempts")
                .upsert(
                    {
                        email,
                        failed_count: currentCount + 1,
                        last_attempt: new Date().toISOString()
                    },
                    { onConflict: "email" }
                );

            if (saveError) throw saveError;

            return res.status(401).json({
                error: "Invalid email or password."
            });
        }

        const { error: deleteError } = await supabase
            .from("login_attempts")
            .delete()
            .eq("email", email);

        if (deleteError) throw deleteError;

        return res.json({
            success: true,
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token
            }
        });

    } catch (error) {
        console.error("ADMIN LOGIN ERROR:", error);

        return res.status(500).json({
            error: "Unable to complete login."
        });
    }
});

 // =========================================
 // CONTACT FORM — SAVE CUSTOMER MESSAGE
 // =========================================

app.post("/contact-message", async (req, res) => {
    try {
        const clean = (value, maxLength) =>
            typeof value === "string"
                ? value.trim().slice(0, maxLength)
                : "";

        const name = clean(req.body?.name, 120);
        const email = clean(req.body?.email, 254);
        const phone = clean(req.body?.phone, 40);
        const business = clean(req.body?.business, 150);
        const subject = clean(req.body?.subject, 200);
        const message = clean(req.body?.message, 5000);

        if (
            !name ||
            !email ||
            !message ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return res.status(400).json({
                success: false,
                error: "Please provide a valid name, email, and message."
            });
        }

        const { data, error } = await supabase
            .from("Messages")
            .insert({
                name,
                email,
                phone: phone || null,
                business: business || null,
                subject: subject || "New Project Inquiry",
                message,
                status: "New"
            })
            .select("id")
            .single();

        if (error) {
            console.error("CONTACT MESSAGE SAVE ERROR:", error);

            return res.status(500).json({
                success: false,
                error: "Unable to save your message."
            });
        }

        console.log("NEW CONTACT MESSAGE:", data.id);


/* =========================================
   CREATE ADMIN DASHBOARD NOTIFICATION
========================================= */

try {
    const { error: notificationError } = await supabase
        .from("admin_notifications")
        .insert({
            notification_type: "message",
            title: "New Contact Message",
            message: `New message from ${name}`,
            reference_id: String(data.id),
            is_read: false
        });

    if (notificationError) {
        console.error(
            "ADMIN NOTIFICATION SAVE ERROR:",
            notificationError
        );
    } else {
        console.log("ADMIN DASHBOARD NOTIFICATION CREATED");
    }

} catch (notificationError) {
    console.error(
        "ADMIN NOTIFICATION ERROR:",
        notificationError
    );
}


// =========================================
// SEND CUSTOMER CONFIRMATION EMAIL
// =========================================

try {
    await sendEmailJS(
        EMAILJS_REPLY_TEMPLATE_ID,
        {
            email: email,
            name: "Amplified Sites",
            customer_name: name,
            reply_to: "Amplifiedsites@outlook.com",
            subject: "We Received Your Message",
            message:
                "Thank you for contacting Amplified Sites. " +
                "We have received your project inquiry and " +
                "will get back to you as soon as possible."
        }
    );

    console.log("CUSTOMER CONFIRMATION EMAIL SENT");

} catch (emailError) {
    console.error(
        "CUSTOMER CONFIRMATION EMAIL FAILED:",
        emailError.message
    );
}

// =========================================
// SEND ADMIN NEW MESSAGE NOTIFICATION
// =========================================

try {
    await sendEmailJS(
        EMAILJS_TEMPLATE_ID,
        {
            email: "Amplifiedsites@outlook.com",
            name: "Amplified Sites",
            customer_name: name,
            customer_email: email,
            reply_to: email,
            phone: phone || "Not provided",
            business: business || "Not provided",
            subject: subject || "New Project Inquiry",
            message_label: "Customer Message",
            message: message
        }
    );

    console.log("ADMIN MESSAGE NOTIFICATION SENT");

} catch (emailError) {
    console.error(
        "ADMIN MESSAGE NOTIFICATION FAILED:",
        emailError.message
    );
}

        return res.status(201).json({
            success: true,
            message: "Your message has been received."
        });

    } catch (error) {
        console.error("CONTACT MESSAGE ERROR:", error);

        return res.status(500).json({
            success: false,
            error: "Unable to process your message."
        });
    }
});



// =========================================
// ADMIN MESSAGES - RESTORE SELECTED
// =========================================

app.post("/admin/messages/bulk-restore", requireAdmin, async (req, res) => {
    try {
        const { message_ids } = req.body;

        const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (
            !Array.isArray(message_ids) ||
            message_ids.length === 0 ||
            message_ids.length > 100 ||
            !message_ids.every(id =>
                typeof id === "string" && validUuid.test(id)
            ) ||
            new Set(message_ids).size !== message_ids.length
        ) {
            return res.status(400).json({
                success: false,
                error: "Invalid message selection."
            });
        }

        const { data, error } = await supabase
            .from("Messages")
            .update({
                is_deleted: false,
                deleted_at: null
            })
            .in("id", message_ids)
            .eq("is_deleted", true)
            .select("id");

        if (error) throw error;

        return res.json({
            success: true,
            restored_count: data?.length || 0
        });

    } catch (error) {
        console.error("RESTORE MESSAGES ERROR:", error);

        return res.status(500).json({
            success: false,
            error: "Unable to restore selected messages."
        });
    }
});


// =========================================
// ADMIN MESSAGES — MOVE TO RECENTLY DELETED
// =========================================
app.post("/admin/messages/bulk-delete", requireAdmin, async (req, res) => {
    try {
        const { message_ids } = req.body;

        if (
            !Array.isArray(message_ids) ||
            message_ids.length === 0 ||
            message_ids.length > 100 ||
            !message_ids.every(id =>
                typeof id === "string" &&
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
            ) ||
            new Set(message_ids).size !== message_ids.length
        ) {
            return res.status(400).json({
                success: false,
                error: "Invalid message selection."
            });
        }

        const { data, error } = await supabase
            .from("Messages")
            .update({
                is_deleted: true,
                deleted_at: new Date().toISOString()
            })
            .in("id", message_ids)
            .eq("is_deleted", false)
            .select("id");

        if (error) throw error;

        return res.json({
            success: true,
            deleted_count: data?.length || 0
        });

    } catch (error) {
        console.error("BULK DELETE MESSAGES ERROR:", error);

        return res.status(500).json({
            success: false,
            error: "Unable to move messages to Recently Deleted."
        });
    }
});


/* =========================================
   ADMIN MESSAGES — SEND CUSTOMER REPLY
========================================= */

app.post("/admin/messages/reply", requireAdmin, async (req, res) => {

    try {

        const { message_id, reply_text } = req.body || {};

        // Validate message ID
        if (
            typeof message_id !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(message_id)
        ) {
            return res.status(400).json({
                success: false,
                error: "Invalid message ID."
            });
        }

        // Validate reply
        if (
            typeof reply_text !== "string" ||
            !reply_text.trim() ||
            reply_text.trim().length > 5000
        ) {
            return res.status(400).json({
                success: false,
                error: "Reply must contain 1–5000 characters."
            });
        }

        // Get original customer message
        const { data: message, error: messageError } = await supabase
            .from("Messages")
            .select("id, name, email, subject, is_deleted")
            .eq("id", message_id)
            .single();

        if (messageError || !message || message.is_deleted) {
            return res.status(404).json({
                success: false,
                error: "Customer message not found."
            });
        }

        if (
            !message.email ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.email)
        ) {
            return res.status(400).json({
                success: false,
                error: "Customer email address is invalid."
            });
        }

        // Send using existing customer email template
            await sendEmailJS(EMAILJS_REPLY_TEMPLATE_ID, {
            email: message.email,
            customer_name: message.name || "Customer",
            subject: "Amplified Sites Message",
            message_label: "Amplified Sites Message",
            message: reply_text.trim(),
            reply_to: "Amplifiedsites@outlook.com"
        });

        // Save reply history only after EmailJS accepts the email
        const { error: replyError } = await supabase
            .from("Message_Replies")
            .insert({
                message_id: message.id,
                reply_text: reply_text.trim(),
                replied_by: req.adminUser.id
            });

        if (replyError) {
            console.error("REPLY HISTORY SAVE ERROR:", replyError);

            return res.status(500).json({
                success: false,
                email_sent: true,
                error: "Email sent, but reply history could not be saved. Do not resend without checking EmailJS history."
            });
        }

        // Update original message status
        const { error: statusError } = await supabase
            .from("Messages")
            .update({
                status: "Replied",
                replied_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq("id", message.id);

        if (statusError) {
            console.error("MESSAGE STATUS UPDATE ERROR:", statusError);

            return res.status(500).json({
                success: false,
                email_sent: true,
                error: "Email and reply history saved, but message status could not be updated."
            });
        }

        return res.json({
            success: true,
            email_sent: true,
            message: "Reply sent successfully."
        });

    } catch (error) {

        console.error("ADMIN MESSAGE REPLY ERROR:", error);

        return res.status(500).json({
            success: false,
            error: "Unable to send customer reply."
        });

    }

});


// ================= FIND ORDER ROUTE =================
app.post("/find-order", async (req, res) => {
  const { order_id, client_email } = req.body;

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("order_id", order_id)
    .eq("client_email", client_email)
    .single();

  if (error) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json({ order: data });
});

// ================= TEST ROUTES =================
app.get("/test-supabase", async (req, res) => {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .limit(1);
  if (error) {
    console.log("❌ Supabase error:", error);
    return res.status(500).json(error);
  }
  res.json({
    success: true,
    message: "Supabase connected",
    data
  });
});

app.get("/", (req, res) => {
  res.send("Backend Online");
});

// ================= DEPOSIT CHECKOUT ROUTES =================
app.post("/create-checkout-session", async (req, res) => {
  try {
    const {
      order_id,
      package_name,
      client_name,
      client_email,
      client_phone,
      business_name,
      total_price,
      deposit_amount
    } = req.body;

// ================= VALIDATE DEPOSIT AMOUNT =================

  const deposit = Number(deposit_amount);

  if (!Number.isFinite(deposit) || deposit <= 0) {
      console.error("INVALID DEPOSIT AMOUNT");

      return res.status(400).json({
          error: "Invalid deposit amount. Please check your selected package."
      });
  }

  const depositCents = Math.round(deposit * 100);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${package_name} Deposit`
            },
           unit_amount: depositCents
          },
          quantity: 1
        }
      ],
      metadata: {
        order_id,
        package_name,
        client_name,
        client_email,
        client_phone,
        business_name,
        total_price,
        deposit_amount
      },
      customer_email: client_email,
      success_url:
        "http://127.0.0.1:5501/success-deposit.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url:
        "http://127.0.0.1:5501/review-order.html"
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("CHECKOUT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ================= ORDER ROUTES/CREATE DEPOSIT STRIPE SESSION =================
app.get("/get-order-by-session", async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) {
      return res.status(400).json({ error: "Missing session_id" });
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const orderId = session.metadata?.order_id;
    if (!orderId) {
      return res.status(404).json({ error: "Missing order_id in Stripe metadata" });
    }
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", orderId)
      .limit(1);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Order not found in Supabase" });
    }
    return res.json({
      order: data[0],
      session
    });
  } catch (err) {
    console.error("GET ORDER ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ================= FINAL CHECKOUT ROUTES =================
app.post("/create-final-payment-session", async (req, res) => {
  try {
    const { order_id } = req.body;

    // 1. Get order from Supabase
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("order_id", order_id)
      .single();
    if (error || !data) {
      return res.status(404).json({ error: "Order not found" });
    }
    const remainingBalance = Number(data.remaining_balance);
    // 2. Create Stripe session for REMAINING BALANCE
    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${data.web_package} Remaining Balance`
            },
            unit_amount: Math.round(remainingBalance * 100)
          },
          quantity: 1
        }
      ],

      metadata: {
        order_id: data.order_id,
        package_name: data.web_package,
        payment_type: "final"
        
      },
      customer_email: data.client_email,
      success_url:
        "http://127.0.0.1:5501/success.html?session_id={CHECKOUT_SESSION_ID}",

      cancel_url:
        "http://127.0.0.1:5501/viewpackage.html"
    });
    res.json({ url: session.url });
  } catch (err) {
    console.log("FINAL PAYMENT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// =========================================
// ADMIN REFUND ENDPOINT
// =========================================
app.post("/admin/refund", requireAdmin, async (req, res) => {
    try {

        // =========================================
        // REFUND SAFETY SWITCH
        // =========================================

        if (process.env.ENABLE_STRIPE_REFUNDS !== "true") {
            return res.status(503).json({
                success: false,
                error: "Stripe refunds are currently disabled."
            });
        }
        
        // Only allow Stripe TEST refunds during development.
        if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
            return res.status(503).json({
                success: false,
                error: "Refund testing requires a Stripe test secret key."
            });
        }

         const { order_id, amount, refund_request_id } = req.body;

// =========================================
// VALIDATE REFUND REQUEST ID
// =========================================

if (
    typeof refund_request_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(refund_request_id)
) {
    return res.status(400).json({
        error: "A valid refund request ID is required."
    });
}

        if (typeof order_id !== "string" || !order_id.trim()) {
            return res.status(400).json({
                error: "A valid order ID is required."
            });
        }

        // Find all Stripe payments associated with this order
        const { data: payments, error } = await supabase
            .from("order_payments")
            .select("*")
            .eq("order_id", order_id.trim())
            .order("created_at", { ascending: true });

        if (error) {
            console.error("PAYMENT LOOKUP ERROR:", error);

            return res.status(500).json({
                error: "Unable to retrieve order payments."
            });
        }

        if (!payments || payments.length === 0) {
            return res.status(404).json({
                error: "No recorded Stripe payments found for this order."
            });
        }

    // =========================================
    // VALIDATE REFUND AMOUNT
    // =========================================

    const requestedAmount = Number(amount);

    if (
        amount === null ||
        amount === undefined ||
        typeof amount === "boolean" ||
        String(amount).trim() === "" ||
        !Number.isFinite(requestedAmount) ||
        requestedAmount <= 0
    ) {
        return res.status(400).json({
            error: "Enter a valid refund amount."
        });
    }

    const refundCents = Math.round(requestedAmount * 100);

    if (
        !Number.isSafeInteger(refundCents) ||
        refundCents <= 0 ||
        Math.abs(requestedAmount * 100 - refundCents) > 0.000001
    ) {
        return res.status(400).json({
            error: "Refund amount must be in dollars and cents."
        });
    }

    // Calculate the remaining refundable balance
    const refundableCents = payments.reduce((total, payment) => {
        const paid = Math.round(Number(payment.amount_paid) * 100);
        const refunded = Math.round(Number(payment.amount_refunded) * 100);

        return total + Math.max(0, paid - refunded);
    }, 0);

    if (refundCents > refundableCents) {
        return res.status(400).json({
            error: `Maximum refundable amount is $${(refundableCents / 100).toFixed(2)}.`
        });
    }

    // =========================================
    // VERIFY REFUNDABLE AMOUNT WITH STRIPE
    // =========================================

    let stripeRefundableCents = 0;

    for (const payment of payments) {

        const paymentIntent = await stripe.paymentIntents.retrieve(
            payment.stripe_payment_intent_id,
            { expand: ["latest_charge"] }
        );

        const charge = paymentIntent.latest_charge;

        if (
            !charge ||
            typeof charge !== "object" ||
            charge.status !== "succeeded" ||
            charge.currency !== "usd"
        ) {
            continue;
        }

        const availableCents = Math.max(
            0,
            charge.amount_captured - charge.amount_refunded
        );

        stripeRefundableCents += availableCents;
    }

    if (refundCents > stripeRefundableCents) {
        return res.status(400).json({
            error: `Stripe only allows $${(stripeRefundableCents / 100).toFixed(2)} to be refunded.`
        });
    }

    // =========================================
    // PREPARE STRIPE REFUND ALLOCATION
    // =========================================

    const refundAllocations = [];
    let remainingRefundCents = refundCents;

    for (const payment of payments) {

        if (remainingRefundCents <= 0) {
            break;
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(
            payment.stripe_payment_intent_id,
            { expand: ["latest_charge"] }
        );

        const charge = paymentIntent.latest_charge;

        if (
            !charge ||
            typeof charge !== "object" ||
            charge.status !== "succeeded" ||
            charge.currency !== "usd"
        ) {
            continue;
        }

        const databaseRemainingCents = Math.max(
            0,
            Math.round(Number(payment.amount_paid) * 100) -
            Math.round(Number(payment.amount_refunded) * 100)
        );

        const stripeRemainingCents = Math.max(
            0,
            charge.amount_captured - charge.amount_refunded
        );

        const availableCents = Math.min(
            databaseRemainingCents,
            stripeRemainingCents
        );

        const allocatedCents = Math.min(
            availableCents,
            remainingRefundCents
        );

        if (allocatedCents <= 0) {
            continue;
        }

        refundAllocations.push({
            payment_id: payment.id,
            payment_type: payment.payment_type,
            payment_intent_id: payment.stripe_payment_intent_id,
            amount_cents: allocatedCents
        });

        remainingRefundCents -= allocatedCents;
    }

    if (remainingRefundCents > 0) {
        return res.status(400).json({
            error: "Unable to allocate the full refund amount."
        });
    }

// =========================================
// CHECK EXISTING REFUND REQUEST
// =========================================

const { data: existingRequest, error: requestLookupError } =
    await supabase
        .from("refund_requests")
        .select("id, order_id, requested_amount, status")
        .eq("id", refund_request_id)
        .maybeSingle();

if (requestLookupError) {
    console.error("REFUND REQUEST LOOKUP ERROR:", requestLookupError);

    return res.status(500).json({
        error: "Unable to verify refund request."
    });
}

if (existingRequest) {

    const sameOrder =
        existingRequest.order_id === order_id.trim();

    const sameAmount =
        Math.round(Number(existingRequest.requested_amount) * 100)
        === refundCents;

    if (!sameOrder || !sameAmount) {
        return res.status(409).json({
            error: "This refund request ID was already used for a different refund."
        });
    }

    return res.status(409).json({
        error: "This refund request already exists.",
        refund_status: existingRequest.status
    });
}

// =========================================
// ACQUIRE REFUND LOCK
// =========================================

const lockToken = randomUUID();

const { data: lockAcquired, error: lockError } =
    await supabase.rpc("acquire_order_refund_lock", {
        p_order_id: order_id.trim(),
        p_lock_token: lockToken
    });

if (lockError) {
    console.error("REFUND LOCK ERROR:", lockError);

    return res.status(500).json({
        error: "Unable to secure this refund request."
    });
}

if (!lockAcquired) {
    return res.status(409).json({
        error: "This order has a pending refund operation. Please resolve it before trying again."
    });
}

// =========================================
// SAVE REFUND REQUEST
// =========================================

const { error: saveRequestError } = await supabase
    .from("refund_requests")
    .insert({
        id: refund_request_id,
        order_id: order_id.trim(),
        requested_amount: refundCents / 100,
        status: "pending"
    });

if (saveRequestError) {
    console.error("SAVE REFUND REQUEST ERROR:", saveRequestError);

    // Do not automatically release the lock here.
    // The request must be checked before retrying.
    return res.status(500).json({
        error: "Unable to save refund request. Manual review required."
    });
}

console.log("Refund request saved:", refund_request_id);

// =========================================
// MARK REFUND REQUEST AS PROCESSING
// =========================================

const { data: processingRequest, error: processingError } =
    await supabase
        .from("refund_requests")
        .update({
            status: "processing",
            updated_at: new Date().toISOString()
        })
        .eq("id", refund_request_id)
        .eq("status", "pending")
        .select("id")
        .single();

if (processingError || !processingRequest) {
    console.error(
        "REFUND STATUS UPDATE ERROR:",
        processingError
    );

    return res.status(500).json({
        error: "Unable to prepare refund for processing. Manual review required."
    });
}

console.log("Refund request marked as processing.");

// =========================================
// SAVE REFUND ALLOCATIONS
// =========================================

const refundRecords = refundAllocations.map(payment => ({
    order_id: order_id.trim(),
    payment_id: payment.payment_id,
    refund_request_id: refund_request_id,
    refund_amount: payment.amount_cents / 100,
    refund_status: "pending"
}));

console.log("Prepared refund allocations:", refundRecords);

// =========================================
// STORE PENDING REFUND RECORDS
// =========================================

const { error: refundRecordsError } = await supabase
    .from("order_refunds")
    .insert(
        refundRecords.map(record => ({
            ...record,
            refund_request_id: refund_request_id
        }))
    );

if (refundRecordsError) {
    console.error("SAVE REFUND RECORDS ERROR:", refundRecordsError);

    // Keep the lock until the database state is reviewed.
    // Do not attempt a Stripe refund.
    await supabase
        .from("refund_requests")
        .update({
            status: "needs_review",
            updated_at: new Date().toISOString()
        })
        .eq("id", refund_request_id)
        .eq("status", "processing");

    return res.status(500).json({
        error: "Refund records could not be saved. Manual review required. No Stripe refund was attempted."
    });
}

console.log("Pending refund records saved successfully.");

// =========================================
// STRIPE REFUND IDEMPOTENCY KEYS
// =========================================

const preparedStripeRefunds = refundAllocations.map(payment => ({
    ...payment,
    idempotency_key:
        `amp-refund-${refund_request_id}-${payment.payment_id}`
}));

// =========================================
// STRIPE REFUND REQUESTS PREPARED
// =========================================

console.log(
    "Stripe refund requests prepared:",
    preparedStripeRefunds.map(payment => ({
        payment_type: payment.payment_type,
        amount_cents: payment.amount_cents,
        idempotency_key: payment.idempotency_key
    }))
);

// =========================================
// STRIPE REFUND PROCESSOR
// =========================================

async function createStripeRefund(payment) {
    return await stripe.refunds.create(
        {
            payment_intent: payment.payment_intent_id,
            amount: payment.amount_cents,
            reason: "requested_by_customer",
            metadata: {
                order_id: order_id.trim(),
                refund_request_id: refund_request_id,
                payment_type: payment.payment_type
            }
        },
        {
            idempotencyKey: payment.idempotency_key,
            maxNetworkRetries: 0
        }
    );
}

// =========================================
// SAVE STRIPE REFUND RESULT
// =========================================

async function saveStripeRefundResult(payment, stripeRefund) {
    const { data, error } = await supabase
        .from("order_refunds")
        .update({
            stripe_refund_id: stripeRefund.id,
            refund_status: stripeRefund.status
        })
        .eq("refund_request_id", refund_request_id)
        .eq("payment_id", payment.payment_id)
        .is("stripe_refund_id", null)
        .select("id");

    if (error || !data || data.length !== 1) {
        throw new Error(
            "Unable to save Stripe refund result. Manual reconciliation required."
        );
    }

    return data[0];
}

// =========================================
// UPDATE REFUND REQUEST STATUS
// =========================================

async function updateRefundRequestStatus(status) {
    const { data, error } = await supabase
        .from("refund_requests")
        .update({
            status,
            updated_at: new Date().toISOString()
        })
        .eq("id", refund_request_id)
        .eq("status", "processing")
        .select("id")
        .single();

    if (error || !data) {
        throw new Error(
            "Unable to update refund request status. Manual review required."
        );
    }

    return data;
}

// =========================================
// VERIFY STRIPE REFUND STATUS
// =========================================

async function verifyStripeRefund(stripeRefundId) {
    const refund = await stripe.refunds.retrieve(stripeRefundId);

    return {
        id: refund.id,
        status: refund.status,
        amount: refund.amount,
        payment_intent: refund.payment_intent
    };
}

// =========================================
// GET STRIPE PAYMENT REFUND BALANCE
// =========================================

async function getStripeRefundBalance(paymentIntentId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId,
        { expand: ["latest_charge"] }
    );

    const charge = paymentIntent.latest_charge;

    if (
        !charge ||
        typeof charge !== "object" ||
        charge.status !== "succeeded"
    ) {
        throw new Error("Unable to verify Stripe payment.");
    }

    return {
        amount_paid: charge.amount_captured / 100,
        amount_refunded: charge.amount_refunded / 100,
        amount_remaining:
            Math.max(0, charge.amount_captured - charge.amount_refunded) / 100
    };
}

// =========================================
// SYNC STRIPE REFUND BALANCE TO SUPABASE
// =========================================

async function syncRefundBalance(payment) {
    const balance = await getStripeRefundBalance(
        payment.payment_intent_id
    );

    const { data, error } = await supabase
        .from("order_payments")
        .update({
            amount_refunded: balance.amount_refunded
        })
        .eq("id", payment.payment_id)
        .eq("stripe_payment_intent_id", payment.payment_intent_id)
        .select("id")
        .single();

    if (error || !data) {
        throw new Error(
            "Unable to synchronize refund balance. Manual review required."
        );
    }

    return balance;
}

// =========================================
// EXECUTE STRIPE REFUNDS
// =========================================

async function executeStripeRefunds() {
    const results = [];

    for (const payment of preparedStripeRefunds) {
        let stripeRefund;

    try {
        stripeRefund = await createStripeRefund(payment);
    } catch (error) {
        console.error("STRIPE REFUND ERROR:", {
            refund_request_id,
            payment_id: payment.payment_id,
            message: error.message
        });

        // The request may have reached Stripe.
        // Stop processing and preserve records for reconciliation.
        throw new Error(
            "Stripe refund outcome requires verification. Do not retry automatically."
        );
    }

       try {
          await saveStripeRefundResult(payment, stripeRefund);

          if (stripeRefund.status !== "succeeded") {
              throw new Error(
                  "Stripe refund is not confirmed. Stop further refunds and review manually."
              );
          }

          const balance = await syncRefundBalance(payment);

          results.push({
              payment_type: payment.payment_type,
              stripe_refund_id: stripeRefund.id,
              status: stripeRefund.status,
              amount: stripeRefund.amount / 100,
              remaining_balance: balance.amount_remaining
          });

      } catch (error) {
          console.error("REFUND DATABASE SYNC ERROR:", {
              refund_request_id,
              stripe_refund_id: stripeRefund.id,
              message: error.message
          });

          throw new Error(
              "Stripe refund may have been created, but database synchronization failed. Manual reconciliation required."
          );
      }
    }

    return results;
}

// =========================================
// PROCESS AND VERIFY STRIPE REFUNDS
// =========================================

try {
    const results = await executeStripeRefunds();

    // Verify each refund directly with Stripe
    for (const result of results) {
        const verified = await verifyStripeRefund(
            result.stripe_refund_id
        );

        if (
            verified.status !== "succeeded" ||
            verified.amount !== Math.round(result.amount * 100)
        ) {
            throw new Error(
                "Stripe refund is not fully confirmed. Manual review required."
            );
        }
    }

    // Mark the refund request as successful
    await updateRefundRequestStatus("succeeded");

    // Release the order refund lock
    const { data: lockReleased, error: releaseError } =
        await supabase.rpc("release_order_refund_lock", {
            p_order_id: order_id.trim(),
            p_lock_token: lockToken
        });

    if (releaseError || !lockReleased) {
        console.error("REFUND LOCK RELEASE ERROR:", releaseError);

        return res.status(500).json({
            success: false,
            refund_request_id,
            error: "Refund succeeded, but the order lock requires manual review."
        });
    }

// =========================================
// SEND REFUND CONFIRMATION EMAIL
// =========================================

try {
    const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("client_name, client_email, total_price")
        .eq("order_id", order_id.trim())
        .single();

    if (orderError || !order) {
        throw new Error("Unable to retrieve customer information.");
    }

    const { data: orderPayments, error: paymentsError } = await supabase
        .from("order_payments")
        .select("amount_paid, amount_refunded")
        .eq("order_id", order_id.trim());

    if (paymentsError || !orderPayments) {
        throw new Error("Unable to retrieve refund balances.");
    }

    const totalPaid = orderPayments.reduce(
        (sum, payment) => sum + Math.round(Number(payment.amount_paid) * 100),
        0
    );

    const totalRefunded = orderPayments.reduce(
        (sum, payment) => sum + Math.round(Number(payment.amount_refunded) * 100),
        0
    );

    const refundType =
        totalRefunded >= totalPaid ? "Full Refund" : "Partial Refund";

    await sendRefundConfirmationEmail({
        email: order.client_email,
        customerName: order.client_name,
        orderNumber: order_id.trim(),
        refundAmount: refundCents / 100,
        refundType: refundType
    });

} catch (emailError) {
    console.error(
        "REFUND CONFIRMATION EMAIL FAILED:",
        emailError.message
    );
}

    return res.json({
        success: true,
        refund_request_id,
        status: "succeeded",
        refunds: results
    });

} catch (error) {
    console.error("REFUND EXECUTION ERROR:", error);

    // Preserve the order lock if the outcome is uncertain
    const { error: reviewError } = await supabase
        .from("refund_requests")
        .update({
            status: "needs_review",
            updated_at: new Date().toISOString()
        })
        .eq("id", refund_request_id)
        .eq("status", "processing");

    if (reviewError) {
        console.error("REFUND REVIEW UPDATE ERROR:", reviewError);
    }

    return res.status(500).json({
        success: false,
        refund_request_id,
        status: "needs_review",
        error: "Refund outcome requires manual review. Check Stripe before retrying."
    });
}

    } catch (error) {

        console.error("REFUND ENDPOINT ERROR:", error);

        return res.status(500).json({
            error: "Unable to process refund request."
        });

    }
});

// =========================================
// FIND EXISTING STRIPE PAYMENT
// =========================================

app.get("/admin/find-stripe-payment", requireAdmin, async (req, res) => {
    try {
        const paymentIntentId = req.query.payment_intent_id;

        if (
            typeof paymentIntentId !== "string" ||
            !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)
        ) {
            return res.status(400).json({
                error: "Invalid Payment Intent ID."
            });
        }

        const payment = await stripe.paymentIntents.retrieve(paymentIntentId);

        const sessions = await stripe.checkout.sessions.list({
            payment_intent: paymentIntentId,
            limit: 100
        });

        return res.json({
            payment_intent_id: payment.id,
            status: payment.status,
            amount: payment.amount_received / 100,
            currency: payment.currency,
            sessions: sessions.data.map(session => ({
                order_id: session.metadata?.order_id || null,
                payment_type: session.metadata?.payment_type || "deposit",
                payment_status: session.payment_status,
                session_id: session.id
            }))
        });

    } catch (error) {
        console.error("STRIPE LOOKUP ERROR:", error.message);

        return res.status(500).json({
            error: "Unable to retrieve Stripe payment."
        });
    }
});


/* =========================================
   CUSTOMER REVIEWS — AUTO VERIFICATION
========================================= */

app.post("/reviews/submit", async (req, res) => {
    try {
        const name = String(req.body?.name || "").trim();
        const email = String(req.body?.email || "").trim().toLowerCase();
        const business = String(req.body?.business_name || "").trim();
        const rating = Number(req.body?.rating);
        const review = String(req.body?.review || "").trim();

        
        if (
            !name || name.length > 120 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            email.length > 254 ||
            !Number.isInteger(rating) ||
            rating < 1 || rating > 5 ||
            !review || review.length > 5000 ||
            business.length > 150

        ) {
            return res.status(400).json({
                error: "Invalid review information."
            });
        }

        // Look for a customer with a confirmed deposit.
        const { data: orders, error: orderError } = await supabase
            .from("orders")
            .select("client_email")
            .ilike("client_email", email)
            .eq("deposit_paid", true)
            .limit(1);

        if (orderError) throw orderError;

        const verified = (orders || []).some(
            order => String(order.client_email || "")
                .trim().toLowerCase() === email
        );

        
        const { data: savedReview, error: reviewError } = await supabase
            .from("website_reviews")
            .insert({
                name,
                email,
                business_name: business || null,
                rating,
                review,
                status: "pending",
                verified
            })
            .select("id")
            .single();


        
        if (reviewError) {
            if (reviewError.code === "23505") {
                return res.status(409).json({
                    success: false,
                    error: "This email address has already submitted a review."
                });
            }

            throw reviewError;
        }

                // =========================================
        // CREATE ADMIN REVIEW NOTIFICATION
        // =========================================

        try {
            const { error: notificationError } = await supabase
                .from("admin_notifications")
                .insert({
                    notification_type: "review",
                    title: "New Customer Review",
                    message: `New ${rating}-star review from ${name}`,
                    reference_id: String(savedReview.id),
                    is_read: false
                });

            if (notificationError) {
                console.error(
                    "REVIEW NOTIFICATION SAVE ERROR:",
                    notificationError
                );
            } else {
                console.log(
                    "ADMIN REVIEW NOTIFICATION CREATED"
                );
            }

        } catch (notificationError) {
            console.error(
                "REVIEW NOTIFICATION ERROR:",
                notificationError
            );
        }

        return res.status(201).json({
            success: true,
            message: "Review submitted for approval."
        });

    } catch (error) {
        console.error("REVIEW SUBMISSION ERROR:", error);

        return res.status(500).json({
            error: "Unable to submit review."
        });
    }
});


// ================= BACKEND SERVER START =================
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

