from rest_framework import generics, permissions, filters
from django.db.models import Count, Q
from .models import Client
from .serializers import ClientSerializer, ClientListSerializer
from apps.accounts.permissions import IsOwnerOrReadOnly


class ClientListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsOwnerOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['first_name', 'last_name', 'brand_name', 'phone']

    def get_queryset(self):
        return Client.objects.annotate(
            orders_count_ann=Count('orders')
        ).order_by('-created_at')

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ClientListSerializer
        return ClientSerializer


class ClientDetailView(generics.RetrieveUpdateAPIView):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsOwnerOrReadOnly]


class ClientOrdersView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from apps.orders.models import Order
        from apps.orders.serializers import OrderListSerializer
        return Order.objects.filter(client_id=self.kwargs['pk']).select_related('client', 'template')

    def get_serializer_class(self):
        from apps.orders.serializers import OrderListSerializer
        return OrderListSerializer
