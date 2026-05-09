from django.urls import path
from .views import ClientListCreateView, ClientDetailView, ClientOrdersView

urlpatterns = [
    path('', ClientListCreateView.as_view(), name='client_list'),
    path('<int:pk>/', ClientDetailView.as_view(), name='client_detail'),
    path('<int:pk>/orders/', ClientOrdersView.as_view(), name='client_orders'),
]
