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

        // Clear previous error
        errorMessage.style.display = "none";
        errorMessage.innerText = "";


        // Check empty fields
        if (!email || !password) {

            errorMessage.innerText =
                "Please enter your email and password.";

            errorMessage.style.display = "block";

            return;
        }


        // Disable button
        loginBtn.disabled = true;
        loginBtn.innerText = "Logging in...";


        try {

            // Check failed login attempts
            const { data: attempt, error: attemptError } =
                await client
                    .from("login_attempts")
                    .select("*")
                    .eq("email", email)
                    .maybeSingle();


            if (attemptError) {
                console.error(
                    "Login attempt lookup error:",
                    attemptError
                );
            }


            // Lock account after 5 failed attempts
            if (attempt && attempt.failed_count >= 5) {

                errorMessage.innerText =
                    "Account locked due to too many failed attempts.";

                errorMessage.style.display = "block";

                loginBtn.disabled = false;
                loginBtn.innerText = "Login";

                return;
            }


            // Supabase authentication
            const { data, error } =
                await client.auth.signInWithPassword({
                    email: email,
                    password: password
                });


            // Login failed
            if (error) {

                console.error("Login error:", error);


                if (attempt) {

                    await client
                        .from("login_attempts")
                        .update({
                            failed_count: attempt.failed_count + 1,
                            last_attempt: new Date().toISOString()
                        })
                        .eq("email", email);

                } else {

                    await client
                        .from("login_attempts")
                        .insert({
                            email: email,
                            failed_count: 1,
                            last_attempt: new Date().toISOString()
                        });
                }


                errorMessage.innerText =
                    "Invalid email or password.";

                errorMessage.style.display = "block";

                passwordInput.value = "";
                passwordInput.focus();

                loginBtn.disabled = false;
                loginBtn.innerText = "Login";

                return;
            }


            // Successful login
            await client
                .from("login_attempts")
                .delete()
                .eq("email", email);


            // Go to dashboard
            window.location.href =
                "admin-dashboard.html";

        } catch (err) {

            console.error(
                "Unexpected login error:",
                err
            );

            errorMessage.innerText =
                "Something went wrong. Please try again.";

            errorMessage.style.display = "block";

            loginBtn.disabled = false;
            loginBtn.innerText = "Login";
        }
    }


    // Submit login form
    loginForm.addEventListener("submit", (e) => {

        e.preventDefault();

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

        const email =
            forgotEmail.value.trim().toLowerCase();

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

                forgotError.textContent =
                    error.message;

                forgotError.style.display = "block";

                resetBtn.disabled = false;
                resetBtn.textContent = "Send Reset Link";

                return;
            }


            successMessage.textContent =
                "Reset link sent! Check your email.";

            successMessage.style.display = "block";

            resetBtn.disabled = false;
            resetBtn.textContent = "Send Reset Link";


        } catch (err) {

            console.error("Password reset exception:", err);

            forgotError.textContent =
                "Unable to send reset link.";

            forgotError.style.display = "block";

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


    resetPasswordForm.addEventListener(
        "submit",
        async (e) => {

            e.preventDefault();


            const password =
                newPassword.value;

            const confirm =
                confirmPassword.value;


            // Hide previous messages
            resetSuccess.style.display = "none";
            resetError.style.display = "none";


            // Check password length
            if (password.length < 8) {

                resetError.textContent =
                    "Password must be at least 8 characters.";

                resetError.style.display = "block";

                return;
            }


            // Check passwords match
            if (password !== confirm) {

                resetError.textContent =
                    "Passwords do not match.";

                resetError.style.display = "block";

                return;
            }


            // Loading state
            updatePasswordBtn.disabled = true;
            updatePasswordBtn.textContent =
                "Updating...";


            try {

                const { error } =
                    await client.auth.updateUser({
                        password: password
                    });


                if (error) {

                    console.error(
                        "Password update error:",
                        error
                    );

                    resetError.textContent =
                        "Unable to update password. Please try again.";

                    resetError.style.display =
                        "block";

                    updatePasswordBtn.disabled = false;
                    updatePasswordBtn.textContent =
                        "Update Password";

                    return;
                }


                // Success
                resetSuccess.textContent =
                    "Password updated successfully!";

                resetSuccess.style.display =
                    "block";


                newPassword.value = "";
                confirmPassword.value = "";


                updatePasswordBtn.textContent =
                    "Password Updated";


                // Sign user out after password change
                await client.auth.signOut();


                // Return to login page
                setTimeout(() => {

                    window.location.href =
                        "admin-login.html";

                }, 2000);


            } catch (err) {

                console.error(
                    "Unexpected password reset error:",
                    err
                );

                resetError.textContent =
                    "Something went wrong. Please try again.";

                resetError.style.display =
                    "block";

                updatePasswordBtn.disabled = false;
                updatePasswordBtn.textContent =
                    "Update Password";
            }

        }
    );

}
