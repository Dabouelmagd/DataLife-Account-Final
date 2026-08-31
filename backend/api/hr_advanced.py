"""
HR Advanced Engine — محرك الموارد البشرية المتقدم

1. Employee Loan Engine   — سلف وقروض الموظفين المجدولة
2. Commission Engine      — عمولات مندوبي المبيعات الديناميكية
3. Asset Custody          — تتبع العهد العينية
4. Offboarding Settlement — تصفية مستحقات نهاية الخدمة وإخلاء الطرف
"""
import uuid, asyncio
from datetime import datetime, timezone, date
from dateutil.relativedelta import relativedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db
from api.users import get_current_user
from models.accounting import JournalEntry
from services.accounting_service import AccountingService

router = APIRouter(prefix="/api/hr-advanced", tags=["HR Advanced"])

# ══════════════════════════════════════════════════════════════
# ACCOUNT CODES
# ══════════════════════════════════════════════════════════════
ACC = {
    "loans_ar":       "1341",  # سلف وقروض الموظفين
    "custody_ar":     "1342",  # عهد الموظفين العينية
    "commission_exp": "3421",  # عمولات مندوبي المبيعات
    "commission_pay": "2201",  # مستحقات عمولات مستحقة
    "salaries_pay":   "253",   # أجور مستحقة الدفع
    "gratuity_prov":  "223",   # مخصص مكافأة نهاية الخدمة
    "bank":           "112",
    "cash":           "161",
    "ar":             "131",
}


async def get_acc(company_id: str, code: str) -> dict:
    a = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0}
    )
    return a or {"id": code, "account_code": code, "account_name": f"حساب {code}"}


async def je_line(company_id: str, code: str,
                  debit=0.0, credit=0.0, desc="") -> dict:
    acc = await get_acc(company_id, code)
    return {
        "line_id": str(uuid.uuid4()), "entry_id": None,
        "account_id":   acc["id"],
        "account_code": acc["account_code"],
        "account_name": acc.get("account_name", f"حساب {code}"),
        "debit": round(debit, 2), "credit": round(credit, 2),
        "description": desc,
    }


async def post_je(company_id: str, user_id: str, date_str: str,
                  description: str, lines: list, src_id: str = None) -> str:
    svc = AccountingService(db)
    entry = JournalEntry(
        company_id=company_id, entry_number=0, entry_date=date_str,
        description=description, lines=lines,
        source_document_type="manual", source_document_id=src_id,
        created_by=user_id,
    )
    result = await svc.create_journal_entry(entry)
    await svc.post_journal_entry(result["id"], user_id)
    return result["id"]


async def get_employee(company_id: str, employee_id: str) -> dict:
    emp = await db.employees.find_one(
        {"id": employee_id, "company_id": company_id}, {"_id": 0})
    if not emp:
        raise HTTPException(404, "الموظف غير موجود")
    return emp


# ══════════════════════════════════════════════════════════════
# 1. EMPLOYEE LOAN ENGINE — محرك السلف والقروض
# ══════════════════════════════════════════════════════════════

class LoanRequest(BaseModel):
    employee_id:     str
    loan_amount:     float
    monthly_payment: float
    start_month:     str        # "2026-02"
    grant_date:      str
    reason:          Optional[str] = "سلفة موظف"
    payment_source:  str = "bank"  # bank | cash


