"""
HR Engine — محرك الموارد البشرية المتكامل

يشمل:
1. محرك الإجازات والرصيد المستحق
2. حساب الأجر الإضافي
3. جدول الجزاءات والخصومات
4. مكافأة نهاية الخدمة
5. النماذج الحكومية (استمارات التأمينات 1، 2، 6)

Law note: this module was written against Labour Law 12/2003, which Labour
Law 14/2025 replaced. Its day counts, overtime factors, the 5-day monthly
penalty cap and the gratuity formula were hard-coded and quoted article
numbers as if current (the gratuity "resignation 1/3 – 2/3" factors are not
in either Egyptian law at all). They are now company policy settings
(GET/PUT /api/hr-engine/policy) whose defaults are the old values; the
screens say so instead of citing an article. Social insurance limits come
from services/egypt_payroll.py like everywhere else.
"""
import uuid
from datetime import datetime, timezone, date
from dateutil.relativedelta import relativedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query

from database import db
from models.accounting import JournalEntry
from services.accounting_service import AccountingService
from services.egypt_payroll import insurance_limits
from dependencies import get_current_user

router = APIRouter(prefix="/api/hr-engine", tags=["HR Engine"])

POLICY_NOTE = ("القيم حسب سياسة الشركة — الافتراضية مأخوذة من قانون العمل السابق 12/2003؛ "
               "راجعها على قانون العمل الجديد 14/2025 وعقود العمل")


# ══════════════════════════════════════════════════════════════
# POLICY — كل الأرقام القابلة للتغيير في مكان واحد
# ══════════════════════════════════════════════════════════════

DEFAULT_POLICY = {
    "annual_leave_days": 21,
    "annual_leave_days_senior": 30,
    "senior_service_years": 10,
    "senior_age": 50,
    "casual_leave_days_per_year": 6,
    "casual_leave_max_per_request": 2,
    "max_carryover_days": 21,
    "penalty_monthly_cap_days": 5,
    # مكافأة نهاية الخدمة — حسب لائحة الشركة / العقد
    "gratuity_enabled": True,
    "gratuity_months_first_5": 0.5,    # أجر شهر عن كل سنة من الخمس الأولى
    "gratuity_months_after_5": 1.0,    # أجر شهر عن كل سنة بعدها
    "resignation_factor_under_3": 0.0,
    "resignation_factor_3_to_5": 1 / 3,
    "resignation_factor_5_to_10": 2 / 3,
    "resignation_factor_10_plus": 1.0,
    # هل تخضع مكافأة نهاية الخدمة لضريبة كسب العمل؟ يقرره محاسب الشركة
    "eos_taxable": False,
    # ── الوقت الإضافي — معاملات أجر الساعة (قيم افتراضية قابلة للتعديل) ──
    # These defaults are what Law 12/2003 (art. 85) gave: +35% day, +70% night,
    # double pay for work on the weekly rest day or an official holiday. Law
    # 14/2025 replaced it; the company must confirm the multipliers against the
    # new law and its executive regulations (اللائحة التنفيذية) and its own
    # contracts before relying on them — nothing here asserts the new values.
    "overtime_day_rate": 1.35,
    "overtime_night_rate": 1.70,
    "overtime_rest_day_rate": 2.0,
    "overtime_holiday_rate": 2.0,
    # أجر الساعة على الأساسي (كما يصرف كشف الرواتب) أو الشامل (أساسي + بدلات ثابتة)
    "overtime_wage_base": "basic",
}
OT_TYPES = {"day": "نهاري", "night": "ليلي", "rest_day": "يوم الراحة الأسبوعية", "holiday": "عطلة رسمية"}
OT_POLICY_KEY = {"day": "overtime_day_rate", "night": "overtime_night_rate",
                 "rest_day": "overtime_rest_day_rate", "holiday": "overtime_holiday_rate"}
# payroll (api/payroll.py attendance_summary_from_records) pays overtime from
# db.company_hr_settings with these keys; the policy writes them there too so
# the calculator and the payroll sheet use one set of numbers. Payroll has no
# rest-day bucket — see effective_overtime().
OT_PAYROLL_KEY = {"day": "overtime_rate", "night": "overtime_night_rate", "holiday": "overtime_holiday_rate"}
OT_WAGE_BASES = ("basic", "total")
OT_NOTE = ("معاملات الوقت الإضافي قيم افتراضية قابلة للتعديل مأخوذة من القانون السابق 12/2003 "
           "(35% نهاري، 70% ليلي، الضعف في يوم الراحة والعطلات الرسمية) — على الشركة مراجعتها على "
           "قانون العمل 14/2025 ولائحته التنفيذية")


async def get_policy(company_id: str) -> dict:
    saved = await db.hr_policy_settings.find_one({"company_id": company_id}, {"_id": 0}) or {}
    return {**DEFAULT_POLICY, **{k: saved[k] for k in DEFAULT_POLICY if k in saved}}


async def effective_overtime(company_id: str, policy: dict = None) -> dict:
    """The overtime numbers that are actually paid. Day/night/holiday come
    from the payroll HR settings when the company has them (that is what the
    payroll sheet multiplies by — they can also be edited on the payroll
    settings screen), otherwise from the HR policy. The rest-day rate exists
    only in the policy."""
    policy = policy or await get_policy(company_id)
    hr = await db.company_hr_settings.find_one({"company_id": company_id}, {"_id": 0}) or {}
    rates, source = {}, {}
    for t, pk in OT_POLICY_KEY.items():
        hk = OT_PAYROLL_KEY.get(t)
        if hk and _num(hr.get(hk)) > 0:
            rates[t], source[t] = _num(hr[hk]), "payroll_hr_settings"
        else:
            rates[t], source[t] = _num(policy.get(pk)) or DEFAULT_POLICY[pk], "hr_policy"
    base = policy.get("overtime_wage_base") if policy.get("overtime_wage_base") in OT_WAGE_BASES else "basic"
    return {"rates": rates, "rate_source": source, "wage_base": base,
            # same divisors payroll uses (standard days per month × hours per day)
            "days_per_month": _num(hr.get("standard_working_days_per_month")) or 22.0,
            "hours_per_day": _num(hr.get("standard_working_hours_per_day")) or 8.0,
            "payroll_settings_saved": bool(hr),
            "enabled_in_payroll": hr.get("overtime_enabled", True) is not False}


