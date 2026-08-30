"""
HR Engine — محرك الموارد البشرية المتكامل
قانون العمل المصري رقم 12 لسنة 2003

يشمل:
1. محرك الإجازات والرصيد المستحق
2. حساب الأجر الإضافي
3. جدول الجزاءات والخصومات
4. مكافأة نهاية الخدمة
5. النماذج الحكومية (استمارات التأمينات 1، 2، 6)
"""
import uuid
from datetime import datetime, timezone, date, timedelta
from dateutil.relativedelta import relativedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db
from api.users import get_current_user
from models.accounting import JournalEntry, JournalEntryLine
from services.accounting_service import AccountingService

router = APIRouter(prefix="/api/hr-engine", tags=["HR Engine"])


# ══════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════

def calc_service_years(hire_date: str, to_date: str = None) -> float:
    """احتساب سنوات الخدمة الكسرية"""
    try:
        hd = date.fromisoformat(hire_date)
        td = date.fromisoformat(to_date) if to_date else date.today()
        diff = relativedelta(td, hd)
        return round(diff.years + diff.months/12 + diff.days/365, 4)
    except Exception:
        return 0.0


def annual_leave_entitlement(service_years: float, age: int = 0) -> int:
    """
    الاستحقاق السنوي للإجازة — قانون 12/2003 المادة 47:
    - 21 يوماً للموظف العادي
    - 30 يوماً لمن تجاوز 50 سنة أو أمضى 10 سنوات خدمة
    """
    if service_years >= 10 or age >= 50:
        return 30
    return 21


async def get_employee(company_id: str, employee_id: str) -> dict:
    emp = await db.employees.find_one(
        {"id": employee_id, "company_id": company_id}, {"_id": 0}
    )
    if not emp:
        raise HTTPException(404, "الموظف غير موجود")
    return emp


async def je_line(company_id: str, code: str, debit=0.0, credit=0.0, desc="") -> dict:
    acc = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0}
    ) or {"id": code, "account_code": code, "account_name": f"حساب {code}"}
    return {
        "line_id": str(uuid.uuid4()), "entry_id": None,
        "account_id": acc["id"], "account_code": acc["account_code"],
        "account_name": acc.get("account_name", f"حساب {code}"),
        "debit": round(debit, 2), "credit": round(credit, 2), "description": desc,
    }


# ══════════════════════════════════════════════════════════════
# 1. LEAVE ENGINE — محرك الإجازات
# ══════════════════════════════════════════════════════════════

@router.get("/leave/balance/{employee_id}")
async def get_leave_balance(employee_id: str,
                            current_user: dict = Depends(get_current_user)):
    """رصيد الإجازات الكامل مع الاستحقاق القانوني"""
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, employee_id)

    service_yrs = calc_service_years(emp.get("hire_date", ""), None)
    age = 0
    if emp.get("date_of_birth"):
        try:
            dob = date.fromisoformat(emp["date_of_birth"])
            age = relativedelta(date.today(), dob).years
        except Exception:
            pass

    entitlement = annual_leave_entitlement(service_yrs, age)

    # Load leave records this year
    year_start = f"{date.today().year}-01-01"
    year_end   = f"{date.today().year}-12-31"
    leaves = await db.leave_requests.find({
        "employee_id": employee_id, "company_id": company_id,
        "status": "approved",
        "start_date": {"$gte": year_start, "$lte": year_end}
    }, {"_id": 0}).to_list(None)

    annual_taken  = sum(l.get("days", 0) for l in leaves if l.get("leave_type") == "annual")
    casual_taken  = sum(l.get("days", 0) for l in leaves if l.get("leave_type") == "casual")
    sick_taken    = sum(l.get("days", 0) for l in leaves if l.get("leave_type") == "sick")

    # Load carried-over balance from previous year
    prev_bal_rec = await db.leave_balances.find_one(
        {"employee_id": employee_id, "company_id": company_id,
         "year": date.today().year}, {"_id": 0}
    )
    carried_over = prev_bal_rec.get("carried_over", 0) if prev_bal_rec else 0

    annual_balance = entitlement + carried_over - annual_taken
    casual_balance = max(6 - casual_taken, 0)  # حد أقصى 6 أيام عارضة

    return {
        "employee_id":   employee_id,
        "employee_name": emp.get("name", ""),
        "service_years": round(service_yrs, 1),
        "age":           age,
        "annual_leave": {
            "entitlement":    entitlement,
            "carried_over":   carried_over,
            "taken":          annual_taken,
            "balance":        annual_balance,
            "reason_30_days": service_yrs >= 10 or age >= 50,
        },
        "casual_leave": {
            "max_per_year": 6,
            "taken":        casual_taken,
            "balance":      casual_balance,
            "note":         "لا يتجاوز يومين في المرة الواحدة — قانون 12/2003 م.47",
        },
        "sick_leave": {"taken": sick_taken},
        "year": date.today().year,
    }


