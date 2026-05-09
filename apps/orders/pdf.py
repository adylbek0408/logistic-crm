import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
from django.conf import settings


def _get_styles():
    styles = getSampleStyleSheet()
    normal = ParagraphStyle('Normal_custom', fontName='Helvetica', fontSize=9, leading=12)
    bold = ParagraphStyle('Bold_custom', fontName='Helvetica-Bold', fontSize=10, leading=13)
    title = ParagraphStyle('Title_custom', fontName='Helvetica-Bold', fontSize=14, leading=17, alignment=TA_CENTER)
    small = ParagraphStyle('Small_custom', fontName='Helvetica', fontSize=7, leading=10, textColor=colors.grey)
    return {'normal': normal, 'bold': bold, 'title': title, 'small': small}


def generate_invoice_pdf(order) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=20 * mm,
    )

    st = _get_styles()
    elements = []

    # ── Header ──
    elements.append(Paragraph('НАКЛАДНАЯ', st['title']))
    elements.append(Spacer(1, 4 * mm))

    import datetime
    date_str = (order.sent_at or order.created_at).strftime('%d.%m.%Y')
    elements.append(Paragraph(f'№ {order.pk} от {date_str}', ParagraphStyle('sub', fontName='Helvetica', fontSize=9, alignment=TA_CENTER)))
    elements.append(Spacer(1, 6 * mm))

    # ── Client info ──
    client = order.client
    header_data = [
        [Paragraph('<b>Поставщик:</b>', st['normal']),
         Paragraph('<b>Покупатель:</b>', st['normal'])],
        [Paragraph('ИП Асылбек', st['normal']),
         Paragraph(f'{client.display_name}', st['normal'])],
        [Paragraph('', st['small']),
         Paragraph(f'Бренд: {client.brand_name}' if client.brand_name else '', st['small'])],
        [Paragraph('', st['small']),
         Paragraph(f'Тел: {client.phone}' if client.phone else '', st['small'])],
    ]
    header_table = Table(header_data, colWidths=[85 * mm, 85 * mm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 6 * mm))

    # ── Table ──
    col_headers = ['№', 'Наименование', 'В.П.', 'Заказ', 'Отправлено', 'Ед.', 'Цена', 'Итог']
    col_widths = [8 * mm, 60 * mm, 12 * mm, 15 * mm, 18 * mm, 10 * mm, 18 * mm, 18 * mm]

    table_data = [[Paragraph(h, ParagraphStyle('hdr', fontName='Helvetica-Bold', fontSize=8)) for h in col_headers]]

    rows = order.rows.all().order_by('row_number')
    grand_total = 0

    for row in rows:
        if row.fulfillment_status == 'done':
            row_color = colors.white
            text_color = colors.black
        elif row.fulfillment_status == 'failed':
            row_color = colors.white
            text_color = colors.grey
        else:
            row_color = colors.white
            text_color = colors.black

        ps = ParagraphStyle('cell', fontName='Helvetica', fontSize=8, textColor=text_color)

        qty_str = str(row.quantity) if row.quantity is not None else ''
        price_str = str(row.price) if row.price is not None else ''
        total_str = ''
        if row.total is not None:
            total_str = f'{row.total:.2f}'
            if row.fulfillment_status == 'done':
                grand_total += float(row.total)

        sent_qty = qty_str if row.fulfillment_status == 'done' else ''

        table_data.append([
            Paragraph(str(row.row_number), ps),
            Paragraph(row.item_name or '', ps),
            Paragraph('', ps),
            Paragraph(qty_str, ps),
            Paragraph(sent_qty, ps),
            Paragraph(row.get_unit_display(), ps),
            Paragraph(price_str, ps),
            Paragraph(total_str if row.fulfillment_status == 'done' else '', ps),
        ])

    # Total row
    total_ps = ParagraphStyle('total', fontName='Helvetica-Bold', fontSize=9)
    table_data.append([
        Paragraph('', total_ps),
        Paragraph('ИТОГО:', total_ps),
        Paragraph('', total_ps),
        Paragraph('', total_ps),
        Paragraph('', total_ps),
        Paragraph('', total_ps),
        Paragraph('', total_ps),
        Paragraph(f'{grand_total:.2f}', total_ps),
    ])

    main_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E1B4B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -2), 0.3, colors.HexColor('#E2E8F0')),
        ('LINEBELOW', (0, -1), (-1, -1), 1, colors.HexColor('#1E1B4B')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#F8FAFC')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#F8FAFC')]),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
    ])
    main_table.setStyle(style)
    elements.append(main_table)
    elements.append(Spacer(1, 8 * mm))

    # ── Payment stamp ──
    if order.payment_status == 'paid':
        stamp_text = 'ОПЛАЧЕНО'
        stamp_color = colors.HexColor('#10B981')
    else:
        stamp_text = 'НЕ ОПЛАЧЕНО'
        stamp_color = colors.HexColor('#F43F5E')

    stamp_ps = ParagraphStyle(
        'stamp',
        fontName='Helvetica-Bold',
        fontSize=20,
        textColor=stamp_color,
        alignment=TA_RIGHT,
    )
    elements.append(Paragraph(stamp_text, stamp_ps))

    if order.payment_amount:
        elements.append(Paragraph(
            f'Сумма оплаты: {order.payment_amount} сом',
            ParagraphStyle('pay', fontName='Helvetica', fontSize=9, alignment=TA_RIGHT)
        ))

    def add_page_number(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(colors.grey)
        page_num = f'Стр. {canvas.getPageNumber()}'
        canvas.drawRightString(A4[0] - 15 * mm, 10 * mm, page_num)
        canvas.restoreState()

    doc.build(elements, onFirstPage=add_page_number, onLaterPages=add_page_number)
    return buffer.getvalue()
