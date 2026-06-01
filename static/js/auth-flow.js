function getNextUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("next");
}

function buildUrlWithNext(baseUrl) {
    const nextUrl = getNextUrl();

    if (!nextUrl) {
        return baseUrl;
    }

    return `${baseUrl}?next=${encodeURIComponent(nextUrl)}`;
}

function redirectAfterAuth(defaultUrl) {
    const nextUrl = getNextUrl();

    if (nextUrl) {
        window.location.href = nextUrl;
        return;
    }

    window.location.href = defaultUrl;
}

function saveAuthData(data) {
    if (data.tokens && data.tokens.access) {
        localStorage.setItem("access_token", data.tokens.access);
    }

    if (data.tokens && data.tokens.refresh) {
        localStorage.setItem("refresh_token", data.tokens.refresh);
    }

    if (data.user) {
        localStorage.setItem("user_data", JSON.stringify(data.user));
    }

    if (data.user && data.user.role) {
        localStorage.setItem("user_role", data.user.role);
    }

    if (data.user && data.user.email) {
        localStorage.setItem("user_email", data.user.email);
    }
}

function clearAuthData() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_data");
    localStorage.removeItem("signupData");
    localStorage.removeItem("profilData");
}

function showAuthMessage(message, isError = true) {
    const messageBox =
        document.getElementById("authMessage") ||
        document.getElementById("auth-message") ||
        document.getElementById("messageBox") ||
        document.getElementById("authError");

    if (!messageBox) {
        alert(message);
        return;
    }

    messageBox.textContent = message;
    messageBox.classList.remove("hidden");

    if (isError) {
        messageBox.className = "mt-4 p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700";
    } else {
        messageBox.className = "mt-4 p-3 rounded-lg text-sm bg-green-50 border border-green-200 text-green-700";
    }
}

function getInputValue(form, names) {
    for (const name of names) {
        const input =
            form.querySelector(`[name="${name}"]`) ||
            form.querySelector(`#${name}`);

        if (input && input.value !== undefined) {
            return input.value.trim();
        }
    }

    return "";
}

function findLoginForm() {
    return (
        document.getElementById("loginForm") ||
        document.getElementById("login-form") ||
        document.getElementById("connexionForm") ||
        document.getElementById("connexion-form") ||
        document.getElementById("signinForm") ||
        document.getElementById("signin-form")
    );
}

function findRegisterForm() {
    return (
        document.getElementById("registerForm") ||
        document.getElementById("register-form") ||
        document.getElementById("signupForm") ||
        document.getElementById("signup-form")
    );
}

async function loginUser(email, password) {
    const response = await fetch("/api/login/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            email: email,
            password: password,
        }),
    });

    const data = await response.json().catch(function () {
        return {};
    });

    if (!response.ok) {
        throw new Error(data.error || data.detail || "Email ou mot de passe incorrect.");
    }

    saveAuthData(data);
    return data;
}

async function registerUser(payload) {
    const response = await fetch("/api/register/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json().catch(function () {
        return {};
    });

    if (!response.ok) {
        const firstError =
            data.email?.[0] ||
            data.password?.[0] ||
            data.role?.[0] ||
            data.phone?.[0] ||
            data.full_name?.[0] ||
            data.error ||
            data.detail ||
            "Inscription impossible. Vérifiez les informations.";

        throw new Error(firstError);
    }

    saveAuthData(data);
    return data;
}

function setupConnexionChoiceLinks() {
    const signinLink = document.getElementById("signinLink");
    const signupLink = document.getElementById("signupLink");
    const signupLinkFromSignin = document.getElementById("signupLinkFromSignin");

    if (signinLink) {
        signinLink.href = buildUrlWithNext("/signin/");
    }

    if (signupLink) {
        signupLink.href = buildUrlWithNext("/signup/");
    }

    if (signupLinkFromSignin) {
        signupLinkFromSignin.href = buildUrlWithNext("/signup/");
    }
}

function setupLoginForm() {
    const loginForm = findLoginForm();

    if (!loginForm) {
        return;
    }

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = getInputValue(loginForm, ["email"]);
        const password = getInputValue(loginForm, ["password", "mot_de_passe"]);

        if (!email || !password) {
            showAuthMessage("Veuillez entrer votre email et votre mot de passe.");
            return;
        }

        const submitButton = loginForm.querySelector('button[type="submit"]');
        const originalText = submitButton ? submitButton.textContent : "";

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Connexion...";
        }

        try {
            const data = await loginUser(email, password);

            showAuthMessage("Connexion réussie.", false);

            setTimeout(function () {
                if (data.user && data.user.role === "rh") {
                    window.location.href = "/rh/";
                    return;
                }

                redirectAfterAuth("/jobs/");
            }, 500);
        } catch (error) {
            showAuthMessage(error.message);
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalText || "Se connecter";
            }
        }
    });
}

function setupRegisterForm() {
    const registerForm = findRegisterForm();

    if (!registerForm) {
        return;
    }

    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const firstName = getInputValue(registerForm, ["first_name", "prenom"]);
        const lastName = getInputValue(registerForm, ["last_name", "nom"]);
        const email = getInputValue(registerForm, ["email"]);
        const phone = getInputValue(registerForm, ["phone", "telephone", "tel"]);
        const password = getInputValue(registerForm, ["password", "mot_de_passe"]);
        const confirmPassword = getInputValue(registerForm, ["confirm_password", "password_confirm"]);
        const role = getInputValue(registerForm, ["role"]) || "candidate";

        const explicitFullName = getInputValue(registerForm, ["full_name", "nom_complet", "name"]);
        const fullName = explicitFullName || `${firstName} ${lastName}`.trim();

        if (!email || !password) {
            showAuthMessage("Veuillez entrer un email et un mot de passe.");
            return;
        }

        if (confirmPassword && password !== confirmPassword) {
            showAuthMessage("Les mots de passe ne correspondent pas.");
            return;
        }

        const payload = {
            email: email,
            password: password,
            role: role,
        };

        if (phone) {
            payload.phone = phone;
        }

        if (fullName) {
            payload.full_name = fullName;
        }

        const submitButton = registerForm.querySelector('button[type="submit"]');
        const originalText = submitButton ? submitButton.textContent : "";

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Création...";
        }

        try {
            await registerUser(payload);

            localStorage.setItem("signupData", JSON.stringify({
                prenom: firstName,
                nom: lastName,
                email: email,
                telephone: phone,
                full_name: fullName,
            }));

            showAuthMessage("Compte créé avec succès.", false);

            setTimeout(function () {
                redirectAfterAuth("/jobs/");
            }, 500);
        } catch (error) {
            showAuthMessage(error.message);
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalText || "Créer un compte";
            }
        }
    });
}

function setupLogoutLinks() {
    const logoutLinks = document.querySelectorAll("[data-logout], #logoutLink, .logout-link");

    logoutLinks.forEach(function (link) {
        link.addEventListener("click", function (event) {
            event.preventDefault();
            clearAuthData();
            window.location.href = "/";
        });
    });
}

document.addEventListener("DOMContentLoaded", function () {
    setupConnexionChoiceLinks();
    setupLoginForm();
    setupRegisterForm();
    setupLogoutLinks();
});