def _num(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def monthly_wage(emp: dict) -> float:
    """Basic + fixed allowances. employees store allowances as a LIST of
    {amount | percentage, is_active}; float(emp["allowances"]) raised
    TypeError, so gratuity, overtime, encashment and form 6 all returned 500
    for any employee entered through the employees screen."""
    basic = _num(emp.get("basic_salary"))
    allow = emp.get("allowances", 0)
    if isinstance(allow, list):
        total = 0.0
        for a in allow:
            if not isinstance(a, dict) or not a.get("is_active", True):
                continue
            total += basic * _num(a.get("percentage")) / 100 if a.get("is_percentage") else _num(a.get("amount"))
        allow = total
    return round(basic + _num(allow), 2)


def active_employees_query(company_id: str) -> dict:
    # employees carry is_active (employees screen) or status (older imports);
    # the old {"status": "active"} filter matched none of the former
    return {"company_id": company_id, "is_active": {"$ne": False},
            "status": {"$nin": ["terminated", "inactive"]}}


def calc_service_years(hire_date: str, to_date: str = None) -> float:
    """احتساب سنوات الخدمة الكسرية"""
    try:
        hd = date.fromisoformat(str(hire_date)[:10])
        td = date.fromisoformat(str(to_date)[:10]) if to_date else date.today()
        diff = relativedelta(td, hd)
        return round(diff.years + diff.months / 12 + diff.days / 365, 4)
    except Exception:
        return 0.0


def _age(emp: dict) -> int:
    try:
        return relativedelta(date.today(), date.fromisoformat(str(emp.get("date_of_birth"))[:10])).years
    except Exception:
        return 0


def annual_leave_entitlement(service_years: float, age: int = 0, policy: dict = None) -> int:
    p = policy or DEFAULT_POLICY
    if service_years >= p["senior_service_years"] or (age and age >= p["senior_age"]):
        return int(p["annual_leave_days_senior"])
    return int(p["annual_leave_days"])


async def leave_days_taken(company_id: str, employee_id: str, year: int, leave_type: str) -> float:
    """Approved days in a year. Leaves are approved in db.leaves (the HR
    leave screens and approvals); this module read only db.leave_requests,
    which nothing ever approves, so every balance showed zero days taken."""
    q = {"employee_id": employee_id, "company_id": company_id, "status": "approved",
         "leave_type": leave_type, "start_date": {"$gte": f"{year}-01-01", "$lte": f"{year}-12-31"}}
    total = 0.0
    for coll in (db.leaves, db.leave_requests):
        async for l in coll.find(q, {"_id": 0, "days": 1}):
            total += _num(l.get("days"))
    return total


def gratuity_amount(policy: dict, monthly: float, service_yrs: float, reason: str) -> dict:
    """One formula for the calculator, form 6 and the clearance (they were
    three copies, and the preview ignored the resignation factor)."""
    if not policy.get("gratuity_enabled", True) or service_yrs < 1:
        return {"first_5_years": 0.0, "after_5_years": 0.0, "before_adjustment": 0.0,
                "factor": 0.0, "total": 0.0,
                "note": "لا تستحق مكافأة (الخدمة أقل من سنة أو المكافأة غير مفعّلة في السياسة)"}
    first5, after5 = min(service_yrs, 5), max(service_yrs - 5, 0)
    g1 = round(first5 * monthly * _num(policy["gratuity_months_first_5"]), 2)
    g2 = round(after5 * monthly * _num(policy["gratuity_months_after_5"]), 2)
    factor, note = 1.0, "إنهاء خدمة / تقاعد — المكافأة كاملة"
    if reason == "resignation":
        if service_yrs < 3:
            factor, note = _num(policy["resignation_factor_under_3"]), "استقالة قبل 3 سنوات"
        elif service_yrs < 5:
            factor, note = _num(policy["resignation_factor_3_to_5"]), "استقالة بين 3 و5 سنوات"
        elif service_yrs < 10:
            factor, note = _num(policy["resignation_factor_5_to_10"]), "استقالة بين 5 و10 سنوات"
        else:
            factor, note = _num(policy["resignation_factor_10_plus"]), "استقالة بعد 10 سنوات"
    return {"first_5_years": g1, "after_5_years": g2, "before_adjustment": round(g1 + g2, 2),
            "factor": round(factor, 4), "total": round((g1 + g2) * factor, 2), "note": note}


async def get_employee(company_id: str, employee_id: str) -> dict:
    emp = await db.employees.find_one(
        {"id": employee_id, "company_id": company_id}, {"_id": 0}
    )
    if not emp:
        raise HTTPException(404, "الموظف غير موجود")
    return emp


async def je_line(company_id: str, code: str, debit=0.0, credit=0.0, desc="") -> dict:
    """A missing account used to become {"id": code} — a line pointing at an
    account that does not exist, so the amount reached no ledger account."""
    acc = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0})
    if not acc:
        raise HTTPException(400, f"الحساب {code} غير موجود في دليل الحسابات — أضفه أولاً")
    if acc.get("is_header") or acc.get("allow_posting") is False:
        raise HTTPException(400, f"الحساب {code} حساب تجميعي لا يقبل قيوداً")
    return {
        "line_id": str(uuid.uuid4()), "entry_id": None,
        "account_id": acc["id"], "account_code": acc["account_code"],
        "account_name": acc.get("account_name", f"حساب {code}"),
        "debit": round(_num(debit), 2), "credit": round(_num(credit), 2), "description": desc,
    }


