import io
import os
import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


# ── Font registration (Cyrillic support) ──────────────────────────────────────

def _register_fonts():
    """Register a Cyrillic-capable TTF font. Falls back gracefully."""
    candidates = [
        # Windows
        (r'C:\Windows\Fonts\arial.ttf',   r'C:\Windows\Fonts\arialbd.ttf'),
        # Linux / server
        ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
         '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
        ('/usr/share/fonts/dejavu/DejaVuSans.ttf',
         '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'),
    ]
    for regular, bold in candidates:
        if os.path.exists(regular) and os.path.exists(bold):
            pdfmetrics.registerFont(TTFont('CyrFont', regular))
            pdfmetrics.registerFont(TTFont('CyrFont-Bold', bold))
            return 'CyrFont', 'CyrFont-Bold'
    # Last resort — Helvetica shows squares for Cyrillic but won't crash
    return 'Helvetica', 'Helvetica-Bold'


_FONT, _FONT_BOLD = _register_fonts()


# ── Style helpers ─────────────────────────────────────────────────────────────

def _ps(name, size=9, bold=False, color=colors.black, align=TA_LEFT, leading=None):
    return ParagraphStyle(
        name,
        fontName=_FONT_BOLD if bold else _FONT,
        fontSize=size,
        textColor=color,
        alignment=align,
        leading=leading or size + 3,
    )


