function getToken() {
    return localStorage.getItem("access_token");
}

let currentAssignments = [];
let selectedAssignment = null;

function showToast(message, isError = false) {
    const toast = document.getElementById("toast");

    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;
    toast.classList.remove("hidden");

    toast.className = isError
        ? "fixed bottom-6 right-6 bg-red-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-semibold z-50"
        : "fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-semibold z-50";

    setTimeout(function () {
        toast.classList.add("hidden");
    }, 3000);
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
    localStorage.removeItem("user_data");
    localStorage.removeItem("signupData");
    localStorage.removeItem("profilData");

    window.location.href = "/";
}

async function loadSidebarProfile() {
    const token = getToken();
    const storedEmail = localStorage.getItem("user_email") || "";

    const sidebarName = document.getElementById("sidebarName");
    const sidebarEmail = document.getElementById("sidebarEmail");
    const sidebarAvatar = document.getElementById("sidebarAvatar");

    if (sidebarEmail && storedEmail) {
        sidebarEmail.textContent = storedEmail;
    }

    if (!token) {
        return;
    }

    try {
        const response = await fetch("/api/profile/", {
            headers: {
                Accept: "application/json",
                Authorization: "Bearer " + token
            }
        });

        if (!response.ok) {
            return;
        }

        const profile = await response.json();

        if (sidebarName) {
            sidebarName.textContent = profile.full_name || profile.email || "Mon Espace";
        }

        if (sidebarEmail) {
            sidebarEmail.textContent = profile.email || storedEmail || "Candidat";
        }

        if (profile.email) {
            localStorage.setItem("user_email", profile.email);
        }

        if (sidebarAvatar && profile.profile_picture_url) {
            sidebarAvatar.innerHTML = `
                <img
                    src="${profile.profile_picture_url}"
                    alt="Photo de profil"
                    style="width:100%;height:100%;object-fit:cover;border-radius:50%;"
                >
            `;
        }
    } catch (error) {
        console.error("Sidebar profile loading error:", error);
    }
}

async function loadMyTests() {
    const token = getToken();
    const container = document.getElementById("testContainer");

    if (!container) {
        return;
    }

    if (!token) {
        window.location.href = "/signin/";
        return;
    }

    container.innerHTML = `<p class="text-sm text-text-muted">Chargement du test...</p>`;

    try {
        const response = await fetch("/api/my-tests/", {
            headers: {
                Accept: "application/json",
                Authorization: "Bearer " + token
            }
        });

        const data = await response.json().catch(function () {
            return {};
        });

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            window.location.href = "/signin/";
            return;
        }

        if (!response.ok) {
            renderError();
            return;
        }

        if (!data.authorized || !Array.isArray(data.assignments) || data.assignments.length === 0) {
            currentAssignments = [];
            renderNotAuthorized();
            return;
        }

        currentAssignments = data.assignments;
        selectedAssignment = null;
        renderAssignmentsList(currentAssignments);
    } catch (error) {
        console.error("Tests loading error:", error);
        renderError();
    }
}

function prepareCenteredCard() {
    const container = document.getElementById("testContainer");

    if (!container) {
        return null;
    }

    container.classList.add("flex", "items-center", "justify-center");

    return container;
}

function prepareNormalCard() {
    const container = document.getElementById("testContainer");

    if (!container) {
        return null;
    }

    container.classList.remove("flex", "items-center", "justify-center");

    return container;
}

function renderNotAuthorized() {
    const container = prepareCenteredCard();

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="max-w-md mx-auto text-center py-10">
            <div class="test-icon mb-8">
                <span class="material-symbols-outlined" style="font-size:56px;">quiz</span>
            </div>

            <h2 class="text-2xl md:text-3xl font-bold text-text-main mb-4">
                Vous n'êtes pas encore autorisé à passer le test.
            </h2>

            <p class="text-text-muted mb-8 leading-relaxed">
                Votre candidature est en cours d'examen. Dès validation par nos équipes RH,
                le test technique sera disponible dans cet espace.
            </p>

            <a href="/dashboard/" class="inline-flex items-center justify-center rounded-xl h-12 px-6 bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors shadow-lg shadow-primary/25">
                <span class="material-symbols-outlined mr-2">dashboard</span>
                Retour au tableau de bord
            </a>
        </div>
    `;
}

function renderError() {
    const container = prepareCenteredCard();

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="max-w-md mx-auto text-center py-10">
            <div class="test-icon mb-8">
                <span class="material-symbols-outlined" style="font-size:56px;">error</span>
            </div>

            <h2 class="text-2xl font-bold text-text-main mb-4">
                Impossible de charger le test.
            </h2>

            <p class="text-text-muted mb-8">
                Veuillez réessayer plus tard.
            </p>

            <a href="/dashboard/" class="outline-btn">
                Retour au tableau de bord
            </a>
        </div>
    `;
}