async def _post_entry(company_id: str, user_id: str, date_str: str, description: str,
                     lines: list, src_id: str = None, src_type: str = "manual") -> str:
    svc = AccountingService(db)
    entry = JournalEntry(company_id=company_id, entry_number=0, entry_date=date_str,
                         description=description, lines=lines, source_document_type=src_type,
                         source_document_id=src_id, created_by=user_id)
    try:
        result = await svc.create_journal_entry(entry)
        await svc.post_journal_entry(result["id"], user_id)
    except ValueError as e:      # unbalanced / header account → was a bare 500
        raise HTTPException(400, str(e))
    return result["id"]


def _iso(d: str, label: str) -> date:
    try:
        return date.fromisoformat(str(d)[:10])
    except Exception:
        raise HTTPException(400, f"{label} غير صحيح — استخدم الصيغة YYYY-MM-DD")


# ══════════════════════════════════════════════════════════════
# 0. POLICY ENDPOINTS
# ══════════════════════════════════════════════════════════════

POLICY_ROLES = {"HR Manager", "مدير الموارد البشرية", "General Manager", "مدير عام", "المدير العام",
                "CEO", "المدير التنفيذي", "Board Chairman", "رئيس مجلس الإدارة", "Super Admin", "admin", "owner"}


@router.get("/policy")
async def read_policy(current_user: dict = Depends(get_current_user)):
    policy = await get_policy(current_user["company_id"])
    ot = await effective_overtime(current_user["company_id"], policy)
    # show the overtime multipliers payroll actually uses
    shown = {**policy, **{OT_POLICY_KEY[t]: r for t, r in ot["rates"].items()}}
    return {"policy": shown, "defaults": DEFAULT_POLICY, "note": POLICY_NOTE,
            "overtime": ot, "overtime_note": OT_NOTE}


@router.put("/policy")
async def update_policy(data: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in POLICY_ROLES:
        raise HTTPException(403, "سياسة الموارد البشرية يضبطها مدير الموارد البشرية أو الإدارة العليا")
    upd = {}
    for k, default in DEFAULT_POLICY.items():
        if k not in data:
            continue
        if isinstance(default, bool):
            upd[k] = bool(data[k])
            continue
        if k == "overtime_wage_base":
            if data[k] not in OT_WAGE_BASES:
                raise HTTPException(400, "أساس أجر الساعة: basic (الأساسي) أو total (الشامل)")
            upd[k] = data[k]
            continue
        v = _num(data[k])
        if v < 0 or (k.startswith("resignation_factor") and v > 1):
            raise HTTPException(400, f"قيمة غير صحيحة للحقل {k}")
        # a multiplier is the whole hour's pay: below 1 would pay overtime
        # less than a normal hour
        if k in OT_POLICY_KEY.values() and not 1 <= v <= 5:
            raise HTTPException(400, f"معامل الوقت الإضافي {k} يكون بين 1 و5 (مثلاً 1.35 = الأجر + 35%)")
        upd[k] = v
    if not upd:
        raise HTTPException(400, "لا توجد قيم للتحديث")
    company_id = current_user["company_id"]
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    upd["updated_by"] = current_user["user_id"]
    await db.hr_policy_settings.update_one(
        {"company_id": company_id},
        {"$set": upd, "$setOnInsert": {"company_id": company_id}}, upsert=True)
    # the payroll sheet pays from company_hr_settings — keep it on the same numbers
    sync = {OT_PAYROLL_KEY[t]: upd[pk] for t, pk in OT_POLICY_KEY.items() if t in OT_PAYROLL_KEY and pk in upd}
    if sync:
        await db.company_hr_settings.update_one(
            {"company_id": company_id},
            {"$set": {**sync, "updated_at": upd["updated_at"]}, "$setOnInsert": {"company_id": company_id}},
            upsert=True)
    return {"message": "تم حفظ سياسة الموارد البشرية", "policy": (await read_policy(current_user))["policy"],
            "synced_to_payroll": sorted(sync)}


# ══════════════════════════════════════════════════════════════
# 1. LEAVE ENGINE — محرك الإجازات
# ══════════════════════════════════════════════════════════════

@router.get("/leave/balance/{employee_id}")
async def get_leave_balance(employee_id: str,
                            current_user: dict = Depends(get_current_user)):
    """رصيد الإجازات الكامل مع الاستحقاق حسب السياسة"""
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, employee_id)
    policy = await get_policy(company_id)
    year = date.today().year

    service_yrs = calc_service_years(emp.get("hire_date", ""), None)
    age = _age(emp)
    entitlement = annual_leave_entitlement(service_yrs, age, policy)

    annual_taken = await leave_days_taken(company_id, employee_id, year, "annual")
    casual_taken = await leave_days_taken(company_id, employee_id, year, "casual")
    sick_taken = await leave_days_taken(company_id, employee_id, year, "sick")

    prev_bal_rec = await db.leave_balances.find_one(
        {"employee_id": employee_id, "company_id": company_id, "year": year}, {"_id": 0})
    carried_over = _num(prev_bal_rec.get("carried_over")) if prev_bal_rec else 0

    casual_max = int(policy["casual_leave_days_per_year"])
    return {
        "employee_id":   employee_id,
        "employee_name": emp.get("name", ""),
        "service_years": round(service_yrs, 1),
        "age":           age,
        "annual_leave": {
            "entitlement":    entitlement,
            "carried_over":   carried_over,
            "taken":          annual_taken,
            "balance":        entitlement + carried_over - annual_taken,
            "reason_30_days": entitlement == int(policy["annual_leave_days_senior"]),
        },
        "casual_leave": {
            "max_per_year": casual_max,
            "taken":        casual_taken,
            "balance":      max(casual_max - casual_taken, 0),
            "note":         f"لا تتجاوز {int(policy['casual_leave_max_per_request'])} يوم في المرة",
        },
        "sick_leave": {"taken": sick_taken},
        "year": year,
        "policy_note": POLICY_NOTE,
    }


