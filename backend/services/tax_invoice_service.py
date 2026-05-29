"""
Tax Invoice Service — generates VAT-inclusive Egyptian tax invoices
for subscription payments and emails them to the customer.

VAT rate: 14% (Egyptian standard rate)
Pricing model: VAT-inclusive (the displayed price already includes VAT).
"""
from datetime import datetime, timezone
from typing import Optional, List
import os
import uuid
import asyncio
import io
import zipfile

try:
    from weasyprint import HTML as WeasyHTML
    WEASY_AVAILABLE = True
except Exception:
    WEASY_AVAILABLE = False


VAT_RATE = 0.14  # 14% Egyptian VAT


def calculate_vat_breakdown(total_inclusive: float, rate: float = VAT_RATE) -> dict:
    """
    Given a VAT-inclusive total, split it into base + VAT.

    total = base + vat ; vat = base * rate => base = total / (1 + rate)
    """
    base = round(total_inclusive / (1 + rate), 2)
    vat = round(total_inclusive - base, 2)
    return {
        "subtotal": base,           # base price before VAT
        "vat_rate": rate,
        "vat_amount": vat,
        "total": round(total_inclusive, 2),
    }


def _generate_invoice_number() -> str:
    """Generate a human-friendly invoice number, e.g. DL-2026-AB12CD34."""
    suffix = uuid.uuid4().hex[:8].upper()
    return f"DL-{datetime.now(timezone.utc).year}-{suffix}"


