// =============================================================
//  rh-dashboard.js  v15
//  - Auto-reject display (ai_score < 50 → badge + disabled dropdown)
//  - Single rejection display — no duplicate badge/dropdown conflict
//  - Message (lettre de motivation) shown in Voir Détails modal
//  - Full lock after manual rejection (no status change, no accept, no test)
// =============================================================


let allApplications = [];
let allJobs = [];
let allTests = [];
let selectedJobId = null;
let pendingDeleteJobId = null;
let chartOffresParMois = null;
let chartRepartitionDomaine = null;
let joChartStatus = null;
let joChartScores = null;


let currentSort = { field: "ai", order: "desc" };


document.addEventListener("DOMContentLoaded", function () {
    const token = localStorage.getItem("access_token");
    const role  = localStorage.getItem("user_role");
    const email = localStorage.getItem("user_email");


    if (!token) {
        alert("Veuillez vous connecter en tant que RH.");
        window.location.href = "/signin/";
        return;
    }
    if (String(role || "").toLowerCase() !== "rh") {
        alert("Accès réservé au service RH.");
        window.location.href = "/jobs/";
        return;
    }


    const sidebarEmail = document.getElementById("sidebarEmail");
    if (sidebarEmail && email) sidebarEmail.textContent = email;


    setupNavigation();
    setupLogout();
    setupSidebarToggle();
    setupDynamicJobLines();
    setupCreateJobForm();
    setupCreateTestForm();
    setupJobOffersFilters();
    setupCandidateFilters();
    setupCandidateSorting();


    loadStats(token);
    loadApplications(token);
    loadAllJobs(token);
    loadCategories();
    loadTests(token);
});


// =============================================================
//  NAVIGATION
// =============================================================
function setupNavigation() {
    document.querySelectorAll("[data-page]").forEach(btn => {
        btn.addEventListener("click", () => showPage(btn.dataset.page));
    });
    document.querySelectorAll("[data-page-target]").forEach(btn => {
        btn.addEventListener("click", () => showPage(btn.dataset.pageTarget));
    });
}


function showPage(pageName) {
    document.querySelectorAll(".page-section").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));
    const page = document.getElementById("page-" + pageName);
    if (page) page.classList.add("active");
    const link = document.querySelector(`[data-page="${pageName}"]`);
    if (link) link.classList.add("active");
    if (pageName === "dashboard") {
        setTimeout(() => {
            if (chartOffresParMois) chartOffresParMois.resize();
            if (chartRepartitionDomaine) chartRepartitionDomaine.resize();
        }, 50);
    }
    if (pageName === "job-offers" && allApplications.length) {
        renderJobOfferAnalytics();
    }
}


// =============================================================
//  LOGOUT / SIDEBAR
// =============================================================
function setupLogout() {
    const link = document.getElementById("logoutLink");
    if (link) link.addEventListener("click", (e) => {
        e.preventDefault();
        ["access_token","refresh_token","user_role","user_email","user_data","signupData","profilData"]
            .forEach(k => localStorage.removeItem(k));
        window.location.href = "/";
    });
}


function setupSidebarToggle() {
    const btn = document.getElementById("toggleBtn");
    const side = document.getElementById("sidebar");
    if (btn && side) btn.addEventListener("click", () => side.classList.toggle("collapsed"));
}


// =============================================================
//  MODALS
// =============================================================
function openModal(id)  { document.getElementById(id)?.classList.add("open"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }
function handleModalOverlayClick(event, id) { if (event.target.id === id) closeModal(id); }


// =============================================================
//  JOB DETAILS MODAL
// =============================================================
function openJobDetailsModal(jobData) {
    let job = typeof jobData === "string" ? JSON.parse(jobData) : jobData;
    openModal("jobDetailsModal");
    document.getElementById("jobModalTitle").textContent = job.title || "Offre";
    document.getElementById("jobModalCategory").textContent = job.category_name || getCategoryName(job) || "Non catégorisé";
    document.getElementById("jobModalContract").textContent = job.contract_type || "Non précisé";
    document.getElementById("jobModalLocation").textContent = job.location || "Non précisé";
    document.getElementById("jobModalDescription").textContent = job.description || "Aucune description.";


    const missionsDiv = document.getElementById("jobModalMissions");
    missionsDiv.innerHTML = "";
    if (job.missions && job.missions.length) {
        job.missions.forEach(m => {
            missionsDiv.innerHTML += `<div class="job-modal-item"><span class="material-symbols-outlined job-modal-icon">task_alt</span><div class="job-modal-text">${escapeHtml(m.text || m)}</div></div>`;
        });
    } else {
        missionsDiv.innerHTML = "<p class='text-sm text-text-muted'>Aucune mission disponible.</p>";
    }


    const profilesDiv = document.getElementById("jobModalProfiles");
    profilesDiv.innerHTML = "";
    if (job.searched_profiles && job.searched_profiles.length) {
        job.searched_profiles.forEach(p => {
            profilesDiv.innerHTML += `<div class="job-modal-item"><span class="material-symbols-outlined job-modal-icon">person</span><div class="job-modal-text">${escapeHtml(p.text || p)}</div></div>`;
        });
    } else {
        profilesDiv.innerHTML = "<p class='text-sm text-text-muted'>Aucun profil recherché.</p>";
    }
}


function openCreateOfferModal() {
    document.getElementById("createJobForm").reset();
    resetDynamicJobLines();
    document.getElementById("testLinkedPreview").classList.add("hidden");
    pendingTestData = null;
    openModal("modalCreateOffer");
}


function openCreateTestFromOffer() {
    document.getElementById("createTestForm").reset();
    resetQuestions();
    populateTestJobSelect();
    const sel = document.getElementById("testJob");
    if (sel) {
        sel.innerHTML = `<option value="__pending__">Sera liée à la nouvelle offre</option>`;
        sel.disabled = true;
        sel.dataset.pendingFromOffer = "true";
    }
    openModal("modalCreateTest");
}


function openCreateTestModal() {
    document.getElementById("createTestForm").reset();
    resetQuestions();
    populateTestJobSelect();
    const sel = document.getElementById("testJob");
    if (sel) {
        sel.disabled = false;
        delete sel.dataset.pendingFromOffer;
    }
    openModal("modalCreateTest");
}


// =============================================================
//  API
// =============================================================
async function apiGet(url, token = null) {
    const headers = { Accept: "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("Erreur API: " + res.status);
    return res.json();
}


// =============================================================
//  LOAD DATA
// =============================================================
async function loadStats(token) {
    try {
        const stats = await apiGet("/api/stats/", token);
        setText("kpiTotalJobs", stats.total_jobs ?? 0);
        setText("kpiOpenJobs", stats.active_jobs ?? 0);
        setText("kpiClosedJobs", (stats.total_jobs ?? 0) - (stats.active_jobs ?? 0));
    } catch(e) { console.error(e); }
}


async function loadApplications(token) {
    try {
        allApplications = await apiGet("/api/applications/", token);
        if (!Array.isArray(allApplications)) allApplications = [];
        renderRecentApplications();
        renderJobOfferAnalytics();
        if (selectedJobId) renderCandidatesForJob();
    } catch(e) {
        console.error(e);
        showMessage("Impossible de charger les candidatures.", true);
    }
}


async function loadAllJobs(token) {
    try {
        allJobs = await apiGet("/api/jobs/", token);
        if (!Array.isArray(allJobs)) allJobs = [];
        renderDashboardCharts();
        renderJobOffersList();
        renderOtOffersTable();
        populateTestJobSelect();
        populateJobDomainFilter();
    } catch(e) { console.error(e); }
}


async function loadTests(token) {
    try {
        allTests = await apiGet("/api/tests/", token);
        if (!Array.isArray(allTests)) allTests = [];
        renderOtTestsTable();
    } catch(e) { console.error(e); }
}


async function loadCategories() {
    const sel = document.getElementById("jobCategory");
    if (!sel) return;
    sel.innerHTML = `<option value="">Chargement...</option>`;
    try {
        let cats = await apiGet("/api/categories/");
        if (cats && Array.isArray(cats.results))    cats = cats.results;
        if (cats && Array.isArray(cats.categories)) cats = cats.categories;
        if (!Array.isArray(cats) || !cats.length) {
            sel.innerHTML = `<option value="">Aucune catégorie</option>`;
            return;
        }
        sel.innerHTML = `<option value="">Choisir une catégorie</option>`;
        cats.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.name || c.title || "Catégorie " + c.id;
            sel.appendChild(opt);
        });
    } catch(e) {
        console.error(e);
        sel.innerHTML = `<option value="">Erreur</option>`;
    }
}


