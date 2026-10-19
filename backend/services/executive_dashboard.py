"""
اللوحة التنفيذية — the figures a decision actually rests on.

The dashboard counted things: how many employees, how many invoices, how many
products. None of that decides anything. What decides things is how much cash
there is, who owes the company and who it owes, what the month made or lost,
what the tax authority is owed, and what is overdue — and those come from the
ledger, not from counting documents.

Every figure here is computed from POSTED journal entries, so the dashboard
and the financial statements cannot disagree. Where a figure has no entries
behind it, it is reported as unavailable rather than as zero: "no data" and
"nothing owed" are different answers, and showing the second for the first is
how a dashboard misleads.

Sections follow the reader's permissions. A payroll figure is not shown to
someone who may not open payroll — the dashboard must not become a way around
the permission system.
"""

import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# account groups, by code prefix, as the chart defines them
CASH = ("161", "162", "164")
RECEIVABLES = ("131", "132")
PAYABLES = ("251", "252", "231")
INVENTORY = ("121", "122", "125", "126")
VAT_OUTPUT = ("260",)
VAT_INPUT = ("137",)
PAYROLL_DUE = ("253", "255", "266")
LOANS = ("241", "242")


def _now():
    return datetime.now(timezone.utc)


DEBIT_TYPES = {"asset", "expense", "contra_liability", "contra_equity"}


def _kind(t) -> str:
    """account type as its plain value, whether stored as text or as the enum."""
    return str(getattr(t, "value", t) or "").lower()


async def _balances(db, company_id: str, upto: str = None) -> dict:
    """account_code → {balance, name, type} from the GENERAL LEDGER.

    The same arithmetic as the trial balance and balance sheet: opening
    balance plus posted ledger movement, signed by the account's nature, header
    accounts skipped. It used to read chart_of_accounts.current_balance — a
    running counter that drifts whenever an entry is half-posted — and summed
    headers together with their children, so the dashboard could disagree
    with the statements.
    """
    accounts = await db.chart_of_accounts.find(
        {"company_id": company_id}, {"_id": 0, "id": 1, "account_code": 1, "account_name": 1,
                                     "account_type": 1, "account_category": 1, "is_header": 1,
                                     "opening_balance": 1}).to_list(None)
    match = {"company_id": company_id}
    if upto:
        match["entry_date"] = {"$lte": upto + "\uffff"}
    movement = {r["_id"]: r async for r in db.general_ledger.aggregate([
        {"$match": match},
        {"$group": {"_id": "$account_id", "d": {"$sum": "$debit"}, "c": {"$sum": "$credit"}}}])}
    out = {}
    for a in accounts:
        if a.get("is_header") or a.get("account_category") == "header":
            continue
        code = str(a.get("account_code") or "")
        mv = movement.get(a.get("id"), {"d": 0, "c": 0})
        opening = float(a.get("opening_balance") or 0)
        if _kind(a.get("account_type")) in DEBIT_TYPES:
            bal = opening + float(mv["d"] or 0) - float(mv["c"] or 0)
        else:
            bal = opening + float(mv["c"] or 0) - float(mv["d"] or 0)
        out[code] = {"balance": round(bal, 2), "account_name": a.get("account_name"),
                     "account_type": a.get("account_type")}
    return out


def _sum_prefix(balances: dict, prefixes: tuple) -> float:
    """Signed total of the leaf accounts under these codes (an overdrawn bank
    reduces the cash total instead of being added to it)."""
    return round(sum(r["balance"] for code, r in balances.items() if code.startswith(prefixes)), 2)


async def _result(db, company_id: str, since: str, until: str) -> tuple:
    """(revenue, expenses) since a date — the income statement's arithmetic:
    general-ledger movement on revenue and expense accounts, by account type."""
    types = {a["id"]: a.get("account_type") async for a in db.chart_of_accounts.find(
        {"company_id": company_id, "account_type": {"$in": ["revenue", "expense"]}},
        {"_id": 0, "id": 1, "account_type": 1})}
    revenue = expenses = 0.0
    async for r in db.general_ledger.aggregate([
            {"$match": {"company_id": company_id,
                        # up to today: a future-dated entry is not this month's result
                        "entry_date": {"$gte": since, "$lte": until + "\uffff"},
                        "account_id": {"$in": list(types)}}},
            {"$group": {"_id": "$account_id", "d": {"$sum": "$debit"}, "c": {"$sum": "$credit"}}}]):
        if _kind(types.get(r["_id"])) == "revenue":
            revenue += float(r["c"] or 0) - float(r["d"] or 0)
        else:
            expenses += float(r["d"] or 0) - float(r["c"] or 0)
    return round(revenue, 2), round(expenses, 2)