@router.post("/leave/request")
async def create_leave_request(data: dict,
                               current_user: dict = Depends(get_current_user)):
    """
    طلب إجازة مع التحقق من السياسة:
    - إجازة عارضة: حد أقصى للمرة والسنة
    - إجازة سنوية: لا يتجاوز الرصيد المتاح
    """
    company_id  = current_user["company_id"]
    emp_id      = data.get("employee_id")
    leave_type  = data.get("leave_type", "annual")
    start       = data.get("start_date")
    end         = data.get("end_date")

    if not all([emp_id, start, end]):
        raise HTTPException(400, "اختر الموظف وتاريخ البداية والنهاية")
    if leave_type not in ("annual", "casual", "sick", "unpaid"):
        raise HTTPException(400, "نوع الإجازة غير معروف")
    # the employee was only checked for annual leave; a casual/sick request
    # could be filed against another company's employee id
    emp = await get_employee(company_id, emp_id)
    policy = await get_policy(company_id)

    sd = _iso(start, "تاريخ البداية"); ed = _iso(end, "تاريخ النهاية")
    days = (ed - sd).days + 1
    if days <= 0:
        raise HTTPException(400, "تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء")

    if leave_type == "casual":
        per_req = int(policy["casual_leave_max_per_request"])
        per_year = int(policy["casual_leave_days_per_year"])
        if days > per_req:
            raise HTTPException(400, f"الإجازة العارضة لا تتجاوز {per_req} يوم في المرة الواحدة (طلبت {days})")
        taken = await leave_days_taken(company_id, emp_id, sd.year, "casual")
        if taken + days > per_year:
            raise HTTPException(400, f"تجاوز الحد السنوي للإجازات العارضة ({per_year} أيام). مستهلك: {taken:g}، طلب: {days}")

    if leave_type == "annual":
        bal = await get_leave_balance(emp_id, current_user)
        if days > bal["annual_leave"]["balance"]:
            raise HTTPException(400,
                f"الرصيد غير كافٍ. متاح: {bal['annual_leave']['balance']:g} يوم، طلب: {days} يوم")

    # Saved in db.leaves (the collection the leave screens list and approve);
    # requests saved in db.leave_requests could never be approved.
    request = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "employee_id": emp_id, "employee_name": emp.get("name", ""),
        "leave_type": leave_type,
        "start_date": sd.isoformat(), "end_date": ed.isoformat(), "days": days,
        "reason": str(data.get("reason", "") or "")[:500],
        "status": "pending",
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.leaves.insert_one(request); request.pop("_id", None)

    return {"message": f"تم تقديم طلب الإجازة — {days} يوم (بانتظار الاعتماد)", "request": request}


@router.post("/leave/carryover")
async def run_annual_leave_carryover(
    data: dict, current_user: dict = Depends(get_current_user)
):
    """ترحيل رصيد الإجازات في نهاية السنة (يمكن إعادة تشغيله — يستبدل نفس السنة)"""
    company_id = current_user["company_id"]
    policy = await get_policy(company_id)
    from_year  = int(data.get("year", date.today().year))
    max_carry  = int(data.get("max_carryover_days", policy["max_carryover_days"]))

    employees = await db.employees.find(active_employees_query(company_id), {"_id": 0}).to_list(None)

    results = []
    for emp in employees:
        entitlement = annual_leave_entitlement(
            calc_service_years(emp.get("hire_date", ""), f"{from_year}-12-31"), _age(emp), policy)
        taken = await leave_days_taken(company_id, emp["id"], from_year, "annual")
        prev = await db.leave_balances.find_one(
            {"employee_id": emp["id"], "company_id": company_id, "year": from_year}, {"_id": 0})
        prev_carry = _num(prev.get("carried_over")) if prev else 0
        balance    = entitlement + prev_carry - taken
        carry_next = min(max(balance, 0), max_carry)

        await db.leave_balances.replace_one(
            {"employee_id": emp["id"], "company_id": company_id, "year": from_year + 1},
            {"employee_id": emp["id"], "company_id": company_id,
             "year": from_year + 1, "carried_over": carry_next,
             "entitlement": entitlement, "as_of": datetime.now(timezone.utc).isoformat()},
            upsert=True
        )
        results.append({
            "employee_id": emp["id"], "name": emp.get("name", ""),
            "entitlement": entitlement, "taken": taken, "balance": balance,
            "carried_to_next_year": carry_next,
        })

    return {
        "message": f"تم ترحيل رصيد الإجازات من {from_year} إلى {from_year+1}",
        "employees_processed": len(results),
        "details": results,
    }