// =============================================================
//  DASHBOARD CHARTS
// =============================================================
function renderDashboardCharts() {
    renderBarChartOffresParMois();
    renderDonutRepartitionDomaine();
}


function renderBarChartOffresParMois() {
    const ctx = document.getElementById("chartOffresParMois");
    if (!ctx) return;
    const counts = {};
    allJobs.forEach(job => {
        const raw = job.date_posted || job.created_at;
        if (!raw) return;
        const d = new Date(raw);
        if (isNaN(d.getTime())) return;
        const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
        counts[key] = (counts[key] || 0) + 1;
    });
    const sorted = Object.keys(counts).sort();
    const last12 = sorted.slice(-12);
    const labels = last12.map(k => {
        const [y, m] = k.split("-");
        return new Date(Number(y), Number(m)-1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    });
    const data = last12.map(k => counts[k]);
    if (chartOffresParMois) chartOffresParMois.destroy();
    chartOffresParMois = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels.length ? labels : ["Aucune donnée"],
            datasets: [{
                label: "Offres publiées",
                data: data.length ? data : [0],
                backgroundColor: "rgba(0,95,172,0.75)",
                borderColor: "#005fac",
                borderWidth: 1.5,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: "rgba(0,0,0,0.05)" } },
                x: { grid: { display: false } }
            }
        }
    });
}


function renderDonutRepartitionDomaine() {
    const ctx = document.getElementById("chartRepartitionDomaine");
    if (!ctx) return;
    const counts = {};
    allJobs.forEach(job => {
        const domain = job.category_name || getCategoryName(job) || "Autre";
        counts[domain] = (counts[domain] || 0) + 1;
    });
    const labels = Object.keys(counts);
    const data = labels.map(k => counts[k]);
    const palette = ["#005fac","#006d38","#d97706","#c0392b","#7c3aed","#0891b2","#be185d","#374151","#15803d","#b45309"];
    if (chartRepartitionDomaine) chartRepartitionDomaine.destroy();
    chartRepartitionDomaine = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: labels.length ? labels : ["Aucune donnée"],
            datasets: [{
                data: data.length ? data : [1],
                backgroundColor: labels.length ? labels.map((_,i) => palette[i % palette.length]) : ["#e6e8eb"],
                borderWidth: 2,
                borderColor: "#fff"
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: "bottom", labels: { font: { size: 11 } } } },
            cutout: "60%"
        }
    });
}


function renderRecentApplications() {
    const container = document.getElementById("recentApplications");
    if (!container) return;
    const recent = allApplications.slice(0, 5);
    if (!recent.length) {
        container.innerHTML = "<p class='text-sm text-text-muted'>Aucune candidature récente.</p>";
        return;
    }
    container.innerHTML = recent.map(app =>
        `<div class="border border-border-light/40 rounded-xl p-4">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <p class="font-bold text-sm">${escapeHtml(getCandidateName(app))}</p>
                    <p class="text-xs text-text-muted">${escapeHtml(getJobTitle(app))}</p>
                </div>
                ${statusBadge(app.status, getAiScore(app))}
            </div>
        </div>`
    ).join("");
}


// =============================================================
//  JOB OFFERS FILTERS & LIST
// =============================================================
function setupJobOffersFilters() {
    ["joFilterSearch","joFilterStatus","joFilterDomain"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input",  renderJobOffersList);
            el.addEventListener("change", renderJobOffersList);
        }
    });
}


