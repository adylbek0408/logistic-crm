from config.celery import app
from django.core.files.base import ContentFile
import datetime


@app.task(bind=True, max_retries=3)
def generate_pdf_task(self, order_id):
    from .models import Order
    from .pdf import generate_invoice_pdf
    try:
        order = Order.objects.select_related('client', 'template').prefetch_related('rows').get(pk=order_id)
        pdf_bytes = generate_invoice_pdf(order)
        date_str = datetime.date.today().strftime('%Y%m%d')
        filename = f'invoice_{order_id}_{date_str}.pdf'
        order.pdf_file.save(filename, ContentFile(pdf_bytes), save=True)
        return {'status': 'ok', 'filename': filename}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=5)
