from django.contrib import admin
from .models import Template, Order, OrderRow


@admin.register(Template)
class TemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'rows_per_page', 'pages', 'total_rows', 'created_at']
    readonly_fields = ['total_rows']

    def total_rows(self, obj):
        return obj.total_rows


class OrderRowInline(admin.TabularInline):
    model = OrderRow
    extra = 0
    fields = ['row_number', 'item_name', 'fulfillment_status', 'quantity', 'unit', 'price']


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['id', 'client', 'status', 'payment_status', 'created_at']
    list_filter = ['status', 'payment_status']
    inlines = [OrderRowInline]
