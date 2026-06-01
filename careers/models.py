from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings


class User(AbstractUser):
    ROLE_CHOICES = (
        ("candidate", "Candidate"),
        ("rh", "RH"),
    )

    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default="candidate"
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return f"{self.email} ({self.role})"


class Profile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    full_name = models.CharField(max_length=255)
    address = models.CharField(max_length=255, blank=True)
    cv_file = models.FileField(upload_to="cvs/", blank=True, null=True)
    profile_picture = models.ImageField(upload_to="profiles/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Profile: {self.full_name}"


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name


class Job(models.Model):
    CONTRACT_CHOICES = (
        ("CDI", "CDI"),
        ("CDD", "CDD"),
        ("Stage", "Stage"),
        ("Alternance", "Alternance"),
    )

    title = models.CharField(max_length=255)

    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="jobs",
    )

    description = models.TextField()

    location = models.CharField(max_length=255)

    contract_type = models.CharField(
        max_length=20,
        choices=CONTRACT_CHOICES
    )

    date_posted = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_jobs",
        limit_choices_to={"role": "rh"},
    )

    class Meta:
        ordering = ["-date_posted"]

    def __str__(self):
        return self.title


class JobMission(models.Model):
    job = models.ForeignKey(
        Job,
        on_delete=models.CASCADE,
        related_name="missions",
    )
    text = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.text


class JobSearchedProfile(models.Model):
    job = models.ForeignKey(
        Job,
        on_delete=models.CASCADE,
        related_name="searched_profiles",
    )
    text = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "Searched profile"
        verbose_name_plural = "Searched profiles"

    def __str__(self):
        return self.text


class Application(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("reviewed", "Reviewed"),
        ("accepted", "Accepted"),
        ("rejected", "Rejected"),
    )

    job = models.ForeignKey(
        Job,
        on_delete=models.CASCADE,
        related_name="applications"
    )

    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="applications",
        limit_choices_to={"role": "candidate"},
    )

    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    cv_file = models.FileField(upload_to="applications/cvs/")

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending"
    )

    # AI CV analysis placeholders.
    # Later, your friend's AI model can update these fields.
    ai_score = models.PositiveIntegerField(null=True, blank=True)
    ai_summary = models.TextField(blank=True, default="")

    applied_date = models.DateTimeField(auto_now_add=True)

    message = models.TextField(blank=True)

    class Meta:
        ordering = ["-applied_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["job", "candidate"],
                name="unique_application_per_job_candidate",
            ),
        ]

    def __str__(self):
        return f"{self.candidate.email} -> {self.job.title} ({self.status})"


class TechnicalTest(models.Model):
    job = models.ForeignKey(
        Job,
        on_delete=models.CASCADE,
        related_name="technical_tests",
    )

    title = models.CharField(max_length=255)

    duration_minutes = models.PositiveIntegerField(default=20)

    is_active = models.BooleanField(default=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_technical_tests",
        limit_choices_to={"role": "rh"},
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} - {self.job.title}"


class TestQuestion(models.Model):
    ANSWER_CHOICES = (
        ("A", "A"),
        ("B", "B"),
        ("C", "C"),
        ("D", "D"),
    )

    test = models.ForeignKey(
        TechnicalTest,
        on_delete=models.CASCADE,
        related_name="questions",
    )

    question_text = models.TextField()

    option_a = models.CharField(max_length=255)
    option_b = models.CharField(max_length=255)
    option_c = models.CharField(max_length=255)
    option_d = models.CharField(max_length=255)

    correct_answer = models.CharField(
        max_length=1,
        choices=ANSWER_CHOICES,
    )

    order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"Question {self.order} - {self.test.title}"


class TestAssignment(models.Model):
    STATUS_CHOICES = (
        ("sent", "Test envoyé"),
        ("completed", "Test complété"),
    )

    application = models.OneToOneField(
        Application,
        on_delete=models.CASCADE,
        related_name="test_assignment",
    )

    test = models.ForeignKey(
        TechnicalTest,
        on_delete=models.CASCADE,
        related_name="assignments",
    )

    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default="sent",
    )

    score = models.PositiveIntegerField(null=True, blank=True)
    total = models.PositiveIntegerField(default=0)

    sent_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-sent_at"]

    def __str__(self):
        return f"{self.application.full_name} - {self.test.title} ({self.status})"