"""
القيود المحاسبية للاشتراك — both sides of the same payment.

A subscription payment is two entries in two different sets of books, and
until now it produced neither:

  the customer   Dr 3322 software subscriptions (net)
                 Dr 137  input VAT (reclaimable — they hold a tax invoice)
                 Cr 162  bank

  the platform   Dr 162  bank
                 Cr 412  service revenue (net)
                 Cr 260  output VAT (payable to the authority)

The platform's own company is named by PLATFORM_COMPANY_ID. Without it, only
the customer's entry is posted and the omission is logged — a missing setting
must not cost the customer their expense record.

Failures never break the payment: money already changed hands, and a payment
that was taken but not recorded is worse than one recorded late. Each entry
is attempted independently and reported.
"""

import logging
import os
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

CUSTOMER_EXPENSE = "3322"      # اشتراكات برامج وخدمات سحابية
INPUT_VAT = "137"
BANK = "162"
PLATFORM_REVENUE = "412"       # إيراد تقديم خدمات
OUTPUT_VAT = "260"


def platform_company_id():
    return (os.environ.get("PLATFORM_COMPANY_ID") or "").strip() or None


async def _post(db, company_id: str, user_id: str, date_str: str, description: str,
                lines_spec: list, source_id: str, source_type: str):
    """lines_spec: [(account_code, debit, credit, text)]. Returns the entry id."""
    from models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
    from services.accounting_service import AccountingService

    codes = [c for c, *_ in lines_spec]
    accounts = await db.chart_of_accounts.find(
        {"company_id": company_id, "account_code": {"$in": codes}},
        {"_id": 0, "id": 1, "account_code": 1, "account_name": 1}).to_list(10)
    by_code = {a["account_code"]: a for a in accounts}
    missing = [c for c in codes if c not in by_code]
    if missing:
        raise ValueError(f"الحسابات غير موجودة في شجرة الشركة: {', '.join(missing)}")

    lines = []
    total = 0.0
    for code, debit, credit, text in lines_spec:
        if not debit and not credit:
            continue                    # a zero line (no VAT, say) is simply omitted
        acc = by_code[code]
        lines.append(JournalEntryLine(
            account_id=acc["id"], account_code=code, account_name=acc["account_name"],
            debit=round(debit, 2), credit=round(credit, 2), description=text[:200]))
        total += debit
    if not lines:
        raise ValueError("لا توجد سطور للقيد")

    service = AccountingService(db)
    entry = JournalEntry(
        company_id=company_id,
        entry_number=await service.get_next_entry_number(company_id),
        entry_date=date_str, description=description[:200], lines=lines,
        total_debit=round(total, 2), total_credit=round(total, 2),
        status=JournalEntryStatus.DRAFT,
        source_document_type=source_type, source_document_id=source_id,
        created_by=user_id, fiscal_year=date_str[:4], period=date_str[:7])
    created = await service.create_journal_entry(entry)
    await service.post_journal_entry(created["id"], user_id)
    return created["id"]


async def post_subscription_payment(db, *, customer_company_id: str, user_id: str,
                                    net: float, vat: float, description: str,
                                    invoice_number: str = None, date_str: str = None,
                                    paid_from: str = BANK) -> dict:
    """Post the customer's expense and the platform's revenue. Never raises."""
    date_str = (date_str or datetime.now(timezone.utc).strftime("%Y-%m-%d"))[:10]
    net = round(float(net or 0), 2)
    vat = round(float(vat or 0), 2)
    gross = round(net + vat, 2)
    source_id = invoice_number or str(uuid.uuid4())
    result = {"customer_entry": None, "platform_entry": None, "errors": []}
    if gross <= 0:
        result["errors"].append("قيمة الاشتراك صفر")
        return result

    label = f"اشتراك — {description}"[:180]

    try:
        result["customer_entry"] = await _post(
            db, customer_company_id, user_id, date_str, label,
            [(CUSTOMER_EXPENSE, net, 0, description),
             (INPUT_VAT, vat, 0, f"ضريبة مدخلات — {invoice_number or ''}".strip(" —")),
             (paid_from, 0, gross, description)],
            source_id, "subscription_expense")
    except Exception as e:
        logger.error("customer subscription entry failed (%s): %s", customer_company_id, e)
        result["errors"].append(f"قيد العميل: {str(e)[:120]}")

    platform = platform_company_id()
    if not platform:
        result["errors"].append("PLATFORM_COMPANY_ID غير مضبوط — لم يُسجَّل إيراد المنصة")
        return result
    if platform == customer_company_id:
        return result                   # the platform paying itself has nothing to record

    try:
        result["platform_entry"] = await _post(
            db, platform, user_id, date_str, label,
            [(BANK, gross, 0, description),
             (PLATFORM_REVENUE, 0, net, description),
             (OUTPUT_VAT, 0, vat, f"ضريبة مخرجات — {invoice_number or ''}".strip(" —"))],
            source_id, "subscription_revenue")
    except Exception as e:
        logger.error("platform revenue entry failed: %s", e)
        result["errors"].append(f"قيد المنصة: {str(e)[:120]}")
    return result
