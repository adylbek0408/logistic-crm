from django.urls import path
from .views import (
    TemplateListCreateView, TemplateDetailView,
    OrderListCreateView, OrderDetailView,
    OrderRowUpdateView, GeneratePDFView, DownloadPDFView,
    DashboardStatsView,
)

urlpatterns = [
    path('templates/', TemplateListCreateView.as_view(), name='template_list'),
    path('templates/<int:pk>/', TemplateDetailView.as_view(), name='template_detail'),
    path('orders/', OrderListCreateView.as_view(), name='order_list'),
    path('orders/<int:pk>/', OrderDetailView.as_view(), name='order_detail'),
    path('orders/<int:pk>/rows/<int:row_id>/', OrderRowUpdateView.as_view(), name='order_row_update'),
    path('orders/<int:pk>/generate-pdf/', GeneratePDFView.as_view(), name='generate_pdf'),
    path('orders/<int:pk>/download-pdf/', DownloadPDFView.as_view(), name='download_pdf'),
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard_stats'),
]