function populateJobDomainFilter() {
    const sel = document.getElementById("joFilterDomain");
    if (!sel) return;
    const domains = [...new Set(allJobs.map(j => j.category_name || getCategoryName(j) || "").filter(Boolean))].sort();
    const current = sel.value;
    sel.innerHTML = `<option value="">Tous les domaines</option>`;
    domains.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        if (d === current) opt.selected = true;
        sel.appendChild(opt);
    });
}


function renderJobOffersList() {
    const container = document.getElementById("joOffersList");
    if (!container) return;
    const search = String(document.getElementById("joFilterSearch")?.value || "").toLowerCase();
    const status = String(document.getElementById("joFilterStatus")?.value || "");
    const domain = String(document.getElementById("joFilterDomain")?.value || "");
    const filtered = allJobs.filter(job => {
        const title = String(job.title || "").toLowerCase();
        const loc   = String(job.location || "").toLowerCase();
        const dom   = job.category_name || getCategoryName(job) || "";
        const matchSearch = !search || title.includes(search) || loc.includes(search) || dom.toLowerCase().includes(search);
        const matchStatus = !status || (status === "active" && job.is_active) || (status === "inactive" && !job.is_active);
        const matchDomain = !domain || dom === domain;
        return matchSearch && matchStatus && matchDomain;
    });
    if (!filtered.length) {
        container.innerHTML = "<p class='text-sm text-text-muted px-1'>Aucune offre trouvée.</p>";
        return;
    }
    container.innerHTML = filtered.map(job => {
        const isSelected = Number(job.id) === Number(selectedJobId);
        const count = allApplications.filter(a => Number(getJobId(a)) === Number(job.id)).length;
        return `<div class="job-card ${isSelected ? "selected" : ""}">
            <div class="flex-1 min-w-0 cursor-pointer" onclick="selectJob(${Number(job.id)})">
                <p class="font-bold text-sm text-text-main truncate">${escapeHtml(job.title || "—")}</p>
                <p class="text-xs text-text-muted mt-1">${escapeHtml(job.category_name || getCategoryName(job) || "—")} · ${escapeHtml(job.location || "—")}</p>
            </div>
            <div class="flex items-center gap-3">
                <button type="button" onclick='openJobDetailsModal(${JSON.stringify(job)})' class="outline-btn text-xs flex items-center gap-1">
                    <span class="material-symbols-outlined text-[18px]">visibility</span> Voir détails
                </button>
                <div class="flex flex-col items-end gap-1">
                    ${job.is_active ? '<span class="badge success">Active</span>' : '<span class="badge danger">Fermée</span>'}
                    <span class="text-xs text-text-muted">${count} candidat${count !== 1 ? "s" : ""}</span>
                </div>
            </div>
        </div>`;
    }).join("");
}


function selectJob(jobId) {
    selectedJobId = jobId;
    renderJobOffersList();
    renderSelectedJobDetail();
}


function renderSelectedJobDetail() {
    const placeholder = document.getElementById("joPlaceholder");
    const detail      = document.getElementById("joOfferDetail");
    if (!placeholder || !detail) return;
    if (!selectedJobId) {
        placeholder.classList.remove("hidden");
        detail.classList.add("hidden");
        return;
    }
    const job = allJobs.find(j => Number(j.id) === Number(selectedJobId));
    if (!job) return;
    placeholder.classList.add("hidden");
    detail.classList.remove("hidden");
    setText("joDetailTitle", job.title || "—");
    setText("joDetailMeta", (job.category_name || getCategoryName(job) || "—") + " · " + (job.location || "—") + " · " + (job.contract_type || "—"));
    const badge = document.getElementById("joDetailBadge");
    if (badge) {
        badge.textContent = job.is_active ? "Active" : "Fermée";
        badge.className = "badge " + (job.is_active ? "success" : "danger");
    }
    renderCandidatesForJob();
}


