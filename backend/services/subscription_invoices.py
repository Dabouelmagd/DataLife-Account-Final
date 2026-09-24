"""
الفاتورة الضريبية للاشتراكات — tax invoices for subscription payments.

Selling a subscription in Egypt is a taxable supply: the customer is owed a
tax invoice carrying the seller's tax number, the customer's details, the net
amount, the VAT and the total. None was ever issued — payments were recorded
and nothing went to the customer.

An invoice is issued once per payment, numbered in an unbroken sequence per
year (a tax invoice series may not have gaps), stored, and emailed. Issuing
is idempotent: asking twice for the same payment returns the first invoice
rather than minting a second number for one supply.

The VAT here is OUR output tax as the seller, recorded on the platform's own
books — not on the customer's company, which is where the subscription is an
expense.
"""

import logging
import os
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

VAT_RATE = float(os.environ.get("SUBSCRIPTION_VAT_RATE", "14"))
SELLER = {
    "name": os.environ.get("PLATFORM_LEGAL_NAME", "داتا لايف"),
    "tax_id": os.environ.get("PLATFORM_TAX_ID", ""),
    "address": os.environ.get("PLATFORM_ADDRESS", ""),
    "commercial_register": os.environ.get("PLATFORM_CR", ""),
}


def _now():
    return datetime.now(timezone.utc)


def split_vat(gross: float, rate: float = VAT_RATE) -> tuple:
    """A paid amount is VAT-inclusive: return (net, vat)."""
    gross = round(float(gross or 0), 2)
    if rate <= 0:
        return gross, 0.0
    net = round(gross / (1 + rate / 100), 2)
    return net, round(gross - net, 2)


async def _next_number(db, year: int) -> str:
    """Sequential per year, with no gaps — a tax series must be unbroken."""
    counter = await db.counters.find_one_and_update(
        {"_id": f"subscription_invoice_{year}"},
        {"$inc": {"seq": 1}},
        upsert=True, return_document=True)
    seq = (counter or {}).get("seq", 1)
    return f"SUB-{year}-{int(seq):05d}"


async def issue_for_payment(db, payment: dict, company: dict) -> dict:
    """Issue (or return the existing) tax invoice for a subscription payment."""
    payment_id = payment.get("id") or payment.get("payment_id")
    existing = await db.subscription_invoices.find_one(
        {"payment_id": payment_id}, {"_id": 0}) if payment_id else None
    if existing:
        return existing                       # one supply, one invoice number

    gross = round(float(payment.get("amount") or payment.get("amount_egp") or 0), 2)
    if gross <= 0:
        raise ValueError("لا يمكن إصدار فاتورة بقيمة صفر")
    net, vat = split_vat(gross)
    issued = _now()
    invoice = {
        "id": f"si_{payment_id or issued.timestamp()}",
        "invoice_number": await _next_number(db, issued.year),
        "payment_id": payment_id,
        "company_id": company.get("id"),
        "issued_at": issued.isoformat(),
        "issue_date": issued.strftime("%Y-%m-%d"),
        "seller": dict(SELLER),
        "buyer": {
            "name": company.get("name", ""),
            "tax_id": company.get("tax_number") or company.get("tax_id") or "",
            "address": company.get("address", ""),
            "email": company.get("email") or payment.get("email") or "",
        },
        "description": payment.get("description") or f"اشتراك {payment.get('plan', '')}".strip(),
        "plan": payment.get("plan"),
        "period": payment.get("period") or payment.get("billing_cycle"),
        "currency": payment.get("currency", "EGP"),
        "net_amount": net,
        "vat_rate": VAT_RATE,
        "vat_amount": vat,
        "total_amount": gross,
        "payment_method": payment.get("payment_method") or payment.get("method"),
        "status": "issued",
    }
    await db.subscription_invoices.insert_one(dict(invoice))
    return invoice


