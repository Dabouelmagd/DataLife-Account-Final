"""
ترحيل المصروفات والإيرادات المستوردة إلى دفتر الأستاذ.

An imported sheet used to land in its own `expenses` (or `revenues`)
collection and stop there: nothing reached the journal, so the money existed
in the system and not in the books. The expense screen showed it, the trial
balance did not, and the two disagreed with no sign of which was right.

Each row now produces one posted entry:

    expense   Dr the expense account  /  Cr cash or bank (or suppliers)
    revenue   Dr cash or bank         /  Cr the revenue account

The account comes from the row when the sheet names one and that code exists
in the company's chart; otherwise a default for the type is used and the row
is reported as "posted to the default account", so nobody has to guess later
which rows were classified and which were not.

A row that cannot be posted is NOT silently kept: the import reports it as
failed, because a stored row with no entry behind it is the exact problem
this module is fixing.
"""

import logging
from datetime import datetime, timezone
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# sensible defaults when the sheet does not name an account
DEFAULT_EXPENSE = "332"     # مصروفات خدمية عامة
DEFAULT_REVENUE = "412"     # إيراد تقديم خدمات
DEFAULT_CASH = "161"        # النقدية بالصندوق
DEFAULT_BANK = "162"        # النقدية بالبنوك

PAYMENT_ACCOUNTS = {
    "cash": DEFAULT_CASH, "نقدي": DEFAULT_CASH, "نقدا": DEFAULT_CASH, "خزينة": DEFAULT_CASH,
    "bank": DEFAULT_BANK, "بنك": DEFAULT_BANK, "تحويل": DEFAULT_BANK, "شيك": DEFAULT_BANK,
    "credit": "251", "آجل": "251", "مورد": "251",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def resolve_account(db, company_id: str, wanted, fallback: str) -> Tuple[str, bool]:
    """(account_code, was_fallback). Matches a code, or a name, or falls back."""
    text = str(wanted or "").strip()
    if text.lower() in ("nan", "none", "nat"):
        text = ""
    if text:
        # A column with any empty cell makes pandas read the rest as floats, so
        # "335" arrives as "335.0" — stripping non-digits then produced "3350",
        # an account that does not exist, and every such row silently fell back
        # to the default.
        if text.endswith(".0") and text[:-2].replace(" ", "").isdigit():
            text = text[:-2]
        digits = "".join(ch for ch in text if ch.isdigit())
        if digits:
            found = await db.chart_of_accounts.find_one(
                {"company_id": company_id, "account_code": digits}, {"_id": 0, "account_code": 1})
            if found:
                return found["account_code"], False
        found = await db.chart_of_accounts.find_one(
            {"company_id": company_id, "account_name": {"$regex": text[:40], "$options": "i"}},
            {"_id": 0, "account_code": 1})
        if found:
            return found["account_code"], False
    return fallback, True


async def post_row(db, company_id: str, user_id: str, row: dict, data_type: str) -> Optional[dict]:
    """Post one imported row. Returns the entry, or raises with a clear reason."""
    from models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
    from services.accounting_service import AccountingService

    amount = round(float(row.get("amount") or 0), 2)
    if amount <= 0:
        raise ValueError("المبلغ صفر أو سالب")

    is_expense = data_type != "revenue"
    side_code, side_fallback = await resolve_account(
        db, company_id, row.get("account") or row.get("category"),
        DEFAULT_EXPENSE if is_expense else DEFAULT_REVENUE)

    pay_hint = str(row.get("payment_method") or row.get("method") or "").strip().lower()
    counter_code = PAYMENT_ACCOUNTS.get(pay_hint, DEFAULT_CASH if is_expense else DEFAULT_BANK)

    service = AccountingService(db)
    accounts = await db.chart_of_accounts.find(
        {"company_id": company_id, "account_code": {"$in": [side_code, counter_code]}},
        {"_id": 0, "id": 1, "account_code": 1, "account_name": 1}).to_list(4)
    by_code = {a["account_code"]: a for a in accounts}
    for code in (side_code, counter_code):
        if code not in by_code:
            raise ValueError(f"الحساب {code} غير موجود في شجرة الحسابات")

    def line(code: str, debit: float, credit: float) -> JournalEntryLine:
        acc = by_code[code]
        return JournalEntryLine(
            account_id=acc["id"], account_code=code, account_name=acc["account_name"],
            debit=round(debit, 2), credit=round(credit, 2),
            description=(row.get("description") or "")[:200])

    lines = ([line(side_code, amount, 0), line(counter_code, 0, amount)] if is_expense
             else [line(counter_code, amount, 0), line(side_code, 0, amount)])

    date_str = str(row.get("date") or "")[:10] or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    label = "مصروف" if is_expense else "إيراد"
    entry = JournalEntry(
        company_id=company_id,
        entry_number=await service.get_next_entry_number(company_id),
        entry_date=date_str,
        description=f"{label} مستورد — {(row.get('description') or '')[:120]}".strip(" —"),
        lines=lines, total_debit=amount, total_credit=amount,
        status=JournalEntryStatus.DRAFT,
        source_document_type=f"imported_{data_type}",
        source_document_id=row.get("id"),
        created_by=user_id, fiscal_year=date_str[:4], period=date_str[:7])

    created = await service.create_journal_entry(entry)
    await service.post_journal_entry(created["id"], user_id)
    return {"journal_entry_id": created["id"], "entry_number": created.get("entry_number"),
            "account_code": side_code, "counter_code": counter_code,
            "used_default_account": side_fallback}