@router.get("/leave/encashment/{employee_id}")
async def calc_leave_encashment(
    employee_id: str,
    termination_date: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """المقابل النقدي لرصيد الإجازات عند إنهاء الخدمة — على أساس آخر أجر"""
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, employee_id)
    _iso(termination_date, "تاريخ إنهاء الخدمة")

    balance_data = await get_leave_balance(employee_id, current_user)
    leave_balance = max(balance_data["annual_leave"]["balance"], 0)

    monthly_salary = monthly_wage(emp)
    daily_rate     = round(monthly_salary / 30, 2)
    encashment     = round(leave_balance * daily_rate, 2)

    return {
        "employee_id":      employee_id,
        "employee_name":    emp.get("name", ""),
        "termination_date": termination_date,
        "leave_balance_days": leave_balance,
        "daily_rate":       daily_rate,
        "encashment_amount": encashment,
        "policy_note":      POLICY_NOTE,
        # the hint named 112 (buildings) and 220 (not in the chart)
        "journal_hint":     {
            "debit":  "331 رواتب وأجور (مقابل الإجازات مصروف لم يُستحق من قبل)",
            "credit": "162 البنك / 161 الخزينة",
        }
    }


# ══════════════════════════════════════════════════════════════
# 2. OVERTIME ENGINE — محرك الوقت الإضافي
# ══════════════════════════════════════════════════════════════

@router.post("/overtime/calculate")
async def calculate_overtime(data: dict,
                             current_user: dict = Depends(get_current_user)):
    """
    احتساب الأجر الإضافي من سياسة الشركة (نهاري / ليلي / يوم الراحة / عطلة رسمية)
    وبنفس قاسم أجر الساعة الذي يستخدمه كشف الرواتب:
        أجر الساعة = (الأساسي أو الشامل حسب السياسة) ÷ (أيام العمل في الشهر × ساعات اليوم)
        أجر الساعات = الساعات × أجر الساعة × المعامل
    """
    company_id  = current_user["company_id"]
    emp = await get_employee(company_id, data.get("employee_id"))
    ot = await effective_overtime(company_id)
    rates = ot["rates"]

    base_wage = monthly_wage(emp) if ot["wage_base"] == "total" else round(_num(emp.get("basic_salary")), 2)
    divisor = ot["days_per_month"] * ot["hours_per_day"]
    hourly_rate = round(base_wage / divisor, 4) if divisor else 0.0

    entries = data.get("entries", []) or []
    if not entries:
        raise HTTPException(400, "أدخل يوماً واحداً على الأقل")
    results = []
    by_type = {t: {"label": OT_TYPES[t], "hours": 0.0, "multiplier": rates[t], "amount": 0.0} for t in OT_TYPES}
    total_pay = 0.0
    for entry in entries:
        hours = _num(entry.get("hours"))
        if hours <= 0 or hours > 24:
            raise HTTPException(400, "عدد الساعات في اليوم يجب أن يكون بين 0 و24")
        ot_type = entry.get("type", "day")
        if ot_type not in rates:
            raise HTTPException(400, "نوع الوقت الإضافي: نهاري أو ليلي أو يوم الراحة أو عطلة رسمية")
        multiplier = rates[ot_type]
        ot_pay = round(hours * hourly_rate * multiplier, 2)
        total_pay += ot_pay
        by_type[ot_type]["hours"] += hours
        by_type[ot_type]["amount"] = round(by_type[ot_type]["amount"] + ot_pay, 2)
        results.append({
            "date": entry.get("date"), "hours": hours, "type": ot_type, "type_label": OT_TYPES[ot_type],
            "multiplier": multiplier, "hourly_base": hourly_rate, "ot_pay": ot_pay,
            "premium": round(hours * hourly_rate * (multiplier - 1), 2),
        })

    warnings = []
    if not ot["payroll_settings_saved"]:
        warnings.append("لم تُحفظ إعدادات الموارد البشرية للرواتب بعد — احفظ معاملات الوقت الإضافي من السياسة "
                        "حتى يصرف كشف الرواتب بنفس القيم")
    if ot["wage_base"] == "total":
        warnings.append("كشف الرواتب يحسب أجر الساعة على الراتب الأساسي فقط — المبلغ هنا (على الشامل) سيختلف عن المصروف")
    if by_type["rest_day"]["hours"]:
        warnings.append("كشف الرواتب لا يفرّق ساعات يوم الراحة — تُسجَّل في الحضور كساعات عطلة (holiday_overtime) "
                        "وتُصرف بمعامل العطلة")
    if not ot["enabled_in_payroll"]:
        warnings.append("الوقت الإضافي معطّل في إعدادات الموارد البشرية للرواتب — لن يُصرف في الكشف")

    return {
        "employee_id":    emp["id"],
        "employee_name":  emp.get("name", ""),
        "wage_base":      ot["wage_base"],
        "base_wage":      base_wage,
        "days_per_month": ot["days_per_month"],
        "hours_per_day":  ot["hours_per_day"],
        "hourly_rate":    hourly_rate,
        "formula":        f"{base_wage:,.2f} ÷ ({ot['days_per_month']:g} يوم × {ot['hours_per_day']:g} ساعة) = {hourly_rate:,.4f} للساعة",
        "total_ot_pay":   round(total_pay, 2),
        "ot_breakdown":   results,
        "by_type":        by_type,
        "rates":          rates,
        "rate_source":    ot["rate_source"],
        "rates_source":   "إعدادات الموارد البشرية للرواتب" if ot["payroll_settings_saved"] else "سياسة الشركة (قيم افتراضية)",
        "warnings":       warnings,
        "note":           OT_NOTE,
    }


# ══════════════════════════════════════════════════════════════
# 3. PENALTY SCHEDULE — جدول الجزاءات والخصومات
# ══════════════════════════════════════════════════════════════

