"""
AI Resume Matching Module
=========================
Integrates with the Django backend models:
  - Job          → title, description, category, contract_type, location
  - JobMission   → job.missions.all()      (responsibilities)
  - JobSearchedProfile → job.searched_profiles.all()  (required profile/skills)
  - Application  → cv_file, ai_score, ai_summary

How to trigger it:
  Call  run_matching_for_application(application_id)
  or    run_matching_for_job(job_id)   to rank ALL applications of a job.
"""

import os
import re
import sys
import django
import pdfplumber

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# ------------------------------------------------------------------ #
#  DJANGO SETUP  (adjust the settings module path if needed)          #
# ------------------------------------------------------------------ #

import sys
# Dynamically resolve the project root (parent of the 'careers' package)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "finals.settings")
django.setup()

# Import models AFTER django.setup()
from careers.models import Application, Job   # ← change 'your_app' to your real app name


# ------------------------------------------------------------------ #
#  SEMANTIC MODEL                                                     #
# ------------------------------------------------------------------ #

model = SentenceTransformer("all-MiniLM-L6-v2")


# ------------------------------------------------------------------ #
#  PDF TEXT EXTRACTION                                                #
# ------------------------------------------------------------------ #

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract and return lower-cased text from a PDF file."""
    text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        print(f"[PDF ERROR] Could not read {pdf_path}: {e}")
    return text.lower()


# ------------------------------------------------------------------ #
#  BUILD JOB CONTEXT FROM DATABASE                                    #
# ------------------------------------------------------------------ #

def build_job_context(job: Job) -> dict:
    """
    Pull everything that describes the job from the DB.
    Returns a dict with:
      - full_text   : combined text used for semantic embedding
      - missions    : list of mission strings  (JobMission)
      - profile_reqs: list of profile/skill strings (JobSearchedProfile)
      - category    : category name string
      - title       : job title
    """
    missions     = [m.text.lower() for m in job.missions.all()]
    profile_reqs = [p.text.lower() for p in job.searched_profiles.all()]
    category     = job.category.name.lower() if job.category else ""

    # Build a single descriptive text for semantic similarity
    full_text = " ".join([
        job.title,
        job.description,
        category,
        " ".join(missions),
        " ".join(profile_reqs),
    ]).lower()

    return {
        "full_text":    full_text,
        "missions":     missions,
        "profile_reqs": profile_reqs,
        "category":     category,
        "title":        job.title,
    }


# ------------------------------------------------------------------ #
#  SCORING FUNCTIONS                                                  #
# ------------------------------------------------------------------ #

def profile_match_score(resume_text: str, profile_reqs: list) -> tuple:
    """
    Score how many of the job's searched-profile requirements appear in the CV.
    Each requirement (a short phrase/sentence) is checked with simple keyword matching.
    Returns (percent_score, matched_reqs_list).
    """
    if not profile_reqs:
        return 0.0, []

    matched = []
    for req in profile_reqs:
        # Tokenise the requirement into meaningful words (≥ 3 chars)
        keywords = [w for w in re.split(r"\W+", req) if len(w) >= 3]
        if not keywords:
            continue
        # Requirement is "matched" if at least half its keywords appear in the CV
        hits = sum(1 for kw in keywords if re.search(r"\b" + re.escape(kw) + r"\b", resume_text))
        if hits >= max(1, len(keywords) // 2):
            matched.append(req)

    score = (len(matched) / len(profile_reqs)) * 100
    return round(score, 2), matched


def mission_relevance_score(resume_text: str, missions: list) -> float:
    """
    Score how many of the job's missions/responsibilities are reflected in the CV.
    Same soft keyword-matching approach as profile_match_score.
    Returns a percent score.
    """
    if not missions:
        return 0.0

    matched = 0
    for mission in missions:
        keywords = [w for w in re.split(r"\W+", mission) if len(w) >= 3]
        if not keywords:
            continue
        hits = sum(1 for kw in keywords if re.search(r"\b" + re.escape(kw) + r"\b", resume_text))
        if hits >= max(1, len(keywords) // 2):
            matched += 1

    score = (matched / len(missions)) * 100
    return round(score, 2)


def category_match_score(resume_text: str, category: str) -> float:
    """
    Check whether the job's category name appears in the CV.
    Returns 100 if found, 0 otherwise.
    """
    if not category:
        return 0.0
    keywords = [w for w in re.split(r"\W+", category) if len(w) >= 3]
    if not keywords:
        return 0.0
    hits = sum(1 for kw in keywords if re.search(r"\b" + re.escape(kw) + r"\b", resume_text))
    return 100.0 if hits >= max(1, len(keywords) // 2) else 0.0


def resume_quality_score(resume_text: str) -> float:
    """
    Basic quality check: does the CV contain common structural sections?
    Uses what's actually stored in Application (full_name, phone, cv_file).
    """
    sections = ["education", "experience", "skills", "email", "phone"]
    hits = sum(1 for s in sections if re.search(r"\b" + re.escape(s) + r"\b", resume_text))
    return round((hits / len(sections)) * 100, 2)


def semantic_similarity_score(resume_text: str, job_full_text: str) -> float:
    """Cosine similarity between resume and job description embeddings."""
    job_vec    = model.encode([job_full_text])
    resume_vec = model.encode([resume_text])
    sim = cosine_similarity(job_vec, resume_vec)[0][0] * 100
    return round(float(sim), 2)


# ------------------------------------------------------------------ #
#  FINAL SCORE CALCULATION                                            #
# ------------------------------------------------------------------ #

def compute_final_score(
    profile_score:   float,   # from searched_profiles  (what the job requires)
    mission_score:   float,   # from missions           (job responsibilities match)
    category_score:  float,   # from category           (domain match)
    semantic_score:  float,   # semantic similarity
    quality_score:   float,   # CV structure quality
) -> float:
    """
    Weighted final score.
    Weights are tuned to the 3 backend sources:
      - searched_profiles  → most important  (35 %)
      - semantic similarity → overall fit    (30 %)
      - missions            → experience fit (20 %)
      - category            → domain match   (10 %)
      - quality             → CV quality      (5 %)
    """
    final = (
        profile_score  * 0.35 +
        semantic_score * 0.30 +
        mission_score  * 0.20 +
        category_score * 0.10 +
        quality_score  * 0.05
    )
    return round(final, 2)


# ------------------------------------------------------------------ #
#  AI SUMMARY GENERATOR                                               #
# ------------------------------------------------------------------ #

def generate_summary(
    job_title:      str,
    profile_score:  float,
    mission_score:  float,
    category_score: float,
    semantic_score: float,
    quality_score:  float,
    final_score:    float,
    matched_reqs:   list,
) -> str:
    """Build a human-readable summary saved to Application.ai_summary."""

    if final_score >= 75:
        verdict = "Strong match"
    elif final_score >= 50:
        verdict = "Moderate match"
    elif final_score >= 30:
        verdict = "Weak match"
    else:
        verdict = "Poor match"

    matched_text = (
        ", ".join(matched_reqs[:5]) + ("..." if len(matched_reqs) > 5 else "")
        if matched_reqs else "none detected"
    )

    summary = (
        f"[{verdict}] for position: {job_title}\n"
        f"Final Score        : {final_score}%\n"
        f"Profile Req. Match : {profile_score}%  — matched requirements: {matched_text}\n"
        f"Mission Relevance  : {mission_score}%\n"
        f"Category Match     : {category_score}%\n"
        f"Semantic Similarity: {semantic_score}%\n"
        f"CV Quality         : {quality_score}%"
    )
    return summary


# ------------------------------------------------------------------ #
#  MAIN PUBLIC FUNCTIONS                                              #
# ------------------------------------------------------------------ #

def analyze_application(application: Application) -> dict:
    """
    Run full AI analysis for a single Application instance.
    Saves ai_score and ai_summary back to the database.
    Returns the result dict.
    """
    job = application.job

    # 1. Build job context from DB
    job_ctx = build_job_context(job)

    # 2. Extract CV text
    cv_path = application.cv_file.path  # Django FileField gives us the absolute path
    resume_text = extract_text_from_pdf(cv_path)

    if not resume_text.strip():
        print(f"[WARNING] Empty CV text for application {application.id}")
        application.ai_score   = 0
        application.ai_summary = "Could not extract text from the uploaded CV."
        application.save(update_fields=["ai_score", "ai_summary"])
        return {}

    # 3. Score each dimension
    profile_score, matched_reqs = profile_match_score(resume_text, job_ctx["profile_reqs"])
    mission_score               = mission_relevance_score(resume_text, job_ctx["missions"])
    cat_score                   = category_match_score(resume_text, job_ctx["category"])
    sem_score                   = semantic_similarity_score(resume_text, job_ctx["full_text"])
    qual_score                  = resume_quality_score(resume_text)

    # 4. Final score
    final = compute_final_score(profile_score, mission_score, cat_score, sem_score, qual_score)

    # 5. Summary
    summary = generate_summary(
        job_title      = job_ctx["title"],
        profile_score  = profile_score,
        mission_score  = mission_score,
        category_score = cat_score,
        semantic_score = sem_score,
        quality_score  = qual_score,
        final_score    = final,
        matched_reqs   = matched_reqs,
    )

    # 6. Save to DB  (ai_score is PositiveIntegerField → cast to int)
    application.ai_score   = int(round(final))
    application.ai_summary = summary
    application.save(update_fields=["ai_score", "ai_summary"])

    result = {
        "application_id":  application.id,
        "candidate":       application.full_name,
        "job":             job_ctx["title"],
        "final_score":     final,
        "profile_score":   profile_score,
        "mission_score":   mission_score,
        "category_score":  cat_score,
        "semantic_score":  sem_score,
        "quality_score":   qual_score,
        "matched_reqs":    matched_reqs,
        "ai_summary":      summary,
    }
    return result


def run_matching_for_application(application_id: int):
    """Entry point: analyse a single application by its ID."""
    try:
        application = Application.objects.select_related("job", "job__category").get(pk=application_id)
    except Application.DoesNotExist:
        print(f"[ERROR] Application {application_id} not found.")
        return

    result = analyze_application(application)
    _print_result(result, rank=1)


def run_matching_for_job(job_id: int):
    """
    Entry point: analyse ALL applications for a given Job,
    then print them ranked by ai_score descending.
    """
    try:
        job = Job.objects.prefetch_related("missions", "searched_profiles", "category").get(pk=job_id)
    except Job.DoesNotExist:
        print(f"[ERROR] Job {job_id} not found.")
        return

    applications = Application.objects.filter(job=job).select_related("job", "job__category")

    if not applications.exists():
        print(f"No applications found for job: {job.title}")
        return

    results = []
    for app in applications:
        print(f"  Analyzing: {app.full_name} ...")
        result = analyze_application(app)
        if result:
            results.append(result)

    results = sorted(results, key=lambda x: x["final_score"], reverse=True)

    print(f"\n{'='*55}")
    print(f"  RANKING FOR JOB: {job.title}")
    print(f"{'='*55}")
    for i, r in enumerate(results, start=1):
        _print_result(r, rank=i)


# ------------------------------------------------------------------ #
#  PRETTY PRINT                                                       #
# ------------------------------------------------------------------ #

def _print_result(r: dict, rank: int = 1):
    print(f"\n{'─'*50}")
    print(f"  Rank #{rank}  —  {r.get('candidate', 'Unknown')}")
    print(f"{'─'*50}")
    print(f"  Job              : {r.get('job', '')}")
    print(f"  Final Score      : {r.get('final_score', 0)}%")
    print(f"  Profile Match    : {r.get('profile_score', 0)}%")
    print(f"  Mission Relevance: {r.get('mission_score', 0)}%")
    print(f"  Category Match   : {r.get('category_score', 0)}%")
    print(f"  Semantic Sim.    : {r.get('semantic_score', 0)}%")
    print(f"  CV Quality       : {r.get('quality_score', 0)}%")
    matched = r.get("matched_reqs", [])
    print(f"  Matched Reqs     : {', '.join(matched) if matched else 'none'}")
    print(f"\n  Summary:\n{r.get('ai_summary', '')}\n")


# ------------------------------------------------------------------ #
#  CLI USAGE                                                          #
# ------------------------------------------------------------------ #

if __name__ == "__main__":
    """
    Usage:
      python ai_matching.py job <job_id>           → rank all applicants for a job
      python ai_matching.py application <app_id>   → analyse a single application
    """
    if len(sys.argv) == 3:
        mode    = sys.argv[1]
        id_arg  = int(sys.argv[2])

        if mode == "job":
            run_matching_for_job(id_arg)
        elif mode == "application":
            run_matching_for_application(id_arg)
        else:
            print("Usage: python ai_matching.py [job|application] <id>")
    else:
        print("Usage: python ai_matching.py [job|application] <id>")