// =============================================================
//  candidate-dashboard.js
//  - Polling every 10 s for real-time status updates
//  - Polite rejection notifications (no score mention to candidate)
//  - auto-reject (score < 50 stored as "rejected") shows same as manual reject
// =============================================================


let dashboardApplications = [];
let currentFilter = "all";
let pollingInterval = null;


// =============================================================
//  HELPERS
// =============================================================
function getToken() {
    return localStorage.getItem("access_token");
}


function formatDate(value) {
    if (!value) return "Non précisée";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Non précisée";
    return date.toLocaleDateString("fr-FR");
}


function getJobTitle(application) {
    return application.job?.title || "Offre inconnue";
}


function getJobMeta(application) {
    const location = application.job?.location     || "Lieu non précisé";
    const contract = application.job?.contract_type || "Contrat non précisé";
    return `${location} · ${contract}`;
}


// ── STATUS INFO ────────────────────────────────────────────────
// Candidates never see AI score or rejection reason.
// Both auto-reject (score < 50, stored as "rejected") and manual
// reject display the same polite message.
function getStatusInfo(status, aiScore) {
    // Mirror the RH auto-reject logic: score exists and is below 50 → show as refused
    if (aiScore !== null && aiScore !== undefined && Number(aiScore) < 50) {
        return {
            label: "Refusée",
            badgeClass: "badge danger",
            textClass: "text-danger",
            notificationTitle: "Candidature refusée",
            notificationText: "Nous avons bien étudié votre candidature. Après examen, nous ne sommes malheureusement pas en mesure de donner suite à votre dossier. Nous vous souhaitons bonne continuation dans vos recherches."
        };
    }
    const map = {
        pending: {
            label: "En cours",
            badgeClass: "badge warning",
            textClass: "text-warning",
            notificationTitle: "Candidature en cours",
            notificationText: "Votre candidature est en cours de traitement. Nous vous tiendrons informé(e) de son évolution."
        },
        reviewed: {
            label: "Consultée",
            badgeClass: "badge",
            textClass: "text-primary",
            notificationTitle: "Dossier consulté",
            notificationText: "Votre dossier a été consulté par notre équipe RH."
        },
        accepted: {
            label: "Acceptée",
            badgeClass: "badge success",
            textClass: "text-success",
            notificationTitle: "Candidature acceptée",
            notificationText: "Félicitations ! Votre candidature a été acceptée. Notre équipe vous contactera prochainement."
        },
        rejected: {
            label: "Refusée",
            badgeClass: "badge danger",
            textClass: "text-danger",
            notificationTitle: "Candidature refusée",
            notificationText: "Nous avons bien étudié votre candidature. Après examen, nous ne sommes malheureusement pas en mesure de donner suite à votre dossier. Nous vous souhaitons bonne continuation dans vos recherches."
        }
    };
    return map[status] || map.pending;
}


function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}


function showToast(message, isError = false) {
    const toast = document.getElementById("toast");
    if (!toast) { alert(message); return; }
    toast.textContent = message;
    toast.className = isError
        ? "fixed bottom-6 right-6 bg-red-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-semibold z-50"
        : "fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-semibold z-50";
    setTimeout(function () { toast.classList.add("hidden"); }, 3000);
}


function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const icon    = document.querySelector("#toggleBtn span");
    if (!sidebar || !icon) return;
    sidebar.classList.toggle("collapsed");
    icon.textContent = sidebar.classList.contains("collapsed") ? "menu" : "menu_open";
}


function updateUrlForPage(page) {
    if (page === "applications") {
        window.history.replaceState({}, "", "/dashboard/?tab=applications");
    } else if (page === "notifications") {
        window.history.replaceState({}, "", "/dashboard/?tab=notifications");
    } else {
        window.history.replaceState({}, "", "/dashboard/");
    }
}


