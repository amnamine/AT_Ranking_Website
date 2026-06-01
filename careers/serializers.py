from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
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

User = get_user_model()


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ("email", "password", "phone", "role")

    def create(self, validated_data):
        email = validated_data["email"]
        password = validated_data["password"]
        phone = validated_data.get("phone")
        role = validated_data.get("role", "candidate")
        username = email.split("@")[0]

        base_username = username
        suffix = 1

        while User.objects.filter(username=username).exists():
            username = f"{base_username}{suffix}"
            suffix += 1

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            phone=phone,
            role=role,
        )

        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class ProfileSerializer(serializers.ModelSerializer):
    cv_file_url = serializers.SerializerMethodField(read_only=True)
    profile_picture_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Profile
        fields = (
            "id",
            "full_name",
            "address",
            "cv_file",
            "cv_file_url",
            "profile_picture",
            "profile_picture_url",
            "created_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "cv_file_url",
            "profile_picture_url",
        )

    def get_cv_file_url(self, obj):
        request = self.context.get("request")

        if obj.cv_file and request:
            return request.build_absolute_uri(obj.cv_file.url)

        return None

    def get_profile_picture_url(self, obj):
        request = self.context.get("request")

        if obj.profile_picture and request:
            return request.build_absolute_uri(obj.profile_picture.url)

        return None


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ("id", "email", "phone", "role", "profile")
        read_only_fields = fields


class CandidateProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    cv_file_url = serializers.SerializerMethodField(read_only=True)
    profile_picture_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Profile
        fields = (
            "id",
            "full_name",
            "address",
            "email",
            "phone",
            "cv_file",
            "cv_file_url",
            "profile_picture",
            "profile_picture_url",
            "created_at",
        )
        read_only_fields = fields

    def get_cv_file_url(self, obj):
        request = self.context.get("request")

        if obj.cv_file and request:
            return request.build_absolute_uri(obj.cv_file.url)

        return None

    def get_profile_picture_url(self, obj):
        request = self.context.get("request")

        if obj.profile_picture and request:
            return request.build_absolute_uri(obj.profile_picture.url)

        return None


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name")


class JobMissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobMission
        fields = ("id", "text", "order")


class JobSearchedProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobSearchedProfile
        fields = ("id", "text", "order")


class JobSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    missions = JobMissionSerializer(many=True, read_only=True)
    searched_profiles = JobSearchedProfileSerializer(many=True, read_only=True)

    class Meta:
        model = Job
        fields = (
            "id",
            "title",
            "category",
            "category_name",
            "description",
            "missions",
            "searched_profiles",
            "location",
            "contract_type",
            "date_posted",
            "is_active",
            "created_by",
            "created_by_email",
        )
        read_only_fields = fields


class JobCreateSerializer(serializers.ModelSerializer):
    missions = serializers.ListField(
        child=serializers.CharField(allow_blank=False),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    searched_profiles = serializers.ListField(
        child=serializers.CharField(allow_blank=False),
        write_only=True,
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = Job
        fields = (
            "id",
            "title",
            "category",
            "description",
            "location",
            "contract_type",
            "is_active",
            "missions",
            "searched_profiles",
        )
        read_only_fields = ("id",)

    def _normalize_items(self, value):
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

    def create(self, validated_data):
        missions = self._normalize_items(validated_data.pop("missions", []))
        searched_profiles = self._normalize_items(
            validated_data.pop("searched_profiles", [])
        )

        job = Job.objects.create(**validated_data)

        for index, mission_text in enumerate(missions, start=1):
            JobMission.objects.create(
                job=job,
                text=mission_text,
                order=index,
            )

        for index, profile_text in enumerate(searched_profiles, start=1):
            JobSearchedProfile.objects.create(
                job=job,
                text=profile_text,
                order=index,
            )

        return job


class TestQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestQuestion
        fields = (
            "id",
            "question_text",
            "option_a",
            "option_b",
            "option_c",
            "option_d",
            "correct_answer",
            "order",
        )


class CandidateTestQuestionSerializer(serializers.ModelSerializer):
    """
    Candidate version of questions.
    Important: correct_answer is intentionally hidden.
    """

    class Meta:
        model = TestQuestion
        fields = (
            "id",
            "question_text",
            "option_a",
            "option_b",
            "option_c",
            "option_d",
            "order",
        )


class TechnicalTestSerializer(serializers.ModelSerializer):
    job_title = serializers.CharField(source="job.title", read_only=True)
    questions = TestQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = TechnicalTest
        fields = (
            "id",
            "job",
            "job_title",
            "title",
            "duration_minutes",
            "is_active",
            "questions",
            "created_at",
        )


class TechnicalTestCreateSerializer(serializers.ModelSerializer):
    questions = TestQuestionSerializer(many=True, write_only=True)

    class Meta:
        model = TechnicalTest
        fields = (
            "id",
            "job",
            "title",
            "duration_minutes",
            "is_active",
            "questions",
        )
        read_only_fields = ("id",)

    def create(self, validated_data):
        questions = validated_data.pop("questions", [])

        test = TechnicalTest.objects.create(**validated_data)

        for index, question_data in enumerate(questions, start=1):
            TestQuestion.objects.create(
                test=test,
                question_text=question_data["question_text"],
                option_a=question_data["option_a"],
                option_b=question_data["option_b"],
                option_c=question_data["option_c"],
                option_d=question_data["option_d"],
                correct_answer=question_data["correct_answer"],
                order=question_data.get("order") or index,
            )

        return test


class TestAssignmentSerializer(serializers.ModelSerializer):
    test = TechnicalTestSerializer(read_only=True)
    application_id = serializers.IntegerField(source="application.id", read_only=True)
    candidate_name = serializers.CharField(source="application.full_name", read_only=True)
    candidate_email = serializers.EmailField(source="application.candidate.email", read_only=True)
    job_title = serializers.CharField(source="application.job.title", read_only=True)

    class Meta:
        model = TestAssignment
        fields = (
            "id",
            "application_id",
            "candidate_name",
            "candidate_email",
            "job_title",
            "test",
            "status",
            "score",
            "total",
            "sent_at",
            "completed_at",
        )


class CandidateMyTestSerializer(serializers.ModelSerializer):
    test_title = serializers.CharField(source="test.title", read_only=True)
    job_title = serializers.CharField(source="application.job.title", read_only=True)
    duration_minutes = serializers.IntegerField(source="test.duration_minutes", read_only=True)
    questions = CandidateTestQuestionSerializer(
        source="test.questions",
        many=True,
        read_only=True,
    )

    class Meta:
        model = TestAssignment
        fields = (
            "id",
            "status",
            "score",
            "total",
            "test_title",
            "job_title",
            "duration_minutes",
            "questions",
            "sent_at",
            "completed_at",
        )


class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = (
            "id",
            "job",
            "full_name",
            "phone",
            "cv_file",
            "message",
            "status",
            "ai_score",
            "ai_summary",
            "applied_date",
        )
        read_only_fields = (
            "id",
            "job",
            "status",
            "ai_score",
            "ai_summary",
            "applied_date",
        )


class ApplicationStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = ("status",)


class ApplicationListSerializer(serializers.ModelSerializer):
    candidate = UserSerializer(read_only=True)
    job = JobSerializer(read_only=True)
    test_assignment = TestAssignmentSerializer(read_only=True)

    class Meta:
        model = Application
        fields = (
            "id",
            "job",
            "candidate",
            "full_name",
            "phone",
            "cv_file",
            "message",
            "status",
            "ai_score",
            "ai_summary",
            "test_assignment",
            "applied_date",
        )