
const client = window.supabaseClient;

// =========================================
// ADMIN LOGIN
// =========================================

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const loginBtn = document.getElementById("loginBtn");
    const errorMessage = document.getElementById("error");

    async function login() {
        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;

        errorMessage.style.display = "none";
        errorMessage.textContent = "";

        if (!email || !password) {
            errorMessage.textContent =
                "Please enter your email and password.";
            errorMessage.style.display = "block";
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = "Logging in...";

        try {
            // Replace with your Cloudflare Tunnel URL
            const API_URL = "api.amplifiedsites.com";

            const response = await fetch(
                `${API_URL}/admin/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        email,
                        password
                    })
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.error || "Login failed."
                );
            }

            if (
                !result.session?.access_token ||
                !result.session?.refresh_token
            ) {
                throw new Error("Invalid login session.");
            }

            const { error: sessionError } =
                await client.auth.setSession({
                    access_token: result.session.access_token,
                    refresh_token: result.session.refresh_token
                });

            if (sessionError) {
                throw sessionError;
            }

            window.location.href = "admin-dashboard.html";

        } catch (error) {
            console.error("ADMIN LOGIN ERROR:", error);

            errorMessage.textContent =
                error.message || "Unable to log in.";

            errorMessage.style.display = "block";

            passwordInput.value = "";
            passwordInput.focus();

        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = "Login";
        }
    }

    loginForm.addEventListener("submit", (event) => {
        event.preventDefault();
        login();
    });
}

// =========================================
// FORGOT PASSWORD
// =========================================

const forgotPasswordForm =
    document.getElementById("forgotPasswordForm");

if (forgotPasswordForm) {
    const forgotEmail =
        document.getElementById("forgotEmail");

    const resetBtn =
        document.getElementById("resetBtn");

    const successMessage =
        document.getElementById("successMessage");

    const forgotError =
        document.getElementById("forgotError");

    forgotPasswordForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = forgotEmail.value.trim().toLowerCase();

        successMessage.style.display = "none";
        forgotError.style.display = "none";

        resetBtn.disabled = true;
        resetBtn.textContent = "Sending...";

        try {
            const { error } =
                await client.auth.resetPasswordForEmail(email, {
                    redirectTo:
                        "https://amplifiedsites.com/admin-reset-password.html"
                });

            if (error) {
                console.error("Supabase reset error:", error);

                forgotError.textContent = error.message;
                forgotError.style.display = "block";
                return;
            }

            successMessage.textContent =
                "Reset link sent! Check your email.";

            successMessage.style.display = "block";

        } catch (err) {
            console.error("Password reset exception:", err);

            forgotError.textContent =
                "Unable to send reset link.";

            forgotError.style.display = "block";

        } finally {
            resetBtn.disabled = false;
            resetBtn.textContent = "Send Reset Link";
        }
    });
}

// =========================================
// RESET PASSWORD
// =========================================

const resetPasswordForm =
    document.getElementById("resetPasswordForm");

if (resetPasswordForm) {
    const newPassword =
        document.getElementById("newPassword");

    const confirmPassword =
        document.getElementById("confirmPassword");

    const updatePasswordBtn =
        document.getElementById("updatePasswordBtn");

    const resetSuccess =
        document.getElementById("resetSuccess");

    const resetError =
        document.getElementById("resetError");

    resetPasswordForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const password = newPassword.value;
        const confirm = confirmPassword.value;

        resetSuccess.style.display = "none";
        resetError.style.display = "none";

        if (password.length < 8) {
            resetError.textContent =
                "Password must be at least 8 characters.";

            resetError.style.display = "block";
            return;
        }

        if (password !== confirm) {
            resetError.textContent =
                "Passwords do not match.";

            resetError.style.display = "block";
            return;
        }

        updatePasswordBtn.disabled = true;
        updatePasswordBtn.textContent = "Updating...";

        try {
            const { error } =
                await client.auth.updateUser({
                    password
                });

            if (error) {
                console.error("Password update error:", error);

                resetError.textContent =
                    "Unable to update password. Please try again.";

                resetError.style.display = "block";
                return;
            }

            resetSuccess.textContent =
                "Password updated successfully!";

            resetSuccess.style.display = "block";

            newPassword.value = "";
            confirmPassword.value = "";

            updatePasswordBtn.textContent = "Password Updated";

            await client.auth.signOut();

            setTimeout(() => {
                window.location.href = "admin-login.html";
            }, 2000);

        } catch (err) {
            console.error("Unexpected password reset error:", err);

            resetError.textContent =
                "Something went wrong. Please try again.";

            resetError.style.display = "block";

        } finally {
            updatePasswordBtn.disabled = false;

            if (resetSuccess.style.display !== "block") {
                updatePasswordBtn.textContent = "Update Password";
            }
        }
    });
}