function showPage(page, updateUrl = true) {
    document.querySelectorAll(".page-section").forEach(function (section) {
        section.classList.remove("active");
    });
    const targetSection = document.getElementById("page-" + page);
    if (targetSection) targetSection.classList.add("active");


    document.querySelectorAll(".sidebar-link").forEach(function (link) {
        link.classList.remove("active");
    });
    const activeLink = document.querySelector(`.sidebar-link[data-page="${page}"]`);
    if (activeLink) activeLink.classList.add("active");


    if (updateUrl) updateUrlForPage(page);
}


function logoutUser(event) {
    event.preventDefault();
    stopPolling();
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_email");
    localStorage.removeItem("signupData");
    window.location.href = "/";
}


// =============================================================
//  POLLING
// =============================================================
function startPolling() {
    pollingInterval = setInterval(function () {
        silentReloadApplications();
    }, 10000);
}


function stopPolling() {
    if (pollingInterval !== null) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}


async function silentReloadApplications() {
    const token = getToken();
    if (!token) return;
    try {
        const response = await fetch("/api/my-applications/", {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`
            }
        });
        if (!response.ok) return;
        dashboardApplications = await response.json();
        renderAll();
    } catch (error) {
        console.warn("Polling error:", error);
    }
}


// =============================================================
//  LOAD DATA (initial)
// =============================================================
async function loadProfileSummary() {
    const token = getToken();
    if (!token) return;
    try {
        const response = await fetch("/api/profile/", {
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` }
        });
        if (!response.ok) return;
        const profile = await response.json();
        setText("sidebarName", profile.full_name || localStorage.getItem("user_email") || "Mon Espace");
        if (profile.profile_picture_url) {
            const avatar = document.getElementById("sidebarAvatar");
            if (avatar) {
                avatar.innerHTML = `<img src="${profile.profile_picture_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
            }
        }
    } catch (error) {
        console.error("Profile summary error:", error);
    }
}


async function loadApplications() {
    const token = getToken();
    if (!token) {
        window.location.href = "/connexion/?next=/dashboard/";
        return;
    }
    try {
        const response = await fetch("/api/my-applications/", {
            method: "GET",
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            window.location.href = "/connexion/?next=/dashboard/";
            return;
        }
        if (!response.ok) {
            showToast("Impossible de charger vos candidatures.", true);
            return;
        }
        dashboardApplications = await response.json();
        renderAll();
        startPolling();
    } catch (error) {
        console.error("Applications loading error:", error);
        showToast("Erreur de connexion au serveur.", true);
    }
}


// =============================================================
//  RENDER
// =============================================================
function renderAll() {
    renderStats();
    renderRecentApplications();
    renderApplicationsTable();
    renderNotifications();
}


function renderStats() {
    const total    = dashboardApplications.length;
    const pending  = dashboardApplications.filter(item => item.status === "pending").length;
    const reviewed = dashboardApplications.filter(item => item.status === "reviewed").length;
    const accepted = dashboardApplications.filter(item => item.status === "accepted").length;
    const rejected = dashboardApplications.filter(item => item.status === "rejected").length;


    setText("statTotal",    total);
    setText("statPending",  pending);
    setText("statReviewed", reviewed);
    setText("statAccepted", accepted);
    setText("statRejected", rejected);


    const dot = document.getElementById("notificationDot");
    if (dot && total > 0) dot.classList.remove("hidden");
}


function renderRecentApplications() {
    const container = document.getElementById("recentApplications");
    if (!container) return;
    const recent = dashboardApplications.slice(0, 3);
    if (!recent.length) {
        container.innerHTML = `
            <div class="text-sm text-text-muted">
                Aucune candidature pour le moment.
                <a href="/jobs/" class="text-primary font-bold hover:underline">Voir les offres</a>
            </div>`;
        return;
    }
    container.innerHTML = recent.map(function (application, index) {
        const status = getStatusInfo(application.status, application.ai_score);
        return `
            <div class="border border-border-light/60 rounded-xl p-4 cursor-pointer hover:bg-primary-light/20 transition" data-open-index="${index}">
                <div class="flex justify-between gap-4">
                    <div>
                        <h3 class="font-bold text-text-main">${getJobTitle(application)}</h3>
                        <p class="text-sm text-text-muted">${getJobMeta(application)} · ${formatDate(application.applied_date)}</p>
                    </div>
                    <span class="${status.badgeClass}">${status.label}</span>
                </div>
                <p class="text-xs text-text-muted mt-3">${status.notificationText}</p>
            </div>`;
    }).join("");
}


function renderApplicationsTable() {
    const tbody = document.getElementById("applicationsTableBody");
    if (!tbody) return;


    const filtered = currentFilter === "all"
        ? dashboardApplications
        : dashboardApplications.filter(item => {
            if (currentFilter === "rejected") {
                return item.status === "rejected" ||
                    (item.ai_score !== null && item.ai_score !== undefined && Number(item.ai_score) < 50);
            }
            return item.status === currentFilter;
        });


    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="py-6 text-center text-text-muted">Aucune candidature trouvée.</td>
            </tr>`;
        return;
    }


    tbody.innerHTML = filtered.map(function (application) {
        const originalIndex = dashboardApplications.findIndex(item => item.id === application.id);
        const status = getStatusInfo(application.status, application.ai_score);
        return `
            <tr class="application-row border-b border-border-light/40" data-open-index="${originalIndex}">
                <td class="py-4">
                    <p class="font-bold">${getJobTitle(application)}</p>
                    <p class="text-xs text-text-muted">${getJobMeta(application)}</p>
                </td>
                <td class="py-4 text-text-muted">${formatDate(application.applied_date)}</td>
                <td class="py-4"><span class="${status.badgeClass}">${status.label}</span></td>
                <td class="py-4 text-primary font-bold cursor-pointer">Détails</td>
            </tr>`;
    }).join("");
}


function renderNotifications() {
    const dashboardBox = document.getElementById("dashboardNotifications");
    const listBox      = document.getElementById("notificationsList");


    const notifications = dashboardApplications.slice(0, 5).map(function (application) {
        const status = getStatusInfo(application.status, application.ai_score);
        const isRejected = application.status === "rejected" ||
            (application.ai_score !== null && application.ai_score !== undefined && Number(application.ai_score) < 50);
        return {
            title:  status.notificationTitle,
            text:   `${getJobTitle(application)}`,
            detail: status.notificationText,
            date:   formatDate(application.applied_date),
            status: application.status,
            isRejected
        };
    });


    const html = notifications.length
        ? notifications.map(function (item) {
            const borderClass = item.status === "accepted"
                ? "border-success bg-green-50"
                : item.isRejected
                    ? "border-danger bg-red-50"
                    : item.status === "reviewed"
                        ? "border-primary bg-primary-light/20"
                        : "border-warning bg-yellow-50";
            return `
                <div class="border-l-4 ${borderClass} rounded-r-xl px-4 py-3">
                    <p class="font-bold text-text-main">${item.title}</p>
                    <p class="text-sm font-semibold text-text-muted">${item.text}</p>
                    <p class="text-sm text-text-muted mt-1">${item.detail}</p>
                    <p class="text-xs text-text-muted mt-1">${item.date}</p>
                </div>`;
        }).join("")
        : `<p class="text-sm text-text-muted">Aucune notification pour le moment.</p>`;


    if (dashboardBox) dashboardBox.innerHTML = html;
    if (listBox)      listBox.innerHTML      = html;
}


// =============================================================
//  FILTER
// =============================================================
function setFilter(status, button) {
    currentFilter = status;
    document.querySelectorAll("[data-filter]").forEach(function (filterButton) {
        filterButton.className = "outline-btn";
    });
    if (button) button.className = "save-btn";
    renderApplicationsTable();
}


// =============================================================
//  APPLICATION MODAL
// =============================================================
function buildTimeline(status) {
    const order         = ["pending", "reviewed", "accepted"];
    const rejectedOrder = ["pending", "reviewed", "rejected"];
    const timelineOrder = status === "rejected" ? rejectedOrder : order;
    const currentIndex  = timelineOrder.indexOf(status);


    return timelineOrder.map(function (step, index) {
        const info       = getStatusInfo(step);
        const state      = index < currentIndex ? "done" : index === currentIndex ? "active" : "";
        const dotClass   = state === "done" ? "timeline-dot done" : state === "active" ? "timeline-dot active" : "timeline-dot";
        const dotContent = state === "done" ? "✓" : state === "active" ? "●" : "";
        return `
            <div class="flex gap-4">
                <div class="${dotClass}">${dotContent}</div>
                <div>
                    <p class="font-bold text-text-main">${info.label}</p>
                    <p class="text-sm text-text-muted mt-1">${info.notificationText}</p>
                </div>
            </div>`;
    }).join("");
}


function openApplicationModal(index) {
    const application = dashboardApplications[index];
    if (!application) return;


    const isAutoReject = application.ai_score !== null &&
        application.ai_score !== undefined &&
        Number(application.ai_score) < 50;
    const effectiveStatus = isAutoReject ? "rejected" : application.status;


    const status = getStatusInfo(application.status, application.ai_score);
    setText("modalTitle",    getJobTitle(application));
    setText("modalSubtitle", getJobMeta(application));
    setText("modalDate",     formatDate(application.applied_date));
    setText("modalStatus",   status.label);


    const modalStatus = document.getElementById("modalStatus");
    if (modalStatus) modalStatus.className = "font-bold mt-1 " + status.textClass;


    const timeline = document.getElementById("modalTimeline");
    if (timeline) timeline.innerHTML = buildTimeline(effectiveStatus);


    const modal = document.getElementById("applicationModal");
    if (modal) modal.classList.add("open");
}


function closeApplicationModal() {
    const modal = document.getElementById("applicationModal");
    if (modal) modal.classList.remove("open");
}


// =============================================================
//  INIT
// =============================================================
document.addEventListener("DOMContentLoaded", function () {
    const toggleBtn          = document.getElementById("toggleBtn");
    const logoutLink         = document.getElementById("logoutLink");
    const modal              = document.getElementById("applicationModal");
    const closeModalBtn      = document.getElementById("closeModalBtn");
    const notificationTopBtn = document.getElementById("notificationTopBtn");


    if (toggleBtn)          toggleBtn.addEventListener("click", toggleSidebar);
    if (logoutLink)         logoutLink.addEventListener("click", logoutUser);
    if (notificationTopBtn) notificationTopBtn.addEventListener("click", function () { showPage("notifications"); });


    document.querySelectorAll(".sidebar-link[data-page]").forEach(function (link) {
        link.addEventListener("click", function (event) {
            event.preventDefault();
            showPage(link.dataset.page);
        });
    });


    document.querySelectorAll("[data-page-target]").forEach(function (button) {
        button.addEventListener("click", function () { showPage(button.dataset.pageTarget); });
    });


    document.querySelectorAll("[data-filter]").forEach(function (button) {
        button.addEventListener("click", function () { setFilter(button.dataset.filter, button); });
    });


    document.addEventListener("click", function (event) {
        const target = event.target.closest("[data-open-index]");
        if (target) openApplicationModal(Number(target.dataset.openIndex));
    });


    if (modal) {
        modal.addEventListener("click", function (event) {
            if (event.target === modal) closeApplicationModal();
        });
    }


    if (closeModalBtn) closeModalBtn.addEventListener("click", closeApplicationModal);


    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeApplicationModal();
    });


    window.addEventListener("beforeunload", stopPolling);


    const params = new URLSearchParams(window.location.search);
    const tab    = params.get("tab");
    if      (tab === "applications")  showPage("applications",  false);
    else if (tab === "notifications") showPage("notifications", false);
    else                              showPage("dashboard",     false);


    loadProfileSummary();
    loadApplications();
});

