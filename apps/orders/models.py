from django.db import models
from django.conf import settings
from apps.clients.models import Client


class Template(models.Model):
    name = models.CharField(max_length=200)
    rows_per_page = models.PositiveIntegerField(default=10)
    pages = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='templates',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'orders_template'
        verbose_name = 'Шаблон'
        verbose_name_plural = 'Шаблоны'
        ordering = ['-created_at']

    @property
    def total_rows(self):
        return self.rows_per_page * self.pages

    def __str__(self):
        return self.name


class Order(models.Model):
    class Status(models.TextChoices):
        NEW = 'new', 'Новый'
        IN_PROGRESS = 'in_progress', 'В процессе'
        COMPLETED = 'completed', 'Завершён'

    class PaymentStatus(models.TextChoices):
        PAID = 'paid', 'Оплачен'
        UNPAID = 'unpaid', 'Не оплачен'

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='orders')
    template = models.ForeignKey(
        Template,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
    )
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.NEW)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='orders',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    payment_status = models.CharField(
        max_length=10,
        choices=PaymentStatus.choices,
        default=PaymentStatus.UNPAID,
    )
    payment_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    payment_receipt = models.FileField(upload_to='receipts/', null=True, blank=True)
    notes = models.TextField(blank=True)
    supplier_name = models.CharField(max_length=200, blank=True, default='')
    buyer_name = models.CharField(max_length=200, blank=True, default='')
    pdf_file = models.FileField(upload_to='invoices/', null=True, blank=True)

    class Meta:
        db_table = 'orders_order'
        verbose_name = 'Заказ'
        verbose_name_plural = 'Заказы'
        ordering = ['-created_at']

    def __str__(self):
        return f'Заказ #{self.pk} — {self.client}'


class OrderRow(models.Model):
    class FulfillmentStatus(models.TextChoices):
        DONE = 'done', 'Выполнен'
        FAILED = 'failed', 'Не выполнен'
        EMPTY = 'empty', 'Нету'

    class Unit(models.TextChoices):
        KG = 'kg', 'кг'
        PCS = 'pcs', 'шт'
        PACK = 'pack', 'пач'
        BOX = 'box', 'уп'

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='rows')
    row_number = models.PositiveIntegerField()
    item_name = models.TextField(blank=True)
    fulfillment_status = models.CharField(
        max_length=10,
        choices=FulfillmentStatus.choices,
        default=FulfillmentStatus.EMPTY,
    )
    quantity = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    unit = models.CharField(max_length=5, choices=Unit.choices, default=Unit.KG)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_rows',
    )

    class Meta:
        db_table = 'orders_orderrow'
        verbose_name = 'Строка заказа'
        verbose_name_plural = 'Строки заказа'
        ordering = ['row_number']
        unique_together = [('order', 'row_number')]

    @property
    def total(self):
        if self.quantity is not None and self.price is not None:
            return self.quantity * self.price
        return None

    def __str__(self):
        return f'Строка {self.row_number}: {self.item_name}'