function renderAssignmentsList(assignments) {
    const container = prepareNormalCard();

    if (!container) {
        return;
    }

    const pendingCount = assignments.filter(function (assignment) {
        return assignment.status !== "completed";
    }).length;

    const completedCount = assignments.filter(function (assignment) {
        return assignment.status === "completed";
    }).length;

    container.innerHTML = `
        <div class="mb-6">
            <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 class="text-2xl font-black text-text-main">Mes tests techniques</h2>
                    <p class="text-sm text-text-muted mt-1">
                        Vous avez ${assignments.length} test(s) assigné(s).
                    </p>
                </div>

                <div class="flex flex-wrap gap-2">
                    <span class="badge">${pendingCount} à passer</span>
                    <span class="badge">${completedCount} terminé(s)</span>
                </div>
            </div>
        </div>

        <div class="grid gap-4">
            ${assignments.map(function (assignment) {
                return renderAssignmentCard(assignment);
            }).join("")}
        </div>

        <div class="mt-6">
            <a href="/dashboard/" class="outline-btn inline-flex items-center gap-2">
                <span class="material-symbols-outlined" style="font-size:18px">dashboard</span>
                Retour au tableau de bord
            </a>
        </div>
    `;
}

function renderAssignmentCard(assignment) {
    const isCompleted = assignment.status === "completed";
    const scoreText = isCompleted
        ? `${escapeHtml(assignment.score)}/${escapeHtml(assignment.total)}`
        : "-";

    const statusBadge = isCompleted
        ? `<span class="badge success">Terminé</span>`
        : `<span class="badge warning">À passer</span>`;

    const action = isCompleted
        ? `
            <div class="text-sm text-text-muted">
                Score :
                <span class="font-black text-primary">${scoreText}</span>
            </div>
        `
        : `
            <button
                type="button"
                class="save-btn"
                onclick="startTest(${Number(assignment.id)})"
            >
                Passer le test
            </button>
        `;

    return `
        <div class="border border-border-light rounded-2xl p-5 bg-white">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <div class="flex flex-wrap items-center gap-2 mb-2">
                        ${statusBadge}
                        <span class="badge">
                            <span class="material-symbols-outlined" style="font-size:14px">schedule</span>
                            ${escapeHtml(assignment.duration_minutes)} min
                        </span>
                    </div>

                    <h3 class="text-lg font-black text-text-main">
                        ${escapeHtml(assignment.test_title)}
                    </h3>

                    <p class="text-sm text-text-muted mt-1">
                        Poste : ${escapeHtml(assignment.job_title)}
                    </p>
                </div>

                <div class="flex-shrink-0">
                    ${action}
                </div>
            </div>
        </div>
    `;
}

function startTest(assignmentId) {
    const assignment = currentAssignments.find(function (item) {
        return Number(item.id) === Number(assignmentId);
    });

    if (!assignment) {
        showToast("Test introuvable.", true);
        return;
    }

    selectedAssignment = assignment;
    renderSelectedTest(assignment);
}

