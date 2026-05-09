from rest_framework import serializers
from .models import Client


class ClientSerializer(serializers.ModelSerializer):
    orders_count = serializers.SerializerMethodField()
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = Client
        fields = [
            'id', 'first_name', 'last_name', 'display_name',
            'phone', 'brand_name', 'notes', 'created_at', 'orders_count',
        ]
        read_only_fields = ['id', 'created_at']

    def get_orders_count(self, obj):
        return obj.orders.count()


class ClientListSerializer(serializers.ModelSerializer):
    orders_count = serializers.SerializerMethodField()
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = Client
        fields = ['id', 'first_name', 'last_name', 'display_name', 'phone', 'brand_name', 'orders_count']

    def get_orders_count(self, obj):
        return getattr(obj, 'orders_count_ann', 0)
