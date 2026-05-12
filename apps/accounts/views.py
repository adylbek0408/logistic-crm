from rest_framework import generics, permissions
from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import MeSerializer, UserSerializer, UserCreateSerializer
from .permissions import IsOwner
from django.contrib.auth import get_user_model

User = get_user_model()


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserListCreateView(generics.ListCreateAPIView):
    queryset = User.objects.filter(is_active=True).order_by('username')
    permission_classes = [IsOwner]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.filter(is_active=True)
    serializer_class = UserSerializer
    permission_classes = [IsOwner]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save()
