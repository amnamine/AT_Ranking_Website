function getToken() {
    return localStorage.getItem("access_token");
}

function getElementValue(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : "";
}

function setElementValue(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.value = value || "";
    }
}

function showToast(message, isError = false) {
    const toast = document.getElementById("toast");

    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;
    toast.classList.remove("hidden");

    toast.className = isError
        ? "fixed bottom-6 right-6 bg-red-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold z-50"
        : "fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-semibold z-50";

    setTimeout(function () {
        toast.classList.add("hidden");
    }, 3000);
}

function splitFullName(fullName) {
    if (!fullName) {
        return {
            prenom: "",
            nom: ""
        };
    }

    const parts = fullName.trim().split(/\s+/);

    if (parts.length === 1) {
        return {
            prenom: parts[0],
            nom: ""
        };
    }

    return {
        prenom: parts[0],
        nom: parts.slice(1).join(" ")
    };
}

function updateDisplayName() {
    const prenom = getElementValue("prenom");
    const nom = getElementValue("nom");
    const email = getElementValue("email");

    const fullName = `${prenom} ${nom}`.trim();

    const displayName = document.getElementById("displayName");
    const displayEmail = document.getElementById("displayEmail");
    const sidebarName = document.getElementById("sidebarName");

    if (displayName) {
        displayName.textContent = fullName || "Mon Profil";
    }

    if (displayEmail) {
        displayEmail.textContent = email || localStorage.getItem("user_email") || "";
    }

    if (sidebarName) {
        sidebarName.textContent = fullName || "Mon Espace";
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
    localStorage.removeItem("signupData");

    window.location.href = "/";
}

function showCVName(input) {
    const cvName = document.getElementById("cvName");

    if (cvName && input.files && input.files[0]) {
        cvName.textContent = "✔ " + input.files[0].name;
    }
}

function previewPhoto(input) {
    if (!input.files || !input.files[0]) {
        return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
        document.querySelectorAll(".avatar-circle").forEach(function (element) {
            element.innerHTML = `<img src="${event.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        });
    };

    reader.readAsDataURL(input.files[0]);
}

async function loadProfile() {
    const token = getToken();

    if (!token) {
        window.location.href = "/connexion/?next=/profile/";
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
            window.location.href = "/connexion/?next=/profile/";
            return;
        }

        if (!response.ok) {
            showToast("Impossible de charger le profil.", true);
            return;
        }

        const profile = await response.json();
        const names = splitFullName(profile.full_name);

        setElementValue("prenom", names.prenom);
        setElementValue("nom", names.nom);
        setElementValue("email", profile.email || localStorage.getItem("user_email") || "");
        setElementValue("telephone", profile.phone || "");

        if (profile.email) {
            localStorage.setItem("user_email", profile.email);
        }

        if (profile.cv_file_url) {
            const cvName = document.getElementById("cvName");

            if (cvName) {
                cvName.innerHTML = `<a href="${profile.cv_file_url}" target="_blank" class="text-primary font-semibold hover:underline">CV actuel</a>`;
            }
        }

        if (profile.profile_picture_url) {
            document.querySelectorAll(".avatar-circle").forEach(function (element) {
                element.innerHTML = `<img src="${profile.profile_picture_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
            });
        }

        updateDisplayName();
    } catch (error) {
        console.error("Profile loading error:", error);
        showToast("Erreur de connexion au serveur.", true);
    }
}

async function saveProfile() {
    const token = getToken();

    if (!token) {
        window.location.href = "/connexion/?next=/profile/";
        return;
    }

    const prenom = getElementValue("prenom");
    const nom = getElementValue("nom");
    const phone = getElementValue("telephone");

    const fullName = `${prenom} ${nom}`.trim();

    if (!fullName) {
        showToast("Veuillez entrer votre nom complet.", true);
        return;
    }

    const formData = new FormData();

    formData.append("full_name", fullName);
    formData.append("phone", phone);

    const cvInput = document.getElementById("cvInput");
    const photoInput = document.getElementById("photoInput");

    if (cvInput && cvInput.files && cvInput.files[0]) {
        formData.append("cv_file", cvInput.files[0]);
    }

    if (photoInput && photoInput.files && photoInput.files[0]) {
        formData.append("profile_picture", photoInput.files[0]);
    }

    const saveButton = document.getElementById("saveProfileBtn");
    const originalText = saveButton ? saveButton.textContent : "";

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Enregistrement...";
    }

    try {
        const response = await fetch("/api/profile/update/", {
            method: "PUT",
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
            window.location.href = "/connexion/?next=/profile/";
            return;
        }

        if (!response.ok) {
            const errorMessage =
                data.full_name?.[0] ||
                data.phone?.[0] ||
                data.cv_file?.[0] ||
                data.profile_picture?.[0] ||
                data.detail ||
                data.error ||
                "Impossible d'enregistrer le profil.";

            showToast(errorMessage, true);
            return;
        }

        showToast("Profil enregistré avec succès !", false);
        await loadProfile();
    } catch (error) {
        console.error("Profile saving error:", error);
        showToast("Erreur de connexion au serveur.", true);
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = originalText || "Enregistrer le profil";
        }
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const toggleBtn = document.getElementById("toggleBtn");
    const saveProfileBtn = document.getElementById("saveProfileBtn");
    const cvInput = document.getElementById("cvInput");
    const photoInput = document.getElementById("photoInput");
    const logoutLink = document.getElementById("logoutLink");

    if (toggleBtn) {
        toggleBtn.addEventListener("click", toggleSidebar);
    }

    if (saveProfileBtn) {
        saveProfileBtn.addEventListener("click", saveProfile);
    }

    if (cvInput) {
        cvInput.addEventListener("change", function () {
            showCVName(this);
        });
    }

    if (photoInput) {
        photoInput.addEventListener("change", function () {
            previewPhoto(this);
        });
    }

    if (logoutLink) {
        logoutLink.addEventListener("click", logoutUser);
    }

    loadProfile();
});