// =============================================================
//  GLOBAL ANALYTICS
// =============================================================
function renderJobOfferAnalytics() {
    const apps     = allApplications;
    const total    = apps.length;
    const accepted = apps.filter(a => a.status === "accepted").length;
    const rejected = apps.filter(a => a.status === "rejected").length;
    const tests    = apps.filter(a => a.test_assignment).length;
    setText("joKpiTotal",    total);
    setText("joKpiAccepted", accepted);
    setText("joKpiRejected", rejected);
    setText("joKpiTests",    tests);


    const statusCtx = document.getElementById("joChartStatus");
    if (statusCtx) {
        const pending = apps.filter(a => a.status === "pending").length;
        if (joChartStatus) joChartStatus.destroy();
        joChartStatus = new Chart(statusCtx, {
            type: "doughnut",
            data: {
                labels: ["En attente", "Acceptés", "Refusés"],
                datasets: [{ data: [pending, accepted, rejected], backgroundColor: ["#facc15","#22c55e","#ef4444"], borderWidth: 2, borderColor: "#fff" }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, cutout: "65%" }
        });
    }


    const scoreCtx = document.getElementById("joChartScores");
    if (scoreCtx) {
        const labels = apps.map(a => getCandidateName(a));
        const scores = apps.map(a => { const s = getAiScore(a); return s !== null ? s : 0; });
        if (joChartScores) joChartScores.destroy();
        joChartScores = new Chart(scoreCtx, {
            type: "bar",
            data: {
                labels: labels.length ? labels : ["Aucune donnée"],
                datasets: [{ label: "Score IA", data: scores.length ? scores : [0], backgroundColor: "rgba(0,95,172,0.75)", borderColor: "#005fac", borderWidth: 1.5, borderRadius: 8 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
        });
    }
}


// =============================================================
//  CANDIDATES TABLE + SORTING
// =============================================================
function setupCandidateFilters() {
    ["joCandSearch","joCandStatus"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input",  renderCandidatesForJob);
            el.addEventListener("change", renderCandidatesForJob);
        }
    });
}


function setupCandidateSorting() {
    document.querySelectorAll("[data-sort]").forEach(btn => {
        btn.addEventListener("click", () => {
            const field    = btn.dataset.sort;
            const newOrder = (currentSort.field === field && currentSort.order === "desc") ? "asc" : "desc";
            currentSort    = { field, order: newOrder };
            document.querySelectorAll("[data-sort]").forEach(b => {
                const f = b.dataset.sort;
                b.textContent = `Score ${f === "ai" ? "IA" : "test"} ${(f === field && newOrder === "asc") ? "⬆️" : "⬇️"}`;
            });
            renderCandidatesForJob();
        });
    });
}


function renderCandidatesForJob() {
    const table = document.getElementById("joCandidatesTableBody");
    if (!table || !selectedJobId) return;


    const search = String(document.getElementById("joCandSearch")?.value  || "").toLowerCase();
    const status = String(document.getElementById("joCandStatus")?.value  || "");


    let apps = allApplications.filter(app => {
        if (Number(getJobId(app)) !== Number(selectedJobId)) return false;
        const name  = getCandidateName(app).toLowerCase();
        const email = getEmail(app).toLowerCase();
        const matchSearch = !search || name.includes(search) || email.includes(search);
        const matchStatus = !status || app.status === status;
        return matchSearch && matchStatus;
    });


    // Sort
    apps.sort((a, b) => {
        if (currentSort.field === "ai") {
            const valA = getAiScore(a) ?? -1;
            const valB = getAiScore(b) ?? -1;
            return currentSort.order === "desc" ? valB - valA : valA - valB;
        } else {
            const tA = a.test_assignment;
            const tB = b.test_assignment;
            let ratioA = -1, ratioB = -1;
            if (tA && tA.status === "completed" && tA.score !== undefined && tA.total > 0) ratioA = tA.score / tA.total;
            if (tB && tB.status === "completed" && tB.score !== undefined && tB.total > 0) ratioB = tB.score / tB.total;
            return currentSort.order === "desc" ? ratioB - ratioA : ratioA - ratioB;
        }
    });


    if (!apps.length) {
        table.innerHTML = `<tr><td colspan="5" class="px-5 py-6 text-text-muted">Aucun candidat pour cette offre.</td></tr>`;
        return;
    }


    table.innerHTML = apps.map(app => {
        const aiScore    = getAiScore(app);
        const assignment = app.test_assignment || null;


        // isAutoReject: score exists and is below 50
        const isAutoReject = aiScore !== null && aiScore < 50;
        // isManualReject: RH explicitly set status to rejected (and score is fine or null)
        const isManualReject = app.status === "rejected" && !isAutoReject;
        // isRejected: either kind — used to lock actions
        const isRejected = app.status === "rejected" || isAutoReject;


        // ── STATUS COLUMN ──────────────────────────────────────────
        // Auto-reject (score < 50): show badge label + a disabled dropdown below it
        // Manual reject: locked badge only
        // Accepted: locked badge only
        // Pending: active dropdown (En attente / Refusé)
        let statusControl;
        if (isAutoReject) {
            // Badge + greyed-out dropdown so RH can see the state clearly
            statusControl = `
                <div class="flex flex-col gap-1">
                    <span class="badge danger">Rejeté (score IA &lt; 50)</span>
                    <select class="rounded-lg border-border-light text-sm opacity-40 cursor-not-allowed" disabled>
                        <option>Refusé</option>
                    </select>
                </div>`;
        } else if (isManualReject) {
            statusControl = `<span class="badge danger">Refusé</span>`;
        } else if (app.status === "accepted") {
            statusControl = `<span class="badge success">Accepté</span>`;
        } else {
            // pending — show active dropdown (En attente / Refusé only)
            statusControl = `
                <select class="rounded-lg border-border-light text-sm focus:border-primary focus:ring-primary"
                        onchange="updateStatus(${Number(app.id)}, this.value)">
                    <option value="pending"  ${app.status === "pending" ? "selected" : ""}>En attente</option>
                    <option value="rejected">Refusé</option>
                </select>`;
        }


        // ── ACCEPT BUTTON ──────────────────────────────────────────
        // Active only when: not rejected, not already accepted, test completed with a score
        const canAccept = !isRejected
            && app.status !== "accepted"
            && assignment
            && assignment.status === "completed"
            && assignment.score !== null
            && assignment.score !== undefined;


        const acceptBtn = isRejected
            ? `<button type="button" class="outline-btn text-xs accept-btn-locked" disabled>Accepter</button>`
            : app.status === "accepted"
                ? `<button type="button" class="outline-btn text-xs accept-btn-locked" disabled>Accepté ✓</button>`
                : canAccept
                    ? `<button type="button" class="save-btn text-xs" onclick="updateStatus(${Number(app.id)}, 'accepted')">Accepter</button>`
                    : `<button type="button" class="outline-btn text-xs accept-btn-locked" disabled>Accepter</button>`;


        // ── TEST BUTTON ────────────────────────────────────────────
        const testBtn = isRejected
            ? `<button type="button" class="outline-btn text-xs accept-btn-locked" disabled>Test indisponible</button>`
            : testActionButton(app);


        return `<tr class="table-row">
            <td class="px-5 py-4">
                <p class="font-bold text-text-main">${escapeHtml(getCandidateName(app))}</p>
                <p class="text-xs text-text-muted">${escapeHtml(getEmail(app))}</p>
            </td>
            <td class="px-5 py-4">${statusControl}</td>
            <td class="px-5 py-4">${aiScoreBadge(aiScore)}</td>
            <td class="px-5 py-4">${testStatusBadge(assignment)}</td>
            <td class="px-5 py-4">
                <div class="flex flex-wrap gap-2">
                    <button type="button" class="outline-btn text-xs" onclick="openVoirDetails(${Number(app.id)})">Voir détails</button>
                    ${acceptBtn}
                    ${testBtn}
                </div>
            </td>
        </tr>`;
    }).join("");
}


// =============================================================
//  VOIR DÉTAILS MODAL
//  Shows: phone, date applied, CV link, + message (lettre de motivation)
// =============================================================
function openVoirDetails(appId) {
    const app = allApplications.find(a => Number(a.id) === Number(appId));
    if (!app) return;


    setText("detailPhone", getPhone(app) || "—");
    setText("detailDate",  formatDate(app.applied_date || app.created_at || app.date_applied) || "—");


    // Message / lettre de motivation
    // The field on the application object may be "message", "cover_letter", or "lettre_motivation"
    const messageEl = document.getElementById("detailMessage");
    if (messageEl) {
        const msg = app.message || app.cover_letter || app.lettre_motivation || "";
        messageEl.textContent = (msg && msg.trim()) ? msg.trim() : "Aucun message fourni.";
    }


    const cvUrl  = getCvUrl(app);
    const cvLink = document.getElementById("detailCvLink");
    const cvNone = document.getElementById("detailCvNone");
    if (cvUrl) {
        cvLink.href = cvUrl;
        cvLink.classList.remove("hidden");
        if (cvNone) cvNone.classList.add("hidden");
    } else {
        cvLink.classList.add("hidden");
        if (cvNone) cvNone.classList.remove("hidden");
    }


    openModal("modalVoirDetails");
}


// =============================================================
//  OFFRES & TESTS TABLES
// =============================================================
function renderOtOffersTable() {
    const table = document.getElementById("otOffersTableBody");
    if (!table) return;
    if (!allJobs.length) {
        table.innerHTML = `<tr><td colspan="6" class="px-5 py-6 text-text-muted">Aucune offre.</td></tr>`;
        return;
    }
    table.innerHTML = allJobs.map(job =>
        `<tr class="table-row">
            <td class="px-5 py-4 font-bold">${escapeHtml(job.title || "—")}</td>
            <td class="px-5 py-4 text-text-muted">${escapeHtml(job.category_name || getCategoryName(job) || "—")}</td>
            <td class="px-5 py-4 text-text-muted">${escapeHtml(job.location || "—")}</td>
            <td class="px-5 py-4 text-text-muted">${escapeHtml(job.contract_type || "—")}</td>
            <td class="px-5 py-4">${job.is_active ? '<span class="badge success">Active</span>' : '<span class="badge danger">Fermée</span>'}</td>
            <td class="px-5 py-4">
                <select class="rounded-lg border-border-light text-sm focus:border-primary focus:ring-primary"
                        onchange="handleJobStatusChange(${Number(job.id)}, this.value, this)">
                    <option value="">Action...</option>
                    <option value="active">Active</option>
                    <option value="close">Close</option>
                    <option value="delete">Supprimer</option>
                </select>
            </td>
        </tr>`
    ).join("");
}


function renderOtTestsTable() {
    const table = document.getElementById("otTestsTableBody");
    if (!table) return;
    if (!allTests.length) {
        table.innerHTML = `<tr><td colspan="5" class="px-5 py-6 text-text-muted">Aucun test créé.</td></tr>`;
        return;
    }
    table.innerHTML = allTests.map(test =>
        `<tr class="table-row">
            <td class="px-5 py-4 font-bold">${escapeHtml(test.title || "—")}</td>
            <td class="px-5 py-4 text-text-muted">${escapeHtml(test.job_title || "—")}</td>
            <td class="px-5 py-4 text-text-muted">${escapeHtml(test.duration_minutes || 0)} min</td>
            <td class="px-5 py-4"><span class="badge">${Array.isArray(test.questions) ? test.questions.length : 0}</span></td>
            <td class="px-5 py-4">${test.is_active ? '<span class="badge success">Actif</span>' : '<span class="badge danger">Inactif</span>'}</td>
        </tr>`
    ).join("");
}


async function handleJobStatusChange(jobId, action, selectEl) {
    if (!action) return;
    selectEl.value = "";
    if (action === "delete") {
        pendingDeleteJobId = jobId;
        openModal("modalConfirmDelete");
        document.getElementById("confirmDeleteBtn").onclick = () => {
            closeModal("modalConfirmDelete");
            performJobAction(jobId, "delete");
        };
        return;
    }
    await performJobAction(jobId, action, action === "active");
}


async function performJobAction(jobId, action, isActive = null) {
    const token = localStorage.getItem("access_token");
    try {
        const body     = action === "delete" ? { action: "delete" } : { is_active: isActive };
        const response = await fetch(`/api/jobs/${jobId}/status/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, Accept: "application/json" },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || data.detail || "Erreur.");
        }
        showMessage(action === "delete" ? "Offre supprimée." : "Statut mis à jour.", false);
        await loadAllJobs(token);
        await loadStats(token);
    } catch(err) {
        console.error(err);
        showMessage(err.message || "Erreur.", true);
    }
}


// =============================================================
//  UPDATE STATUS
// =============================================================
async function updateStatus(applicationId, newStatus) {
    const token = localStorage.getItem("access_token");
    try {
        const response = await fetch(`/api/applications/${applicationId}/status/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, Accept: "application/json" },
            body: JSON.stringify({ status: newStatus })
        });
        if (!response.ok) throw new Error("Erreur: " + response.status);
        const updated = await response.json();
        allApplications = allApplications.map(a => Number(a.id) === Number(updated.id) ? updated : a);
        renderCandidatesForJob();
        renderRecentApplications();
        renderJobOfferAnalytics();
        showMessage("Statut mis à jour.", false);
    } catch(err) {
        console.error(err);
        showMessage("Erreur mise à jour statut.", true);
    }
}


