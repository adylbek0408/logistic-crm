from rest_framework import generics, permissions, filters
from rest_framework.response import Response
from django.db.models import Count, Q
from .models import Client
from .serializers import ClientSerializer, ClientListSerializer
from apps.accounts.permissions import IsOwnerOrReadOnly


class ClientListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsOwnerOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['first_name', 'last_name', 'brand_name', 'phone']

    def get_queryset(self):
        qs = Client.objects.annotate(
            orders_count_ann=Count('orders', distinct=True)
        ).order_by('-created_at')

        order_status = self.request.query_params.get('order_status')
        if order_status:
            qs = qs.filter(orders__status=order_status).distinct()

        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)

        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        return qs

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return ClientListSerializer
        return ClientSerializer


class ClientDetailView(generics.RetrieveUpdateDestroyAPIView):
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