def build_tax_invoice_html(
    *,
    invoice_number: str,
    customer_name: str,
    customer_email: str,
    company_name: Optional[str],
    plan_name_ar: str,
    plan_name_en: str,
    duration_ar: str,
    duration_en: str,
    breakdown: dict,
    issued_at: datetime,
) -> str:
    """Render the HTML for the tax invoice email body."""
    subtotal = breakdown["subtotal"]
    vat_amount = breakdown["vat_amount"]
    total = breakdown["total"]
    issued_str = issued_at.strftime('%Y-%m-%d %H:%M')

    return f"""
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8" />
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0; padding: 0; background: #f4f7fa; color: #1e293b;
        }}
        .wrap {{ max-width: 680px; margin: 0 auto; background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,.08); }}
        .header {{ background: linear-gradient(135deg, #28376B 0%, #4F46E5 100%); padding: 32px 28px; color: #fff; }}
        .header .row {{ display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }}
        .header h1 {{ margin: 0; font-size: 22px; }}
        .header .badge {{ background: rgba(255,255,255,.18); padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; }}
        .header .meta {{ margin-top: 18px; font-size: 13px; color: rgba(255,255,255,.85); }}
        .body {{ padding: 28px; }}
        .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }}
        .card {{ background: #f8fafc; border-radius: 10px; padding: 16px 18px; }}
        .card h3 {{ margin: 0 0 8px; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }}
        .card p {{ margin: 2px 0; font-size: 14px; color: #1e293b; font-weight: 600; }}
        .card .muted {{ color: #64748b; font-weight: 400; font-size: 13px; }}
        table.items {{ width: 100%; border-collapse: collapse; margin-top: 24px; }}
        table.items th {{ background: #28376B; color: #fff; text-align: right; padding: 12px 14px; font-size: 13px; }}
        table.items td {{ padding: 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }}
        table.items td.amount {{ font-weight: 700; color: #1e293b; }}
        .totals {{ margin-top: 18px; border-top: 2px solid #e2e8f0; padding-top: 18px; }}
        .totals .row {{ display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }}
        .totals .row.grand {{
            margin-top: 12px; padding: 14px 16px; background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #fff; border-radius: 10px; font-size: 18px; font-weight: 700;
        }}
        .note {{
            margin-top: 22px; padding: 14px 16px; background: #fef3c7; border-right: 3px solid #f59e0b;
            border-radius: 8px; font-size: 12px; color: #78350f;
        }}
        .footer {{ background: #f8fafc; padding: 22px; text-align: center; color: #64748b; font-size: 11px; border-top: 1px solid #e2e8f0; }}
        @media print {{
            .no-print {{ display: none !important; }}
            body {{ background: #fff; }}
        }}
        .print-bar {{
            position: fixed; top: 14px; left: 14px; z-index: 99; display: flex; gap: 8px;
        }}
        .print-bar button {{
            background: #28376B; color: #fff; border: 0; padding: 8px 14px; border-radius: 8px;
            font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,.15);
        }}
        .print-bar button.green {{ background: #10b981; }}
    </style>
</head>
<body>
    <div class="print-bar no-print">
        <button onclick="window.print()">🖨️ طباعة | Print</button>
        <button class="green" onclick="window.print()">📄 حفظ PDF | Save as PDF</button>
    </div>
    <div class="wrap">
        <div class="header">
            <div class="row">
                <h1>فاتورة ضريبية | Tax Invoice</h1>
                <span class="badge">{invoice_number}</span>
            </div>
            <div class="meta">
                <strong>DataLife Account</strong> &middot; خدمات الذكاء الاصطناعي والمحاسبة<br/>
                تاريخ الإصدار | Issued: {issued_str}
            </div>
        </div>

        <div class="body">
            <div class="grid">
                <div class="card">
                    <h3>صادرة من | From</h3>
                    <p>DataLife AI Services</p>
                    <p class="muted">DataLife Account ERP</p>
                    <p class="muted">noreply@datalifeaccount.com</p>
                </div>
                <div class="card">
                    <h3>صادرة إلى | Bill To</h3>
                    <p>{customer_name}</p>
                    {f'<p class="muted">{company_name}</p>' if company_name else ''}
                    <p class="muted">{customer_email}</p>
                </div>
            </div>

            <table class="items">
                <thead>
                    <tr>
                        <th>الوصف | Description</th>
                        <th style="width: 140px; text-align: right;">المبلغ | Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <strong>اشتراك {plan_name_ar}</strong> &mdash; {duration_ar}<br/>
                            <span style="color:#64748b;font-size:12px;">{plan_name_en} subscription &mdash; {duration_en}</span>
                        </td>
                        <td class="amount" style="text-align: right;">{subtotal:,.2f} EGP</td>
                    </tr>
                </tbody>
            </table>

            <div class="totals">
                <div class="row">
                    <span>المجموع الفرعي | Subtotal (Excl. VAT)</span>
                    <span><strong>{subtotal:,.2f} EGP</strong></span>
                </div>
                <div class="row">
                    <span>ضريبة القيمة المضافة | VAT ({int(VAT_RATE*100)}%)</span>
                    <span><strong>{vat_amount:,.2f} EGP</strong></span>
                </div>
                <div class="row grand">
                    <span>الإجمالي شامل الضريبة | Total (Incl. VAT)</span>
                    <span>{total:,.2f} EGP</span>
                </div>
            </div>

            <div class="note">
                <strong>ملاحظة:</strong> هذه فاتورة ضريبية إلكترونية صادرة بموجب قانون ضريبة القيمة المضافة المصري بنسبة 14%.
                السعر المُعلن يشمل ضريبة القيمة المضافة. تم استلام الدفع بنجاح.<br/>
                <em>This is an electronic tax invoice issued under the Egyptian VAT law (14%). The displayed price is VAT-inclusive. Payment received successfully.</em>
            </div>
        </div>

        <div class="footer">
            <p>© {datetime.now(timezone.utc).year} DataLife Account &mdash; جميع الحقوق محفوظة</p>
            <p>هذا البريد تم إرساله تلقائياً، يرجى عدم الرد عليه.</p>
        </div>
    </div>
</body>
</html>
"""