// =============================================================
//  TEST ACTION BUTTON (only called when NOT rejected)
// =============================================================
function testActionButton(app) {
    const aiScore  = getAiScore(app);
    const assignment = app.test_assignment || null;


    if (assignment && assignment.status === "completed")
        return `<span class="badge success">Résultat disponible</span>`;
    if (assignment)
        return `<span class="badge warning">Déjà envoyé</span>`;
    if (aiScore === null)
        return `<button type="button" class="outline-btn text-xs" disabled>Non scoré</button>`;
    if (aiScore < 50)
        return `<button type="button" class="outline-btn text-xs accept-btn-locked" disabled>Score &lt; 50</button>`;


    const jobId  = getJobId(app);
    const hasTest = allTests.some(t => Number(t.job) === Number(jobId) && t.is_active);
    if (!hasTest)
        return `<button type="button" class="outline-btn text-xs" onclick="goCreateTestForJob(${Number(jobId)})">Aucun test</button>`;


    return `<button type="button" class="save-btn text-xs" onclick="sendTest(${Number(app.id)})">Envoyer test</button>`;
}


async function sendTest(applicationId) {
    const token = localStorage.getItem("access_token");
    const app   = allApplications.find(a => Number(a.id) === Number(applicationId));
    if (!app) return;
    const aiScore = getAiScore(app);
    if (aiScore === null || aiScore < 50) { showMessage("Score IA insuffisant.", true); return; }
    const jobId   = getJobId(app);
    const matching = allTests.filter(t => Number(t.job) === Number(jobId) && t.is_active);
    if (!matching.length) { showMessage("Aucun test actif pour cette offre.", true); return; }
    try {
        const response = await fetch(`/api/applications/${applicationId}/send-test/`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, Accept: "application/json" },
            body: JSON.stringify({ test_id: matching[0].id })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || data.detail || "Erreur envoi test.");
        showMessage("Test envoyé.", false);
        await loadApplications(token);
    } catch(err) {
        console.error(err);
        showMessage(err.message || "Erreur.", true);
    }
}


