"""
Financial Reports PDF + Email service.
Renders Trial Balance and General Ledger as PDF (WeasyPrint) and
sends them as a monthly email digest, mirroring the VAT report pattern.
"""
from __future__ import annotations
import os
import asyncio
from datetime import datetime, timezone
from typing import Optional, Tuple

try:
    from weasyprint import HTML as WeasyHTML
    _WEASY_OK = True
except Exception as _e:  # pragma: no cover
    WeasyHTML = None
    _WEASY_OK = False
    print(f"[financial_reports] weasyprint unavailable: {_e}")


def _fmt(n) -> str:
    return f"{float(n or 0):,.2f}"


# ----------- Aggregations -----------
async def _trial_balance_data(db, company_id: str, start_date: Optional[str], end_date: Optional[str]):
    match = {"company_id": company_id}
    if start_date or end_date:
        date_q = {}
        if start_date:
            date_q["$gte"] = start_date
        if end_date:
            date_q["$lte"] = end_date
        match["date"] = date_q
    pipeline = [
        {"$match": match},
        {"$unwind": "$lines"},
        {"$group": {
            "_id": "$lines.account",
            "total_debit": {"$sum": "$lines.debit"},
            "total_credit": {"$sum": "$lines.credit"},
        }},
        {"$sort": {"_id": 1}},
    ]
    rows = await db.journal_entries.aggregate(pipeline).to_list(length=500)
    accounts, grand_d, grand_c = [], 0.0, 0.0
    for r in rows:
        d, c = round(r["total_debit"], 2), round(r["total_credit"], 2)
        bal = round(d - c, 2)
        accounts.append({
            "account": r["_id"],
            "debit_balance": bal if bal > 0 else 0,
            "credit_balance": abs(bal) if bal < 0 else 0,
        })
        grand_d += d
        grand_c += c
    return accounts, round(grand_d, 2), round(grand_c, 2)


async def _ledger_data(db, company_id: str, start_date: Optional[str], end_date: Optional[str]):
    match = {"company_id": company_id}
    if start_date or end_date:
        date_q = {}
        if start_date:
            date_q["$gte"] = start_date
        if end_date:
            date_q["$lte"] = end_date
        match["date"] = date_q
    pipeline = [
        {"$match": match},
        {"$unwind": "$lines"},
        {"$sort": {"date": 1, "entry_number": 1}},
        {"$group": {
            "_id": "$lines.account",
            "transactions": {"$push": {
                "entry_number": "$entry_number",
                "date": "$date",
                "description": "$description",
                "line_description": "$lines.description",
                "debit": "$lines.debit",
                "credit": "$lines.credit",
            }},
            "total_debit": {"$sum": "$lines.debit"},
            "total_credit": {"$sum": "$lines.credit"},
        }},
        {"$sort": {"_id": 1}},
    ]
    raw = await db.journal_entries.aggregate(pipeline).to_list(length=500)
    result = []
    for r in raw:
        running = 0.0
        txs = []
        for tx in r["transactions"]:
            running += tx["debit"] - tx["credit"]
            txs.append({**tx, "running_balance": round(running, 2)})
        result.append({
            "account": r["_id"],
            "total_debit": round(r["total_debit"], 2),
            "total_credit": round(r["total_credit"], 2),
            "balance": round(r["total_debit"] - r["total_credit"], 2),
            "transactions": txs,
        })
    return result


# ----------- HTML templates -----------
def _common_css() -> str:
    return """
    @page { size: A4; margin: 18mm; }
    body { font-family: 'Noto Sans Arabic', Arial, sans-serif; color: #1e293b; direction: rtl; }
    .header { display: flex; justify-content: space-between; align-items: center;
              border-bottom: 3px solid #28376B; padding-bottom: 12px; margin-bottom: 18px; }
    .header h1 { color: #28376B; margin: 0; font-size: 22px; }
    .meta { font-size: 11px; color: #64748b; text-align: left; }
    .period { background: #f1f5f9; padding: 8px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #28376B; color: #fff; padding: 8px; font-size: 11px; text-align: right; }
    td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11.5px; }
    td.amt { text-align: left; font-weight: 600; font-variant-numeric: tabular-nums; }
    tfoot td { background: #ecfdf5; font-weight: 700; color: #065f46; }
    .acc-block { margin-bottom: 18px; page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
    .acc-head { background: #eef2ff; padding: 8px 12px; display: flex; justify-content: space-between; font-size: 12px; }
    .sig { margin-top: 26px; padding-top: 14px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-around; font-size: 11px; }
    .sig div { text-align: center; min-width: 140px; }
    .sig strong { display: block; margin-bottom: 28px; color: #475569; }
    .ok  { color: #059669; font-weight: bold; }
    .err { color: #dc2626; font-weight: bold; }
    .footer { margin-top: 22px; font-size: 10px; color: #94a3b8; text-align: center; }
    """


