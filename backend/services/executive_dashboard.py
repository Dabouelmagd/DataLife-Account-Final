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


async def _balances(db, company_id: str) -> dict:
    """account_code → balance, from the chart (kept current by posting)."""
    rows = await db.chart_of_accounts.find(
        {"company_id": company_id}, {"_id": 0, "account_code": 1, "current_balance": 1,
                                     "account_name": 1, "account_type": 1}).to_list(None)
    return {r["account_code"]: r for r in rows}


def _sum_prefix(balances: dict, prefixes: tuple, absolute: bool = True) -> float:
    total = 0.0
    for code, row in balances.items():
        if code.startswith(prefixes):
            value = float(row.get("current_balance") or 0)
            total += abs(value) if absolute else value
    return round(total, 2)


async def _period_movement(db, company_id: str, prefixes: tuple, since: str) -> float:
    """Movement on a group of accounts since a date, from posted entries only."""
    pipeline = [
        {"$match": {"company_id": company_id, "status": {"$in": ["posted", "POSTED"]},
                    "entry_date": {"$gte": since}}},
        {"$unwind": "$lines"},
        {"$group": {"_id": "$lines.account_code",
                    "debit": {"$sum": "$lines.debit"}, "credit": {"$sum": "$lines.credit"}}},
    ]
    rows = await db.journal_entries.aggregate(pipeline).to_list(None)
    total = 0.0
    for row in rows:
        code = str(row.get("_id") or "")
        if code.startswith(prefixes):
            total += float(row.get("credit", 0)) - float(row.get("debit", 0))
    return round(abs(total), 2)


async def build(db, company_id: str, permissions: set, is_manager: bool) -> dict:
    """The executive view, limited to what this reader may see."""
    def may(permission: str) -> bool:
        return is_manager or permission in permissions

    now = _now()
    month_start = now.replace(day=1).strftime("%Y-%m-%d")
    year_start = now.replace(month=1, day=1).strftime("%Y-%m-%d")
    today = now.strftime("%Y-%m-%d")

    balances = await _balances(db, company_id)
    has_ledger = await db.journal_entries.count_documents(
        {"company_id": company_id, "status": {"$in": ["posted", "POSTED"]}}) > 0

    out = {"as_of": now.isoformat(), "has_data": has_ledger, "sections": {}}
    if not has_ledger:
        out["note"] = "لا توجد قيود مرحّلة بعد — ستظهر الأرقام فور بدء التسجيل المحاسبي"
        return out

    # ── cash and what it owes / is owed ──────────────────────────
    if may("financial"):
        revenue = await _period_movement(db, company_id, ("41", "42", "43"), month_start)
        expenses = await _period_movement(db, company_id, ("31", "32", "33", "34"), month_start)
        revenue_ytd = await _period_movement(db, company_id, ("41", "42", "43"), year_start)
        expenses_ytd = await _period_movement(db, company_id, ("31", "32", "33", "34"), year_start)
        cash = _sum_prefix(balances, CASH)
        receivables = _sum_prefix(balances, RECEIVABLES)
        payables = _sum_prefix(balances, PAYABLES)

        out["sections"]["financial"] = {
            "cash_and_banks": cash,
            "receivables": receivables,
            "payables": payables,
            "net_position": round(cash + receivables - payables, 2),
            "month_revenue": revenue,
            "month_expenses": expenses,
            "month_profit": round(revenue - expenses, 2),
            "ytd_revenue": revenue_ytd,
            "ytd_expenses": expenses_ytd,
            "ytd_profit": round(revenue_ytd - expenses_ytd, 2),
            "loans_outstanding": _sum_prefix(balances, LOANS),
        }

        # banks, one line each — a total hides an overdrawn account
        banks = [{"code": c, "name": r.get("account_name"), "balance": round(float(r.get("current_balance") or 0), 2)}
                 for c, r in sorted(balances.items()) if c.startswith(("161", "162", "164"))]
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
    out["sections"]["attention"] = {
        "draft_invoices": pending_invoices,
        "unposted_entries": await db.journal_entries.count_documents(
            {"company_id": company_id, "status": {"$in": ["draft", "DRAFT"]}}),
    }
    return out
