/* =========================================================
   SUBTRACK AUTHENTICATION
========================================================= */

async function getCurrentUser() {
    const { data, error } = await supabaseClient.auth.getUser();

    if (error) {
        console.error("Auth error:", error.message);
        return null;
    }

    return data.user;
}

function showMessage(element, message, type = "info") {
    if (!element) return;
    element.textContent = message;
    element.className = "auth-message " + type;
}

async function protectAppPage() {
    const user = await getCurrentUser();

    if (!user) {
        window.location.href = "login.html";
        return null;
    }

    const emailElement = document.getElementById("userEmail");
    if (emailElement) {
        emailElement.textContent = user.email || "Logged in";
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async function () {
            const { error } = await supabaseClient.auth.signOut();

            if (error) {
                alert("Logout failed: " + error.message);
                return;
            }

            window.location.href = "login.html";
        });
    }

    return user;
}

/* Login */
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        const message = document.getElementById("loginMessage");
        const button = loginForm.querySelector("button[type='submit']");

        if (!email || !password) {
            showMessage(message, "Please enter your email and password.", "error");
            return;
        }

        button.disabled = true;
        button.textContent = "Signing in...";

        const { error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        button.disabled = false;
        button.textContent = "Login";

        if (error) {
            showMessage(message, error.message, "error");
            return;
        }

        showMessage(message, "Login successful. Opening dashboard...", "success");

        setTimeout(function () {
            window.location.href = "index.html";
        }, 500);
    });
}

/* Signup */
const signupForm = document.getElementById("signupForm");

if (signupForm) {
    signupForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("signupEmail").value.trim();
        const password = document.getElementById("signupPassword").value;
        const confirmPassword =
            document.getElementById("signupConfirmPassword").value;

        const message = document.getElementById("signupMessage");
        const button = signupForm.querySelector("button[type='submit']");

        if (!email || !password || !confirmPassword) {
            showMessage(message, "Please fill all fields.", "error");
            return;
        }

        if (password.length < 6) {
            showMessage(message, "Password must contain at least 6 characters.", "error");
            return;
        }

        if (password !== confirmPassword) {
            showMessage(message, "Passwords do not match.", "error");
            return;
        }

        button.disabled = true;
        button.textContent = "Creating account...";

        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password
        });

        button.disabled = false;
        button.textContent = "Create Account";

        if (error) {
            showMessage(message, error.message, "error");
            return;
        }

        if (data.session) {
            showMessage(message, "Account created. Opening dashboard...", "success");

            setTimeout(function () {
                window.location.href = "index.html";
            }, 500);
        } else {
            showMessage(
                message,
                "Account created. Check your email and confirm your account before logging in.",
                "success"
            );
        }
    });
}

/* Protect all normal application pages */
const currentPath = window.location.pathname
    .replace(/\/+$/, "")
    .replace(/\.html$/, "");

const isAuthPage =
    currentPath.endsWith("/login") ||
    currentPath.endsWith("/signup") ||
    currentPath === "login" ||
    currentPath === "signup";

if (!isAuthPage) {
    protectAppPage();
}

/* If already logged in, don't show login/signup again. */
if (isAuthPage) {
    getCurrentUser().then(function (user) {
        if (user) {
            window.location.href = "index.html";
        }
    });
}