function renderSelectedTest(assignment) {
    const container = prepareNormalCard();

    if (!container) {
        return;
    }

    if (!assignment) {
        renderAssignmentsList(currentAssignments);
        return;
    }

    if (assignment.status === "completed") {
        renderAssignmentsList(currentAssignments);
        return;
    }

    const questions = Array.isArray(assignment.questions) ? assignment.questions : [];

    if (!questions.length) {
        renderError();
        return;
    }

    container.innerHTML = `
        <div class="mb-6">
            <button
                type="button"
                class="outline-btn mb-5 inline-flex items-center gap-2"
                onclick="renderAssignmentsList(currentAssignments)"
            >
                <span class="material-symbols-outlined" style="font-size:18px">arrow_back</span>
                Retour à la liste des tests
            </button>

            <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                    <h2 class="text-2xl font-black text-text-main">
                        ${escapeHtml(assignment.test_title)}
                    </h2>
                    <p class="text-sm text-text-muted mt-1">
                        Poste : ${escapeHtml(assignment.job_title)}
                    </p>
                </div>

                <span class="badge">
                    <span class="material-symbols-outlined" style="font-size:14px">schedule</span>
                    ${escapeHtml(assignment.duration_minutes)} min
                </span>
            </div>

            <p class="text-sm text-text-muted">
                Répondez à toutes les questions puis cliquez sur “Soumettre le test”.
            </p>
        </div>

        <form id="technicalTestForm" class="space-y-5">
            ${questions.map(function (question, index) {
                return renderQuestion(question, index);
            }).join("")}

            <div class="flex justify-end pt-2">
                <button type="submit" id="submitTestButton" class="save-btn">
                    Soumettre le test
                </button>
            </div>
        </form>
    `;

    const form = document.getElementById("technicalTestForm");

    if (form) {
        form.addEventListener("submit", submitSelectedTest);
    }
}

function renderQuestion(question, index) {
    const questionId = Number(question.id);

    return `
        <div class="question-card border border-border-light rounded-xl p-5 bg-white">
            <div class="flex items-start gap-3 mb-4">
                <span class="badge">${index + 1}</span>
                <h3 class="font-bold text-text-main">${escapeHtml(question.question_text)}</h3>
            </div>

            <div class="grid gap-3">
                ${renderOption(questionId, "A", question.option_a)}
                ${renderOption(questionId, "B", question.option_b)}
                ${renderOption(questionId, "C", question.option_c)}
                ${renderOption(questionId, "D", question.option_d)}
            </div>
        </div>
    `;
}

function renderOption(questionId, letter, text) {
    return `
        <label class="answer-option">
            <input
                type="radio"
                name="question_${questionId}"
                value="${letter}"
                class="mt-1 text-primary focus:ring-primary"
                required
            >
            <span>
                <span class="font-bold text-primary">${letter}.</span>
                <span class="text-sm text-text-main">${escapeHtml(text)}</span>
            </span>
        </label>
    `;
}

async function submitSelectedTest(event) {
    event.preventDefault();

    const token = getToken();
    const form = document.getElementById("technicalTestForm");
    const button = document.getElementById("submitTestButton");

    if (!token || !form || !selectedAssignment) {
        return;
    }

    const answers = {};
    const checkedInputs = form.querySelectorAll("input[type='radio']:checked");
    const questionBlocks = form.querySelectorAll(".question-card");

    checkedInputs.forEach(function (input) {
        const questionId = input.name.replace("question_", "");
        answers[questionId] = input.value;
    });

    if (Object.keys(answers).length < questionBlocks.length) {
        showToast("Veuillez répondre à toutes les questions.", true);
        return;
    }

    try {
        if (button) {
            button.disabled = true;
            button.textContent = "Soumission...";
        }

        const response = await fetch(`/api/my-tests/${selectedAssignment.id}/submit/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: "Bearer " + token
            },
            body: JSON.stringify({
                answers: answers
            })
        });

        const data = await response.json().catch(function () {
            return {};
        });

        if (!response.ok) {
            showToast(data.error || data.detail || "Impossible de soumettre le test.", true);
            return;
        }

        showToast("Test soumis avec succès.", false);

        currentAssignments = currentAssignments.map(function (assignment) {
            if (Number(assignment.id) === Number(data.assignment_id)) {
                return {
                    ...assignment,
                    status: "completed",
                    score: data.score,
                    total: data.total
                };
            }

            return assignment;
        });

        selectedAssignment = null;
        renderAssignmentsList(currentAssignments);
    } catch (error) {
        console.error("Test submit error:", error);
        showToast("Erreur de connexion au serveur.", true);
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Soumettre le test";
        }
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", function () {
    const token = getToken();
    const role = localStorage.getItem("user_role");

    if (!token) {
        window.location.href = "/signin/";
        return;
    }

    if (role && role !== "candidate") {
        window.location.href = "/jobs/";
        return;
    }

    const toggleBtn = document.getElementById("toggleBtn");
    const logoutLink = document.getElementById("logoutLink");

    if (toggleBtn) {
        toggleBtn.addEventListener("click", toggleSidebar);
    }

    if (logoutLink) {
        logoutLink.addEventListener("click", logoutUser);
    }

    loadSidebarProfile();
    loadMyTests();
});