DEFAULT_PENALTY_SCHEDULE = [
    {"violation": "تأخر عن العمل (المرة الأولى)",  "deduct_hours": 1,  "level": 1},
    {"violation": "تأخر عن العمل (المرة الثانية)", "deduct_hours": 2,  "level": 2},
    {"violation": "تأخر عن العمل (المرة الثالثة)", "deduct_hours": 4,  "level": 3},
    {"violation": "غياب بدون إذن (يوم واحد)",      "deduct_days":  2,  "level": 2},
    {"violation": "غياب بدون إذن (يومان متتاليان)", "deduct_days":  4,  "level": 3},
    {"violation": "غياب بدون إذن (3+ أيام)",        "deduct_days":  6,  "level": 4},
    {"violation": "مخالفة تعليمات السلامة",         "deduct_days":  1,  "level": 2},
    {"violation": "إهمال في العمل",                "deduct_days":  2,  "level": 2},
    {"violation": "سوء السلوك (مرة أولى)",         "deduct_days":  3,  "level": 3},
    {"violation": "سوء السلوك (مرة ثانية)",        "deduct_days":  6,  "level": 4},
]


@router.get("/penalties/schedule")
async def get_penalty_schedule(current_user: dict = Depends(get_current_user)):
    """جدول الجزاءات (لائحة الشركة)"""
    company_id = current_user["company_id"]
    custom = await db.penalty_schedules.find_one({"company_id": company_id}, {"_id": 0})
    schedule = custom.get("penalties", DEFAULT_PENALTY_SCHEDULE) if custom else DEFAULT_PENALTY_SCHEDULE
    policy = await get_policy(company_id)
    return {
        "schedule": schedule,
        "note": "يُطبَّق التدرج في الجزاءات عند تكرار المخالفة — حسب لائحة الجزاءات المعتمدة للمنشأة",
        "max_deduction": f"لا يزيد مجموع الخصم في الشهر عن {policy['penalty_monthly_cap_days']:g} أيام من الأجر (سياسة قابلة للتعديل)",
    }


@router.get("/penalties")
async def list_penalties(employee_id: Optional[str] = None, month: Optional[str] = None,
                         current_user: dict = Depends(get_current_user)):
    q = {"company_id": current_user["company_id"]}
    if employee_id: q["employee_id"] = employee_id
    if month: q["date"] = {"$gte": f"{month}-01", "$lte": f"{month}-31"}
    rows = await db.penalties.find(q, {"_id": 0}).sort("date", -1).to_list(500)
    return {"penalties": rows, "total": len(rows),
            "total_amount": round(sum(_num(r.get("amount")) for r in rows), 2)}


@router.post("/penalties/apply")
async def apply_penalty(data: dict, current_user: dict = Depends(get_current_user)):
    """تسجيل جزاء على موظف مع احتساب الخصم (يُخصم في كشف الرواتب)"""
    company_id  = current_user["company_id"]
    emp = await get_employee(company_id, data.get("employee_id"))
    policy = await get_policy(company_id)

    violation    = str(data.get("violation", "") or "").strip()[:300]
    deduct_days  = _num(data.get("deduct_days"))
    deduct_hours = _num(data.get("deduct_hours"))
    apply_date   = _iso(data.get("date") or date.today().isoformat(), "التاريخ").isoformat()
    if not violation:
        raise HTTPException(400, "اكتب المخالفة")
    if deduct_days < 0 or deduct_hours < 0 or (deduct_days == 0 and deduct_hours == 0):
        raise HTTPException(400, "حدد أيام أو ساعات الخصم")

    monthly = _num(emp.get("basic_salary"))
    daily   = monthly / 30
    hourly  = daily / 8
    amount  = round((deduct_days * daily) + (deduct_hours * hourly), 2)

    # The cap was applied to each penalty on its own, so three penalties in a
    # month could deduct 15 days. It is the month's total that is capped.
    month = apply_date[:7]
    already = 0.0
    async for p in db.penalties.find({"company_id": company_id, "employee_id": emp["id"],
                                      "date": {"$gte": f"{month}-01", "$lte": f"{month}-31"},
                                      "status": {"$ne": "cancelled"}}, {"_id": 0, "amount": 1}):
        already += _num(p.get("amount"))
    max_monthly = round(daily * _num(policy["penalty_monthly_cap_days"]), 2)
    room = max(round(max_monthly - already, 2), 0)
    capped = amount > room
    amount = min(amount, room)
    if amount <= 0:
        raise HTTPException(400, f"بلغ الموظف الحد الأقصى للخصم هذا الشهر ({max_monthly:,.2f} ج.م)")

    record = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "employee_id": emp["id"], "employee_name": emp.get("name", ""),
        "violation": violation, "deduct_days": deduct_days,
        "deduct_hours": deduct_hours, "amount": amount,
        "date": apply_date, "status": "pending",
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.penalties.insert_one(record); record.pop("_id", None)

    return {
        "message": f"تم تسجيل الجزاء — خصم {amount:,.2f} ج.م" + (" (بعد تطبيق الحد الشهري)" if capped else ""),
        "penalty": record,
        "monthly_cap_note": f"الحد الأقصى للخصم في الشهر: {max_monthly:,.2f} ج.م — المستخدم قبل هذا الجزاء {already:,.2f}",
    }


# ══════════════════════════════════════════════════════════════
# 4. END OF SERVICE GRATUITY — مكافأة نهاية الخدمة
# ══════════════════════════════════════════════════════════════

TERMINATION_REASONS = {
    "resignation": "استقالة",
    "retirement":  "بلوغ سن التقاعد",
    "dismissal":   "إنهاء العقد من صاحب العمل",
    "death":       "وفاة",
    "disability":  "عجز كلي",
}