def render_trial_balance_html(company_name: str, accounts, grand_d, grand_c,
                              start_date: Optional[str], end_date: Optional[str]) -> str:
    period = f"من {start_date or '—'} إلى {end_date or '—'}" if (start_date or end_date) else "كل الفترات"
    is_balanced = round(grand_d, 2) == round(grand_c, 2)
    rows = "".join(
        f"<tr><td>{a['account']}</td>"
        f"<td class='amt'>{_fmt(a['debit_balance']) if a['debit_balance'] > 0 else '—'}</td>"
        f"<td class='amt'>{_fmt(a['credit_balance']) if a['credit_balance'] > 0 else '—'}</td></tr>"
        for a in accounts
    ) or "<tr><td colspan='3' style='text-align:center;color:#94a3b8'>لا توجد بيانات</td></tr>"
    return f"""<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<title>ميزان المراجعة</title><style>{_common_css()}</style></head><body>
<div class="header">
  <div><h1>ميزان المراجعة</h1><div style="font-size:12px;color:#64748b">{company_name}</div></div>
  <div class="meta">تاريخ الإصدار: {datetime.now().strftime('%Y-%m-%d %H:%M')}<br/>الفترة: {period}</div>
</div>
<div class="period">عدد الحسابات: <strong>{len(accounts)}</strong></div>
<table>
  <thead><tr><th>الحساب</th><th>رصيد مدين (EGP)</th><th>رصيد دائن (EGP)</th></tr></thead>
  <tbody>{rows}</tbody>
  <tfoot><tr><td>الإجمالي</td><td class="amt">{_fmt(grand_d)}</td><td class="amt">{_fmt(grand_c)}</td></tr></tfoot>
</table>
<p style="margin-top:16px" class="{'ok' if is_balanced else 'err'}">
  {'✓ ميزان المراجعة متوازن' if is_balanced else '✗ ميزان المراجعة غير متوازن!'}
</p>
<div class="sig">
  <div><strong>المحاسب</strong>____________________</div>
  <div><strong>مدير الحسابات</strong>____________________</div>
  <div><strong>الإدارة</strong>____________________</div>
</div>
<div class="footer">DataLife Account © {datetime.now().year} — تقرير آلي</div>
</body></html>"""


def render_ledger_html(company_name: str, ledger, start_date: Optional[str], end_date: Optional[str]) -> str:
    period = f"من {start_date or '—'} إلى {end_date or '—'}" if (start_date or end_date) else "كل الفترات"
    blocks = []
    for acc in ledger:
        tx_rows = "".join(
            f"<tr><td>{tx['date']}</td><td>{tx['entry_number']}</td>"
            f"<td>{tx.get('line_description') or tx.get('description','')}</td>"
            f"<td class='amt'>{_fmt(tx['debit']) if tx['debit'] > 0 else '—'}</td>"
            f"<td class='amt'>{_fmt(tx['credit']) if tx['credit'] > 0 else '—'}</td>"
            f"<td class='amt'>{_fmt(tx['running_balance'])}</td></tr>"
            for tx in acc["transactions"]
        )
        blocks.append(f"""
        <div class="acc-block">
          <div class="acc-head">
            <strong>{acc['account']}</strong>
            <span>مدين: {_fmt(acc['total_debit'])} · دائن: {_fmt(acc['total_credit'])} · الرصيد: {_fmt(acc['balance'])}</span>
          </div>
          <table>
            <thead><tr><th>التاريخ</th><th>القيد</th><th>البيان</th><th>مدين</th><th>دائن</th><th>الرصيد الجاري</th></tr></thead>
            <tbody>{tx_rows or '<tr><td colspan=6 style="text-align:center;color:#94a3b8">لا حركات</td></tr>'}</tbody>
          </table>
        </div>""")
    body_blocks = "\n".join(blocks) or "<p style='text-align:center;color:#94a3b8'>لا توجد بيانات</p>"
    return f"""<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<title>دفتر الأستاذ</title><style>{_common_css()}</style></head><body>
<div class="header">
  <div><h1>دفتر الأستاذ العام</h1><div style="font-size:12px;color:#64748b">{company_name}</div></div>
  <div class="meta">تاريخ الإصدار: {datetime.now().strftime('%Y-%m-%d %H:%M')}<br/>الفترة: {period}</div>
</div>
<div class="period">عدد الحسابات: <strong>{len(ledger)}</strong></div>
{body_blocks}
<div class="footer">DataLife Account © {datetime.now().year} — تقرير آلي</div>
</body></html>"""


