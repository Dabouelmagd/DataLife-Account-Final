"""
التكليف العكسي — reverse charge VAT on imported services (VAT law 67/2016, art. 32).

When a company buys a service from abroad — Google or Meta advertising, AWS or
Microsoft subscriptions, a foreign consultant — the foreign supplier charges no
Egyptian VAT. The law makes the BUYER account for it: 14% is self-assessed and
declared, and only then may it be deducted if the service belongs to a taxable
activity.

Nothing in the system did this. Every foreign subscription a customer paid for
was a VAT liability that never reached the books or the return — the kind of
thing an inspection finds immediately, because the bank transfers abroad are
right there in the statements.

Two outcomes, and which one applies is the customer's decision, not ours:

  deductible     Dr input VAT (137) / Cr output VAT (260)
                 — declared and deducted in the same return, no cash moves.

  not deductible Dr the expense itself / Cr output VAT (260)
                 — the 14% becomes part of the cost. This is the case for an
                 exempt activity, or a service that is not for the business.
"""

import uuid
from datetime import datetime, timezone

DEFAULT_RATE = 14.0


def _now():
    return datetime.now(timezone.utc).isoformat()


def compute(amount: float, rate: float = DEFAULT_RATE, amount_includes_vat: bool = False) -> dict:
    """The VAT the company owes on a foreign service.

    A foreign invoice is normally VAT-free, so `amount` is the net and the tax
    is added on top. amount_includes_vat is there for the rarer case where a
    gross figure is all the customer has.
    """
    amount = round(float(amount or 0), 2)
    rate = float(rate if rate is not None else DEFAULT_RATE)
    if amount <= 0:
        raise ValueError("قيمة الخدمة يجب أن تكون أكبر من صفر")
    if rate < 0 or rate > 100:
        raise ValueError("نسبة الضريبة غير صحيحة")
    if amount_includes_vat and rate:
        net = round(amount / (1 + rate / 100), 2)
        vat = round(amount - net, 2)
    else:
        net = amount
        vat = round(amount * rate / 100, 2)
    return {"net": net, "vat": vat, "gross": round(net + vat, 2), "rate": rate}


async def build_lines(db, company_id: str, *, net: float, vat: float, deductible: bool,
                      expense_account: str, description: str) -> list:
    """The entry's lines, with the accounts resolved from this company's chart."""
    accounts = await db.chart_of_accounts.find(
        {"company_id": company_id}, {"_id": 0, "id": 1, "account_code": 1, "account_name": 1}).to_list(None)
    by_code = {a["account_code"]: a for a in accounts}

    def line(code: str, debit: float, credit: float, text: str) -> dict:
        acc = by_code.get(code)
        if not acc:
            raise ValueError(f"الحساب {code} غير موجود في شجرة الحسابات")
        return {"line_id": str(uuid.uuid4()), "account_id": acc["id"], "account_code": code,
                "account_name": acc["account_name"], "debit": round(debit, 2),
                "credit": round(credit, 2), "description": text}

    output_vat = "260"
    if deductible:
        # declared and deducted in the same return — no cash moves
        return [
            line("137", vat, 0, f"ضريبة مدخلات — تكليف عكسي: {description}"),
            line(output_vat, 0, vat, f"ضريبة مخرجات مستحقة — تكليف عكسي: {description}"),
        ]
    # not deductible: the tax is part of what the service cost
    return [
        line(expense_account, vat, 0, f"عبء ضريبة القيمة المضافة — تكليف عكسي: {description}"),
        line(output_vat, 0, vat, f"ضريبة مخرجات مستحقة — تكليف عكسي: {description}"),
    ]


async def record(db, company_id: str, user_id: str, data: dict) -> dict:
    """Record the self-assessed VAT and post it."""
    from services.accounting_service import AccountingService
    from models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus

    description = (data.get("description") or "").strip()
    supplier = (data.get("supplier") or "").strip()
    if not description:
        raise ValueError("وصف الخدمة مطلوب")
    amounts = compute(data.get("amount"), data.get("vat_rate", DEFAULT_RATE),
                      bool(data.get("amount_includes_vat")))
    deductible = data.get("deductible", True)
    expense_account = (data.get("expense_account") or "332").strip()
    date_str = data.get("date") or _now()[:10]

    raw_lines = await build_lines(db, company_id, net=amounts["net"], vat=amounts["vat"],
                                  deductible=bool(deductible), expense_account=expense_account,
                                  description=description)
    service = AccountingService(db)
    entry = JournalEntry(
        company_id=company_id,
        entry_number=await service.get_next_entry_number(company_id),
        entry_date=date_str,
        description=f"تكليف عكسي — {description}" + (f" ({supplier})" if supplier else ""),
        lines=[JournalEntryLine(**line) for line in raw_lines],
        total_debit=amounts["vat"], total_credit=amounts["vat"],
        # created as a draft and posted in the next step: creating it POSTED and
        # then posting trips the immutability guard, which is working as intended
        status=JournalEntryStatus.DRAFT,
        source_document_type="reverse_charge",
        source_document_id=str(uuid.uuid4()),
        created_by=user_id,
        fiscal_year=date_str[:4], period=date_str[:7],
    )
    created = await service.create_journal_entry(entry)
    await service.post_journal_entry(created["id"], user_id)

    record_doc = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "supplier": supplier or None, "description": description,
        "net_amount": amounts["net"], "vat_rate": amounts["rate"], "vat_amount": amounts["vat"],
        "deductible": bool(deductible), "expense_account": None if deductible else expense_account,
        "date": date_str, "period": date_str[:7],
        "journal_entry_id": created["id"], "created_by": user_id, "created_at": _now(),
    }
    await db.reverse_charge_records.insert_one(dict(record_doc))
    return record_doc