@router.post("/leave/request")
async def create_leave_request(data: dict,
                               current_user: dict = Depends(get_current_user)):
    """
    طلب إجازة مع التحقق من القانون:
    - إجازة عارضة: حد أقصى يومان في المرة، 6 أيام في السنة
    - إجازة سنوية: لا يتجاوز الرصيد المتاح
    """
    company_id  = current_user["company_id"]
    emp_id      = data.get("employee_id")
    leave_type  = data.get("leave_type", "annual")  # annual | casual | sick | unpaid
    start       = data.get("start_date")
    end         = data.get("end_date")

    if not all([emp_id, start, end]):
        raise HTTPException(400, "employee_id + start_date + end_date مطلوبة")

    sd = date.fromisoformat(start); ed = date.fromisoformat(end)
    days = (ed - sd).days + 1
    if days <= 0:
        raise HTTPException(400, "تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء")

    # ── Validate casual leave limits ─────────────────────────
    if leave_type == "casual":
        if days > 2:
            raise HTTPException(400,
                f"الإجازة العارضة لا تتجاوز يومين في المرة الواحدة (طلبت {days} أيام) — قانون 12/2003 م.47")
        # Check annual casual total
        year_start = f"{sd.year}-01-01"; year_end = f"{sd.year}-12-31"
        existing_casual = await db.leave_requests.find({
            "employee_id": emp_id, "company_id": company_id,
            "leave_type": "casual", "status": "approved",
            "start_date": {"$gte": year_start, "$lte": year_end}
        }, {"_id": 0}).to_list(None)
        total_casual = sum(l.get("days", 0) for l in existing_casual)
        if total_casual + days > 6:
            raise HTTPException(400,
                f"تجاوز الحد السنوي للإجازات العارضة (6 أيام). مستهلك: {total_casual}, طلب: {days}")

    # ── Validate annual leave balance ─────────────────────────
    if leave_type == "annual":
        bal = await get_leave_balance(emp_id, current_user)
        if days > bal["annual_leave"]["balance"]:
            raise HTTPException(400,
                f"الرصيد غير كافٍ. متاح: {bal['annual_leave']['balance']} يوم، طلب: {days} يوم")

    request = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "employee_id": emp_id, "leave_type": leave_type,
        "start_date": start, "end_date": end, "days": days,
        "reason": data.get("reason", ""),
        "status": "pending",
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.leave_requests.insert_one(request); request.pop("_id", None)

    return {
        "message": f"تم تقديم طلب إجازة {leave_type} — {days} يوم",
        "request": request,
        "law_note": "قانون العمل 12/2003 المادة 47" if leave_type == "casual" else "",
    }


