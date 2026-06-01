from django.shortcuts import render
from django.contrib.auth import authenticate, get_user_model
from django.db.models import Count
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from careers.ai_matching import analyze_application

from .models import (
    Profile,
    Job,
    Application,
    Category,
    TechnicalTest,
    TestAssignment,
)

from .serializers import (
    UserRegistrationSerializer,
    LoginSerializer,
    UserSerializer,
    ProfileSerializer,
    JobSerializer,
    JobCreateSerializer,
    ApplicationSerializer,
    ApplicationListSerializer,
    CandidateProfileSerializer,
    CategorySerializer,
    TechnicalTestSerializer,
    TechnicalTestCreateSerializer,
    TestAssignmentSerializer,
    CandidateMyTestSerializer,
)

User = get_user_model()


# ========================= HTML PAGES =========================

def landingpage(request):
    return render(request, "careers/landingpage.html")


def job_list(request):
    return render(request, "careers/job_list.html")


def about_contact(request):
    return render(request, "careers/about_contact.html")


def job_detail(request):
    return render(request, "careers/job_detail.html")


def application(request):
    return render(request, "careers/application.html")


def profile_page(request):
    return render(request, "careers/profile.html")


def candidate_test_page(request):
    return render(request, "careers/candidate_test.html")


def candidate_dashboard(request):
    return render(request, "careers/candidate_dashboard.html")


def connexion_page(request):
    return render(request, "careers/connexion.html")


def signin_page(request):
    return render(request, "careers/signin.html")


def signup_page(request):
    return render(request, "careers/signup.html")


def rh_page(request):
    return render(request, "careers/rh.html")


# ========================= HELPERS =========================

def _get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)

    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


def _is_rh_user(user):
    if getattr(user, "is_staff", False):
        return True

    return getattr(user, "role", None) == "rh"


def _is_candidate_user(user):
    return getattr(user, "role", None) == "candidate"


def _normalize_text_list(value):
    if value is None:
        return []

    if isinstance(value, list):
        return [
            str(item).strip()
            for item in value
            if str(item).strip()
        ]

    if isinstance(value, str):
        return [
            line.strip()
            for line in value.split("\n")
            if line.strip()
        ]

    return []


# ========================= AUTH =========================