function goCreateTestForJob(jobId) {
    showPage("offres-tests");
    setTimeout(() => {
        populateTestJobSelect();
        const sel = document.getElementById("testJob");
        if (sel) sel.value = String(jobId);
        openCreateTestModal();
    }, 120);
}


// =============================================================
//  CREATE JOB FORM & DYNAMIC LINES
// =============================================================
function setupDynamicJobLines() {
    setupLineGroup({ containerId:"missionsLines", addButtonId:"addMissionLine", inputClass:"mission-input", lineClass:"mission-line", placeholder:"Ex: Assurer la maintenance" });
    setupLineGroup({ containerId:"profilesLines", addButtonId:"addProfileLine", inputClass:"profile-input", lineClass:"profile-line", placeholder:"Ex: Bac+5" });
}


function setupLineGroup(cfg) {
    const container = document.getElementById(cfg.containerId);
    const addBtn    = document.getElementById(cfg.addButtonId);
    if (!container || !addBtn) return;


    function bindRemove(btn) {
        btn.addEventListener("click", () => {
            const line  = btn.closest("." + cfg.lineClass);
            const lines = container.querySelectorAll("." + cfg.lineClass);
            if (!line) return;
            if (lines.length > 1) {
                line.remove();
            } else {
                const inp = line.querySelector("." + cfg.inputClass);
                if (inp) inp.value = "";
            }
        });
    }


    function createLine(val = "") {
        const div = document.createElement("div");
        div.className = "flex gap-2 " + cfg.lineClass;
        div.innerHTML = `<input type="text" class="${cfg.inputClass} w-full rounded-lg border-border-light text-sm" placeholder="${escapeAttribute(cfg.placeholder)}" value="${escapeAttribute(val)}">
                         <button type="button" class="remove-line-btn px-3 py-2 rounded-lg border border-border-light text-text-muted hover:bg-red-50">−</button>`;
        bindRemove(div.querySelector(".remove-line-btn"));
        container.appendChild(div);
    }


    addBtn.addEventListener("click", () => createLine());
    container.querySelectorAll(".remove-line-btn").forEach(bindRemove);
}


function syncJobLinesToHiddenFields() {
    const mta   = document.getElementById("jobMissions");
    const pta   = document.getElementById("jobProfiles");
    const mvals = Array.from(document.querySelectorAll(".mission-input")).map(i => i.value.trim()).filter(Boolean);
    const pvals = Array.from(document.querySelectorAll(".profile-input")).map(i => i.value.trim()).filter(Boolean);
    if (mta) mta.value = mvals.join("\n");
    if (pta) pta.value = pvals.join("\n");
}


function resetDynamicJobLines() {
    resetLineGroup("missionsLines", "mission-line", "mission-input");
    resetLineGroup("profilesLines", "profile-line", "profile-input");
    const mta = document.getElementById("jobMissions"); if (mta) mta.value = "";
    const pta = document.getElementById("jobProfiles"); if (pta) pta.value = "";
}


function resetLineGroup(cid, lc, ic) {
    const c = document.getElementById(cid);
    if (!c) return;
    Array.from(c.querySelectorAll("." + lc)).forEach((l, i) => {
        if (i === 0) { const inp = l.querySelector("." + ic); if (inp) inp.value = ""; }
        else l.remove();
    });
}


let pendingTestData = null;


function setupCreateJobForm() {
    const form = document.getElementById("createJobForm");
    if (!form) return;
    form.addEventListener("reset", () => setTimeout(resetDynamicJobLines, 0));
    form.addEventListener("submit", async function(e) {
        e.preventDefault();
        const token  = localStorage.getItem("access_token");
        const button = document.getElementById("createJobButton");
        syncJobLinesToHiddenFields();
        const title        = getFieldValue("jobTitle");
        const category     = getFieldValue("jobCategory");
        const location     = getFieldValue("jobLocation");
        const contractType = getFieldValue("jobContractType");
        const description  = getFieldValue("jobDescription");
        const missionsText = getFieldValue("jobMissions");
        const profilesText = getFieldValue("jobProfiles");
        if (!title || !category || !location || !contractType || !description) {
            showMessage("Champs obligatoires.", true);
            return;
        }
        const payload = { title, category: Number(category), location, contract_type: contractType, description, missions: splitLines(missionsText), searched_profiles: splitLines(profilesText) };
        try {
            if (button) { button.disabled = true; button.innerHTML = `<span>Publication...</span><span class="material-symbols-outlined">send</span>`; }
            let response = await fetch("/api/jobs/create/", {
                method: "POST",
                headers: { "Content-Type":"application/json", Authorization:"Bearer "+token, Accept:"application/json" },
                body: JSON.stringify(payload)
            });
            let data = await response.json().catch(() => ({}));
            if (!response.ok && (data.missions || data.searched_profiles)) {
                const fb = {...payload, missions: missionsText, searched_profiles: profilesText};
                response = await fetch("/api/jobs/create/", { method:"POST", headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,Accept:"application/json"}, body:JSON.stringify(fb) });
                data = await response.json().catch(() => ({}));
            }
            if (!response.ok) throw new Error(data.error || data.detail || "Erreur création.");
            showMessage("Offre créée.", false);
            form.reset(); resetDynamicJobLines(); closeModal("modalCreateOffer");
            if (pendingTestData && data.id) {
                try {
                    const testPayload = {...pendingTestData, job: Number(data.id)};
                    const testRes = await fetch("/api/tests/create/", { method:"POST", headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,Accept:"application/json"}, body:JSON.stringify(testPayload) });
                    if (testRes.ok) showMessage("Offre et test créés.", false);
                    else showMessage("Offre créée, erreur test.", true);
                } catch(te) { showMessage("Erreur test.", true); }
                pendingTestData = null;
            }
            await loadAllJobs(token); await loadTests(token); await loadStats(token); showPage("offres-tests");
        } catch(err) {
            console.error(err); showMessage(err.message, true);
        } finally {
            if (button) { button.disabled = false; button.innerHTML = `<span>Publier l'offre</span><span class="material-symbols-outlined">send</span>`; }
        }
    });
}