# ── Main generator ────────────────────────────────────────────────────────────

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

    elements = []
    client = order.client
    date_str = (order.sent_at or order.created_at).strftime('%d.%m.%Y')

    # ── Title ──
    elements.append(Paragraph('НАКЛАДНАЯ', _ps('title', 16, bold=True, align=TA_CENTER)))
    elements.append(Spacer(1, 3 * mm))
    elements.append(Paragraph(
        f'№ {order.pk}  от  {date_str}',
        _ps('sub', 9, align=TA_CENTER, color=colors.HexColor('#6B7280'))
    ))
    elements.append(Spacer(1, 7 * mm))

    # ── Header: Покупатель (СЛЕВА) | Поставщик (СПРАВА) ──
    buyer_display = order.buyer_name or client.display_name
    buyer_lines = [
        Paragraph('Покупатель:', _ps('bh', 8, bold=True, color=colors.HexColor('#6B7280'))),
        Paragraph(buyer_display, _ps('bn', 11, bold=True)),
    ]
    if not order.buyer_name and client.brand_name:
        buyer_lines.append(Paragraph(client.brand_name, _ps('bb', 9)))
    if client.phone:
        buyer_lines.append(Paragraph(f'Тел: {client.phone}', _ps('bp', 8, color=colors.HexColor('#6B7280'))))

    supplier_display = order.supplier_name or 'Асылбек'
    supplier_lines = [
        Paragraph('Поставщик:', _ps('sh', 8, bold=True, color=colors.HexColor('#6B7280'))),
        Paragraph(supplier_display, _ps('sn', 11, bold=True)),
    ]

    header_data = [[
        # LEFT — покупатель (клиент)
        [line for line in buyer_lines],
        # RIGHT — поставщик (Асылбек)
        [line for line in supplier_lines],
    ]]

    # Build as two-column table of nested flowables
    from reportlab.platypus import KeepInFrame

    left_col = Table([[line] for line in buyer_lines], colWidths=[85 * mm])
    left_col.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
    ]))

    right_col = Table([[line] for line in supplier_lines], colWidths=[85 * mm])
    right_col.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 1),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
    ]))

    header_table = Table([[left_col, right_col]], colWidths=[90 * mm, 85 * mm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LINEBELOW', (0, 0), (-1, 0), 0.5, colors.HexColor('#E5E7EB')),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 7 * mm))

    # ── Data table ──
    col_headers = ['№', 'Наименование', 'В.П.', 'Отправлено', 'Ед.', 'Цена', 'Итог']
    col_widths   = [8*mm, 68*mm, 14*mm, 22*mm, 14*mm, 20*mm, 14*mm]

    hdr_ps = _ps('hdr', 8, bold=True, color=colors.white, align=TA_CENTER)
    table_data = [[Paragraph(h, hdr_ps) for h in col_headers]]

    rows = order.rows.all().order_by('row_number')
    grand_total = 0

    for row in rows:
        is_done   = row.fulfillment_status == 'done'
        is_failed = row.fulfillment_status == 'failed'
        txt_color = colors.HexColor('#9CA3AF') if is_failed else colors.black

        cell = _ps(f'c{row.pk}', 8, color=txt_color)
        cell_r = _ps(f'cr{row.pk}', 8, color=txt_color, align=TA_RIGHT)

        qty_str   = str(row.quantity).rstrip('0').rstrip('.') if row.quantity else ''
        price_str = f'{float(row.price):.2f}'                 if row.price    else ''
        total_str = ''
        if row.total is not None and is_done:
            total_str = f'{float(row.total):.2f}'
            grand_total += float(row.total)

        unit_map = {'kg': 'кг', 'pcs': 'шт', 'pack': 'пач', 'box': 'уп'}
        unit_str = unit_map.get(row.unit, row.unit)

        status_map = {
            'done':   ('+', colors.HexColor('#10B981')),
            'failed': ('-', colors.HexColor('#F43F5E')),
            'empty':  ('',  colors.HexColor('#9CA3AF')),
        }
        vp_char, vp_color = status_map.get(row.fulfillment_status, ('', colors.HexColor('#9CA3AF')))
        vp_ps = _ps(f'vp{row.pk}', 9, bold=True, color=vp_color, align=TA_CENTER)

        table_data.append([
            Paragraph(str(row.row_number), _ps(f'n{row.pk}', 8, align=TA_CENTER)),
            Paragraph(row.item_name or '', cell),
            Paragraph(vp_char, vp_ps),
            Paragraph(qty_str if is_done else '', cell_r),
            Paragraph(unit_str, cell),
            Paragraph(price_str, cell_r),
            Paragraph(total_str, cell_r),
        ])

    # Total row (7 columns)
    tot_ps = _ps('tot', 9, bold=True, align=TA_RIGHT)
    table_data.append([
        Paragraph('', tot_ps),
        Paragraph('ИТОГО:', _ps('totl', 9, bold=True)),
        Paragraph('', tot_ps), Paragraph('', tot_ps),
        Paragraph('', tot_ps), Paragraph('', tot_ps),
        Paragraph(f'{grand_total:.2f}', tot_ps),
    ])

    main_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    main_table.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0),  (-1, 0),  colors.HexColor('#1E1B4B')),
        ('FONTNAME',      (0, 0),  (-1, 0),  _FONT_BOLD),
        ('FONTSIZE',      (0, 0),  (-1, 0),  8),
        ('ALIGN',         (0, 0),  (-1, 0),  'CENTER'),
        ('VALIGN',        (0, 0),  (-1, -1), 'MIDDLE'),
        ('GRID',          (0, 0),  (-1, -2), 0.3, colors.HexColor('#E2E8F0')),
        ('LINEBELOW',     (0, -1), (-1, -1), 1,   colors.HexColor('#1E1B4B')),
        ('BACKGROUND',    (0, -1), (-1, -1), colors.HexColor('#F8FAFC')),
        ('ROWBACKGROUNDS',(0, 1),  (-1, -2), [colors.white, colors.HexColor('#FAFAFA')]),
        ('TOPPADDING',    (0, 0),  (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0),  (-1, -1), 4),
        ('LEFTPADDING',   (0, 0),  (-1, -1), 3),
        ('RIGHTPADDING',  (0, 0),  (-1, -1), 3),
        ('FONTNAME',      (0, 1),  (-1, -1), _FONT),
        ('FONTSIZE',      (0, 1),  (-1, -1), 8),
    ]))
    elements.append(main_table)
    elements.append(Spacer(1, 8 * mm))

    def _footer(canvas, doc):
        canvas.saveState()
        canvas.setFont(_FONT, 8)
        canvas.setFillColor(colors.HexColor('#9CA3AF'))
        canvas.drawRightString(A4[0] - 15 * mm, 10 * mm, f'Стр. {canvas.getPageNumber()}')
        canvas.restoreState()

    doc.build(elements, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()
