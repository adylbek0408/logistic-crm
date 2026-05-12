from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import MeView, UserListCreateView, UserDetailView

urlpatterns = [
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='auth_me'),
    path('users/', UserListCreateView.as_view(), name='user_list'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user_detail'),
]