@router.post("/loans/grant")
async def grant_loan(req: LoanRequest,
                     current_user: dict = Depends(get_current_user)):
    """
    صرف سلفة أو قرض لموظف

    القيد:
    Dr م/1341 سلف وقروض الموظفين
    Cr م/112 البنك / م/161 الخزينة

    يُولِّد جدول أقساط شهري تلقائياً
    """
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, req.employee_id)
    loan_id = str(uuid.uuid4())

    # Validate
    if req.monthly_payment <= 0 or req.loan_amount <= 0:
        raise HTTPException(400, "مبلغ القرض والقسط يجب أن يكونا موجبَين")
    if req.monthly_payment > req.loan_amount:
        raise HTTPException(400, "القسط أكبر من مبلغ القرض")

    # Journal: Dr loans AR | Cr Bank
    pay_acc  = ACC["bank"] if req.payment_source == "bank" else ACC["cash"]
    pay_name = "البنك" if req.payment_source == "bank" else "الخزينة"
    lines = await asyncio.gather(
        je_line(company_id, ACC["loans_ar"], debit=req.loan_amount,
                desc=f"سلفة {emp.get('name','')} — {req.reason}"),
        je_line(company_id, pay_acc, credit=req.loan_amount,
                desc=f"صرف سلفة من {pay_name} — {emp.get('name','')}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], req.grant_date,
        f"صرف سلفة — {emp.get('name','')} — {req.loan_amount:,.0f} ج.م",
        list(lines), loan_id)

    # Generate installment schedule
    schedule = []
    remaining = req.loan_amount
    current_month = req.start_month
    while remaining > 0.01:
        installment = min(req.monthly_payment, remaining)
        installment = round(installment, 2)
        schedule.append({
            "month":       current_month,
            "amount":      installment,
            "paid":        False,
            "paid_date":   None,
            "je_id":       None,
        })
        remaining = round(remaining - installment, 2)
        # Advance month
        try:
            y, m = map(int, current_month.split("-"))
            m += 1
            if m > 12: y += 1; m = 1
            current_month = f"{y}-{m:02d}"
        except Exception:
            break

    loan = {
        "id": loan_id, "company_id": company_id,
        "employee_id": req.employee_id,
        "employee_name": emp.get("name",""),
        "loan_amount": req.loan_amount,
        "monthly_payment": req.monthly_payment,
        "remaining_amount": req.loan_amount,
        "status": "active",
        "grant_date": req.grant_date,
        "start_month": req.start_month,
        "reason": req.reason,
        "schedule": schedule,
        "grant_je_id": je_id,
        "total_months": len(schedule),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.employee_loans.insert_one(loan); loan.pop("_id", None)

    return {
        "message":  f"تم صرف سلفة {req.loan_amount:,.2f} ج.م لـ {emp.get('name','')}",
        "loan":     loan,
        "schedule_preview": schedule[:3],
        "total_months": len(schedule),
        "journal":  {"id": je_id,
                     "debit":  f"م/{ACC['loans_ar']} سلف الموظفين  {req.loan_amount:,.2f}",
                     "credit": f"م/{pay_acc} {pay_name}             {req.loan_amount:,.2f}"},
    }


@router.post("/loans/{loan_id}/deduct")
async def deduct_loan_installment(loan_id: str, data: dict,
                                  current_user: dict = Depends(get_current_user)):
    """
    خصم قسط السلفة من مسير الراتب

    القيد:
    Dr م/253 أجور مستحقة الدفع (من جانب الراتب)
    Cr م/1341 سلف وقروض الموظفين
    """
    company_id = current_user["company_id"]
    loan = await db.employee_loans.find_one(
        {"id": loan_id, "company_id": company_id}, {"_id": 0})
    if not loan:
        raise HTTPException(404, "السلفة غير موجودة")
    if float(loan.get("remaining_amount", 0)) <= 0:
        raise HTTPException(400, "السلفة مُسدَّدة بالكامل")

    month        = data.get("month")
    amount       = float(data.get("amount") or loan["monthly_payment"])
    amount       = min(amount, float(loan["remaining_amount"]))
    date_str     = data.get("date", date.today().isoformat())
    deduct_method= data.get("method", "payroll")  # payroll | cash

    # Find the installment slot
    schedule = loan.get("schedule", [])
    slot_idx  = next((i for i, s in enumerate(schedule) if s["month"] == month and not s["paid"]), None)

    # Journal: Dr salaries payable | Cr loans AR
    if deduct_method == "payroll":
        dr_acc, dr_name = ACC["salaries_pay"], "أجور مستحقة الدفع"
    else:
        dr_acc, dr_name = ACC["bank"], "البنك (سداد نقدي)"

    lines = await asyncio.gather(
        je_line(company_id, dr_acc, debit=amount,
                desc=f"خصم قسط سلفة {loan['employee_name']} — {month}"),
        je_line(company_id, ACC["loans_ar"], credit=amount,
                desc=f"تسديد قسط سلفة — {loan['employee_name']} — {month}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], date_str,
        f"خصم قسط سلفة — {loan['employee_name']} — {month}", list(lines), loan_id)

    # Update schedule and remaining
    new_remaining = round(float(loan["remaining_amount"]) - amount, 2)
    update = {"$set": {"remaining_amount": new_remaining}}
    if new_remaining <= 0:
        update["$set"]["status"] = "settled"
    if slot_idx is not None:
        update["$set"][f"schedule.{slot_idx}.paid"]      = True
        update["$set"][f"schedule.{slot_idx}.paid_date"] = date_str
        update["$set"][f"schedule.{slot_idx}.je_id"]     = je_id

    await db.employee_loans.update_one({"id": loan_id}, update)

    return {
        "message":     f"تم خصم قسط {amount:,.2f} ج.م من سلفة {loan['employee_name']}",
        "remaining":   new_remaining,
        "status":      "settled" if new_remaining <= 0 else "active",
        "journal_entry_id": je_id,
    }


@router.get("/loans")
async def list_loans(
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    q = {"company_id": current_user["company_id"]}
    if employee_id: q["employee_id"] = employee_id
    if status:      q["status"]      = status
    loans = await db.employee_loans.find(q, {"_id": 0}).sort("grant_date", -1).to_list(None)
    total_outstanding = round(sum(float(l.get("remaining_amount",0)) for l in loans), 2)
    return {"loans": loans, "total": len(loans), "total_outstanding": total_outstanding}


# ══════════════════════════════════════════════════════════════
# 2. COMMISSION ENGINE — محرك العمولات والحوافز
# ══════════════════════════════════════════════════════════════

@router.post("/commissions/calculate")
async def calculate_commissions(data: dict,
                                 current_user: dict = Depends(get_current_user)):
    """
    حساب عمولات مندوبي المبيعات — ربط بالفواتير أو التحصيل الفعلي

    القيد:
    Dr م/3421 عمولات ومكافآت مندوبي المبيعات
    Cr م/2201 مستحقات عمولات مستحقة الدفع
    """
    company_id = current_user["company_id"]
    period     = data.get("period")   # "2026-01"
    calc_basis = data.get("basis", "invoiced")  # invoiced | collected

    date_from  = f"{period}-01"
    y, m       = map(int, period.split("-"))
    m2 = m + 1; y2 = y
    if m2 > 12: y2 += 1; m2 = 1
    date_to = f"{y2}-{m2:02d}-01"

    # Get all salespeople with commission rules
    rules = await db.commission_rules.find(
        {"company_id": company_id, "active": True}, {"_id": 0}
    ).to_list(None)

    if not rules:
        return {"message": "لا توجد قواعد عمولات مُعرَّفة — أنشئ قواعد في POST /commissions/rules",
                "total_commission": 0}

    results  = []
    total_all = 0.0
    je_lines = []

    for rule in rules:
        emp_id  = rule["employee_id"]
        emp     = await get_employee(company_id, emp_id)
        rate    = float(rule.get("commission_rate", 0))
        basis   = rule.get("basis", calc_basis)
        max_cap = rule.get("max_monthly", None)

        if basis == "invoiced":
            # Sales by invoice date
            invoices = await db.invoices.find({
                "company_id": company_id,
                "document_type": "sales_invoice",
                "salesperson_id": emp_id,
                "status": {"$nin": ["cancelled","draft"]},
                "document_date": {"$gte": date_from, "$lt": date_to},
            }, {"_id": 0, "grand_total": 1}).to_list(None)
            base = sum(float(i.get("grand_total",0)) for i in invoices)
        else:
            # Collected — sum of payments received
            payments = await db.invoice_payments.find({
                "company_id": company_id,
                "salesperson_id": emp_id,
                "payment_date": {"$gte": date_from, "$lt": date_to},
            }, {"_id": 0, "amount": 1}).to_list(None)
            base = sum(float(p.get("amount",0)) for p in payments)

        commission = round(base * rate, 2)
        if max_cap:
            commission = min(commission, float(max_cap))

        if commission <= 0:
            continue

        total_all += commission
        results.append({
            "employee_id":   emp_id,
            "employee_name": emp.get("name",""),
            "basis":         basis,
            "base_amount":   round(base, 2),
            "rate":          f"{rate*100:.1f}%",
            "commission":    commission,
        })

        je_lines.append(await je_line(
            company_id, ACC["commission_exp"], debit=commission,
            desc=f"عمولة {emp.get('name','')} — {period} ({basis})"))
        je_lines.append(await je_line(
            company_id, ACC["commission_pay"], credit=commission,
            desc=f"مستحق عمولة {emp.get('name','')} — {period}"))

    je_id = None
    if je_lines and total_all > 0:
        date_str = f"{period}-28"
        je_id = await post_je(company_id, current_user["user_id"], date_str,
            f"عمولات مندوبي المبيعات — {period}", je_lines)

    return {
        "message":        f"تم احتساب عمولات {len(results)} مندوب لفترة {period}",
        "period":         period,
        "basis":          calc_basis,
        "total_commission": round(total_all, 2),
        "breakdown":      results,
        "journal_entry_id": je_id,
        "tax_note":       "العمولات تخضع لضريبة كسب العمل — تُضاف لكشف الراتب الشهري",
    }


@router.post("/commissions/rules")
async def create_commission_rule(data: dict,
                                  current_user: dict = Depends(get_current_user)):
    """تعريف قاعدة عمولة لمندوب مبيعات"""
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, data.get("employee_id",""))
    rule = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "employee_id":    data["employee_id"],
        "employee_name":  emp.get("name",""),
        "commission_rate": float(data.get("commission_rate", 0)),
        "basis":           data.get("basis", "invoiced"),
        "max_monthly":     data.get("max_monthly"),
        "active":          True,
        "created_at":      datetime.now(timezone.utc).isoformat(),
    }
    await db.commission_rules.insert_one(rule); rule.pop("_id", None)
    return {"message": f"تم تعريف قاعدة عمولة {rule['commission_rate']*100:.1f}%", "rule": rule}


@router.post("/commissions/{period}/pay")
async def pay_commissions(period: str, data: dict,
                          current_user: dict = Depends(get_current_user)):
    """
    صرف العمولات المستحقة للمندوبين

    Dr م/2201 مستحقات عمولات مستحقة الدفع
    Cr م/112 البنك
    """
    company_id = current_user["company_id"]
    amount     = float(data.get("amount", 0))
    date_str   = data.get("date", date.today().isoformat())

    lines = await asyncio.gather(
        je_line(company_id, ACC["commission_pay"], debit=amount,
                desc=f"صرف عمولات مندوبي المبيعات — {period}"),
        je_line(company_id, ACC["bank"], credit=amount,
                desc=f"تحويل بنكي عمولات — {period}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], date_str,
        f"صرف عمولات — {period}", list(lines))

    return {
        "message": f"تم صرف عمولات {amount:,.2f} ج.م — {period}",
        "journal_entry_id": je_id,
    }


# ══════════════════════════════════════════════════════════════
# 3. ASSET CUSTODY — تتبع العهد العينية
# ══════════════════════════════════════════════════════════════

class CustodyRequest(BaseModel):
    employee_id:  str
    asset_type:   str   # laptop | phone_line | car | sim_card | other
    asset_name:   str
    asset_code:   Optional[str] = None
    serial_number: Optional[str] = None
    value:        float = 0.0   # قيمة العهدة (للمحاسبة)
    hand_over_date: str


@router.post("/custody/assign")
async def assign_custody(req: CustodyRequest,
                          current_user: dict = Depends(get_current_user)):
    """
    تسليم عهدة عينية لموظف

    إن كانت لها قيمة محاسبية:
    Dr م/1342 عهد الموظفين العينية
    Cr م/155 أصول ثابتة (يُحوَّل من الأصول للعهدة)
    """
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, req.employee_id)
    custody_id = str(uuid.uuid4())

    je_id = None
    if req.value > 0:
        lines = await asyncio.gather(
            je_line(company_id, ACC["custody_ar"], debit=req.value,
                    desc=f"عهدة {req.asset_name} — {emp.get('name','')}"),
            je_line(company_id, "155", credit=req.value,
                    desc=f"تحويل {req.asset_name} لعهدة {emp.get('name','')}"),
        )
        je_id = await post_je(company_id, current_user["user_id"], req.hand_over_date,
            f"تسليم عهدة — {req.asset_name} — {emp.get('name','')}", list(lines), custody_id)

    custody = {
        "id": custody_id, "company_id": company_id,
        "employee_id":   req.employee_id,
        "employee_name": emp.get("name",""),
        "asset_type":    req.asset_type,
        "asset_name":    req.asset_name,
        "asset_code":    req.asset_code,
        "serial_number": req.serial_number,
        "value":         req.value,
        "hand_over_date": req.hand_over_date,
        "return_date":   None,
        "status":        "assigned",  # assigned | returned | lost
        "assign_je_id":  je_id,
        "created_at":    datetime.now(timezone.utc).isoformat(),
    }
    await db.employee_custody.insert_one(custody); custody.pop("_id", None)

    return {
        "message":    f"تم تسليم {req.asset_name} لـ {emp.get('name','')}",
        "custody":    custody,
        "custody_id": custody_id,
    }


@router.put("/custody/{custody_id}/return")
async def return_custody(custody_id: str, data: dict,
                          current_user: dict = Depends(get_current_user)):
    """
    استرداد عهدة من موظف

    Dr م/155 أصول ثابتة (استرجاع)
    Cr م/1342 عهد الموظفين العينية
    """
    company_id = current_user["company_id"]
    custody = await db.employee_custody.find_one(
        {"id": custody_id, "company_id": company_id}, {"_id": 0})
    if not custody:
        raise HTTPException(404, "العهدة غير موجودة")
    if custody["status"] != "assigned":
        raise HTTPException(400, f"العهدة في حالة '{custody['status']}'")

    return_date = data.get("date", date.today().isoformat())
    condition   = data.get("condition", "good")  # good | damaged | lost
    value       = float(custody.get("value", 0))
    je_id       = None

    if value > 0:
        if condition == "lost":
            # خسارة → Dr مصروف خسارة | Cr عهدة
            lines = await asyncio.gather(
                je_line(company_id, "422", debit=value,
                        desc=f"خسارة عهدة مفقودة — {custody['asset_name']}"),
                je_line(company_id, ACC["custody_ar"], credit=value,
                        desc=f"إقفال عهدة مفقودة — {custody['asset_name']}"),
            )
        else:
            # استرجاع عادي
            lines = await asyncio.gather(
                je_line(company_id, "155", debit=value,
                        desc=f"استرجاع عهدة — {custody['asset_name']}"),
                je_line(company_id, ACC["custody_ar"], credit=value,
                        desc=f"إقفال عهدة — {custody['asset_name']} — {condition}"),
            )
        je_id = await post_je(company_id, current_user["user_id"], return_date,
            f"استرجاع عهدة — {custody['asset_name']}", list(lines), custody_id)

    await db.employee_custody.update_one(
        {"id": custody_id},
        {"$set": {"status": "returned" if condition != "lost" else "lost",
                  "return_date": return_date, "condition": condition,
                  "return_je_id": je_id}}
    )
    return {
        "message": f"تم استرجاع {custody['asset_name']}",
        "condition": condition,
        "journal_entry_id": je_id,
    }


@router.get("/custody/employee/{employee_id}")
async def get_employee_custody(employee_id: str,
                                current_user: dict = Depends(get_current_user)):
    """قائمة العهد المسجلة على موظف"""
    items = await db.employee_custody.find({
        "employee_id": employee_id,
        "company_id":  current_user["company_id"],
        "status":      "assigned"
    }, {"_id": 0}).to_list(None)
    return {
        "employee_id": employee_id,
        "custody_items": items,
        "total_items": len(items),
        "clearance_blocked": len(items) > 0,
        "note": "⚠️ يجب استرداد كل العهد قبل إصدار إخلاء الطرف" if items else "✅ لا عهد مسجلة",
    }


# ══════════════════════════════════════════════════════════════
# 4. OFFBOARDING & SETTLEMENT — تصفية نهاية الخدمة وإخلاء الطرف
# ══════════════════════════════════════════════════════════════

@router.post("/offboarding/{employee_id}/clearance")
async def generate_clearance(
    employee_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    تصفية مستحقات نهاية الخدمة وإخلاء الطرف

    Guard: يُمنَع إصدار إخلاء الطرف إذا:
    - توجد عهد غير مستردة
    - يوجد رصيد سلف غير مسدد

    التسوية النهائية:
    مكافأة نهاية الخدمة
    + مقابل رصيد الإجازات
    - المتبقي من السلف
    = صافي المستحق

    القيد النهائي:
    Dr م/253 أجور مستحقة / م/223 مخصص مكافأة
    Cr م/112 البنك (صافي المستحق)
    Cr م/1341 سلف الموظفين (ما تبقى)
    """
    company_id        = current_user["company_id"]
    termination_date  = data.get("termination_date", date.today().isoformat())
    termination_reason= data.get("termination_reason", "resignation")
    force_clear       = data.get("force_clear", False)  # override guard

    emp = await get_employee(company_id, employee_id)

    # ── GUARD 1: Check unreturned custody ────────────────────
    pending_custody = await db.employee_custody.find({
        "employee_id": employee_id, "company_id": company_id, "status": "assigned"
    }, {"_id": 0}).to_list(None)

    if pending_custody and not force_clear:
        return {
            "clearance_blocked": True,
            "reason": "يجب استرداد العهد المسجلة قبل إخلاء الطرف",
            "pending_custody": [{"asset": c["asset_name"],
                                  "since": c["hand_over_date"]} for c in pending_custody],
            "action": "استخدم PUT /custody/{id}/return لكل عهدة، ثم أعد المحاولة",
        }

    # ── GUARD 2: Check open loans ─────────────────────────────
    open_loans = await db.employee_loans.find({
        "employee_id": employee_id, "company_id": company_id,
        "status": "active", "remaining_amount": {"$gt": 0}
    }, {"_id": 0}).to_list(None)
    total_loan_balance = round(sum(float(l.get("remaining_amount",0)) for l in open_loans), 2)

    # ── Calculate entitlements ────────────────────────────────
    monthly_salary = float(emp.get("basic_salary", 0)) + float(emp.get("allowances", 0))
    daily_rate     = round(monthly_salary / 30, 2)
    hire_date      = emp.get("hire_date","")

    # Service years
    try:
        hd = date.fromisoformat(hire_date)
        td = date.fromisoformat(termination_date)
        service_yrs = round((td - hd).days / 365.25, 2)
    except Exception:
        service_yrs = 0

    # Gratuity (م.54 قانون 12/2003)
    first5  = min(service_yrs, 5)
    after5  = max(service_yrs - 5, 0)
    gratuity = round(first5 * monthly_salary * 0.5 + after5 * monthly_salary, 2)
    REASON_FACTORS = {"retirement":1.0,"dismissal":1.0,"resignation":(
        0 if service_yrs<3 else 1/3 if service_yrs<5 else 2/3 if service_yrs<10 else 1.0)}
    factor = REASON_FACTORS.get(termination_reason, 1.0)
    gratuity = round(gratuity * factor, 2)

    # Leave encashment
    current_year = date.today().year
    leave_bal_rec = await db.leave_balances.find_one(
        {"employee_id": employee_id, "company_id": company_id, "year": current_year})
    entitlement = 30 if service_yrs >= 10 else 21
    leave_taken = 0
    leaves = await db.leave_requests.find({
        "employee_id": employee_id, "company_id": company_id,
        "status": "approved", "leave_type": "annual",
        "start_date": {"$gte": f"{current_year}-01-01"}
    }, {"_id": 0}).to_list(None)
    leave_taken = sum(l.get("days",0) for l in leaves)
    carried     = leave_bal_rec.get("carried_over",0) if leave_bal_rec else 0
    leave_balance = max(entitlement + carried - leave_taken, 0)
    leave_encash = round(leave_balance * daily_rate, 2)

    # Net settlement
    total_due    = round(gratuity + leave_encash, 2)
    net_payable  = round(total_due - total_loan_balance, 2)

    # ── Settlement Journal Entry ──────────────────────────────
    je_lines = []

    # Debit side: liability/provision being settled
    if gratuity > 0:
        je_lines.append(await je_line(
            company_id, ACC["gratuity_prov"], debit=gratuity,
            desc=f"مكافأة نهاية خدمة — {emp.get('name','')} ({service_yrs:.1f} سنة)"))
    if leave_encash > 0:
        je_lines.append(await je_line(
            company_id, ACC["salaries_pay"], debit=leave_encash,
            desc=f"مقابل رصيد إجازات — {leave_balance} يوم × {daily_rate} ج.م"))

    # Credit side: payments and loan deductions
    if net_payable > 0:
        je_lines.append(await je_line(
            company_id, ACC["bank"], credit=net_payable,
            desc=f"صافي مستحقات {emp.get('name','')} — تحويل بنكي"))
    if total_loan_balance > 0:
        je_lines.append(await je_line(
            company_id, ACC["loans_ar"], credit=total_loan_balance,
            desc=f"خصم رصيد سلف {emp.get('name','')} من المستحقات"))
        # Close all loans
        await db.employee_loans.update_many(
            {"employee_id": employee_id, "company_id": company_id, "status": "active"},
            {"$set": {"status": "settled", "remaining_amount": 0}}
        )

    td = round(sum(l["debit"]  for l in je_lines), 2)
    tc = round(sum(l["credit"] for l in je_lines), 2)
    je_id = None
    if je_lines and td > 0:
        je_id = await post_je(company_id, current_user["user_id"], termination_date,
            f"تصفية نهاية خدمة — {emp.get('name','')} — {termination_date}",
            je_lines, employee_id)

    # Update employee status
    await db.employees.update_one(
        {"id": employee_id, "company_id": company_id},
        {"$set": {"status": "terminated", "termination_date": termination_date,
                  "termination_reason": termination_reason}}
    )

    return {
        "message":         f"✅ تم إخلاء طرف {emp.get('name','')}",
        "employee":        emp.get("name",""),
        "service_years":   service_yrs,
        "termination_date": termination_date,
        "clearance_blocked": False,
        "settlement": {
            "gratuity":         gratuity,
            "leave_encashment": leave_encash,
            "leave_days":       leave_balance,
            "total_due":        total_due,
            "loan_deduction":   total_loan_balance,
            "net_payable":      net_payable,
        },
        "journal": {
            "id":       je_id,
            "debit":    td,
            "credit":   tc,
            "balanced": abs(td - tc) < 0.01,
        },
        "status": "terminated",
    }


@router.get("/offboarding/{employee_id}/preview")
async def preview_clearance(
    employee_id: str,
    termination_date: str = Query(None),
    termination_reason: str = Query("resignation"),
    current_user: dict = Depends(get_current_user)
):
    """معاينة حساب التصفية بدون ترحيل"""
    term_date = termination_date or date.today().isoformat()
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, employee_id)

    monthly = float(emp.get("basic_salary",0)) + float(emp.get("allowances",0))
    try:
        yrs = round((date.fromisoformat(term_date) -
                     date.fromisoformat(emp.get("hire_date","2020-01-01"))).days/365.25, 2)
    except Exception:
        yrs = 0

    first5 = min(yrs,5); after5=max(yrs-5,0)
    gratuity = round(first5*monthly*0.5 + after5*monthly, 2)

    loans = await db.employee_loans.find({
        "employee_id": employee_id, "company_id": company_id,
        "status": "active"}, {"_id":0}).to_list(None)
    loan_balance = round(sum(float(l.get("remaining_amount",0)) for l in loans), 2)

    custody = await db.employee_custody.find({
        "employee_id": employee_id, "company_id": company_id,
        "status": "assigned"}, {"_id":0}).to_list(None)

    return {
        "employee": emp.get("name",""),
        "service_years": yrs,
        "preview": {
            "gratuity_estimate":       gratuity,
            "leave_encashment_estimate": round((21 if yrs<10 else 30) * (monthly/30), 2),
            "loan_deduction":          loan_balance,
            "net_estimate":            round(gratuity - loan_balance, 2),
        },
        "custody_count": len(custody),
        "clearance_blocked": len(custody) > 0,
    }