@router.post("/leave/carryover")
async def run_annual_leave_carryover(
    data: dict, current_user: dict = Depends(get_current_user)
):
    """
    ترحيل رصيد الإجازات في نهاية السنة
    يُحدِّد الرصيد المرحَّل للعام القادم
    """
    company_id = current_user["company_id"]
    from_year  = int(data.get("year", date.today().year))
    max_carry  = int(data.get("max_carryover_days", 21))  # حد الترحيل

    employees = await db.employees.find(
        {"company_id": company_id, "status": "active"}, {"_id": 0}
    ).to_list(None)

    results = []
    for emp in employees:
        service_yrs = calc_service_years(emp.get("hire_date",""))
        age = 0
        if emp.get("date_of_birth"):
            try:
                age = relativedelta(date.today(), date.fromisoformat(emp["date_of_birth"])).years
            except: pass
        entitlement = annual_leave_entitlement(service_yrs, age)

        year_range = {"$gte": f"{from_year}-01-01", "$lte": f"{from_year}-12-31"}
        leaves = await db.leave_requests.find({
            "employee_id": emp["id"], "company_id": company_id,
            "status": "approved", "leave_type": "annual",
            "start_date": year_range
        }, {"_id": 0}).to_list(None)
        taken = sum(l.get("days", 0) for l in leaves)

        prev = await db.leave_balances.find_one(
            {"employee_id": emp["id"], "company_id": company_id, "year": from_year}, {"_id": 0}
        )
        prev_carry = prev.get("carried_over", 0) if prev else 0
        balance    = entitlement + prev_carry - taken
        carry_next = min(max(balance, 0), max_carry)

        # Save balance for next year
        await db.leave_balances.replace_one(
            {"employee_id": emp["id"], "company_id": company_id, "year": from_year + 1},
            {"employee_id": emp["id"], "company_id": company_id,
             "year": from_year + 1, "carried_over": carry_next,
             "entitlement": entitlement, "as_of": datetime.now(timezone.utc).isoformat()},
            upsert=True
        )
        results.append({
            "employee_id": emp["id"], "name": emp.get("name",""),
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
    """
    المقابل النقدي لرصيد الإجازات عند إنهاء الخدمة
    قانون 12/2003 المادة 51: يُحسب على أساس آخر أجر
    """
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, employee_id)

    # Get leave balance at termination
    balance_data = await get_leave_balance(employee_id, current_user)
    leave_balance = balance_data["annual_leave"]["balance"]

    # Daily rate = monthly salary / 30
    monthly_salary = float(emp.get("basic_salary", 0)) + float(emp.get("allowances", 0))
    daily_rate     = round(monthly_salary / 30, 2)
    encashment     = round(leave_balance * daily_rate, 2)

    return {
        "employee_id":      employee_id,
        "employee_name":    emp.get("name",""),
        "termination_date": termination_date,
        "leave_balance_days": leave_balance,
        "daily_rate":       daily_rate,
        "encashment_amount": encashment,
        "law_reference":    "قانون العمل 12/2003 المادة 51",
        "journal_hint":     {
            "debit":  "م/223 مخصص مكافأة نهاية الخدمة / م/331 الأجور المستحقة",
            "credit": "م/112 البنك / م/220 أجور مستحقة",
        }
    }


# ══════════════════════════════════════════════════════════════
# 2. OVERTIME ENGINE — محرك الوقت الإضافي
# ══════════════════════════════════════════════════════════════

OT_RATES = {
    "day":     1.35,  # 35% فوق العادي للعمل النهاري — م.88 قانون 12/2003
    "night":   1.70,  # 70% للعمل الليلي (بعد الساعة 8 مساءً)
    "holiday": 2.00,  # 100% في أيام العطلات والأعياد الرسمية
}


@router.post("/overtime/calculate")
async def calculate_overtime(data: dict,
                             current_user: dict = Depends(get_current_user)):
    """
    احتساب الأجر الإضافي وفق قانون 12/2003 المادة 88:
    - 35% فوق الأجر النهاري العادي
    - 70% فوق الأجر الليلي
    - 100% فوق أجر أيام العطلات والراحة الرسمية
    """
    company_id  = current_user["company_id"]
    employee_id = data.get("employee_id")
    emp = await get_employee(company_id, employee_id)

    monthly_salary = float(emp.get("basic_salary", 0)) + float(emp.get("allowances", 0))
    # Hourly rate = monthly / (30 * 8)
    hourly_rate    = round(monthly_salary / (30 * 8), 4)

    entries = data.get("entries", [])  # [{date, hours, type: day|night|holiday}]
    results = []
    total_pay = 0.0

    for entry in entries:
        hours     = float(entry.get("hours", 0))
        ot_type   = entry.get("type", "day")  # day | night | holiday
        multiplier = OT_RATES.get(ot_type, OT_RATES["day"])
        ot_pay    = round(hours * hourly_rate * multiplier, 2)
        total_pay += ot_pay
        results.append({
            "date":       entry.get("date"),
            "hours":      hours,
            "type":       ot_type,
            "multiplier": f"{int((multiplier-1)*100)}%",
            "hourly_base": hourly_rate,
            "ot_pay":     ot_pay,
            "law":        f"م.88 قانون 12/2003 — معامل {multiplier}x",
        })

    return {
        "employee_id":    employee_id,
        "employee_name":  emp.get("name",""),
        "hourly_rate":    hourly_rate,
        "total_ot_pay":   round(total_pay, 2),
        "ot_breakdown":   results,
        "rates_reference": {
            "day":     "35% فوق العادي (× 1.35)",
            "night":   "70% فوق العادي (× 1.70) — بعد 8 مساءً",
            "holiday": "100% فوق العادي (× 2.00) — أيام العطل",
        }
    }


# ══════════════════════════════════════════════════════════════
# 3. PENALTY SCHEDULE — جدول الجزاءات والخصومات
# ══════════════════════════════════════════════════════════════

# وزارة العمل — جدول الجزاءات التدرجي
DEFAULT_PENALTY_SCHEDULE = [
    {"violation": "تأخر عن العمل (المرة الأولى)",  "deduct_hours": 1,  "level": 1},
    {"violation": "تأخر عن العمل (المرة الثانية)", "deduct_hours": 2,  "level": 2},
    {"violation": "تأخر عن العمل (المرة الثالثة)","deduct_hours": 4,  "level": 3},
    {"violation": "غياب بدون إذن (يوم واحد)",     "deduct_days":  2,  "level": 2},
    {"violation": "غياب بدون إذن (يومان متتاليان)","deduct_days":  4,  "level": 3},
    {"violation": "غياب بدون إذن (3+ أيام)",       "deduct_days":  6,  "level": 4},
    {"violation": "مخالفة تعليمات السلامة",        "deduct_days":  1,  "level": 2},
    {"violation": "إهمال في العمل",               "deduct_days":  2,  "level": 2},
    {"violation": "سوء السلوك (مرة أولى)",        "deduct_days":  3,  "level": 3},
    {"violation": "سوء السلوك (مرة ثانية)",       "deduct_days":  6,  "level": 4},
]


@router.get("/penalties/schedule")
async def get_penalty_schedule(current_user: dict = Depends(get_current_user)):
    """جدول الجزاءات الرسمي وفق لائحة وزارة العمل"""
    company_id = current_user["company_id"]
    custom = await db.penalty_schedules.find_one(
        {"company_id": company_id}, {"_id": 0}
    )
    schedule = custom.get("penalties", DEFAULT_PENALTY_SCHEDULE) if custom else DEFAULT_PENALTY_SCHEDULE
    return {
        "schedule": schedule,
        "law_reference": "قانون العمل 12/2003 المادة 69 — لائحة الجزاءات",
        "note": "يُطبَّق التدرج في الجزاءات عند تكرار المخالفة",
        "max_deduction": "لا تزيد قيمة الجزاء في الشهر عن 5 أيام من الأجر",
    }


@router.post("/penalties/apply")
async def apply_penalty(data: dict, current_user: dict = Depends(get_current_user)):
    """
    تطبيق جزاء على موظف مع احتساب الخصم
    القيد: من حـ/ مصاريف جزاءات | إلى حـ/ صندوق رعاية العمال
    """
    company_id  = current_user["company_id"]
    employee_id = data.get("employee_id")
    emp = await get_employee(company_id, employee_id)

    violation    = data.get("violation", "")
    deduct_days  = float(data.get("deduct_days", 0))
    deduct_hours = float(data.get("deduct_hours", 0))
    apply_date   = data.get("date", date.today().isoformat())

    monthly = float(emp.get("basic_salary", 0))
    daily   = monthly / 30
    hourly  = daily / 8
    amount  = round((deduct_days * daily) + (deduct_hours * hourly), 2)

    # Max 5 days per month cap
    max_monthly = daily * 5
    if amount > max_monthly:
        amount = round(max_monthly, 2)

    record = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "employee_id": employee_id, "employee_name": emp.get("name",""),
        "violation": violation, "deduct_days": deduct_days,
        "deduct_hours": deduct_hours, "amount": amount,
        "date": apply_date, "status": "pending",
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.penalties.insert_one(record); record.pop("_id", None)

    return {
        "message": f"تم تسجيل الجزاء — خصم {amount:,.2f} ج.م",
        "penalty": record,
        "monthly_cap_note": f"الحد الأقصى للخصم في الشهر: {max_monthly:,.2f} ج.م (5 أيام)",
    }


# ══════════════════════════════════════════════════════════════
# 4. END OF SERVICE GRATUITY — مكافأة نهاية الخدمة
# ══════════════════════════════════════════════════════════════

@router.get("/gratuity/calculate/{employee_id}")
async def calculate_gratuity(
    employee_id: str,
    termination_date: str = Query(..., description="تاريخ إنهاء الخدمة"),
    termination_reason: str = Query("retirement", description="retirement|resignation|dismissal"),
    current_user: dict = Depends(get_current_user)
):
    """
    مكافأة نهاية الخدمة — قانون العمل 12/2003 المادة 54:
    - نصف شهر عن كل سنة من السنوات الخمس الأولى
    - شهر كامل عن كل سنة بعد الخمس سنوات الأولى
    """
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, employee_id)

    service_yrs = calc_service_years(emp.get("hire_date", ""), termination_date)
    if service_yrs < 1:
        return {"message": "لا تستحق مكافأة — الخدمة أقل من سنة", "gratuity": 0}

    # آخر أجر = الراتب الأساسي + البدلات الثابتة
    last_salary = float(emp.get("basic_salary", 0)) + float(emp.get("allowances", 0))
    monthly     = last_salary

    first_5  = min(service_yrs, 5)
    after_5  = max(service_yrs - 5, 0)

    gratuity_first5 = round(first_5 * (monthly * 0.5), 2)   # نصف شهر/سنة
    gratuity_after5 = round(after_5 * monthly,          2)   # شهر كامل/سنة
    total_gratuity  = round(gratuity_first5 + gratuity_after5, 2)

    # Note: Resignation < 3 years = 0, 3-5 years = 1/3, 5-10 years = 2/3
    if termination_reason == "resignation":
        if service_yrs < 3:
            total_gratuity = 0
            note = "استقالة قبل 3 سنوات — لا تستحق مكافأة"
        elif service_yrs < 5:
            total_gratuity = round(total_gratuity / 3, 2)
            note = "استقالة 3-5 سنوات — ثلث المكافأة"
        elif service_yrs < 10:
            total_gratuity = round(total_gratuity * 2 / 3, 2)
            note = "استقالة 5-10 سنوات — ثلثا المكافأة"
        else:
            note = "استقالة 10+ سنوات — المكافأة كاملة"
    else:
        note = "إنهاء خدمة / تقاعد — المكافأة كاملة"

    return {
        "employee_id":      employee_id,
        "employee_name":    emp.get("name",""),
        "hire_date":        emp.get("hire_date",""),
        "termination_date": termination_date,
        "service_years":    round(service_yrs, 2),
        "termination_reason": termination_reason,
        "last_monthly_salary": monthly,
        "gratuity_calculation": {
            "first_5_years":  {"years": round(first_5,2), "rate": "نصف شهر/سنة", "amount": gratuity_first5},
            "after_5_years":  {"years": round(after_5,2), "rate": "شهر كامل/سنة",  "amount": gratuity_after5},
            "total_before_adj": round(gratuity_first5 + gratuity_after5, 2),
            "total_payable":  total_gratuity,
        },
        "note":          note,
        "law_reference": "قانون العمل 12/2003 المادة 54",
    }