# ----------- PDF rendering -----------
def html_to_pdf(html: str) -> bytes:
    if not _WEASY_OK:
        raise RuntimeError("PDF rendering not available (weasyprint missing)")
    return WeasyHTML(string=html).write_pdf()


async def build_trial_balance_pdf(db, company_id: str, start_date: Optional[str] = None,
                                   end_date: Optional[str] = None) -> Tuple[bytes, str]:
    company = await db.companies.find_one({"id": company_id}, {"_id": 0, "name": 1}) or {}
    accounts, grand_d, grand_c = await _trial_balance_data(db, company_id, start_date, end_date)
    html = render_trial_balance_html(company.get("name", ""), accounts, grand_d, grand_c, start_date, end_date)
    return html_to_pdf(html), html


async def build_ledger_pdf(db, company_id: str, start_date: Optional[str] = None,
                           end_date: Optional[str] = None) -> Tuple[bytes, str]:
    company = await db.companies.find_one({"id": company_id}, {"_id": 0, "name": 1}) or {}
    ledger = await _ledger_data(db, company_id, start_date, end_date)
    html = render_ledger_html(company.get("name", ""), ledger, start_date, end_date)
    return html_to_pdf(html), html


# ----------- Email -----------
async def send_monthly_financial_report(*, company_id: str, recipient_email: str,
                                         month: int, year: int, db) -> dict:
    """Email Trial Balance + Ledger PDFs for the given month."""
    import resend
    import base64
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        return {"sent": False, "error": "RESEND_API_KEY missing"}

    start = f"{year:04d}-{month:02d}-01"
    if month == 12:
        end = f"{year+1:04d}-01-01"
    else:
        end = f"{year:04d}-{month+1:02d}-01"
    # convert to inclusive YYYY-MM-DD for date strings in journal entries
    from datetime import date, timedelta
    end_inclusive = (date.fromisoformat(end) - timedelta(days=1)).isoformat()

    tb_pdf, _ = await build_trial_balance_pdf(db, company_id, start, end_inclusive)
    lg_pdf, _ = await build_ledger_pdf(db, company_id, start, end_inclusive)

    company = await db.companies.find_one({"id": company_id}, {"_id": 0, "name": 1}) or {}
    company_name = company.get("name", "")

    month_label = f"{year:04d}-{month:02d}"
    html_body = f"""
    <div style="font-family:Arial,sans-serif; direction:rtl; max-width:640px; margin:auto;">
      <div style="background:linear-gradient(135deg,#28376B,#1e2a52); color:#fff; padding:24px; border-radius:10px 10px 0 0;">
        <h2 style="margin:0">التقرير المالي الشهري</h2>
        <p style="margin:6px 0 0; opacity:.85; font-size:13px">{company_name} — {month_label}</p>
      </div>
      <div style="background:#fff; padding:22px; border:1px solid #e5e7eb; border-radius:0 0 10px 10px;">
        <p style="font-size:14px; color:#334155">مرفق طي هذا الإيميل تقريران ماليان رسميان عن شهر <strong>{month_label}</strong>:</p>
        <ul style="font-size:14px; color:#334155; line-height:1.9">
          <li>ميزان المراجعة (Trial Balance)</li>
          <li>دفتر الأستاذ العام (General Ledger)</li>
        </ul>
        <p style="font-size:12px; color:#64748b">تم توليد التقارير تلقائياً بواسطة نظام DataLife Account.</p>
      </div>
    </div>"""

    try:
        resend.api_key = api_key
        sender = os.environ.get("SENDER_EMAIL", "noreply@datalifeaccount.com")
        params = {
            "from": f"DataLife Account <{sender}>",
            "to": [recipient_email],
            "subject": f"📊 التقرير المالي الشهري — {month_label}",
            "html": html_body,
            "attachments": [
                {"filename": f"trial-balance-{month_label}.pdf",
                 "content": base64.b64encode(tb_pdf).decode("utf-8")},
                {"filename": f"general-ledger-{month_label}.pdf",
                 "content": base64.b64encode(lg_pdf).decode("utf-8")},
            ],
        }
        await asyncio.to_thread(resend.Emails.send, params)
        await db.financial_report_logs.insert_one({
            "company_id": company_id,
            "recipient": recipient_email,
            "month": month,
            "year": year,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"sent": True, "month": month_label, "recipient": recipient_email}
    except Exception as err:
        return {"sent": False, "error": str(err)}
