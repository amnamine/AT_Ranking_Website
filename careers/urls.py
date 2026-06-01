from django.urls import path
from . import views
from .views_chatbot import chatbot_api   # add this import

urlpatterns = [
    path('api/chatbot/', chatbot_api, name='api_chatbot'),

    # =========================
    # HTML PAGES
    # =========================
    path('', views.landingpage, name='landingpage'),
    path('jobs/', views.job_list, name='job_list'),
    path('jobs/detail/', views.job_detail, name='job_detail'),
    path('about-contact/', views.about_contact, name='about_contact'),
    path('apply/', views.application, name='application'),
    path('profile/', views.profile_page, name='profile_page'),
    path('test-technique/', views.candidate_test_page, name='candidate_test_page'),
    path('dashboard/', views.candidate_dashboard, name='candidate_dashboard'),
    path('connexion/', views.connexion_page, name='connexion_page'),
    path('signin/', views.signin_page, name='signin_page'),
    path('signup/', views.signup_page, name='signup_page'),
    path('rh/', views.rh_page, name='rh_page'),

    # =========================
    # AUTH API
    # =========================
    path('api/register/', views.register_user, name='api_register'),
    path('api/login/', views.login_user, name='api_login'),

    # =========================
    # PROFILE API
    # =========================
    path('api/profile/', views.get_profile, name='api_profile'),
    path('api/profile/update/', views.update_profile, name='api_profile_update'),

    # =========================
    # CATEGORIES API
    # =========================
    path('api/categories/', views.category_list_api, name='api_categories'),

    # =========================
    # JOBS API
    # =========================
    path('api/jobs/', views.job_list_api, name='api_jobs'),
    path('api/jobs/create/', views.create_job, name='api_create_job'),

    # PATCH — must come AFTER api/jobs/create/ to avoid route conflict
    path('api/jobs/<int:id>/status/', views.update_job_status, name='api_update_job_status'),

    path('api/jobs/<int:id>/', views.job_detail_api, name='api_job_detail'),

    # =========================
    # APPLICATIONS API - CANDIDATE
    # =========================
    path('api/apply/<int:job_id>/', views.apply_to_job, name='api_apply'),
    path('api/my-applications/', views.my_applications, name='api_my_applications'),

    # =========================
    # RH FEATURES API
    # =========================
    path('api/candidates/', views.all_candidates, name='api_candidates'),
    path('api/candidates/<int:id>/', views.candidate_detail, name='api_candidate_detail'),
    path('api/applications/', views.all_applications, name='api_applications'),
    path('api/applications/<int:id>/status/', views.update_application_status, name='api_update_status'),
    path('api/applications/<int:id>/delete/', views.delete_application, name='api_delete_application'),
    path('api/stats/', views.application_stats, name='api_stats'),

    # =========================
    # TECHNICAL TESTS API - RH
    # =========================
    path('api/tests/', views.test_list_api, name='api_tests'),
    path('api/tests/create/', views.create_test_api, name='api_create_test'),
    path(
        'api/applications/<int:application_id>/send-test/',
        views.send_test_to_application,
        name='api_send_test',
    ),
    path(
        'api/test-assignments/',
        views.test_assignments_api,
        name='api_test_assignments',
    ),

    # =========================
    # TECHNICAL TESTS API - CANDIDATE
    # =========================

    # Old single-test endpoints kept for compatibility
    path('api/my-test/', views.my_test_api, name='api_my_test'),
    path('api/my-test/submit/', views.submit_my_test_api, name='api_submit_my_test'),

    # New multiple-test endpoints
    path('api/my-tests/', views.my_tests_api, name='api_my_tests'),
    path(
        'api/my-tests/<int:assignment_id>/submit/',
        views.submit_candidate_test_api,
        name='api_submit_candidate_test',
    ),
]