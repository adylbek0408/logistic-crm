from rest_framework import serializers
from .models import Template, Order, OrderRow
from apps.clients.serializers import ClientListSerializer


class TemplateSerializer(serializers.ModelSerializer):
    total_rows = serializers.IntegerField(read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, default='')

    class Meta:
        model = Template
        fields = ['id', 'name', 'rows_per_page', 'pages', 'total_rows', 'created_by_name', 'created_at']
        read_only_fields = ['id', 'created_at']


class OrderRowSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    updated_by_name = serializers.CharField(source='updated_by.full_name', read_only=True, default='')

    class Meta:
        model = OrderRow
        fields = [
            'id', 'row_number', 'item_name', 'fulfillment_status',
            'quantity', 'unit', 'price', 'total', 'updated_at', 'updated_by_name',
        ]
        read_only_fields = ['id', 'row_number', 'updated_at']


class OrderRowUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderRow
        fields = ['item_name', 'fulfillment_status', 'quantity', 'unit', 'price']


class OrderSerializer(serializers.ModelSerializer):
    rows = OrderRowSerializer(many=True, read_only=True)
    client_name = serializers.CharField(source='client.display_name', read_only=True)
    client_brand = serializers.CharField(source='client.brand_name', read_only=True)
    template_name = serializers.CharField(source='template.name', read_only=True, default='')
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, default='')
    total_amount = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'client', 'client_name', 'client_brand',
            'template', 'template_name', 'status',
            'created_by_name', 'created_at', 'updated_at', 'sent_at',
            'payment_status', 'payment_amount', 'payment_receipt',
            'notes', 'pdf_file', 'rows', 'total_amount',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'pdf_file']

    def get_total_amount(self, obj):
        total = 0
        for row in obj.rows.all():
            if row.fulfillment_status == OrderRow.FulfillmentStatus.DONE and row.total:
                total += row.total
        return total


class OrderCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['client', 'template', 'notes']

    def create(self, validated_data):
        template = validated_data.get('template')
        order = Order.objects.create(**validated_data)
        if template:
            rows = [
                OrderRow(order=order, row_number=i + 1)
                for i in range(template.total_rows)
            ]
            OrderRow.objects.bulk_create(rows)
        return order


class OrderUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['status', 'sent_at', 'payment_status', 'payment_amount', 'payment_receipt', 'notes']


class OrderListSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.display_name', read_only=True)
    client_brand = serializers.CharField(source='client.brand_name', read_only=True)
    rows_count = serializers.SerializerMethodField()
    done_count = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'client', 'client_name', 'client_brand',
            'status', 'payment_status', 'created_at', 'sent_at',
            'rows_count', 'done_count',
        ]

    def get_rows_count(self, obj):
        return getattr(obj, 'rows_count_ann', 0)

    def get_done_count(self, obj):
        return getattr(obj, 'done_count_ann', 0)
