console.log("REAL job-list.js loaded");
function slugifyCategory(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function mapCategoryToFilter(rawCategory) {
    const slug = slugifyCategory(rawCategory);
    if (!slug) return "all";
    if (slug.includes("tech")) return "technique";
    if (slug.includes("it") || slug.includes("digital") || slug.includes("informat")) return "it-digital";
    if (slug.includes("manage") || slug.includes("gestion") || slug.includes("projet")) return "management";
    if (slug.includes("commercial") || slug.includes("vente") || slug.includes("business")) return "commercial";
    return "all";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatDate(dateValue) {
    if (!dateValue) return "Date non précisée";
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return "Date non précisée";
    return d.toLocaleDateString("fr-FR");
}

function buildJobCard(job) {
    console.log("buildJobCard", job);   
    const id = job.id ?? job.pk ?? "";
    const title = job.title || "Offre d'emploi";
    const category = job.category_name || "Catégorie non précisée";
    const location = job.location || "Lieu non précisé";
    const contractType = job.contract_type || "Contrat non précisé";
    const description = job.description || "Aucune description disponible pour cette offre.";
    const postedDate = formatDate(job.date_posted);
    const categoryFilter = mapCategoryToFilter(category);

    return `
        <div class="job-card bg-surface-card rounded-xl border border-border-light/40 p-6 shadow-sm hover:shadow-md transition-shadow" data-category="${escapeHtml(categoryFilter)}">
            <div class="flex flex-wrap justify-between items-start gap-3 mb-3">
                <h2 class="text-xl font-bold text-text-main">${escapeHtml(title)}</h2>
                <span class="px-2 py-1 rounded-full text-xs font-medium bg-primary-light/30 text-primary">${escapeHtml(contractType)}</span>
            </div>
            <div class="flex flex-wrap gap-4 mb-4 text-sm text-text-muted">
                <div class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-base">location_on</span>
                    <span>${escapeHtml(location)}</span>
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-base">schedule</span>
                    <span>Publiée le ${escapeHtml(postedDate)}</span>
                </div>
            </div>
            <p class="text-text-muted text-sm mb-5 line-clamp-2">
                ${escapeHtml(description)}
            </p>
            <div class="flex flex-wrap gap-2 mb-5">
                <span class="px-2 py-1 rounded-full text-xs bg-surface-muted/50 text-text-muted">${escapeHtml(category)}</span>
            </div>
            <a href="/jobs/detail/?id=${encodeURIComponent(id)}" class="inline-flex items-center gap-1 text-primary font-semibold text-sm hover:gap-2 transition-all">
                Voir l'offre
                <span class="material-symbols-outlined text-sm">arrow_forward</span>
            </a>
        </div>
    `;
}

function setupFilters() {
    const filterButtons = document.querySelectorAll(".filter-btn");
    const jobsGrid = document.getElementById("jobsGrid");

    function setActiveButton(activeButton) {
        filterButtons.forEach((button) => {
            button.classList.remove("bg-primary", "text-white");
            button.classList.add("bg-surface-card", "border", "border-border-light/50", "text-text-muted");
        });
        activeButton.classList.remove("bg-surface-card", "border", "border-border-light/50", "text-text-muted");
        activeButton.classList.add("bg-primary", "text-white");
    }

    function filterJobs(category) {
        console.log("filterJobs", category);
        const jobCards = jobsGrid.querySelectorAll(".job-card");
        jobCards.forEach((card) => {
            const cardCategory = card.getAttribute("data-category");
            card.style.display = category === "all" || cardCategory === category ? "block" : "none";
        });
    }

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const category = button.getAttribute("data-category");
            setActiveButton(button);
            filterJobs(category);
        });
    });
}

async function loadJobs() {
    console.log("loadJobs");
    const jobsGrid = document.getElementById("jobsGrid");
    try {
        const response = await fetch("/api/jobs/", { headers: { Accept: "application/json" } });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        const jobs = Array.isArray(payload) ? payload : Array.isArray(payload.results) ? payload.results : [];
        console.log(jobs);
        if (!jobs.length) {
            jobsGrid.innerHTML = `
                <div class="job-card bg-surface-card rounded-xl border border-border-light/40 p-6 shadow-sm" data-category="all">
                    <p class="text-text-muted text-sm">Aucune offre disponible pour le moment.</p>
                </div>
            `;
            return;
        }
        jobsGrid.innerHTML = jobs.map(buildJobCard).join("");
    } catch (error) {
        jobsGrid.innerHTML = `
            <div class="job-card bg-surface-card rounded-xl border border-border-light/40 p-6 shadow-sm" data-category="all">
                <p class="text-text-muted text-sm">Impossible de charger les offres pour le moment.</p>
            </div>
        `;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    setupFilters();
    await loadJobs();
});