@router.get("/gratuity/calculate/{employee_id}")
async def calculate_gratuity(
    employee_id: str,
    termination_date: str = Query(..., description="تاريخ إنهاء الخدمة"),
    termination_reason: str = Query("retirement"),
    current_user: dict = Depends(get_current_user)
):
    """مكافأة نهاية الخدمة حسب سياسة الشركة (قابلة للتعديل)"""
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, employee_id)
    _iso(termination_date, "تاريخ إنهاء الخدمة")
    policy = await get_policy(company_id)

    service_yrs = calc_service_years(emp.get("hire_date", ""), termination_date)
    monthly = monthly_wage(emp)
    g = gratuity_amount(policy, monthly, service_yrs, termination_reason)

    return {
        "employee_id":      employee_id,
        "employee_name":    emp.get("name", ""),
        "hire_date":        emp.get("hire_date", ""),
        "termination_date": termination_date,
        "service_years":    round(service_yrs, 2),
        "termination_reason": termination_reason,
        "last_monthly_salary": monthly,
        "gratuity_calculation": {
            "first_5_years":  {"years": round(min(service_yrs, 5), 2), "amount": g["first_5_years"],
                               "months_per_year": policy["gratuity_months_first_5"]},
            "after_5_years":  {"years": round(max(service_yrs - 5, 0), 2), "amount": g["after_5_years"],
                               "months_per_year": policy["gratuity_months_after_5"]},
            "total_before_adj": g["before_adjustment"],
            "factor":         g["factor"],
            "total_payable":  g["total"],
        },
        "gratuity": g["total"],
        "note":          g["note"],
        "policy_note":   POLICY_NOTE,
    }