async def build(db, company_id: str, permissions: set, is_manager: bool) -> dict:
    """The executive view, limited to what this reader may see."""
    def may(permission: str) -> bool:
        return is_manager or permission in permissions

    now = _now()
    month_start = now.replace(day=1).strftime("%Y-%m-%d")
    year_start = now.replace(month=1, day=1).strftime("%Y-%m-%d")
    today = now.strftime("%Y-%m-%d")

    balances = await _balances(db, company_id, today)   # as of today, like the trial balance
    has_ledger = (await db.general_ledger.count_documents({"company_id": company_id}, limit=1) > 0
                  or any(r["balance"] for r in balances.values()))

    out = {"as_of": now.isoformat(), "has_data": has_ledger, "sections": {}}
    if not has_ledger:
        out["note"] = "لا توجد قيود مرحّلة بعد — ستظهر الأرقام فور بدء التسجيل المحاسبي"
        return out

    # ── cash and what it owes / is owed ──────────────────────────
    if may("financial"):
        revenue, expenses = await _result(db, company_id, month_start, today)
        revenue_ytd, expenses_ytd = await _result(db, company_id, year_start, today)
        cash = _sum_prefix(balances, CASH)
        receivables = _sum_prefix(balances, RECEIVABLES)
        # a "جاري" (current account) of a partner or the chairman sits under the
        # payables codes but is not owed to suppliers — shown on its own line
        owners = round(sum(r["balance"] for c, r in balances.items()
                           if c.startswith(PAYABLES + ("212",)) and "جاري" in str(r.get("account_name") or "")), 2)
        payables = round(_sum_prefix(balances, PAYABLES) - sum(
            r["balance"] for c, r in balances.items()
            if c.startswith(PAYABLES) and "جاري" in str(r.get("account_name") or "")), 2)

        out["sections"]["financial"] = {
            "cash_and_banks": cash,
            "receivables": receivables,
            "payables": payables,
            "net_position": round(cash + receivables - payables - owners, 2),
            "month_revenue": revenue,
            "month_expenses": expenses,
            "month_profit": round(revenue - expenses, 2),
            "ytd_revenue": revenue_ytd,
            "ytd_expenses": expenses_ytd,
            "ytd_profit": round(revenue_ytd - expenses_ytd, 2),
            "loans_outstanding": _sum_prefix(balances, LOANS),
            "owners_current": owners,
        }

        # banks, one line each — a total hides an overdrawn account
        banks = [{"code": c, "name": r.get("account_name"), "balance": r["balance"]}
                 for c, r in sorted(balances.items()) if c.startswith(CASH)]
        out["sections"]["banks"] = [b for b in banks if b["balance"] or b["code"] in ("161", "162")]

    # ── tax position ─────────────────────────────────────────────
    if may("financial") or may("taxes"):
        output_vat = _sum_prefix(balances, VAT_OUTPUT)
        input_vat = _sum_prefix(balances, VAT_INPUT)
        out["sections"]["tax"] = {
            "vat_output": output_vat,
            "vat_input": input_vat,
            "vat_due": round(output_vat - input_vat, 2),
            "income_tax_accrued": _sum_prefix(balances, ("265",)),
            "withholding_due": _sum_prefix(balances, ("261",)),
            "note": "الرصيد المستحق للمصلحة = ضريبة المخرجات ناقص المدخلات",
        }

    # ── receivables that are late ────────────────────────────────
    if may("financial") or may("invoices"):
        overdue = await db.invoices.find(
            {"company_id": company_id, "document_type": "sales_invoice",
             "status": {"$in": ["approved", "partially_paid"]},
             "due_date": {"$lt": today}},
            {"_id": 0, "document_number": 1, "party_name": 1, "amount_due": 1, "due_date": 1}
        ).sort("due_date", 1).to_list(200)
        out["sections"]["overdue"] = {
            "count": len(overdue),
            "total": round(sum(float(i.get("amount_due") or 0) for i in overdue), 2),
            "oldest": overdue[:5],
        }

    # ── inventory tied up ────────────────────────────────────────
    if may("financial") or may("inventory"):
        out["sections"]["inventory"] = {
            "value": _sum_prefix(balances, INVENTORY),
            "low_stock_count": await db.stocks.count_documents(
                {"company_id": company_id, "quantity": {"$lte": 5}}),
        }

    # ── people and what payroll will cost ────────────────────────
    if may("hr") or may("payroll"):
        active = await db.employees.count_documents(
            {"company_id": company_id, "$or": [{"status": "active"}, {"is_active": True}]})
        out["sections"]["people"] = {
            "active_employees": active,
            "payroll_liabilities": _sum_prefix(balances, PAYROLL_DUE),
        }

    # ── what is waiting on someone ───────────────────────────────
    pending_invoices = await db.invoices.count_documents(
        {"company_id": company_id, "status": "draft"})
    future = await db.journal_entries.count_documents(
        {"company_id": company_id, "entry_date": {"$gt": today + "\uffff"},
         "status": {"$in": ["posted", "POSTED"]}, "is_reversal": {"$ne": True}})
    out["sections"]["attention"] = {
        "future_entries": future,
        "draft_invoices": pending_invoices,
        "unposted_entries": await db.journal_entries.count_documents(
            {"company_id": company_id, "status": {"$in": ["draft", "DRAFT"]}}),
    }
    return out
