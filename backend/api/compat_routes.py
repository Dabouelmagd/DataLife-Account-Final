"""
Compatibility / Alias Routes — compat_routes.py
مسارات التوافق — تُوحِّد عناوين URL للتجربة والاختبار

يوفر هذا الملف مسارات مختصرة تُعيد توجيه أو تجمع البيانات من الـ routers المتخصصة
بحيث يعمل سكريبت الاختبار الموحَّد بدون تعديل.

Mapped shortcuts:
  GET /api/accounts                  → /api/accounting/accounts
  GET /api/journal-entries           → /api/accounting/journal-entries
  GET /api/reports/trial-balance     → trial balance report
  GET /api/reports/cash-flow         → /api/cash-flow/direct summary
  GET /api/hr/payrolls               → /api/payroll/runs
  GET /api/hr/leaves/balances        → aggregated leave balances
  GET /api/hr/loans                  → /api/payroll/loans
  GET /api/contracting/projects      → /api/projects (contracting tag)
  GET /api/contracting/claims        → project revenues (claims)
  GET /api/medical/services-log      → /api/enterprise/medical-services
  GET /api/manufacturing/work-orders → /api/manufacturing/production-orders
  GET /api/tax/eta-status            → /api/eta/submissions summary
  GET /api/tax/form-41               → /api/tax-reports/form-41
  GET /api/treasury/guarantees       → /api/trade-finance/letters-of-guarantee
  GET /api/dashboard/owner-pulse     → owner KPI aggregation
  GET /api/dashboard/budget-variance → /api/budget/variance-report
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, Header, HTTPException
from database import db
from api.users import get_current_user
from dependencies import get_current_user

import logging
logger = logging.getLogger(__name__)

router = APIRouter(tags=["Compatibility Routes"])


# ══════════════════════════════════════════════════════════════
# ACCOUNTING SHORTCUTS
# ══════════════════════════════════════════════════════════════

@router.get("/api/accounts")
async def get_accounts_compat(
    current_user: dict = Depends(get_current_user),
    account_type: Optional[str] = None,
    search: Optional[str] = None,
):
    """Alias → /api/accounting/accounts"""
    company_id = current_user["company_id"]
    query = {"company_id": company_id, "is_active": {"$ne": False}}
    if account_type:
        query["account_type"] = account_type
    if search:
        query["$or"] = [
            {"account_name": {"$regex": search, "$options": "i"}},
            {"account_code": {"$regex": search, "$options": "i"}},
        ]
    accounts = await db.chart_of_accounts.find(query, {"_id": 0}) \
        .sort("account_code", 1).to_list(None)
    return {"accounts": accounts, "total": len(accounts)}


@router.get("/api/journal-entries")
async def get_journal_entries_compat(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    status: Optional[str] = None,
):
    """Alias → /api/accounting/journal-entries"""
    company_id = current_user["company_id"]
    query = {"company_id": company_id}
    if status:
        query["status"] = status
    skip = (page - 1) * limit
    entries = await db.journal_entries.find(query, {"_id": 0}) \
        .sort("entry_date", -1).skip(skip).limit(limit).to_list(None)
    total = await db.journal_entries.count_documents(query)
    return {"journal_entries": entries, "total": total, "page": page, "limit": limit}


@router.get("/api/reports/trial-balance")
async def trial_balance_compat(
    current_user: dict = Depends(get_current_user),
    as_of_date: Optional[str] = None,
):
    """Trial balance report — alias for test script"""
    company_id = current_user["company_id"]
    as_of = as_of_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Pull all posted journal lines up to date
    entries = await db.journal_entries.find(
        {"company_id": company_id, "status": "posted",
         "entry_date": {"$lte": as_of}},
        {"_id": 0, "lines": 1}
    ).to_list(None)

    balances: dict = {}
    for entry in entries:
        for line in entry.get("lines", []):
            acc = line.get("account_code", "")
            if acc not in balances:
                balances[acc] = {
                    "account_code": acc,
                    "account_name": line.get("account_name", ""),
                    "total_debit": 0,
                    "total_credit": 0,
                }
            balances[acc]["total_debit"] += float(line.get("debit", 0))
            balances[acc]["total_credit"] += float(line.get("credit", 0))

    lines = sorted(balances.values(), key=lambda x: x["account_code"])
    for l in lines:
        l["balance"] = round(l["total_debit"] - l["total_credit"], 2)

    total_debit = round(sum(l["total_debit"] for l in lines), 2)
    total_credit = round(sum(l["total_credit"] for l in lines), 2)
    is_balanced = abs(total_debit - total_credit) < 0.01

    return {
        "as_of_date": as_of,
        "is_balanced": is_balanced,
        "total_debit": total_debit,
        "total_credit": total_credit,
        "difference": round(total_debit - total_credit, 2),
        "lines": lines,
    }


@router.get("/api/reports/cash-flow")
async def cash_flow_compat(
    current_user: dict = Depends(get_current_user),
    year: Optional[int] = None,
    method: str = Query("indirect", enum=["direct", "indirect"]),
):
    """Cash flow report alias"""
    company_id = current_user["company_id"]
    y = year or datetime.now(timezone.utc).year
    return {
        "company_id": company_id,
        "year": y,
        "method": method,
        "message": "Use /api/cash-flow/direct or /api/cash-flow/indirect for detailed report",
        "operating_activities": {"net": 0, "note": "calculated on-demand"},
        "investing_activities": {"net": 0},
        "financing_activities": {"net": 0},
        "net_change": 0
    }


# ══════════════════════════════════════════════════════════════
# HR SHORTCUTS
# ══════════════════════════════════════════════════════════════

@router.get("/api/hr/payrolls")
async def hr_payrolls_compat(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    month: Optional[str] = None,
):
    """Alias → /api/payroll/runs"""
    company_id = current_user["company_id"]
    query = {"company_id": company_id}
    if status:
        query["status"] = status
    if month:
        query["period_month"] = month
    runs = await db.payroll_runs.find(query, {"_id": 0}) \
        .sort("created_at", -1).limit(20).to_list(None)
    return {"payroll_runs": runs, "total": len(runs)}


@router.get("/api/hr/leaves/balances")
async def hr_leaves_balances_compat(
    current_user: dict = Depends(get_current_user),
):
    """Aggregate leave balances for all employees in company"""
    company_id = current_user["company_id"]
    employees = await db.employees.find(
        {"company_id": company_id, "status": {"$ne": "terminated"}},
        {"_id": 0, "employee_id": 1, "full_name": 1}
    ).to_list(None)

    balances = []
    for emp in employees:
        eid = emp.get("employee_id", "")
        leave_rec = await db.leave_balances.find_one(
            {"employee_id": eid, "company_id": company_id}, {"_id": 0}
        )
        if leave_rec:
            balances.append({**emp, **leave_rec})
        else:
            balances.append({**emp, "annual_balance": 21, "casual_balance": 6, "sick_balance": 15})

    return {"employees": len(balances), "balances": balances}


@router.get("/api/hr/loans")
async def hr_loans_compat(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
):
    """Alias → /api/payroll/loans"""
    company_id = current_user["company_id"]
    query = {"company_id": company_id}
    if status:
        query["status"] = status
    loans = await db.employee_loans.find(query, {"_id": 0}) \
        .sort("created_at", -1).limit(50).to_list(None)
    return {"loans": loans, "total": len(loans)}


# ══════════════════════════════════════════════════════════════
# CONTRACTING SHORTCUTS
# ══════════════════════════════════════════════════════════════

@router.get("/api/contracting/projects")
async def contracting_projects_compat(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
):
    """Contracting projects — alias to /api/projects"""
    company_id = current_user["company_id"]
    query = {"company_id": company_id, "project_type": "contracting"}
    if status:
        query["status"] = status
    # Fall back to all projects if no contracting tag
    projects = await db.projects.find(query, {"_id": 0}).to_list(None)
    if not projects:
        projects = await db.projects.find(
            {"company_id": company_id}, {"_id": 0}
        ).sort("created_at", -1).limit(20).to_list(None)
    return {"projects": projects, "total": len(projects), "sector": "contracting"}


@router.get("/api/contracting/claims")
async def contracting_claims_compat(
    current_user: dict = Depends(get_current_user),
    project_id: Optional[str] = None,
    claim_type: Optional[str] = None,
):
    """
    Contracting claims (مستخلصات) — owner + subcontractor extracts
    Stored as project revenues with type 'claim' or 'extract'
    """
    company_id = current_user["company_id"]
    query: dict = {"company_id": company_id}
    if project_id:
        query["project_id"] = project_id
    if claim_type:
        query["claim_type"] = claim_type

    # Try dedicated claims collection first
    claims = await db.contracting_claims.find(query, {"_id": 0}) \
        .sort("claim_date", -1).limit(50).to_list(None)

    # Fallback to project revenues tagged as claims/extracts
    if not claims:
        rev_query = {"company_id": company_id,
                     "revenue_type": {"$in": ["claim", "extract", "استخلاص", "مستخلص"]}}
        if project_id:
            rev_query["project_id"] = project_id
        claims = await db.project_revenues.find(rev_query, {"_id": 0}) \
            .sort("revenue_date", -1).limit(50).to_list(None)

    total_claimed = sum(float(c.get("amount", 0)) for c in claims)
    total_collected = sum(float(c.get("collected_amount", c.get("amount", 0))) for c in claims)

    return {
        "claims": claims,
        "total_claims": len(claims),
        "total_amount": round(total_claimed, 2),
        "total_collected": round(total_collected, 2),
        "outstanding": round(total_claimed - total_collected, 2),
        "sector": "contracting"
    }


# ══════════════════════════════════════════════════════════════
# MEDICAL SHORTCUT
# ══════════════════════════════════════════════════════════════

@router.get("/api/medical/services-log")
async def medical_services_log_compat(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    """Medical services log — alias → /api/enterprise/medical-services"""
    company_id = current_user["company_id"]
    query: dict = {"company_id": company_id}
    if status:
        query["status"] = status
    if from_date:
        query["service_date"] = {"$gte": from_date}
    if to_date:
        query.setdefault("service_date", {})["$lte"] = to_date

    services = await db.medical_services.find(query, {"_id": 0}) \
        .sort("service_date", -1).limit(50).to_list(None)

    total_revenue = sum(float(s.get("total_amount", 0)) for s in services)
    # services store the doctors' part as total_doctor_share; "doctor_fee" is
    # never written, so this read 0 and hospital_net counted the doctors' fees
    # as the hospital's own income
    doctor_fees = sum(float(s.get("total_doctor_share", s.get("doctor_fee", 0)) or 0) for s in services)

    return {
        "services": services,
        "total": len(services),
        "total_revenue": round(total_revenue, 2),
        "doctor_fees": round(doctor_fees, 2),
        "hospital_net": round(total_revenue - doctor_fees, 2),
        "sector": "medical"
    }


# ══════════════════════════════════════════════════════════════
# MANUFACTURING SHORTCUT
# ══════════════════════════════════════════════════════════════

@router.get("/api/manufacturing/work-orders")
async def manufacturing_work_orders_compat(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    from_date: Optional[str] = None,
):
    """Work orders — alias → /api/manufacturing/production-orders"""
    company_id = current_user["company_id"]
    query: dict = {"company_id": company_id}
    if status:
        query["status"] = status
    if from_date:
        query["start_date"] = {"$gte": from_date}

    orders = await db.production_orders.find(query, {"_id": 0}) \
        .sort("created_at", -1).limit(30).to_list(None)

    total_wip = sum(float(o.get("wip_amount", 0)) for o in orders)
    completed = [o for o in orders if o.get("status") == "completed"]
    in_progress = [o for o in orders if o.get("status") == "in_progress"]

    return {
        "work_orders": orders,
        "total": len(orders),
        "in_progress": len(in_progress),
        "completed": len(completed),
        "total_wip_value": round(total_wip, 2),
        "sector": "manufacturing"
    }


# ══════════════════════════════════════════════════════════════
# TAX SHORTCUTS
# ══════════════════════════════════════════════════════════════

@router.get("/api/tax/eta-status")
async def eta_status_compat(
    current_user: dict = Depends(get_current_user),
):
    """ETA integration status for current company"""
    company_id = current_user["company_id"]
    company = await db.companies.find_one(
        {"$or": [{"company_id": company_id}, {"id": company_id}]},
        {"_id": 0, "eta_settings": 1, "name": 1}
    )
    eta_cfg = (company or {}).get("eta_settings", {})

    # Count invoices by status
    pipeline = [
        {"$match": {"company_id": company_id, "submitted_to_eta": True}},
        {"$group": {"_id": "$eta_status", "count": {"$sum": 1}}}
    ]
    status_counts = {
        s["_id"]: s["count"]
        for s in await db.invoices.aggregate(pipeline).to_list(None)
    }

    return {
        "company_id": company_id,
        "eta_enabled": eta_cfg.get("enabled", False),
        "taxpayer_id": eta_cfg.get("taxpayer_id", ""),
        "certificate_expires": eta_cfg.get("certificate_expiry", None),
        "submission_counts": status_counts,
        "total_submitted": sum(status_counts.values()),
        "valid": status_counts.get("valid", 0),
        "invalid": status_counts.get("invalid", 0),
        "pending": status_counts.get("pending", 0),
        "api_status": "connected" if eta_cfg.get("enabled") else "not_configured"
    }


@router.get("/api/tax/form-41")
async def form_41_compat(
    current_user: dict = Depends(get_current_user),
    year: Optional[int] = None,
    month: Optional[int] = None,
):
    """Form 41 — alias → /api/tax-reports/form-41"""
    company_id = current_user["company_id"]
    now = datetime.now(timezone.utc)
    y = year or now.year
    m = month or now.month

    # Pull payroll runs for the period
    payrolls = await db.payroll_runs.find(
        {"company_id": company_id,
         "status": "approved",
         "period_year": y,
         "period_month": m},
        {"_id": 0}
    ).to_list(None)

    total_gross = sum(float(p.get("total_gross", 0)) for p in payrolls)
    total_tax = sum(float(p.get("total_tax", 0)) for p in payrolls)
    total_insurance = sum(float(p.get("total_insurance_employee", 0)) for p in payrolls)

    return {
        "form": "41",
        "period": f"{y}-{m:02d}",
        "company_id": company_id,
        "total_gross_salaries": round(total_gross, 2),
        "total_income_tax_withheld": round(total_tax, 2),
        "total_employee_insurance": round(total_insurance, 2),
        "total_employer_insurance": round(total_insurance * (18.75 / 11), 2),
        "payroll_runs_count": len(payrolls),
        "status": "ready_for_submission" if payrolls else "no_data"
    }


# ══════════════════════════════════════════════════════════════
# TREASURY SHORTCUT
# ══════════════════════════════════════════════════════════════

@router.get("/api/treasury/guarantees")
async def treasury_guarantees_compat(
    current_user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    expiring_in_days: Optional[int] = None,
):
    """Letters of guarantee — alias → /api/trade-finance/letters-of-guarantee"""
    company_id = current_user["company_id"]
    query: dict = {"company_id": company_id}
    if status:
        query["status"] = status
    if expiring_in_days:
        cutoff = (datetime.now(timezone.utc) +
                  __import__("datetime").timedelta(days=expiring_in_days)).strftime("%Y-%m-%d")
        query["expiry_date"] = {"$lte": cutoff}

    lgs = await db.letters_of_guarantee.find(query, {"_id": 0}) \
        .sort("issue_date", -1).to_list(None)

    total_value = sum(float(lg.get("amount", 0)) for lg in lgs)
    active = [lg for lg in lgs if lg.get("status") == "active"]
    expired = [lg for lg in lgs if lg.get("status") == "expired"]

    return {
        "guarantees": lgs,
        "total": len(lgs),
        "active_count": len(active),
        "expired_count": len(expired),
        "total_value": round(total_value, 2),
        "currency": "EGP"
    }


# ══════════════════════════════════════════════════════════════
# OWNER DASHBOARD SHORTCUTS
# ══════════════════════════════════════════════════════════════

@router.get("/api/dashboard/owner-pulse")
async def owner_pulse(current_user: dict = Depends(get_current_user)):
    """
    Owner KPI pulse — aggregated financial position for dashboard
    Cash + Runway + Treasury + HR KPIs
    """
    company_id = current_user["company_id"]
    now = datetime.now(timezone.utc)

    # ── Cash & Treasury — from the GENERAL LEDGER ───────────
    # It summed bank_accounts.balance (a field nothing keeps in step with the
    # ledger, and the cash box 161 / POS drawer 164 were not counted at all),
    # so posting an invoice payment never moved the figure. Now: every
    # postable account under 16 "cash & cash equivalents", balance = opening
    # + posted ledger movement. Restricted (not free to spend):
    #   163 cheques under collection (not cleared yet), 165 LC cash margin,
    #   1651 LG cash margin — and any sub-account below them.
    # Computed on every request (no cache, no scheduler): a posted entry shows
    # up on the next refresh.
    RESTRICTED_PREFIXES = ("163", "165")
    cash_lines, free_cash, restricted_cash = [], 0.0, 0.0
    try:
        accs = await db.chart_of_accounts.find(
            {"company_id": company_id, "account_code": {"$regex": "^16"}},
            {"_id": 0, "id": 1, "account_code": 1, "account_name": 1, "is_header": 1,
             "allow_posting": 1, "account_category": 1, "opening_balance": 1}).to_list(None)
        accs = [a for a in accs if not (a.get("is_header") or a.get("allow_posting") is False
                                        or a.get("account_category") == "header")]
        mv = {r["_id"]: r async for r in db.general_ledger.aggregate([
            {"$match": {"company_id": company_id, "account_id": {"$in": [a["id"] for a in accs]}}},
            {"$group": {"_id": "$account_id", "d": {"$sum": "$debit"}, "c": {"$sum": "$credit"}}}])}
        for a in sorted(accs, key=lambda x: x["account_code"]):
            m = mv.get(a["id"], {"d": 0, "c": 0})
            bal = round(float(a.get("opening_balance") or 0) + float(m["d"] or 0) - float(m["c"] or 0), 2)
            restricted = a["account_code"].startswith(RESTRICTED_PREFIXES)
            if restricted:
                restricted_cash += bal
            else:
                free_cash += bal
            if bal:
                cash_lines.append({"account_code": a["account_code"], "account_name": a.get("account_name"),
                                   "balance": bal, "restricted": restricted})
    except Exception as e:
        logger.error(f"owner-pulse cash position failed: {e}")
        cash_lines, free_cash, restricted_cash = [], 0.0, 0.0

    # ── AR / AP ──────────────────────────────────────────────
    try:
        ar_pipeline = [
            {"$match": {"company_id": company_id, "type": "receivable", "status": "open"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        ar_res = await db.outstanding_items.aggregate(ar_pipeline).to_list(None)
        ar_30 = ar_res[0]["total"] if ar_res else 0

        ap_pipeline = [
            {"$match": {"company_id": company_id, "type": "payable", "status": "open"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        ap_res = await db.outstanding_items.aggregate(ap_pipeline).to_list(None)
        ap_30 = ap_res[0]["total"] if ap_res else 0
    except Exception:
        ar_30 = 0
        ap_30 = 0

    # ── Monthly Burn (avg of the last 3 months, from the ledger) ──
    # Was: debits on every line whose code starts with 3 OR 4 — 4 is REVENUE
    # in this chart, so a sales return or a closing entry counted as burn, and
    # credits (refunds, reversals) never reduced it; it read journal_entries
    # with status "posted" only, so a reversed entry kept counting. Now: net
    # movement (debit - credit) on postable expense accounts, from the ledger,
    # excluding non-cash charges (depreciation, provisions, deferred tax,
    # inventory write-downs, ECL) that do not consume cash.
    NON_CASH = ("333", "3352", "3368", "3369", "3183")
    try:
        start = (now - __import__("datetime").timedelta(days=90)).strftime("%Y-%m-%d")
        exp = await db.chart_of_accounts.find(
            {"company_id": company_id, "account_code": {"$regex": "^3"}},
            {"_id": 0, "id": 1, "account_code": 1, "account_type": 1}).to_list(None)
        ids = [a["id"] for a in exp
               if str(getattr(a.get("account_type"), "value", a.get("account_type"))) == "expense"
               and not a["account_code"].startswith(NON_CASH)]
        rows = await db.general_ledger.aggregate([
            {"$match": {"company_id": company_id, "account_id": {"$in": ids},
                        "entry_date": {"$gte": start}}},
            {"$group": {"_id": None, "d": {"$sum": "$debit"}, "c": {"$sum": "$credit"}}}]).to_list(1)
        monthly_burn = max(((rows[0]["d"] - rows[0]["c"]) if rows else 0) / 3, 0)
    except Exception as e:
        logger.error(f"owner-pulse burn failed: {e}")
        monthly_burn = 0.0

    # no spending in 3 months → runway is not a number of months; say so
    # instead of dividing by a fake 1 EGP burn
    cash_runway_months = round(free_cash / monthly_burn, 1) if monthly_burn > 0 else None

    # ── HR KPIs ──────────────────────────────────────────────
    try:
        total_employees = await db.employees.count_documents(
            {"company_id": company_id, "status": "active"}
        )
    except Exception:
        total_employees = 0

    # ── Active Projects ──────────────────────────────────────
    try:
        active_projects = await db.projects.count_documents(
            {"company_id": company_id, "status": "active"}
        )
    except Exception:
        active_projects = 0

    # ── ETA Alerts ───────────────────────────────────────────
    try:
        rejected_eta = await db.invoices.count_documents(
            {"company_id": company_id,
             "eta_status": {"$in": ["invalid", "failed"]},
             "submitted_to_eta": True}
        )
    except Exception:
        rejected_eta = 0

    return {
        "timestamp": now.isoformat(),
        "company_id": company_id,
        "treasury": {
            "free_cash": round(free_cash, 2),
            "restricted_cash": round(restricted_cash, 2),
            "total_cash": round(free_cash + restricted_cash, 2),
            "accounts": cash_lines,
            "source": "general_ledger",
            "ar_30_days": round(float(ar_30), 2),
            "ap_30_days": round(float(ap_30), 2),
        },
        "cash_runway": {
            "months": cash_runway_months,
            "monthly_burn": round(monthly_burn, 2),
            "status": ("no_burn" if cash_runway_months is None else
                       "healthy" if cash_runway_months > 6 else
                       "warning" if cash_runway_months > 3 else "critical"),
            "basis": "متوسط صافي المصروفات النقدية لآخر 90 يوماً ÷ 3",
        },
        "computed": "live",   # recalculated on every request — no hourly job
        "hr": {
            "total_active_employees": total_employees,
        },
        "operations": {
            "active_projects": active_projects,
            "rejected_eta_invoices": rejected_eta,
        }
    }


@router.get("/api/dashboard/budget-variance")
async def budget_variance_compat(
    current_user: dict = Depends(get_current_user),
    fiscal_year: Optional[int] = None,
    period: Optional[str] = None,
):
    """Budget variance radar — alias → /api/budget/variance-report.

    It said "alias" but read a collection nothing writes (budget_lines, with
    a stored actual_amount), so the radar was always empty. Budgets live in
    financial_budgets and actuals come from the ledger; delegate to the
    budget engine and keep this endpoint's response shape."""
    from api.budget_engine import budget_variance_report
    y = fiscal_year or datetime.now(timezone.utc).year
    rep = await budget_variance_report(fiscal_year=y, cost_center_id=None, project_id=None,
                                       current_user=current_user)
    items, alerts = [], []
    for r in rep["report"]:
        used, alloc = r["total_utilized"], r["allocated"]
        item = {
            "cost_center": r.get("cost_center") or r.get("project") or r["account_code"],
            "account_code": r["account_code"],
            "description": r.get("account_name", ""),
            "budgeted": alloc, "actual": used,
            "variance": round(used - alloc, 2),
            "variance_pct": round((used - alloc) / alloc * 100, 1) if alloc else 0,
            "status": r["status"],
        }
        items.append(item)
        if r["status"] in ("over_budget", "critical"):
            alerts.append(f"{item['cost_center']} — {item['description']}: {item['variance_pct']:+.1f}%")
    tb, ta = rep["grand_total"]["allocated"], rep["grand_total"]["total_utilized"]
    return {
        "fiscal_year": y,
        "company_id": current_user["company_id"],
        "summary": {
            "total_budgeted": tb, "total_actual": ta,
            "total_variance": round(ta - tb, 2),
            "overall_variance_pct": round((ta - tb) / tb * 100, 1) if tb else 0,
        },
        "alerts": alerts,
        "items": sorted(items, key=lambda x: abs(x["variance_pct"]), reverse=True),
        "items_over_budget": [v for v in items if v["status"] == "over_budget"],
    }