def render_html(invoice: dict) -> str:
    """The invoice as the customer receives it."""
    money = lambda v: f"{float(v or 0):,.2f}"
    seller, buyer = invoice.get("seller", {}), invoice.get("buyer", {})
    rows = [
        ("الإجمالي قبل الضريبة", money(invoice.get("net_amount"))),
        (f"ضريبة القيمة المضافة ({invoice.get('vat_rate')}%)", money(invoice.get("vat_amount"))),
    ]
    body = "".join(
        f"<tr><td style='padding:6px 10px'>{k}</td>"
        f"<td style='padding:6px 10px;text-align:left' dir='ltr'>{v}</td></tr>" for k, v in rows)
    return f"""<div dir="rtl" style="font-family:Tahoma,Arial;max-width:640px;line-height:1.8;color:#111">
  <h2 style="margin:0 0 4px">فاتورة ضريبية</h2>
  <p style="margin:0;color:#555">رقم {invoice.get('invoice_number')} — بتاريخ {invoice.get('issue_date')}</p>
  <table style="width:100%;margin-top:16px;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:6px 10px;width:50%;vertical-align:top">
      <b>المورّد</b><br>{seller.get('name','')}<br>
      {('الرقم الضريبي: ' + seller['tax_id']) if seller.get('tax_id') else
       '<span style="color:#b45309">الرقم الضريبي غير مُعد على الخادم</span>'}<br>
      {seller.get('address','')}
    </td><td style="padding:6px 10px;vertical-align:top">
      <b>العميل</b><br>{buyer.get('name','')}<br>
      {('الرقم الضريبي: ' + buyer['tax_id']) if buyer.get('tax_id') else 'بدون رقم ضريبي'}<br>
      {buyer.get('address','')}
    </td></tr>
  </table>
  <table style="width:100%;margin-top:16px;border-collapse:collapse;font-size:14px;border:1px solid #e5e7eb">
    <tr style="background:#f8fafc"><th style="padding:8px 10px;text-align:right">البند</th>
      <th style="padding:8px 10px;text-align:left">المبلغ ({invoice.get('currency','EGP')})</th></tr>
    <tr><td style="padding:6px 10px">{invoice.get('description','اشتراك')}</td>
      <td style="padding:6px 10px;text-align:left" dir="ltr">{money(invoice.get('net_amount'))}</td></tr>
    {body}
    <tr style="background:#f1f5f9;font-weight:bold"><td style="padding:8px 10px">الإجمالي المستحق</td>
      <td style="padding:8px 10px;text-align:left" dir="ltr">{money(invoice.get('total_amount'))}</td></tr>
  </table>
  <p style="margin-top:14px;color:#555;font-size:13px">
    طريقة السداد: {invoice.get('payment_method') or '—'} — مدفوعة بالكامل.
  </p>
</div>"""


async def email_invoice(invoice: dict) -> bool:
    """Send it to the customer. Never raises — a mail failure must not undo a payment."""
    to = (invoice.get("buyer", {}) or {}).get("email")
    if not to:
        return False
    try:
        import asyncio as _aio, resend as _rs
        from services.email_service import SENDER_EMAIL
        _rs.api_key = os.environ.get("RESEND_API_KEY", "")
        if not _rs.api_key:
            return False
        await _aio.to_thread(_rs.Emails.send, {
            "from": SENDER_EMAIL, "to": [to],
            "subject": f"فاتورة ضريبية {invoice.get('invoice_number')} — {invoice.get('total_amount'):,.2f} ج.م",
            "html": render_html(invoice)})
        return True
    except Exception as e:
        logger.warning("subscription invoice email failed for %s: %s", invoice.get("invoice_number"), e)
        return False


async def issue_and_send(db, payment: dict, company_id: str = None) -> dict:
    """Issue the tax invoice for a recorded payment and email it.

    Called wherever a subscription payment is stored. Never raises: a payment
    that was taken must not be lost because an invoice or an email failed —
    the failure is logged and can be re-issued, since issuing is idempotent.
    """
    try:
        company = await db.companies.find_one(
            {"id": company_id or payment.get("company_id")}, {"_id": 0}) or {}
        invoice = await issue_for_payment(db, payment, company)
        sent = await email_invoice(invoice)
        return {"invoice_number": invoice["invoice_number"], "net_amount": invoice["net_amount"],
                "vat_amount": invoice["vat_amount"], "total_amount": invoice["total_amount"],
                "emailed": sent}
    except Exception as e:
        logger.error("subscription invoice failed for payment %s: %s", payment.get("id"), e)
        return {"error": str(e)[:200]}