@api_view(["POST"])
@permission_classes([AllowAny])
def register_user(request):
    serializer = UserRegistrationSerializer(data=request.data)

    if serializer.is_valid():
        user = serializer.save()

        Profile.objects.get_or_create(
            user=user,
            defaults={"full_name": request.data.get("full_name", user.email)},
        )

        tokens = _get_tokens_for_user(user)

        return Response(
            {
                "message": "User registered successfully",
                "user": UserSerializer(user, context={"request": request}).data,
                "tokens": tokens,
            },
            status=status.HTTP_201_CREATED,
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_user(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]
    password = serializer.validated_data["password"]

    user = authenticate(request=request, username=email, password=password)

    if user is None:
        return Response(
            {"error": "Invalid email or password"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    tokens = _get_tokens_for_user(user)

    return Response(
        {
            "message": "Login successful",
            "user": UserSerializer(user, context={"request": request}).data,
            "tokens": tokens,
        },
        status=status.HTTP_200_OK,
    )


# ========================= PROFILE API =========================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_profile(request):
    profile, _ = Profile.objects.get_or_create(
        user=request.user,
        defaults={"full_name": request.user.email},
    )

    serializer = ProfileSerializer(profile, context={"request": request})
    data = serializer.data

    data["email"] = request.user.email
    data["phone"] = getattr(request.user, "phone", "") or ""

    return Response(data, status=status.HTTP_200_OK)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def update_profile(request):
    profile, _ = Profile.objects.get_or_create(
        user=request.user,
        defaults={"full_name": request.user.email},
    )

    phone = request.data.get("phone")

    if phone is not None:
        request.user.phone = phone
        request.user.save(update_fields=["phone"])

    serializer = ProfileSerializer(
        profile,
        data=request.data,
        partial=True,
        context={"request": request},
    )

    if serializer.is_valid():
        serializer.save()

        data = serializer.data
        data["email"] = request.user.email
        data["phone"] = getattr(request.user, "phone", "") or ""

        return Response(data, status=status.HTTP_200_OK)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ========================= CATEGORIES =========================

@api_view(["GET"])
@permission_classes([AllowAny])
def category_list_api(request):
    categories = Category.objects.all().order_by("name")
    serializer = CategorySerializer(categories, many=True)

    return Response(serializer.data, status=status.HTTP_200_OK)


# ========================= JOBS =========================

@api_view(["GET"])
@permission_classes([AllowAny])
def job_list_api(request):
    """
    PATCH 1 — RH users see ALL jobs (active + inactive).
              Public users see only active jobs.
    """
    jobs_queryset = (
        Job.objects
        .select_related("category", "created_by")
        .prefetch_related("missions", "searched_profiles")
        .order_by("-date_posted")
    )

    # RH users can see every job regardless of is_active
    if request.user.is_authenticated and _is_rh_user(request.user):
        jobs = jobs_queryset
    else:
        jobs = jobs_queryset.filter(is_active=True)

    serializer = JobSerializer(jobs, many=True, context={"request": request})

    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def job_detail_api(request, id):
    try:
        job = (
            Job.objects
            .select_related("category", "created_by")
            .prefetch_related("missions", "searched_profiles")
            .get(id=id, is_active=True)
        )
    except Job.DoesNotExist:
        return Response(
            {"error": "Job not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    serializer = JobSerializer(job, context={"request": request})

    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser, FormParser, MultiPartParser])
def create_job(request):
    if not _is_rh_user(request.user):
        return Response(
            {"error": "Only RH users can create jobs"},
            status=status.HTTP_403_FORBIDDEN,
        )

    data = request.data.copy()

    data["missions"] = _normalize_text_list(request.data.get("missions"))
    data["searched_profiles"] = _normalize_text_list(
        request.data.get("searched_profiles")
    )

    serializer = JobCreateSerializer(data=data)

    if serializer.is_valid():
        job = serializer.save(
            created_by=request.user,
            is_active=True,
        )

        job = (
            Job.objects
            .select_related("category", "created_by")
            .prefetch_related("missions", "searched_profiles")
            .get(id=job.id)
        )

        return Response(
            JobSerializer(job, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    return Response(
        {
            "error": "Impossible de créer l'offre.",
            "details": serializer.errors,
        },
        status=status.HTTP_400_BAD_REQUEST,
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def update_job_status(request, id):
    """
    PATCH 2 — New endpoint.
    RH can set a job Active, Close (is_active=False), or Delete it.

    Payload:
        { "is_active": true }   → Active
        { "is_active": false }  → Close
        { "action": "delete" }  → permanent delete (after frontend confirmation)
    """
    if not _is_rh_user(request.user):
        return Response(
            {"error": "Only RH users can update jobs"},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        job = Job.objects.get(id=id)
    except Job.DoesNotExist:
        return Response(
            {"error": "Job not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    action = request.data.get("action")

    # ---- DELETE ----
    if action == "delete":
        job.delete()
        return Response(
            {"message": "Job deleted successfully"},
            status=status.HTTP_200_OK,
        )

    # ---- ACTIVE / CLOSE ----
    is_active = request.data.get("is_active")

    if is_active is not None:
        job.is_active = bool(is_active)
        job.save(update_fields=["is_active"])

        return Response(
            {
                "message": "Job status updated",
                "is_active": job.is_active,
            },
            status=status.HTTP_200_OK,
        )

    return Response(
        {"error": "Provide 'is_active' (true/false) or 'action': 'delete'"},
        status=status.HTTP_400_BAD_REQUEST,
    )


# ========================= APPLY =========================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def apply_to_job(request, job_id):
    try:
        job = Job.objects.get(id=job_id, is_active=True)
    except Job.DoesNotExist:
        return Response(
            {"error": "Job not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if _is_rh_user(request.user):
        return Response(
            {"error": "RH users cannot apply to jobs"},
            status=status.HTTP_403_FORBIDDEN,
        )

    if not _is_candidate_user(request.user):
        return Response(
            {"error": "Only candidate users can apply to jobs"},
            status=status.HTTP_403_FORBIDDEN,
        )

    if Application.objects.filter(job=job, candidate=request.user).exists():
        return Response(
            {"error": "You already applied for this job"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = ApplicationSerializer(data=request.data)

    if serializer.is_valid():

        application_obj = serializer.save(
            candidate=request.user,
            job=job,
        )

        # =========================
        # AI MATCHING INTEGRATION
        # =========================
        try:
            analyze_application(application_obj)

        except Exception as e:
            print(f"[AI MATCHING ERROR] {e}")

        return Response(
            ApplicationListSerializer(
                application_obj,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ========================= CANDIDATE APPLICATIONS =========================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_applications(request):
    if not _is_candidate_user(request.user):
        return Response(
            {"error": "Only candidate users can access their applications"},
            status=status.HTTP_403_FORBIDDEN,
        )

    applications = (
        Application.objects
        .filter(candidate=request.user)
        .select_related("job", "job__category", "candidate")
        .prefetch_related("test_assignment", "test_assignment__test")
        .order_by("-applied_date")
    )

    serializer = ApplicationListSerializer(
        applications,
        many=True,
        context={"request": request},
    )

    return Response(serializer.data, status=status.HTTP_200_OK)


# ========================= RH CANDIDATE MANAGEMENT =========================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def all_candidates(request):
    if not _is_rh_user(request.user):
        return Response(
            {"error": "Only RH users can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN,
        )

    candidate_profiles = (
        Profile.objects
        .filter(user__role="candidate")
        .select_related("user")
    )

    serializer = CandidateProfileSerializer(
        candidate_profiles,
        many=True,
        context={"request": request},
    )

    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def candidate_detail(request, id):
    if not _is_rh_user(request.user):
        return Response(
            {"error": "Only RH users can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        candidate = User.objects.get(
            id=id,
            role="candidate",
        )
    except User.DoesNotExist:
        return Response(
            {"error": "Candidate not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    profile, _ = Profile.objects.get_or_create(
        user=candidate,
        defaults={"full_name": candidate.email},
    )

    applications = (
        Application.objects
        .filter(candidate=candidate)
        .select_related("job", "job__category", "candidate")
        .prefetch_related("test_assignment", "test_assignment__test")
        .order_by("-applied_date")
    )

    return Response(
        {
            "candidate": UserSerializer(
                candidate,
                context={"request": request},
            ).data,
            "profile": ProfileSerializer(
                profile,
                context={"request": request},
            ).data,
            "applications": ApplicationListSerializer(
                applications,
                many=True,
                context={"request": request},
            ).data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def all_applications(request):
    if not _is_rh_user(request.user):
        return Response(
            {"error": "Only RH users can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN,
        )

    applications = (
        Application.objects
        .select_related("candidate", "job", "job__category")
        .prefetch_related("test_assignment", "test_assignment__test")
        .order_by("-applied_date")
    )

    job_id = request.query_params.get("job_id")

    if job_id:
        applications = applications.filter(job_id=job_id)

    serializer = ApplicationListSerializer(
        applications,
        many=True,
        context={"request": request},
    )

    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser, FormParser, MultiPartParser])
def update_application_status(request, id):
    if not _is_rh_user(request.user):
        return Response(
            {"error": "Only RH users can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        application_obj = (
            Application.objects
            .select_related("candidate", "job", "job__category")
            .prefetch_related("test_assignment", "test_assignment__test")
            .get(id=id)
        )
    except Application.DoesNotExist:
        return Response(
            {"error": "Application not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    new_status = request.data.get("status")

    if not new_status:
        return Response(
            {"error": "Status field is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # "reviewed" is removed from the frontend but kept here for data integrity.
    # Frontend never sends it anymore, so it cannot be set via the RH UI.
    allowed_statuses = ["pending", "reviewed", "accepted", "rejected"]

    if new_status not in allowed_statuses:
        return Response(
            {"error": f"Invalid status. Choose one of: {allowed_statuses}"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # PATCH 3 — Block acceptance if test not completed with a score
    if new_status == "accepted":
        assignment = getattr(application_obj, "test_assignment", None)

        if assignment is None:
            return Response(
                {
                    "error": (
                        "Ce candidat doit d'abord compléter un test technique "
                        "avant d'être accepté."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if assignment.status != "completed":
            return Response(
                {
                    "error": (
                        "Le test technique n'est pas encore complété. "
                        "Vous ne pouvez pas accepter ce candidat."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if assignment.score is None:
            return Response(
                {
                    "error": (
                        "Aucun score enregistré pour ce test. "
                        "Vous ne pouvez pas accepter ce candidat."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    application_obj.status = new_status
    application_obj.save(update_fields=["status"])

    return Response(
        ApplicationListSerializer(
            application_obj,
            context={"request": request},
        ).data,
        status=status.HTTP_200_OK,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_application(request, id):
    if not _is_rh_user(request.user):
        return Response(
            {"error": "Only RH users can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        application_obj = Application.objects.get(id=id)
    except Application.DoesNotExist:
        return Response(
            {"error": "Application not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    application_obj.delete()

    return Response(
        {"message": "Application deleted successfully"},
        status=status.HTTP_200_OK,
    )


# ========================= TECHNICAL TESTS - RH =========================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def test_list_api(request):
    if not _is_rh_user(request.user):
        return Response(
            {"error": "Only RH users can access tests"},
            status=status.HTTP_403_FORBIDDEN,
        )

    tests = (
        TechnicalTest.objects
        .select_related("job", "created_by")
        .prefetch_related("questions")
        .order_by("-created_at")
    )

    job_id = request.query_params.get("job_id")

    if job_id:
        tests = tests.filter(job_id=job_id)

    serializer = TechnicalTestSerializer(
        tests,
        many=True,
        context={"request": request},
    )

    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def create_test_api(request):
    if not _is_rh_user(request.user):
        return Response(
            {"error": "Only RH users can create tests"},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = TechnicalTestCreateSerializer(data=request.data)

    if serializer.is_valid():
        technical_test = serializer.save(created_by=request.user)

        technical_test = (
            TechnicalTest.objects
            .select_related("job", "created_by")
            .prefetch_related("questions")
            .get(id=technical_test.id)
        )

        return Response(
            TechnicalTestSerializer(
                technical_test,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def send_test_to_application(request, application_id):
    if not _is_rh_user(request.user):
        return Response(
            {"error": "Only RH users can send tests"},
            status=status.HTTP_403_FORBIDDEN,
        )

    test_id = request.data.get("test_id")

    if not test_id:
        return Response(
            {"error": "test_id is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        application_obj = (
            Application.objects
            .select_related("job", "candidate")
            .get(id=application_id)
        )
    except Application.DoesNotExist:
        return Response(
            {"error": "Application not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if application_obj.ai_score is None or application_obj.ai_score < 50:
        return Response(
            {
                "error": "Candidate is not eligible for test. AI score must be >= 50."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        technical_test = (
            TechnicalTest.objects
            .prefetch_related("questions")
            .get(
                id=test_id,
                job=application_obj.job,
                is_active=True,
            )
        )
    except TechnicalTest.DoesNotExist:
        return Response(
            {"error": "Active test not found for this job"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if technical_test.questions.count() == 0:
        return Response(
            {"error": "This test has no questions"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if hasattr(application_obj, "test_assignment"):
        return Response(
            {"error": "A test has already been sent to this candidate"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    assignment = TestAssignment.objects.create(
        application=application_obj,
        test=technical_test,
        status="sent",
        total=technical_test.questions.count(),
    )

    return Response(
        TestAssignmentSerializer(
            assignment,
            context={"request": request},
        ).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def test_assignments_api(request):
    if not _is_rh_user(request.user):
        return Response(
            {"error": "Only RH users can access test assignments"},
            status=status.HTTP_403_FORBIDDEN,
        )

    assignments = (
        TestAssignment.objects
        .select_related(
            "application",
            "application__candidate",
            "application__job",
            "test",
            "test__job",
        )
        .order_by("-sent_at")
    )

    serializer = TestAssignmentSerializer(
        assignments,
        many=True,
        context={"request": request},
    )

    return Response(serializer.data, status=status.HTTP_200_OK)


# ========================= TECHNICAL TESTS - CANDIDATE =========================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_test_api(request):
    """
    Old single-test endpoint.
    Kept for compatibility.
    Returns the latest assigned test only.
    """
    if not _is_candidate_user(request.user):
        return Response(
            {"error": "Only candidates can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN,
        )

    assignment = (
        TestAssignment.objects
        .filter(application__candidate=request.user)
        .select_related("application", "application__job", "test")
        .prefetch_related("test__questions")
        .order_by("-sent_at")
        .first()
    )

    if not assignment:
        return Response(
            {
                "authorized": False,
                "message": "Vous n'êtes pas encore autorisé à passer le test.",
            },
            status=status.HTTP_200_OK,
        )

    return Response(
        {
            "authorized": True,
            "assignment": CandidateMyTestSerializer(
                assignment,
                context={"request": request},
            ).data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def submit_my_test_api(request):
    """
    Old single-test submit endpoint.
    Kept for compatibility.
    Submits the latest active test only.
    """
    if not _is_candidate_user(request.user):
        return Response(
            {"error": "Only candidates can submit tests"},
            status=status.HTTP_403_FORBIDDEN,
        )

    answers = request.data.get("answers", {})

    if not isinstance(answers, dict):
        return Response(
            {"error": "answers must be an object"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    assignment = (
        TestAssignment.objects
        .filter(application__candidate=request.user, status="sent")
        .select_related("application", "application__job", "test")
        .prefetch_related("test__questions")
        .order_by("-sent_at")
        .first()
    )

    if not assignment:
        return Response(
            {"error": "No active test assignment found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    questions = list(assignment.test.questions.all())
    score = 0

    for question in questions:
        submitted_answer = str(answers.get(str(question.id), "")).upper().strip()

        if submitted_answer == question.correct_answer:
            score += 1

    assignment.score = score
    assignment.total = len(questions)
    assignment.status = "completed"
    assignment.completed_at = timezone.now()
    assignment.save(
        update_fields=[
            "score",
            "total",
            "status",
            "completed_at",
        ]
    )

    return Response(
        {
            "message": "Test submitted successfully",
            "score": assignment.score,
            "total": assignment.total,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_tests_api(request):
    """
    New multiple-test endpoint.
    Returns all test assignments for the logged-in candidate.
    """
    if not _is_candidate_user(request.user):
        return Response(
            {"error": "Only candidates can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN,
        )

    assignments = (
        TestAssignment.objects
        .filter(application__candidate=request.user)
        .select_related("application", "application__job", "test")
        .prefetch_related("test__questions")
        .order_by("-sent_at")
    )

    if not assignments.exists():
        return Response(
            {
                "authorized": False,
                "message": "Vous n'êtes pas encore autorisé à passer le test.",
                "assignments": [],
            },
            status=status.HTTP_200_OK,
        )

    return Response(
        {
            "authorized": True,
            "assignments": CandidateMyTestSerializer(
                assignments,
                many=True,
                context={"request": request},
            ).data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def submit_candidate_test_api(request, assignment_id):
    """
    New multiple-test submit endpoint.
    Candidate submits one specific assignment.
    """
    if not _is_candidate_user(request.user):
        return Response(
            {"error": "Only candidates can submit tests"},
            status=status.HTTP_403_FORBIDDEN,
        )

    answers = request.data.get("answers", {})

    if not isinstance(answers, dict):
        return Response(
            {"error": "answers must be an object"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        assignment = (
            TestAssignment.objects
            .filter(
                id=assignment_id,
                application__candidate=request.user,
            )
            .select_related("application", "application__job", "test")
            .prefetch_related("test__questions")
            .get()
        )
    except TestAssignment.DoesNotExist:
        return Response(
            {"error": "Test assignment not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if assignment.status == "completed":
        return Response(
            {"error": "This test has already been submitted"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    questions = list(assignment.test.questions.all())
    score = 0

    for question in questions:
        submitted_answer = str(answers.get(str(question.id), "")).upper().strip()

        if submitted_answer == question.correct_answer:
            score += 1

    assignment.score = score
    assignment.total = len(questions)
    assignment.status = "completed"
    assignment.completed_at = timezone.now()
    assignment.save(
        update_fields=[
            "score",
            "total",
            "status",
            "completed_at",
        ]
    )

    return Response(
        {
            "message": "Test submitted successfully",
            "assignment_id": assignment.id,
            "score": assignment.score,
            "total": assignment.total,
            "status": assignment.status,
        },
        status=status.HTTP_200_OK,
    )


# ========================= STATS =========================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def application_stats(request):
    if not _is_rh_user(request.user):
        return Response(
            {"error": "Only RH users can access this endpoint"},
            status=status.HTTP_403_FORBIDDEN,
        )

    # PATCH 4 — reuse the same queryset to avoid duplicate DB hits
    applications = Application.objects.all()
    jobs = Job.objects.all()
    active_jobs = jobs.filter(is_active=True)   # reuses jobs queryset

    status_counts = {
        "pending":  applications.filter(status="pending").count(),
        "reviewed": applications.filter(status="reviewed").count(),
        "accepted": applications.filter(status="accepted").count(),
        "rejected": applications.filter(status="rejected").count(),
    }

    test_counts = {
        "sent":      TestAssignment.objects.filter(status="sent").count(),
        "completed": TestAssignment.objects.filter(status="completed").count(),
    }

    ai_counts = {
        "eligible":    applications.filter(ai_score__gte=50).count(),
        "not_eligible": applications.filter(ai_score__lt=50).count(),
        "not_scored":   applications.filter(ai_score__isnull=True).count(),
    }

    applications_by_job = (
        Application.objects
        .values("job__id", "job__title")
        .annotate(total_applications=Count("id"))
        .order_by("-total_applications", "job__title")
    )

    return Response(
        {
            "total_jobs":         jobs.count(),
            "active_jobs":        active_jobs.count(),
            "total_applications": applications.count(),
            "total_candidates":   User.objects.filter(role="candidate").count(),
            "status_counts":      status_counts,
            "test_counts":        test_counts,
            "ai_counts":          ai_counts,
            "applications_by_job": list(applications_by_job),
        },
        status=status.HTTP_200_OK,
    )