async def send_tax_invoice_email(
    *,
    customer_email: str,
    customer_name: str,
    company_name: Optional[str],
    company_id: Optional[str],
    plan: str,
    duration: str,
    amount_inclusive_egp: float,
    db,
) -> dict:
    """
    Build a tax invoice, persist it in MongoDB, and email it to the customer.

    Returns a dict with the invoice metadata.
    """
    plan_names = {
        "starter":      {"en": "Starter",      "ar": "المبتدئ"},
        "professional": {"en": "Professional", "ar": "المحترف"},
        "enterprise":   {"en": "Enterprise",   "ar": "المؤسسي"},
        "hr-only":      {"en": "HR Only",      "ar": "الموارد البشرية فقط"},
        "financial-only": {"en": "Financial Only", "ar": "المالية فقط"},
        "inventory-only": {"en": "Inventory Only", "ar": "المخزون فقط"},
        "lifetime":     {"en": "Lifetime",     "ar": "اشتراك دائم"},
    }
    duration_names = {
        "3_months":  {"en": "3 Months",  "ar": "3 أشهر"},
        "6_months":  {"en": "6 Months",  "ar": "6 أشهر"},
        "9_months":  {"en": "9 Months",  "ar": "9 أشهر"},
        "12_months": {"en": "1 Year",    "ar": "سنة"},
        "lifetime":  {"en": "Lifetime",  "ar": "مدى الحياة"},
    }

    breakdown = calculate_vat_breakdown(amount_inclusive_egp)
    invoice_number = _generate_invoice_number()
    issued_at = datetime.now(timezone.utc)

    plan_label = plan_names.get(plan, {"en": plan, "ar": plan})
    dur_label = duration_names.get(duration, {"en": duration, "ar": duration})

    html = build_tax_invoice_html(
        invoice_number=invoice_number,
        customer_name=customer_name or customer_email,
        customer_email=customer_email,
        company_name=company_name,
        plan_name_ar=plan_label["ar"],
        plan_name_en=plan_label["en"],
        duration_ar=dur_label["ar"],
        duration_en=dur_label["en"],
        breakdown=breakdown,
        issued_at=issued_at,
    )

    # Persist invoice to DB so customer can retrieve it later
    invoice_record = {
        "id": str(uuid.uuid4()),
        "invoice_number": invoice_number,
        "customer_email": customer_email,
        "customer_name": customer_name,
        "company_id": company_id,
        "company_name": company_name,
        "plan": plan,
        "duration": duration,
        "subtotal_egp": breakdown["subtotal"],
        "vat_rate": breakdown["vat_rate"],
        "vat_amount_egp": breakdown["vat_amount"],
        "total_egp": breakdown["total"],
        "currency": "EGP",
        "issued_at": issued_at.isoformat(),
        "html": html,
        "sent": False,
    }
    try:
        await db.tax_invoices.insert_one(dict(invoice_record))
    except Exception as err:
        print(f"[tax_invoice] Failed to persist invoice: {err}")

    # Send via Resend
    try:
        import resend
        api_key = os.environ.get("RESEND_API_KEY")
        sender_email = os.environ.get("SENDER_EMAIL", "noreply@datalifeaccount.com")
        if api_key:
            resend.api_key = api_key
            params = {
                "from": f"DataLife Account <{sender_email}>",
                "to": [customer_email],
                "subject": f"فاتورة ضريبية {invoice_number} | Tax Invoice — DataLife Account",
                "html": html,
            }
            await asyncio.to_thread(resend.Emails.send, params)
            await db.tax_invoices.update_one(
                {"invoice_number": invoice_number},
                {"$set": {"sent": True, "sent_at": datetime.now(timezone.utc).isoformat()}},
            )
    except Exception as err:
        print(f"[tax_invoice] Failed to send invoice email: {err}")

    # Return metadata (without raw HTML to keep responses small)
    meta = {k: v for k, v in invoice_record.items() if k != "html"}
    return meta


def render_invoice_pdf(invoice_html: str) -> bytes:
    """
    Convert the invoice HTML into a PDF using WeasyPrint.
    Returns the raw PDF bytes. Raises RuntimeError if WeasyPrint is unavailable.
    """
    if not WEASY_AVAILABLE:
        raise RuntimeError(
            "PDF rendering is not available on this server (weasyprint missing)."
        )
    # Strip the floating print bar that only makes sense in a browser view
    cleaned = invoice_html.replace('class="print-bar no-print"', 'class="print-bar no-print" style="display:none"')
    return WeasyHTML(string=cleaned).write_pdf()