function setupCreateTestForm() {
    const form   = document.getElementById("createTestForm");
    const addBtn = document.getElementById("addQuestionButton");
    if (addBtn) addBtn.addEventListener("click", addQuestionBlock);
    if (form) {
        form.addEventListener("reset", () => setTimeout(resetQuestions, 0));
        form.addEventListener("submit", async function(e) {
            e.preventDefault();
            const token      = localStorage.getItem("access_token");
            const button     = document.getElementById("createTestButton");
            const testJobSel = document.getElementById("testJob");
            const isPending  = testJobSel && testJobSel.dataset.pendingFromOffer === "true";
            const jobId      = isPending ? null : getFieldValue("testJob");
            const title      = getFieldValue("testTitle");
            const dur        = Number(getFieldValue("testDuration") || 20);
            const qs         = collectQuestions();
            if (!isPending && !jobId) { showMessage("Choisissez une offre.", true); return; }
            if (!title || !dur)       { showMessage("Remplissez titre et durée.", true); return; }
            if (!qs.length)           { showMessage("Ajoutez au moins une question.", true); return; }
            if (isPending) {
                pendingTestData = { title, duration_minutes: dur, is_active: true, questions: qs };
                const preview  = document.getElementById("testLinkedPreview");
                const nameSpan = document.getElementById("testLinkedName");
                if (preview && nameSpan) { nameSpan.textContent = title; preview.classList.remove("hidden"); }
                showMessage("Test configuré (créé à la publication de l'offre).", false);
                closeModal("modalCreateTest");
                if (testJobSel) { testJobSel.disabled = false; delete testJobSel.dataset.pendingFromOffer; }
                return;
            }
            const payload = { job: Number(jobId), title, duration_minutes: dur, is_active: true, questions: qs };
            try {
                if (button) { button.disabled = true; button.innerHTML = `<span>Enregistrement...</span><span class="material-symbols-outlined">quiz</span>`; }
                const response = await fetch("/api/tests/create/", { method:"POST", headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,Accept:"application/json"}, body:JSON.stringify(payload) });
                const data     = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || data.detail || "Erreur création test.");
                showMessage("Test créé avec succès.", false);
                closeModal("modalCreateTest");
                await loadTests(token);
            } catch(err) {
                console.error(err); showMessage(err.message, true);
            } finally {
                if (button) { button.disabled = false; button.innerHTML = `<span>Enregistrer le test</span><span class="material-symbols-outlined">quiz</span>`; }
            }
        });
    }
    resetQuestions();
}


function resetQuestions() {
    const c = document.getElementById("testQuestionsContainer");
    if (c) { c.innerHTML = ""; addQuestionBlock(); }
}


function addQuestionBlock() {
    const c = document.getElementById("testQuestionsContainer");
    if (!c) return;
    const idx = c.querySelectorAll(".question-block").length + 1;
    const w   = document.createElement("div");
    w.className = "question-block border rounded-xl p-4 bg-surface/40";
    w.innerHTML = `<div class="flex justify-between mb-3"><h4 class="font-bold text-sm">Question ${idx}</h4><button type="button" class="text-xs font-bold text-danger" onclick="removeQuestionBlock(this)">Supprimer</button></div>
        <div class="grid md:grid-cols-2 gap-3">
            <div class="md:col-span-2"><label class="block text-xs font-bold mb-1">Énoncé</label><textarea data-question-field="question_text" rows="2" required class="w-full rounded-lg border-border-light text-sm"></textarea></div>
            <div><label class="block text-xs font-bold mb-1">Option A</label><input data-question-field="option_a" type="text" required class="w-full rounded-lg border-border-light text-sm"></div>
            <div><label class="block text-xs font-bold mb-1">Option B</label><input data-question-field="option_b" type="text" required class="w-full rounded-lg border-border-light text-sm"></div>
            <div><label class="block text-xs font-bold mb-1">Option C</label><input data-question-field="option_c" type="text" required class="w-full rounded-lg border-border-light text-sm"></div>
            <div><label class="block text-xs font-bold mb-1">Option D</label><input data-question-field="option_d" type="text" required class="w-full rounded-lg border-border-light text-sm"></div>
            <div><label class="block text-xs font-bold mb-1">Bonne réponse</label>
                <select data-question-field="correct_answer" required class="w-full rounded-lg border-border-light text-sm">
                    <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                </select>
            </div>
        </div>`;
    c.appendChild(w);
}


function removeQuestionBlock(btn) {
    const b = btn.closest(".question-block");
    if (b) b.remove();
    document.querySelectorAll(".question-block h4").forEach((h, i) => h.textContent = "Question " + (i + 1));
}


