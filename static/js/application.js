function getToken() {
    return localStorage.getItem("access_token");
}

function getJobId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("job_id");
}

function setInputValue(id, value) {
    const input = document.getElementById(id);

    if (input) {
        input.value = value || "";
    }
}

function getInputValue(id) {
    const input = document.getElementById(id);
    return input ? input.value.trim() : "";
}

function showApplicationAlert(message, isError = true) {
    const alertBox = document.getElementById("applicationAlert");

    if (!alertBox) {
        alert(message);
        return;
    }

    alertBox.textContent = message;
    alertBox.classList.remove("hidden");

    if (isError) {
        alertBox.className = "mb-6 p-4 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700";
    } else {
        alertBox.className = "mb-6 p-4 rounded-lg text-sm bg-green-50 border border-green-200 text-green-700";
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const icon = document.querySelector("#toggleBtn span");

    if (!sidebar || !icon) {
        return;
    }

    sidebar.classList.toggle("collapsed");
    icon.textContent = sidebar.classList.contains("collapsed") ? "menu" : "menu_open";
}

function logoutUser(event) {
    event.preventDefault();

    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_email");
    localStorage.removeItem("user_phone");
    localStorage.removeItem("user_full_name");
    localStorage.removeItem("signupData");

    window.location.href = "/";
}

async function loadProfileIntoApplication() {
    const token = getToken();

    if (!token) {
        const jobId = getJobId();
        const nextUrl = jobId ? `/apply/?job_id=${encodeURIComponent(jobId)}` : "/apply/";
        window.location.href = `/connexion/?next=${encodeURIComponent(nextUrl)}`;
        return;
    }

    try {
        const response = await fetch("/api/profile/", {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");

            const jobId = getJobId();
            const nextUrl = jobId ? `/apply/?job_id=${encodeURIComponent(jobId)}` : "/apply/";
            window.location.href = `/connexion/?next=${encodeURIComponent(nextUrl)}`;
            return;
        }

        if (!response.ok) {
            return;
        }

        const profile = await response.json();

        const signupData = JSON.parse(localStorage.getItem("signupData") || "{}");

        const fullName =
            profile.full_name ||
            localStorage.getItem("user_full_name") ||
            signupData.full_name ||
            `${signupData.prenom || ""} ${signupData.nom || ""}`.trim();

        const phone =
            profile.phone ||
            localStorage.getItem("user_phone") ||
            signupData.telephone ||
            "";

        setInputValue("full_name", fullName);
        setInputValue("phone", phone);
    } catch (error) {
        console.error("Profile auto-fill error:", error);
    }
}

async function loadJobTitle() {
    const jobId = getJobId();
    const titleText = document.getElementById("jobTitleText");

    if (!jobId) {
        if (titleText) {
            titleText.textContent = "Aucune offre n'a été sélectionnée.";
        }
        return;
    }

    try {
        const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/`, {
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            return;
        }

        const job = await response.json();

        if (titleText && job.title) {
            titleText.textContent = `Vous postulez pour : ${job.title}`;
        }
    } catch (error) {
        console.error("Job loading error:", error);
    }
}

async function submitApplication(event) {
    event.preventDefault();

    const token = getToken();
    const jobId = getJobId();

    if (!token) {
        const nextUrl = jobId ? `/apply/?job_id=${encodeURIComponent(jobId)}` : "/apply/";
        window.location.href = `/connexion/?next=${encodeURIComponent(nextUrl)}`;
        return;
    }

    if (!jobId) {
        showApplicationAlert("Aucune offre n'a été sélectionnée.", true);
        return;
    }

    const fullName = getInputValue("full_name");
    const phone = getInputValue("phone");

    if (!fullName || !phone) {
        showApplicationAlert("Veuillez entrer votre nom complet et votre téléphone.", true);
        return;
    }

    const formData = new FormData();

    formData.append("full_name", fullName);
    formData.append("phone", phone);

    const messageInput = document.getElementById("message");
    const cvInput = document.getElementById("cv_file");

    if (messageInput && messageInput.value.trim()) {
        formData.append("message", messageInput.value.trim());
    }

    if (cvInput && cvInput.files && cvInput.files[0]) {
        formData.append("cv_file", cvInput.files[0]);
    }

    const submitButton = document.getElementById("submitApplicationBtn");
    const originalText = submitButton ? submitButton.textContent : "";

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Envoi...";
    }

    try {
        const response = await fetch(`/api/apply/${encodeURIComponent(jobId)}/`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`
            },
            body: formData
        });

        const data = await response.json().catch(function () {
            return {};
        });

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");

            const nextUrl = `/apply/?job_id=${encodeURIComponent(jobId)}`;
            window.location.href = `/connexion/?next=${encodeURIComponent(nextUrl)}`;
            return;
        }

        if (!response.ok) {
            const errorMessage =
                data.error ||
                data.detail ||
                data.full_name?.[0] ||
                data.phone?.[0] ||
                data.cv_file?.[0] ||
                data.message?.[0] ||
                "Erreur lors de l'envoi de la candidature.";

            showApplicationAlert(errorMessage, true);
            return;
        }

        const successMsg = document.getElementById("successMsg");

        if (successMsg) {
            successMsg.classList.remove("hidden");
        }

        showApplicationAlert("Candidature envoyée avec succès.", false);

        setTimeout(function () {
            window.location.href = "/dashboard/?tab=applications";
        }, 900);
    } catch (error) {
        console.error("Application submit error:", error);
        showApplicationAlert("Erreur de connexion au serveur.", true);
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalText || "Envoyer la candidature";
        }
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const toggleBtn = document.getElementById("toggleBtn");
    const logoutLink = document.getElementById("logoutLink");
    const applicationForm = document.getElementById("applicationForm");

    if (toggleBtn) {
        toggleBtn.addEventListener("click", toggleSidebar);
    }

    if (logoutLink) {
        logoutLink.addEventListener("click", logoutUser);
    }

    if (applicationForm) {
        applicationForm.addEventListener("submit", submitApplication);
    }

    loadJobTitle();
    loadProfileIntoApplication();
});