from django.urls import path
from . import views

urlpatterns = [
    path("health/", views.health),
    path("auth/register/", views.register),
    path("auth/login/", views.login),
    path("auth/google/", views.google_login),
    path("auth/me/", views.me),
    path("auth/profile/", views.profile),
    path("admin/users/", views.admin_users),
    path("admin/subscriptions/", views.subscriptions),
    path("notifications/", views.notifications),
    path("support-chat/", views.support_chat),
    path("notes/", views.notes),
    path("notes/<str:note_id>/", views.note_detail),
    path("platforms/", views.platforms),
    path("platforms/<str:platform_id>/", views.platform_detail),
    path("earnings/", views.earnings),
    path("earnings/<str:earning_id>/", views.earning_detail),
    path("dashboard/", views.dashboard),
]