function collectQuestions() {
    return Array.from(document.querySelectorAll(".question-block")).map((block, i) => ({
        question_text:  getQuestionFieldValue(block, "question_text"),
        option_a:       getQuestionFieldValue(block, "option_a"),
        option_b:       getQuestionFieldValue(block, "option_b"),
        option_c:       getQuestionFieldValue(block, "option_c"),
        option_d:       getQuestionFieldValue(block, "option_d"),
        correct_answer: getQuestionFieldValue(block, "correct_answer"),
        order: i + 1
    })).filter(q => q.question_text && q.option_a && q.option_b && q.option_c && q.option_d);
}


function getQuestionFieldValue(block, fn) {
    const f = block.querySelector(`[data-question-field="${fn}"]`);
    return f ? f.value.trim() : "";
}


function populateTestJobSelect() {
    const sel = document.getElementById("testJob");
    if (!sel) return;
    sel.innerHTML = `<option value="">Choisir une offre</option>`;
    allJobs.forEach(job => {
        const opt = document.createElement("option");
        opt.value = job.id;
        opt.textContent = job.title || "Offre " + job.id;
        sel.appendChild(opt);
    });
}


// =============================================================
//  UTILITIES
// =============================================================
function getAiScore(app) {
    if (app.ai_score === null || app.ai_score === undefined || app.ai_score === "") return null;
    const s = Number(app.ai_score);
    return isNaN(s) ? null : s;
}
function getJobId(app) {
    if (app.job_id) return Number(app.job_id);
    if (app.job && typeof app.job === "object" && app.job.id) return Number(app.job.id);
    if (typeof app.job === "number") return Number(app.job);
    return null;
}
function getCandidateName(app) {
    if (app.candidate_name)       return String(app.candidate_name);
    if (app.full_name)            return String(app.full_name);
    if (app.candidate_full_name)  return String(app.candidate_full_name);
    if (app.name)                 return String(app.name);
    if (app.candidate && typeof app.candidate === "object") {
        const fn = ((app.candidate.first_name || "") + " " + (app.candidate.last_name || "")).trim();
        if (fn) return fn;
        if (app.candidate.full_name) return String(app.candidate.full_name);
        if (app.candidate.email)     return String(app.candidate.email);
    }
    if (app.candidate_email) return String(app.candidate_email);
    return "Candidat";
}
function getEmail(app) {
    if (app.candidate_email) return String(app.candidate_email);
    if (app.email)           return String(app.email);
    if (app.candidate && typeof app.candidate === "object" && app.candidate.email) return String(app.candidate.email);
    return "—";
}
function getPhone(app) {
    if (app.phone)           return String(app.phone);
    if (app.candidate_phone) return String(app.candidate_phone);
    if (app.candidate && typeof app.candidate === "object" && app.candidate.phone) return String(app.candidate.phone);
    return "";
}
function getJobTitle(app) {
    if (app.job_title)                                             return String(app.job_title);
    if (app.job && typeof app.job === "string")                   return app.job;
    if (app.job && typeof app.job === "object")                   return String(app.job.title || app.job.name || "—");
    if (app.title)                                                return String(app.title);
    return "—";
}
function getCategoryName(job) {
    if (job.category_name)                                        return String(job.category_name);
    if (job.category && typeof job.category === "string")         return job.category;
    if (job.category && typeof job.category === "object")         return String(job.category.name || "—");
    return "—";
}
function getCvUrl(app) {
    if (app.cv_file) return String(app.cv_file);
    if (app.cv)      return String(app.cv);
    if (app.resume)  return String(app.resume);
    return "";
}


// statusBadge used in recent applications panel
function statusBadge(status, aiScore) {
    if (status === "rejected") return '<span class="badge danger">Refusée</span>';
    if (aiScore !== null && aiScore !== undefined && aiScore < 50)
        return '<span class="badge danger">Rejeté (score IA &lt; 50)</span>';
    if (status === "accepted") return '<span class="badge success">Acceptée</span>';
    if (status === "reviewed") return '<span class="badge success">Consultée</span>';
    return '<span class="badge warning">En attente</span>';
}


function aiScoreBadge(score) {
    if (score === null || score === undefined || score === "")
        return '<span class="badge warning">Non scoré</span>';
    const n = Number(score);
    return n >= 50
        ? `<span class="badge success">${n}</span>`
        : `<span class="badge danger">${n}</span>`;
}


function testStatusBadge(assignment) {
    if (!assignment) return '<span class="badge warning">Non envoyé</span>';
    if (assignment.status === "completed") {
        if (assignment.score !== undefined && assignment.total !== undefined && assignment.total > 0)
            return `<span class="badge success">${assignment.score} / ${assignment.total}</span>`;
        if (assignment.score !== undefined)
            return `<span class="badge success">${assignment.score}</span>`;
        return '<span class="badge success">Complété</span>';
    }
    if (assignment.status === "sent") return '<span class="badge">Envoyé</span>';
    return '<span class="badge warning">Non envoyé</span>';
}


function splitLines(v) {
    if (!v) return [];
    return v.split("\n").map(l => l.trim()).filter(l => l.length);
}
function getFieldValue(id) {
    const f = document.getElementById(id);
    return f ? f.value.trim() : "";
}
function formatDate(v) {
    if (!v) return "—";
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString("fr-FR");
}
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}
function escapeHtml(v) {
    return String(v ?? "")
        .replaceAll("&",  "&amp;")
        .replaceAll("<",  "&lt;")
        .replaceAll(">",  "&gt;")
        .replaceAll('"',  "&quot;")
        .replaceAll("'",  "&#039;");
}
function escapeAttribute(v) { return escapeHtml(v); }
function showMessage(msg, isError) {
    const box = document.getElementById("rhMessage");
    if (!box) { alert(msg); return; }
    box.textContent = msg;
    box.classList.remove("hidden");
    box.className = isError
        ? "fixed bottom-5 right-5 rounded-xl px-5 py-3 text-sm font-bold shadow-lg z-50 bg-red-50 text-danger border border-red-200"
        : "fixed bottom-5 right-5 rounded-xl px-5 py-3 text-sm font-bold shadow-lg z-50 bg-green-50 text-success border border-green-200";
    setTimeout(() => box.classList.add("hidden"), 3000);
}

