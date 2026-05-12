from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Count, Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .models import Template, Order, OrderRow
from .serializers import (
    TemplateSerializer, OrderSerializer, OrderCreateSerializer,
    OrderUpdateSerializer, OrderListSerializer, OrderRowUpdateSerializer,
)
from apps.accounts.permissions import IsOwner, IsOwnerOrReadOnly


class TemplateListCreateView(generics.ListCreateAPIView):
    queryset = Template.objects.select_related('created_by').all()
    serializer_class = TemplateSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsOwner()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class TemplateDeleteView(generics.DestroyAPIView):
    queryset = Template.objects.all()
    permission_classes = [IsOwner]


class OrderListCreateView(generics.ListCreateAPIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsOwner()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = Order.objects.select_related('client', 'template', 'created_by').annotate(
            rows_count_ann=Count('rows'),
            done_count_ann=Count('rows', filter=Q(rows__fulfillment_status='done')),
        ).order_by('-created_at')

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        client_id = self.request.query_params.get('client')
        if client_id:
            qs = qs.filter(client_id=client_id)

        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)

        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        return qs

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return OrderCreateSerializer
        return OrderListSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class OrderDetailView(generics.RetrieveUpdateAPIView):
    queryset = Order.objects.select_related('client', 'template', 'created_by').prefetch_related('rows__updated_by')

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return OrderUpdateSerializer
        return OrderSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # Only owner can change payment info
        if not request.user.is_owner:
            for field in ['payment_status', 'payment_amount', 'payment_receipt']:
                request.data.pop(field, None)

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(OrderSerializer(instance, context={'request': request}).data)


class OrderRowUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk, row_id):
        order = get_object_or_404(Order, pk=pk)
        row = get_object_or_404(OrderRow, pk=row_id, order=order)

        serializer = OrderRowUpdateSerializer(row, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        row = serializer.save(updated_by=request.user)

        from .serializers import OrderRowSerializer
        return Response(OrderRowSerializer(row).data)


class GeneratePDFView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = get_object_or_404(Order, pk=pk)
        from .tasks import generate_pdf_task
        generate_pdf_task.delay(order.pk)
        return Response({'status': 'generating'})


class DownloadPDFView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        order = get_object_or_404(Order, pk=pk)
        if not order.pdf_file:
            # Generate synchronously if not exists
            from .pdf import generate_invoice_pdf
            from django.core.files.base import ContentFile
            import datetime
            pdf_bytes = generate_invoice_pdf(order)
            date_str = datetime.date.today().strftime('%Y%m%d')
            filename = f'invoice_{order.pk}_{date_str}.pdf'
            order.pdf_file.save(filename, ContentFile(pdf_bytes), save=True)

        response = FileResponse(order.pdf_file.open('rb'), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{order.pdf_file.name.split("/")[-1]}"'
        return response


class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Count, Sum, F, ExpressionWrapper, DecimalField
        from django.db.models.functions import TruncMonth
        from django.utils import timezone

        stats = Order.objects.aggregate(
            total=Count('id'),
            new=Count('id', filter=Q(status='new')),
            in_progress=Count('id', filter=Q(status='in_progress')),
            completed=Count('id', filter=Q(status='completed')),
        )

        # Revenue = sum of done rows (quantity × price)
        rev_expr = ExpressionWrapper(
            F('quantity') * F('price'),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        )
        revenue_qs = OrderRow.objects.filter(
            fulfillment_status='done',
            quantity__isnull=False,
            price__isnull=False,
        ).annotate(row_total=rev_expr)

        stats['total_revenue'] = float(revenue_qs.aggregate(s=Sum('row_total'))['s'] or 0)

        now = timezone.now()
        stats['month_revenue'] = float(
            revenue_qs.filter(
                order__created_at__year=now.year,
                order__created_at__month=now.month,
            ).aggregate(s=Sum('row_total'))['s'] or 0
        )

        # Top 6 clients by revenue
        top = (
            revenue_qs
            .values(
                'order__client__id',
                'order__client__first_name',
                'order__client__last_name',
                'order__client__brand_name',
            )
            .annotate(
                revenue=Sum('row_total'),
                orders_count=Count('order', distinct=True),
            )
            .order_by('-revenue')[:6]
        )
        stats['top_clients'] = [
            {
                'id':           t['order__client__id'],
                'name':         f"{t['order__client__first_name']} {t['order__client__last_name']}".strip(),
                'brand':        t['order__client__brand_name'] or '',
                'revenue':      float(t['revenue'] or 0),
                'orders_count': t['orders_count'],
            }
            for t in top
        ]

        # Monthly revenue — last 6 months
        monthly_qs = (
            revenue_qs
            .annotate(month=TruncMonth('order__created_at'))
            .values('month')
            .annotate(revenue=Sum('row_total'))
            .order_by('-month')[:6]
        )
        stats['monthly'] = [
            {
                'month':   m['month'].strftime('%b %Y') if m['month'] else '',
                'revenue': float(m['revenue'] or 0),
            }
            for m in monthly_qs
        ]

        return Response(stats)