@router.post("/gratuity/post/{employee_id}")
async def post_gratuity_journal(
    employee_id: str, data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    قيد صرف مكافأة نهاية الخدمة:
    مدين: 223 مخصص مكافأة نهاية الخدمة (أو 331 رواتب وأجور إن لم يُكوَّن مخصص)
    دائن: 162 البنك / 161 الخزينة
    """
    company_id = current_user["company_id"]
    amount     = round(_num(data.get("amount")), 2)
    pay_date   = _iso(data.get("date") or date.today().isoformat(), "التاريخ").isoformat()
    # a zero amount used to reach the service and fail as a 500
    if amount <= 0:
        raise HTTPException(400, "المبلغ يجب أن يكون أكبر من صفر")
    debit_code = str(data.get("debit_account") or "223")
    credit_code = str(data.get("payment_account") or "162")
    if debit_code not in ("223", "331"):
        raise HTTPException(400, "حساب المدين: 223 مخصص المكافأة أو 331 رواتب وأجور")
    if credit_code not in ("161", "162"):
        raise HTTPException(400, "حساب الصرف: 161 الخزينة أو 162 البنك")
    emp = await get_employee(company_id, employee_id)

    # nothing stopped the same gratuity being posted again on a second click
    if await db.gratuity_payments.find_one({"company_id": company_id, "employee_id": employee_id}):
        raise HTTPException(400, "تم صرف مكافأة نهاية الخدمة لهذا الموظف من قبل")

    lines = [
        await je_line(company_id, debit_code, debit=amount,
                      desc=f"مكافأة نهاية خدمة — {emp.get('name','')}"),
        await je_line(company_id, credit_code, credit=amount,
                      desc=f"صرف مكافأة نهاية خدمة — {emp.get('name','')}"),
    ]
    je_id = await _post_entry(company_id, current_user["user_id"], pay_date,
                             f"مكافأة نهاية خدمة — {emp.get('name','')}", lines, employee_id)
    await db.gratuity_payments.insert_one({
        "id": str(uuid.uuid4()), "company_id": company_id, "employee_id": employee_id,
        "employee_name": emp.get("name", ""), "amount": amount, "date": pay_date,
        "journal_entry_id": je_id, "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()})

    return {
        "message": f"تم إثبات وصرف مكافأة نهاية الخدمة — {amount:,.2f} ج.م",
        "journal_entry_id": je_id,
        "journal": {"lines": [{k: l[k] for k in ("account_code", "account_name", "debit", "credit")} for l in lines]},
    }


# ══════════════════════════════════════════════════════════════
# 5. GOVERNMENT FORMS — النماذج الحكومية
# ══════════════════════════════════════════════════════════════

@router.get("/forms/form-1/{employee_id}")
async def generate_form_1(employee_id: str,
                          current_user: dict = Depends(get_current_user)):
    """استمارة (1) تأمينات — التحاق عامل جديد"""
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, employee_id)
    company = await db.companies.find_one({"id": company_id}, {"_id": 0}) or {}
    profile = await db.employee_insurance_profiles.find_one(
        {"employee_id": employee_id, "company_id": company_id}, {"_id": 0}) or {}
    # the payroll's insurance wage rule (insured_basic_salary → insured_salary
    # → basic, within the limits); this read insured_basic_salary only
    from api.insurance_forms import insurance_wage
    wage = await insurance_wage(company_id, emp, profile)

    return {
        "form_name":        "استمارة رقم (1) — إخطار التحاق عامل",
        "full_form":        f"/api/insurance-forms/form1/{employee_id}",
        "law_reference":    "قانون التأمينات الاجتماعية 148/2019",
        "submission_note":  "تُقدَّم للهيئة خلال المدة المقررة من تاريخ الالتحاق",
        "employer_data": {
            "company_name":      company.get("name", ""),
            "company_name_en":   company.get("name_en", ""),
            "tax_number":        company.get("tax_id", ""),
            "insurance_number":  company.get("insurance_registration_number", ""),
            "address":           company.get("address", ""),
            "activity":          company.get("activity", ""),
        },
        "employee_data": {
            "name":             emp.get("name", ""),
            "name_en":          emp.get("name_en", ""),
            "national_id":      emp.get("national_id") or profile.get("national_id", ""),
            "date_of_birth":    emp.get("date_of_birth", ""),
            "gender":           emp.get("gender", ""),
            "nationality":      emp.get("nationality", "Egyptian"),
            "marital_status":   emp.get("marital_status", ""),
            "hire_date":        emp.get("hire_date", ""),
            "job_title":        emp.get("position") or emp.get("job_title", ""),
            "department":       emp.get("department", ""),
            "insured_salary":   wage["insurable_wage"],
            "declared_insured_salary": wage["declared_wage"],
            "variable_salary":  profile.get("insured_variable_salary", 0),
            "insurance_number": profile.get("insurance_number", ""),
            "bank_iban":        profile.get("bank_account_iban", ""),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/forms/form-2")
async def generate_form_2(
    year: int = Query(None, description="السنة — يناير من السنة التالية"),
    current_user: dict = Depends(get_current_user)
):
    """استمارة (2) تأمينات — إقرار الأجور السنوي"""
    company_id = current_user["company_id"]
    if not year:
        year = date.today().year - 1
    company = await db.companies.find_one({"id": company_id}, {"_id": 0}) or {}
    settings = await db.payroll_settings.find_one({"company_id": company_id}, {"_id": 0}) or {}
    lo, hi = insurance_limits(settings)

    employees = await db.employees.find(active_employees_query(company_id), {"_id": 0}).to_list(None)

    employee_wages = []
    total_insured = 0.0
    for emp in employees:
        profile = await db.employee_insurance_profiles.find_one(
            {"employee_id": emp["id"], "company_id": company_id}, {"_id": 0}) or {}
        insured_salary  = _num(profile.get("insured_basic_salary", emp.get("basic_salary", 0)))
        variable_salary = _num(profile.get("insured_variable_salary", 0))
        # the insurable wage is held between the year's minimum and maximum
        # (services/egypt_payroll); the form declared any salary in full
        monthly_insurable = min(max(insured_salary + variable_salary, lo), hi) if (insured_salary + variable_salary) else 0.0
        annual_insured  = round(monthly_insurable * 12, 2)
        total_insured  += annual_insured
        employee_wages.append({
            "name":             emp.get("name", ""),
            "national_id":      emp.get("national_id") or profile.get("national_id", ""),
            "insurance_number": profile.get("insurance_number", ""),
            "monthly_basic":    insured_salary,
            "monthly_variable": variable_salary,
            "monthly_insurable": round(monthly_insurable, 2),
            "annual_total":     annual_insured,
        })

    return {
        "form_name":       f"استمارة رقم (2) — إقرار الأجور السنوي {year}",
        "law_reference":   "قانون التأمينات الاجتماعية 148/2019",
        "submission_note": f"تُقدَّم في يناير {year+1} عن عام {year}",
        "insurable_limits": {"min": lo, "max": hi},
        "employer_data": {
            "company_name":     company.get("name", ""),
            "insurance_number": company.get("insurance_registration_number", ""),
            "tax_number":       company.get("tax_id", ""),
        },
        "year":              year,
        "employees":         employee_wages,
        "totals": {
            "employee_count":  len(employee_wages),
            "total_annual_insured_wages": round(total_insured, 2),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/forms/form-6/{employee_id}")
async def generate_form_6(
    employee_id: str,
    termination_date: str = Query(...),
    termination_reason: str = Query("resignation"),
    current_user: dict = Depends(get_current_user)
):
    """استمارة (6) تأمينات — إنهاء خدمة عامل"""
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, employee_id)
    _iso(termination_date, "تاريخ إنهاء الخدمة")
    company = await db.companies.find_one({"id": company_id}, {"_id": 0}) or {}
    profile = await db.employee_insurance_profiles.find_one(
        {"employee_id": employee_id, "company_id": company_id}, {"_id": 0}) or {}
    policy = await get_policy(company_id)

    from api.insurance_forms import insurance_wage, last_payroll_wage
    wage = await insurance_wage(company_id, emp, profile)
    last_run = await last_payroll_wage(company_id, employee_id)
    service_yrs = calc_service_years(emp.get("hire_date", ""), termination_date)
    last_salary = monthly_wage(emp)
    # the form ignored the resignation factor that the calculator applied
    gratuity = gratuity_amount(policy, last_salary, service_yrs, termination_reason)["total"]

    bal = await get_leave_balance(employee_id, current_user)
    leave_days = max(bal["annual_leave"]["balance"], 0)
    leave_encash = round(leave_days * (last_salary / 30), 2)

    return {
        "form_name":       "استمارة رقم (6) — إخطار انتهاء خدمة عامل",
        "full_form":       f"/api/insurance-forms/form6/{employee_id}",
        "law_reference":   "قانون التأمينات الاجتماعية 148/2019",
        "submission_note": "تُقدَّم للهيئة خلال المدة المقررة من تاريخ انتهاء الخدمة",
        "employer_data": {
            "company_name":     company.get("name", ""),
            "insurance_number": company.get("insurance_registration_number", ""),
            "tax_number":       company.get("tax_id", ""),
        },
        "employee_data": {
            "name":             emp.get("name", ""),
            "national_id":      emp.get("national_id") or profile.get("national_id", ""),
            "insurance_number": profile.get("insurance_number", ""),
            "hire_date":        emp.get("hire_date", ""),
            "termination_date": termination_date,
            "termination_reason": TERMINATION_REASONS.get(termination_reason, termination_reason),
            "service_years":    round(service_yrs, 2),
            "last_insured_salary": (last_run or {}).get("insured_salary") or wage["insurable_wage"],
        },
        "entitlements": {
            "gratuity_amount":      gratuity,
            "leave_balance_days":   leave_days,
            "leave_encashment":     leave_encash,
            "total_dues":           round(gratuity + leave_encash, 2),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
