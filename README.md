
<h1 align="center">🚀 AT Ranking Website</h1>

<p align="center">
  <strong>AI-Powered Recruitment Platform for AT</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Django-6.0-092E20?style=for-the-badge&logo=django&logoColor=white" alt="Django">
  <img src="https://img.shields.io/badge/DRF-3.17-ff1709?style=for-the-badge&logo=django&logoColor=white" alt="DRF">
  <img src="https://img.shields.io/badge/Python-3.x-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/PyTorch-2.12-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white" alt="PyTorch">
  <img src="https://img.shields.io/badge/TailwindCSS-CDN-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind">
  <img src="https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite">
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Data Models](#-data-models)
- [API Endpoints](#-api-endpoints)
- [AI Matching Engine](#-ai-matching-engine)
- [Chatbot](#-chatbot)
- [Frontend Pages](#-frontend-pages)
- [Installation & Setup](#-installation--setup)
- [Usage](#-usage)
- [Admin Panel](#-admin-panel)
- [Authors](#-authors)

---

## 🌐 Overview

**AT Ranking Website** is a full-stack recruitment platform built for **Algérie Télécom**. It streamlines the entire hiring pipeline — from job posting and candidate application to **AI-powered CV analysis**, **technical testing**, and **candidate ranking**.

The platform serves two types of users:

| Role | Description |
|------|-------------|
| **Candidate** | Browse jobs, apply with CV, take technical tests, track application status |
| **RH (Recruiter)** | Post jobs, review applications, send technical tests, view AI scores & rankings |

---

## ✨ Key Features

### 🤖 AI-Powered CV Matching
- Semantic similarity analysis using **Sentence Transformers** (`all-MiniLM-L6-v2`)
- Multi-dimensional scoring: profile match, mission relevance, category alignment, CV quality
- Automatic ranking of candidates per job posting
- Detailed AI summary saved per application

### 📝 Complete Recruitment Workflow
- Job creation with missions & searched profiles
- Candidate application with CV upload (PDF)
- Application status tracking (Pending → Reviewed → Accepted/Rejected)
- Acceptance gated behind completed technical test

### 📊 Technical Testing System
- RH creates MCQ tests linked to specific jobs
- Tests assigned to eligible candidates (AI score ≥ 50)
- Timed tests with automatic grading
- Score tracking per assignment

### 💬 Recruitment Chatbot
- French-language virtual assistant
- Answers questions about: job listings, application process, requirements, locations, salaries, contact info
- Pulls live data from the Jobs API

### 📈 Dashboard & Analytics
- RH dashboard with comprehensive stats
- Application counts by status
- AI eligibility breakdown
- Test completion tracking
- Applications per job breakdown

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  Landing Page · Job List · Job Detail · Apply · Profile     │
│  Candidate Dashboard · RH Dashboard · Technical Tests       │
│  Sign In · Sign Up · About/Contact · Chatbot Widget         │
│         (Django Templates + Tailwind CSS + Vanilla JS)      │
└────────────────────────┬────────────────────────────────────┘
                         │ AJAX / Fetch API
┌────────────────────────▼────────────────────────────────────┐
│                     REST API (DRF)                           │
│  Auth (JWT) · Jobs · Applications · Profiles · Categories   │
│  Technical Tests · Test Assignments · Stats · Chatbot       │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   DJANGO ORM + SQLite                        │
│  User · Profile · Job · JobMission · JobSearchedProfile     │
│  Application · Category · TechnicalTest · TestQuestion      │
│  TestAssignment                                              │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                 AI MATCHING ENGINE                            │
│  Sentence-Transformers · scikit-learn · pdfplumber           │
│  PDF Extraction → Scoring → Ranking → Summary               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **Django 6.0** | Web framework & ORM |
| **Django REST Framework 3.17** | RESTful API layer |
| **SimpleJWT** | JWT authentication (access + refresh tokens) |
| **django-cors-headers** | Cross-Origin Resource Sharing |
| **SQLite** | Database (development) |

### AI & Machine Learning
| Technology | Purpose |
|------------|---------|
| **Sentence Transformers** | Semantic embeddings (`all-MiniLM-L6-v2`) |
| **scikit-learn** | Cosine similarity computation |
| **PyTorch** | Deep learning backend |
| **pdfplumber** | PDF text extraction from CVs |
| **HuggingFace Transformers** | NLP model hub |

### Frontend
| Technology | Purpose |
|------------|---------|
| **Django Templates** | Server-side rendering |
| **Tailwind CSS (CDN)** | Utility-first styling |
| **Vanilla JavaScript** | Client-side interactivity |
| **Inter Font** | Modern typography |
| **Material Symbols** | Icon system |

---

## 📁 Project Structure

```
finals/
├── manage.py                    # Django management script
├── requirements.txt             # Python dependencies
├── db.sqlite3                   # SQLite database
│
├── finals/                      # Django project configuration
│   ├── settings.py              # Settings (DB, apps, JWT, CORS, etc.)
│   ├── urls.py                  # Root URL configuration
│   ├── wsgi.py                  # WSGI entry point
│   └── asgi.py                  # ASGI entry point
│
├── careers/                     # Main Django app
│   ├── models.py                # Data models (User, Job, Application, etc.)
│   ├── views.py                 # API views & HTML page views
│   ├── views_chatbot.py         # Chatbot API endpoint
│   ├── serializers.py           # DRF serializers
│   ├── urls.py                  # URL routing (pages + API)
│   ├── admin.py                 # Django admin configuration
│   ├── ai_matching.py           # AI resume matching engine
│   └── migrations/              # Database migrations
│
├── templates/careers/           # HTML templates
│   ├── landingpage.html         # Home page with hero & latest jobs
│   ├── job_list.html            # All job listings with filters
│   ├── job_detail.html          # Single job details + apply
│   ├── application.html         # Application form
│   ├── signin.html              # Login page
│   ├── signup.html              # Registration page
│   ├── connexion.html           # Connection hub
│   ├── profile.html             # Candidate profile management
│   ├── candidate_dashboard.html # Candidate application tracker
│   ├── candidate_test.html      # Technical test interface
│   ├── rh.html                  # RH recruiter dashboard
│   ├── about_contact.html       # About & contact page
│   ├── chatbot.html             # Chatbot widget (partial)
│   └── partials/
│       └── candidate_sidebar.html
│
├── static/
│   ├── css/
│   │   └── chatbot.css          # Chatbot widget styles
│   ├── js/
│   │   ├── auth-flow.js         # Authentication flow logic
│   │   ├── job-list.js          # Job listing page logic
│   │   ├── job-detail.js        # Job detail page logic
│   │   ├── application.js       # Application form logic
│   │   ├── profile.js           # Profile management logic
│   │   ├── candidate-dashboard.js # Candidate dashboard logic
│   │   ├── candidate-test.js    # Technical test UI & timer
│   │   ├── rh-dashboard.js      # RH dashboard (57KB — full CRUD)
│   │   └── chatbot.js           # Chatbot widget logic
│   └── images/
│       ├── logo.png             # Algérie Télécom logo
│       └── logo algerie telecome.png
│
└── media/                       # User-uploaded files
    ├── cvs/                     # Profile CVs
    ├── profiles/                # Profile pictures
    └── applications/            # Application CVs
```

---

## 📊 Data Models

### User System
```
User (extends AbstractUser)
├── email (unique, used as USERNAME_FIELD)
├── phone
└── role: "candidate" | "rh"
    └── Profile (OneToOne)
        ├── full_name
        ├── address
        ├── cv_file
        └── profile_picture
```

### Job System
```
Category
└── Job
    ├── title, description, location
    ├── contract_type: CDI | CDD | Stage | Alternance
    ├── is_active, date_posted
    ├── created_by → User (role=rh)
    ├── JobMission[] (responsibilities)
    └── JobSearchedProfile[] (required skills/profile)
```

### Application System
```
Application
├── job → Job
├── candidate → User (role=candidate)
├── full_name, phone, cv_file, message
├── status: pending | reviewed | accepted | rejected
├── ai_score (auto-computed)
├── ai_summary (auto-generated)
└── TestAssignment (OneToOne)
    ├── test → TechnicalTest
    ├── status: sent | completed
    ├── score, total
    └── sent_at, completed_at
```

### Technical Test System
```
TechnicalTest
├── job → Job
├── title, duration_minutes, is_active
├── created_by → User (role=rh)
└── TestQuestion[]
    ├── question_text
    ├── option_a, option_b, option_c, option_d
    ├── correct_answer: A | B | C | D
    └── order
```

---

## 🔗 API Endpoints

### Authentication
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/register/` | Register new user | ❌ |
| `POST` | `/api/login/` | Login & get JWT tokens | ❌ |

### Profile
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/profile/` | Get current user profile | ✅ |
| `PUT` | `/api/profile/update/` | Update profile (name, CV, photo) | ✅ |

### Categories
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/categories/` | List all job categories | ❌ |

### Jobs
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/jobs/` | List jobs (active for public, all for RH) | ❌ |
| `GET` | `/api/jobs/<id>/` | Get job details | ❌ |
| `POST` | `/api/jobs/create/` | Create a new job posting | ✅ RH |
| `PATCH` | `/api/jobs/<id>/status/` | Activate, close, or delete a job | ✅ RH |

### Applications — Candidate
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/apply/<job_id>/` | Apply to a job (triggers AI analysis) | ✅ Candidate |
| `GET` | `/api/my-applications/` | List own applications | ✅ Candidate |

### Applications — RH
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/candidates/` | List all candidate profiles | ✅ RH |
| `GET` | `/api/candidates/<id>/` | Get candidate detail + applications | ✅ RH |
| `GET` | `/api/applications/` | List all applications (filterable by job) | ✅ RH |
| `PATCH` | `/api/applications/<id>/status/` | Update application status | ✅ RH |
| `DELETE` | `/api/applications/<id>/delete/` | Delete an application | ✅ RH |

### Technical Tests — RH
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/tests/` | List all tests (filterable by job) | ✅ RH |
| `POST` | `/api/tests/create/` | Create test with questions | ✅ RH |
| `POST` | `/api/applications/<id>/send-test/` | Assign test to candidate (AI score ≥ 50) | ✅ RH |
| `GET` | `/api/test-assignments/` | List all test assignments | ✅ RH |

### Technical Tests — Candidate
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/my-test/` | Get latest assigned test | ✅ Candidate |
| `POST` | `/api/my-test/submit/` | Submit test answers | ✅ Candidate |
| `GET` | `/api/my-tests/` | Get all assigned tests | ✅ Candidate |
| `POST` | `/api/my-tests/<id>/submit/` | Submit a specific test | ✅ Candidate |

### Statistics & Chatbot
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/stats/` | Dashboard statistics | ✅ RH |
| `POST` | `/api/chatbot/` | Chatbot message processing | ❌ |

---

## 🤖 AI Matching Engine

The AI matching engine (`careers/ai_matching.py`) automatically analyzes every CV submitted and ranks candidates against job requirements.

### Scoring Dimensions

| Dimension | Weight | Method |
|-----------|--------|--------|
| **Profile Requirements Match** | 35% | Keyword matching against `JobSearchedProfile` entries |
| **Semantic Similarity** | 30% | Cosine similarity of sentence embeddings (job vs CV) |
| **Mission Relevance** | 20% | Keyword matching against `JobMission` entries |
| **Category Match** | 10% | Category name detection in CV text |
| **CV Quality** | 5% | Structural section detection (education, experience, skills, etc.) |

### How It Works

```
1. Candidate submits application with PDF CV
        ↓
2. PDF text extracted via pdfplumber
        ↓
3. Job context built from: title + description + category + missions + searched profiles
        ↓
4. Five scoring dimensions computed independently
        ↓
5. Weighted final score calculated (0-100%)
        ↓
6. Human-readable AI summary generated
        ↓
7. ai_score + ai_summary saved to Application record
        ↓
8. Candidates with score ≥ 50 are eligible for technical tests
```

### Verdict Scale

| Score Range | Verdict |
|-------------|---------|
| ≥ 75% | 🟢 Strong match |
| 50% – 74% | 🟡 Moderate match |
| 30% – 49% | 🟠 Weak match |
| < 30% | 🔴 Poor match |

### CLI Usage

```bash
# Rank all applicants for a specific job
python careers/ai_matching.py job <job_id>

# Analyze a single application
python careers/ai_matching.py application <app_id>
```

---

## 💬 Chatbot

The recruitment chatbot is an embedded widget available on all public pages. It provides instant answers in **French** about:

- 📋 Available job listings (live from API)
- 📍 Jobs by location (Alger, Oran, Constantine, Blida)
- 📝 Application process
- 📄 Required documents
- 🎓 Education & experience requirements
- ⏰ Response timelines
- 💰 Salary & benefits
- 📞 Contact information

The chatbot uses keyword-based intent detection and fetches live data from the Jobs API when answering job-related queries.

---

## 🖥 Frontend Pages

| Page | URL | Description |
|------|-----|-------------|
| **Landing Page** | `/` | Hero section, trust strip, latest job cards, chatbot |
| **Job List** | `/jobs/` | Filterable job listings with search & categories |
| **Job Detail** | `/jobs/detail/?id=<id>` | Full job description, missions, requirements, apply button |
| **Apply** | `/apply/` | Application form with CV upload |
| **Sign In** | `/signin/` | Email + password login |
| **Sign Up** | `/signup/` | Registration (candidate or RH) |
| **Connection Hub** | `/connexion/` | Connection options |
| **Profile** | `/profile/` | Candidate profile management (photo, CV, address) |
| **Candidate Dashboard** | `/dashboard/` | Application tracking with status indicators |
| **Technical Test** | `/test-technique/` | Timed MCQ test interface with auto-submit |
| **RH Dashboard** | `/rh/` | Full recruiter suite: jobs, applications, tests, stats |
| **About & Contact** | `/about-contact/` | Company info & contact form |

### Design System

- **Primary Color:** `#2C5EAA` (Algérie Télécom blue)
- **Accent Color:** `#00AA5B` (success green)
- **Typography:** Inter font family
- **Icons:** Material Symbols Outlined
- **Styling:** Tailwind CSS via CDN with custom configuration
- **Animations:** Scroll-reveal, hover transitions, card elevations

---

## ⚙️ Installation & Setup

### Prerequisites

- Python 3.10+
- pip
- Git

### 1. Clone the repository

```bash
git clone https://github.com/amnamine/AT_Ranking_Website.git
cd AT_Ranking_Website
```

### 2. Create a virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

> ⚠️ **Note:** PyTorch and Sentence Transformers are large packages (~2GB+). The first run will also download the `all-MiniLM-L6-v2` model (~80MB).

### 4. Apply database migrations

```bash
python manage.py migrate
```

### 5. Create a superuser (admin)

```bash
python manage.py createsuperuser
```

### 6. Run the development server

```bash
python manage.py runserver
```

Visit: [http://127.0.0.1:8000](http://127.0.0.1:8000)

---

## 🚀 Usage

### As a Candidate

1. **Sign Up** → Create an account with role "Candidate"
2. **Browse Jobs** → Explore available positions
3. **Apply** → Submit your CV (PDF) and motivation message
4. **AI Score** → Your CV is automatically analyzed and scored
5. **Take Tests** → If eligible (AI score ≥ 50), complete assigned technical tests
6. **Track Status** → Monitor your application status on the dashboard

### As an RH Recruiter

1. **Sign Up** → Create an account with role "RH"
2. **Post Jobs** → Create job listings with missions & required profiles
3. **Review Applications** → View AI scores, summaries, and candidate rankings
4. **Create Tests** → Build MCQ tests for specific job positions
5. **Assign Tests** → Send tests to eligible candidates
6. **Accept/Reject** → Make hiring decisions (acceptance requires completed test)
7. **View Stats** → Monitor overall recruitment metrics

---

## 🔧 Admin Panel

Access the Django admin at [http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/)

| Model | Permissions | Notes |
|-------|-------------|-------|
| **User** | Full CRUD | Platform administration |
| **Profile** | View only | Managed by candidates |
| **Category** | Full CRUD | System reference data |
| **Job** | View + Delete | RH creates from dashboard |
| **Application** | View + Delete | Includes AI analysis section |
| **TechnicalTest** | View + Delete | Includes inline questions |
| **TestQuestion** | View + Delete | Managed via test creation |
| **TestAssignment** | View + Delete | Shows score & status |

---

## 👥 Authors

Built as a university project for **Algérie Télécom** recruitment workflow optimization.

---

<p align="center">
  <sub>© 2026 AT Ranking Website — AT Carrières</sub>
</p>