def build_invoices_zip(invoices: List[dict]) -> bytes:
    """
    Bundle the provided invoices into a ZIP file. Each invoice is rendered
    both as an HTML file and (if WeasyPrint is available) as a PDF.
    Returns the ZIP archive as raw bytes.
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for inv in invoices:
            number = inv.get("invoice_number") or inv.get("id", "invoice")
            html = inv.get("html", "")
            if not html:
                continue
            zf.writestr(f"{number}.html", html)
            if WEASY_AVAILABLE:
                try:
                    pdf_bytes = render_invoice_pdf(html)
                    zf.writestr(f"{number}.pdf", pdf_bytes)
                except Exception as err:
                    print(f"[tax_invoice] Failed to render PDF for {number}: {err}")
    return buf.getvalue()


def build_monthly_vat_report_html(
    *,
    company_name: str,
    company_id: str,
    month: int,
    year: int,
    invoices: List[dict],
    language: str = "ar",
) -> str:
    """
    Build an HTML monthly VAT report listing all invoices issued in the
    given month, with totals and a summary suitable for filing the VAT
    declaration.
    """
    months_ar = ["", "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
                 "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
    months_en = ["", "January", "February", "March", "April", "May", "June",
                 "July", "August", "September", "October", "November", "December"]
    month_ar = months_ar[month] if 1 <= month <= 12 else str(month)
    month_en = months_en[month] if 1 <= month <= 12 else str(month)

    total_subtotal = sum(float(i.get("subtotal_egp", 0)) for i in invoices)
    total_vat = sum(float(i.get("vat_amount_egp", 0)) for i in invoices)
    total = sum(float(i.get("total_egp", 0)) for i in invoices)

    rows_html = "".join(
        f"""
        <tr>
            <td>{inv.get('invoice_number', '')}</td>
            <td>{(inv.get('issued_at') or '')[:10]}</td>
            <td>{inv.get('customer_name') or inv.get('customer_email', '')}</td>
            <td style="text-align:right;">{float(inv.get('subtotal_egp', 0)):,.2f}</td>
            <td style="text-align:right;">{float(inv.get('vat_amount_egp', 0)):,.2f}</td>
            <td style="text-align:right;font-weight:700;">{float(inv.get('total_egp', 0)):,.2f}</td>
        </tr>"""
        for inv in invoices
    ) or """<tr><td colspan="6" style="text-align:center;padding:20px;color:#888;">لا توجد فواتير في هذا الشهر | No invoices in this month</td></tr>"""

    return f"""
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8" />
    <style>
        body {{ font-family: 'Noto Sans Arabic', 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f4f7fa; color: #1e293b; }}
        .wrap {{ max-width: 900px; margin: 0 auto; background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,.08); }}
        .header {{ background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 28px; color: #fff; }}
        .header h1 {{ margin: 0; font-size: 22px; }}
        .header .meta {{ margin-top: 12px; font-size: 13px; color: rgba(255,255,255,.8); }}
        .summary {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; padding: 24px 28px; background: #f8fafc; }}
        .stat {{ background: #fff; border-radius: 10px; padding: 14px 16px; border: 1px solid #e2e8f0; }}
        .stat h3 {{ margin: 0; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }}
        .stat p {{ margin: 6px 0 0; font-size: 18px; color: #0f172a; font-weight: 700; }}
        .stat.vat p {{ color: #d97706; }}
        .stat.total p {{ color: #059669; }}
        table {{ width: 100%; border-collapse: collapse; }}
        thead {{ background: #28376B; color: #fff; }}
        th, td {{ padding: 12px 14px; text-align: right; font-size: 13px; border-bottom: 1px solid #e2e8f0; }}
        tfoot td {{ background: #ecfdf5; font-weight: 700; color: #065f46; }}
        .footer {{ background: #f8fafc; padding: 22px; text-align: center; color: #64748b; font-size: 11px; border-top: 1px solid #e2e8f0; }}
    </style>
</head>
<body>
    <div class="wrap">
        <div class="header">
            <h1>📊 تقرير ضريبة القيمة المضافة الشهري | Monthly VAT Report</h1>
            <div class="meta">
                <strong>{company_name}</strong><br/>
                {month_ar} {year} | {month_en} {year}<br/>
                <span style="font-size:11px;">معدل الضريبة: 14% | VAT Rate: 14%</span>
            </div>
        </div>

        <div class="summary">
            <div class="stat">
                <h3>عدد الفواتير | Invoices</h3>
                <p>{len(invoices)}</p>
            </div>
            <div class="stat">
                <h3>المجموع الفرعي | Subtotal</h3>
                <p>{total_subtotal:,.2f}</p>
            </div>
            <div class="stat vat">
                <h3>ضريبة 14% | VAT</h3>
                <p>{total_vat:,.2f}</p>
            </div>
            <div class="stat total">
                <h3>الإجمالي | Total</h3>
                <p>{total:,.2f}</p>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>رقم الفاتورة<br/>Invoice #</th>
                    <th>التاريخ<br/>Date</th>
                    <th>العميل<br/>Customer</th>
                    <th>المجموع الفرعي<br/>Subtotal</th>
                    <th>الضريبة 14%<br/>VAT</th>
                    <th>الإجمالي<br/>Total</th>
                </tr>
            </thead>
            <tbody>
                {rows_html}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3">الإجمالي | Grand Total</td>
                    <td style="text-align:right;">{total_subtotal:,.2f} EGP</td>
                    <td style="text-align:right;">{total_vat:,.2f} EGP</td>
                    <td style="text-align:right;">{total:,.2f} EGP</td>
                </tr>
            </tfoot>
        </table>

        <div class="footer">
            <p>تم إنشاء هذا التقرير تلقائياً بواسطة <strong>DataLife Account</strong> — Generated automatically</p>
            <p>Company ID: {company_id} &middot; Generated at: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}</p>
        </div>
    </div>
</body>
</html>
"""


async def send_monthly_vat_report(
    *,
    company_id: str,
    recipient_email: str,
    month: int,
    year: int,
    db,
    language: str = "ar",
) -> dict:
    """
    Build the VAT report for the given (company, year, month), email it
    to the recipient and persist a record of the send.
    """
    from datetime import datetime as _dt
    start = _dt(year, month, 1).isoformat()
    if month == 12:
        end = _dt(year + 1, 1, 1).isoformat()
    else:
        end = _dt(year, month + 1, 1).isoformat()

    invoices = await db.tax_invoices.find(
        {"company_id": company_id, "issued_at": {"$gte": start, "$lt": end}},
        {"_id": 0, "html": 0},
    ).sort("issued_at", 1).to_list(length=2000)

    company = await db.companies.find_one({"id": company_id}, {"_id": 0, "name": 1})
    company_name = (company or {}).get("name") or "DataLife Account"

    html = build_monthly_vat_report_html(
        company_name=company_name,
        company_id=company_id,
        month=month,
        year=year,
        invoices=invoices,
        language=language,
    )

    # Send + attach PDF if possible
    sent = False
    try:
        import resend
        api_key = os.environ.get("RESEND_API_KEY")
        sender_email = os.environ.get("SENDER_EMAIL", "noreply@datalifeaccount.com")
        if api_key:
            resend.api_key = api_key
            params = {
                "from": f"DataLife Account <{sender_email}>",
                "to": [recipient_email],
                "subject": f"📊 تقرير VAT الشهري - {company_name} ({month}/{year})",
                "html": html,
            }
            # Attach PDF if WeasyPrint available
            if WEASY_AVAILABLE:
                try:
                    import base64
                    pdf_bytes = WeasyHTML(string=html).write_pdf()
                    params["attachments"] = [{
                        "filename": f"VAT-Report-{year}-{month:02d}.pdf",
                        "content": base64.b64encode(pdf_bytes).decode("utf-8"),
                    }]
                except Exception as err:
                    print(f"[vat_report] PDF attach failed: {err}")
            await asyncio.to_thread(resend.Emails.send, params)
            sent = True
    except Exception as err:
        print(f"[vat_report] Email failed: {err}")

    await db.vat_reports.insert_one({
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "month": month,
        "year": year,
        "recipient_email": recipient_email,
        "invoice_count": len(invoices),
        "total_egp": sum(float(i.get("total_egp", 0)) for i in invoices),
        "vat_amount_egp": sum(float(i.get("vat_amount_egp", 0)) for i in invoices),
        "sent": sent,
        "issued_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "company_id": company_id,
        "month": month,
        "year": year,
        "recipient_email": recipient_email,
        "invoice_count": len(invoices),
        "sent": sent,
    }
