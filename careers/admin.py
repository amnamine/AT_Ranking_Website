from django.contrib import admin

from .models import (
    User,
    Profile,
    Job,
    JobMission,
    JobSearchedProfile,
    Application,
    Category,
    TechnicalTest,
    TestQuestion,
    TestAssignment,
)


# =========================================================
# INLINE MODELS
# =========================================================

class JobMissionInline(admin.TabularInline):
    model = JobMission
    extra = 1
    fields = ("text", "order")


class JobSearchedProfileInline(admin.TabularInline):
    model = JobSearchedProfile
    extra = 1
    fields = ("text", "order")


class TestQuestionInline(admin.TabularInline):
    model = TestQuestion
    extra = 1

    fields = (
        "order",
        "question_text",
        "option_a",
        "option_b",
        "option_c",
        "option_d",
        "correct_answer",
    )


# =========================================================
# JOB ADMIN
# ADMIN = VIEW + DELETE ONLY
# RH handles creation/editing from dashboard
# =========================================================

@admin.register(Job)
class JobAdmin(admin.ModelAdmin):

    list_display = (
        "title",
        "category",
        "location",
        "contract_type",
        "is_active",
        "date_posted",
        "created_by",
    )

    list_filter = (
        "contract_type",
        "is_active",
        "category",
    )

    search_fields = (
        "title",
        "description",
        "location",
    )

    readonly_fields = (
        "date_posted",
    )

    inlines = (
        JobMissionInline,
        JobSearchedProfileInline,
    )

    fieldsets = (
        (
            "Informations principales",
            {
                "fields": (
                    "title",
                    "category",
                    "description",
                    "location",
                    "contract_type",
                    "is_active",
                )
            },
        ),
        (
            "Création",
            {
                "fields": (
                    "created_by",
                    "date_posted",
                )
            },
        ),
    )

    # -----------------------------
    # PERMISSIONS
    # -----------------------------

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return True


# =========================================================
# USER ADMIN
# FULL ACCESS FOR PLATFORM ADMIN
# =========================================================

@admin.register(User)
class UserAdmin(admin.ModelAdmin):

    list_display = (
        "email",
        "username",
        "phone",
        "role",
        "is_staff",
        "is_active",
    )

    list_filter = (
        "role",
        "is_staff",
        "is_active",
    )

    search_fields = (
        "email",
        "username",
        "phone",
    )


# =========================================================
# PROFILE ADMIN
# VIEW ONLY
# =========================================================

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):

    list_display = (
        "full_name",
        "user",
        "created_at",
    )

    search_fields = (
        "full_name",
        "user__email",
        "address",
    )

    readonly_fields = (
        "created_at",
    )

    # -----------------------------
    # PERMISSIONS
    # -----------------------------

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# =========================================================
# CATEGORY ADMIN
# FULL ACCESS
# SYSTEM REFERENCE DATA
# =========================================================

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):

    list_display = (
        "name",
    )

    search_fields = (
        "name",
    )


# =========================================================
# APPLICATION ADMIN
# VIEW + DELETE ONLY
# =========================================================

@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):

    list_display = (
        "full_name",
        "job",
        "candidate",
        "phone",
        "status",
        "ai_score",
        "test_status",
        "test_score",
        "applied_date",
    )

    list_filter = (
        "status",
        "ai_score",
        "applied_date",
    )

    search_fields = (
        "full_name",
        "phone",
        "candidate__email",
        "job__title",
    )

    readonly_fields = (
        "applied_date",
    )

    fieldsets = (
        (
            "Candidature",
            {
                "fields": (
                    "job",
                    "candidate",
                    "full_name",
                    "phone",
                    "cv_file",
                    "message",
                    "status",
                    "applied_date",
                )
            },
        ),
        (
            "Analyse IA",
            {
                "fields": (
                    "ai_score",
                    "ai_summary",
                )
            },
        ),
    )

    def test_status(self, obj):

        assignment = getattr(obj, "test_assignment", None)

        if not assignment:
            return "Aucun test"

        return assignment.status

    test_status.short_description = "Statut test"

    def test_score(self, obj):

        assignment = getattr(obj, "test_assignment", None)

        if not assignment:
            return "-"

        if assignment.score is None:
            return "-"

        return f"{assignment.score}/{assignment.total}"

    test_score.short_description = "Score test"

    # -----------------------------
    # PERMISSIONS
    # -----------------------------

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return True


# =========================================================
# TECHNICAL TEST ADMIN
# VIEW + DELETE ONLY
# =========================================================

@admin.register(TechnicalTest)
class TechnicalTestAdmin(admin.ModelAdmin):

    list_display = (
        "title",
        "job",
        "duration_minutes",
        "is_active",
        "created_by",
        "question_count",
        "created_at",
    )

    list_filter = (
        "is_active",
        "job",
        "created_at",
    )

    search_fields = (
        "title",
        "job__title",
    )

    readonly_fields = (
        "created_at",
    )

    inlines = (
        TestQuestionInline,
    )

    fieldsets = (
        (
            "Test technique",
            {
                "fields": (
                    "job",
                    "title",
                    "duration_minutes",
                    "is_active",
                )
            },
        ),
        (
            "Création",
            {
                "fields": (
                    "created_by",
                    "created_at",
                )
            },
        ),
    )

    def question_count(self, obj):
        return obj.questions.count()

    question_count.short_description = "Questions"

    # -----------------------------
    # PERMISSIONS
    # -----------------------------

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return True


# =========================================================
# TEST QUESTION ADMIN
# VIEW + DELETE ONLY
# =========================================================

@admin.register(TestQuestion)
class TestQuestionAdmin(admin.ModelAdmin):

    list_display = (
        "test",
        "order",
        "short_question",
        "correct_answer",
    )

    list_filter = (
        "test",
        "correct_answer",
    )

    search_fields = (
        "question_text",
        "test__title",
        "test__job__title",
    )

    def short_question(self, obj):

        if len(obj.question_text) > 80:
            return obj.question_text[:80] + "..."

        return obj.question_text

    short_question.short_description = "Question"

    # -----------------------------
    # PERMISSIONS
    # -----------------------------

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return True


# =========================================================
# TEST ASSIGNMENT ADMIN
# VIEW + DELETE ONLY
# =========================================================

@admin.register(TestAssignment)
class TestAssignmentAdmin(admin.ModelAdmin):

    list_display = (
        "application",
        "candidate_email",
        "job_title",
        "test",
        "status",
        "score_display",
        "sent_at",
        "completed_at",
    )

    list_filter = (
        "status",
        "sent_at",
        "completed_at",
    )

    search_fields = (
        "application__full_name",
        "application__candidate__email",
        "application__job__title",
        "test__title",
    )

    readonly_fields = (
        "sent_at",
        "completed_at",
    )

    def candidate_email(self, obj):
        return obj.application.candidate.email

    candidate_email.short_description = "Email candidat"

    def job_title(self, obj):
        return obj.application.job.title

    job_title.short_description = "Offre"

    def score_display(self, obj):

        if obj.score is None:
            return "-"

        return f"{obj.score}/{obj.total}"

    score_display.short_description = "Score"

    # -----------------------------
    # PERMISSIONS
    # -----------------------------

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return True