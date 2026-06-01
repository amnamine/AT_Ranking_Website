function textOrFallback(value, fallback) {
    if (value === undefined || value === null) {
        return fallback;
    }

    const text = String(value).trim();
    return text ? text : fallback;
}

function parseToList(value) {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value
            .map(function (item) {
                if (typeof item === "string") {
                    return item.trim();
                }

                if (item && typeof item === "object") {
                    return String(
                        item.text ||
                        item.name ||
                        item.title ||
                        item.value ||
                        ""
                    ).trim();
                }

                return String(item || "").trim();
            })
            .filter(Boolean);
    }

    return String(value)
        .split(/\r?\n|;|•/)
        .map(function (item) {
            return item.trim();
        })
        .filter(Boolean);
}

function setListContent(listEl, values, fallbackText) {
    if (!listEl) {
        return;
    }

    listEl.innerHTML = "";

    const items = values.length ? values : [fallbackText];

    items.forEach(function (item) {
        const li = document.createElement("li");
        li.textContent = item;
        listEl.appendChild(li);
    });
}

function setText(element, value) {
    if (element) {
        element.textContent = value;
    }
}

function formatDate(dateValue) {
    if (!dateValue) {
        return "Non précisée";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "Non précisée";
    }

    return date.toLocaleDateString("fr-FR");
}

function setupApplyButton(applyBtn, jobId) {
    if (!applyBtn || !jobId) {
        return;
    }

    const applyUrl = `/apply/?job_id=${encodeURIComponent(jobId)}`;

    applyBtn.href = applyUrl;

    applyBtn.addEventListener("click", function (event) {
        const accessToken = localStorage.getItem("access_token");

        if (!accessToken) {
            event.preventDefault();
            window.location.href = `/connexion/?next=${encodeURIComponent(applyUrl)}`;
        }
    });
}

async function loadJobDetail() {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get("id") || params.get("job_id");

    const titleEl = document.getElementById("jobTitle");
    const breadcrumbTitleEl = document.getElementById("breadcrumbJobTitle");
    const locationEl = document.getElementById("jobLocation");
    const categoryEl = document.getElementById("jobCategory");
    const contractEl = document.getElementById("jobContract");
    const descriptionEl = document.getElementById("jobDescription");
    const missionsEl = document.getElementById("jobMissions");
    const profileEl = document.getElementById("jobProfiles");
    const dateEl = document.getElementById("jobDatePosted");
    const locationAsideEl = document.getElementById("jobLocationAside");
    const contractAsideEl = document.getElementById("jobContractAside");
    const applyBtn = document.getElementById("applyBtn");

    if (!jobId) {
        setText(titleEl, "Offre introuvable");
        setText(breadcrumbTitleEl, "Offre introuvable");
        setText(descriptionEl, "Aucun identifiant d'offre n'a été fourni dans l'URL.");
        setText(dateEl, "Non précisée");
        setText(locationAsideEl, "Non précisé");
        setText(contractAsideEl, "Non précisé");

        setListContent(missionsEl, [], "Informations non précisées.");
        setListContent(profileEl, [], "Informations non précisées.");

        if (applyBtn) {
            applyBtn.href = "/jobs/";
        }

        return;
    }

    setupApplyButton(applyBtn, jobId);

    try {
        const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/`, {
            headers: {
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const job = await response.json();

        const title = textOrFallback(job.title, "Offre d'emploi");
        const location = textOrFallback(job.location, "Lieu non précisé");

        const category = textOrFallback(
            job.category_name ||
            (job.category && job.category.name) ||
            job.category,
            "Catégorie non précisée"
        );

        const contractType = textOrFallback(job.contract_type, "Contrat non précisé");
        const description = textOrFallback(job.description, "Aucune description disponible.");

        const missions = parseToList(job.missions);

        const profiles = parseToList(
            job.searched_profiles ||
            job.profiles ||
            job.profile
        );

        const datePosted = formatDate(job.date_posted || job.created_at);

        setText(titleEl, title);
        setText(breadcrumbTitleEl, title);
        setText(locationEl, location);
        setText(categoryEl, category);
        setText(contractEl, contractType);
        setText(descriptionEl, description);
        setText(dateEl, datePosted);
        setText(locationAsideEl, location);
        setText(contractAsideEl, contractType);

        setListContent(missionsEl, missions, "Informations non précisées.");
        setListContent(profileEl, profiles, "Informations non précisées.");
    } catch (error) {
        console.error("Job detail loading error:", error);

        setText(titleEl, "Offre introuvable");
        setText(breadcrumbTitleEl, "Offre introuvable");
        setText(descriptionEl, "Impossible de charger les détails de cette offre.");
        setText(dateEl, "Non précisée");
        setText(locationAsideEl, "Non précisé");
        setText(contractAsideEl, "Non précisé");

        setListContent(missionsEl, [], "Informations non précisées.");
        setListContent(profileEl, [], "Informations non précisées.");

        if (applyBtn) {
            applyBtn.href = "/jobs/";
        }
    }
}

document.addEventListener("DOMContentLoaded", loadJobDetail);