@router.post("/gratuity/post/{employee_id}")
async def post_gratuity_journal(
    employee_id: str, data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    قيد إثبات ودفع مكافأة نهاية الخدمة:
    مدين: م/223 مخصص مكافأة نهاية الخدمة
    دائن: م/112 البنك / م/220 أجور مستحقة
    """
    company_id = current_user["company_id"]
    amount     = float(data.get("amount", 0))
    pay_date   = data.get("date", date.today().isoformat())
    emp = await get_employee(company_id, employee_id)

    lines = [
        await je_line(company_id, "223", debit=amount,
                      desc=f"مكافأة نهاية خدمة — {emp.get('name','')}"),
        await je_line(company_id, "112", credit=amount,
                      desc=f"صرف مكافأة نهاية خدمة — {emp.get('name','')}"),
    ]
    svc = AccountingService(db)
    entry = JournalEntry(
        company_id=company_id, entry_number=0, entry_date=pay_date,
        description=f"مكافأة نهاية خدمة — {emp.get('name','')}",
        lines=lines, source_document_type="manual",
        source_document_id=employee_id, created_by=current_user["user_id"],
    )
    result = await svc.create_journal_entry(entry)
    await svc.post_journal_entry(result["id"], current_user["user_id"])

    return {
        "message": f"تم إثبات وصرف مكافأة نهاية الخدمة — {amount:,.2f} ج.م",
        "journal_entry_id": result["id"],
        "journal": {
            "debit":  f"م/223 مخصص مكافأة نهاية الخدمة  {amount:,.2f}",
            "credit": f"م/112 البنك                       {amount:,.2f}",
        }
    }


# ══════════════════════════════════════════════════════════════
# 5. GOVERNMENT FORMS — النماذج الحكومية
# ══════════════════════════════════════════════════════════════

@router.get("/forms/form-1/{employee_id}")
async def generate_form_1(employee_id: str,
                           current_user: dict = Depends(get_current_user)):
    """
    استمارة (1) تأمينات — التحاق عامل جديد
    تُقدَّم خلال 30 يوماً من تاريخ التعيين
    """
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, employee_id)
    company = await db.companies.find_one({"id": company_id}, {"_id": 0}) or {}
    profile = await db.employee_insurance_profiles.find_one(
        {"employee_id": employee_id, "company_id": company_id}, {"_id": 0}
    ) or {}

    return {
        "form_name":        "استمارة رقم (1) — إخطار التحاق عامل",
        "law_reference":    "قانون التأمينات الاجتماعية 148/2019",
        "submission_note":  "تُقدَّم خلال 30 يوماً من تاريخ الالتحاق",
        "employer_data": {
            "company_name":      company.get("name",""),
            "company_name_en":   company.get("name_en",""),
            "tax_number":        company.get("tax_id",""),
            "insurance_number":  company.get("insurance_registration_number",""),
            "address":           company.get("address",""),
            "activity":          company.get("activity",""),
        },
        "employee_data": {
            "name":             emp.get("name",""),
            "name_en":          emp.get("name_en",""),
            "national_id":      emp.get("national_id", profile.get("national_id","")),
            "date_of_birth":    emp.get("date_of_birth",""),
            "gender":           emp.get("gender",""),
            "nationality":      emp.get("nationality","Egyptian"),
            "marital_status":   emp.get("marital_status",""),
            "hire_date":        emp.get("hire_date",""),
            "job_title":        emp.get("position",""),
            "department":       emp.get("department",""),
            "insured_salary":   profile.get("insured_basic_salary", emp.get("basic_salary",0)),
            "variable_salary":  profile.get("insured_variable_salary", 0),
            "insurance_number": profile.get("insurance_number",""),
            "bank_iban":        profile.get("bank_account_iban",""),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/forms/form-2")
async def generate_form_2(
    year: int = Query(None, description="السنة — يناير من السنة التالية"),
    current_user: dict = Depends(get_current_user)
):
    """
    استمارة (2) تأمينات — إقرار الأجور السنوي
    تُقدَّم في يناير من كل عام عن أجور العام السابق
    """
    company_id = current_user["company_id"]
    if not year:
        year = date.today().year - 1  # السنة السابقة
    company = await db.companies.find_one({"id": company_id}, {"_id": 0}) or {}

    employees = await db.employees.find(
        {"company_id": company_id, "status": "active"}, {"_id": 0}
    ).to_list(None)

    employee_wages = []
    total_insured = 0
    for emp in employees:
        profile = await db.employee_insurance_profiles.find_one(
            {"employee_id": emp["id"], "company_id": company_id}, {"_id": 0}
        ) or {}
        insured_salary   = float(profile.get("insured_basic_salary", emp.get("basic_salary", 0)))
        variable_salary  = float(profile.get("insured_variable_salary", 0))
        annual_insured   = (insured_salary + variable_salary) * 12
        total_insured   += annual_insured
        employee_wages.append({
            "name":            emp.get("name",""),
            "national_id":     emp.get("national_id", profile.get("national_id","")),
            "insurance_number": profile.get("insurance_number",""),
            "monthly_basic":   insured_salary,
            "monthly_variable": variable_salary,
            "annual_total":    round(annual_insured, 2),
        })

    return {
        "form_name":       f"استمارة رقم (2) — إقرار الأجور السنوي {year}",
        "law_reference":   "قانون التأمينات الاجتماعية 148/2019",
        "submission_note": f"تُقدَّم خلال شهر يناير {year+1} عن عام {year}",
        "employer_data": {
            "company_name":     company.get("name",""),
            "insurance_number": company.get("insurance_registration_number",""),
            "tax_number":       company.get("tax_id",""),
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
    """
    استمارة (6) تأمينات — إنهاء خدمة عامل
    تُقدَّم خلال 30 يوماً من تاريخ انتهاء الخدمة
    """
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, employee_id)
    company = await db.companies.find_one({"id": company_id}, {"_id": 0}) or {}
    profile = await db.employee_insurance_profiles.find_one(
        {"employee_id": employee_id, "company_id": company_id}, {"_id": 0}
    ) or {}

    service_yrs = calc_service_years(emp.get("hire_date",""), termination_date)

    # Calculate gratuity
    last_salary = float(emp.get("basic_salary",0)) + float(emp.get("allowances",0))
    first_5 = min(service_yrs, 5)
    after_5 = max(service_yrs - 5, 0)
    gratuity = round(first_5 * last_salary * 0.5 + after_5 * last_salary, 2)

    # Leave encashment
    bal = await get_leave_balance(employee_id, current_user)
    leave_days = bal["annual_leave"]["balance"]
    leave_encash = round(leave_days * (last_salary / 30), 2)

    REASONS = {
        "resignation": "استقالة",
        "retirement":  "بلوغ سن التقاعد",
        "dismissal":   "إنهاء العقد من صاحب العمل",
        "death":       "وفاة",
        "disability":  "عجز كلي",
    }

    return {
        "form_name":       "استمارة رقم (6) — إخطار انتهاء خدمة عامل",
        "law_reference":   "قانون التأمينات الاجتماعية 148/2019",
        "submission_note": "تُقدَّم خلال 30 يوماً من تاريخ انتهاء الخدمة",
        "employer_data": {
            "company_name":     company.get("name",""),
            "insurance_number": company.get("insurance_registration_number",""),
            "tax_number":       company.get("tax_id",""),
        },
        "employee_data": {
            "name":             emp.get("name",""),
            "national_id":      emp.get("national_id", profile.get("national_id","")),
            "insurance_number": profile.get("insurance_number",""),
            "hire_date":        emp.get("hire_date",""),
            "termination_date": termination_date,
            "termination_reason": REASONS.get(termination_reason, termination_reason),
            "service_years":    round(service_yrs, 2),
            "last_insured_salary": profile.get("insured_basic_salary", emp.get("basic_salary",0)),
        },
        "entitlements": {
            "gratuity_amount":      gratuity,
            "leave_balance_days":   leave_days,
            "leave_encashment":     leave_encash,
            "total_dues":           round(gratuity + leave_encash, 2),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
