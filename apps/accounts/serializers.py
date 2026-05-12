from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'phone', 'role', 'is_active']
        read_only_fields = ['id']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['username', 'password', 'full_name', 'phone', 'role']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class MeSerializer(serializers.ModelSerializer):
    is_owner = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'phone', 'role', 'is_owner', 'is_superuser']
        read_only_fields = ['id', 'username', 'role', 'is_owner', 'is_superuser']
