"""
HR Advanced Engine — محرك الموارد البشرية المتقدم

1. Employee Loan Engine   — سلف وقروض الموظفين المجدولة
2. Commission Engine      — عمولات مندوبي المبيعات الديناميكية
3. Asset Custody          — تتبع العهد العينية
4. Offboarding Settlement — تصفية مستحقات نهاية الخدمة وإخلاء الطرف

Wage, leave balance, gratuity, account lookup and posting come from
api/hr_engine.py so the two HR modules give the same numbers (they had
separate copies that disagreed, and both crashed on list-type allowances).
"""
import uuid
from datetime import datetime, timezone, date
from dateutil.relativedelta import relativedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from database import db
from dependencies import get_current_user
from api.hr_engine import (je_line, _post_entry, get_employee, get_policy, monthly_wage,
                           calc_service_years, annual_leave_entitlement, leave_days_taken,
                           gratuity_amount, _iso, _num, _age)

router = APIRouter(prefix="/api/hr-advanced", tags=["HR Advanced"])

# ══════════════════════════════════════════════════════════════
# ACCOUNT CODES (all exist in models/accounting.py DEFAULT_ACCOUNTS)
# ══════════════════════════════════════════════════════════════
ACC = {
    "loans_ar":       "134",   # سلف الموظفين
    "custody_ar":     "1342",  # عهد عينية لدى الموظفين
    "commission_exp": "3421",  # عمولات مندوبي المبيعات
    "commission_pay": "2201",  # عمولات مبيعات مستحقة
    "salaries_exp":   "331",   # رواتب وأجور
    "gratuity_prov":  "223",   # مخصص مكافأة نهاية الخدمة
    "lost_custody":   "3365",  # خسائر عهد ومفقودات
    "bank":           "162",
    "cash":           "161",
}
PAY_ACCOUNTS = {"bank": "162", "cash": "161"}
# where a custody item comes from / returns to: inventory or fixed assets
CUSTODY_SOURCES = {"124", "122", "121", "113", "114", "115", "116"}


def _pay_code(source: str) -> str:
    if source not in PAY_ACCOUNTS:
        raise HTTPException(400, "طريقة الصرف: bank (البنك) أو cash (الخزينة)")
    return PAY_ACCOUNTS[source]


def _month(m: str, label="الشهر") -> str:
    try:
        y, mm = map(int, str(m).split("-")[:2])
        if not 1 <= mm <= 12:
            raise ValueError
        return f"{y}-{mm:02d}"
    except Exception:
        raise HTTPException(400, f"{label} غير صحيح — استخدم الصيغة YYYY-MM")


def _lines_view(lines: list) -> list:
    return [{k: l[k] for k in ("account_code", "account_name", "debit", "credit", "description")} for l in lines]


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
    صرف سلفة لموظف:  مدين 134 سلف الموظفين / دائن 162 البنك أو 161 الخزينة
    الأقساط تُخصم تلقائياً في كشف الرواتب (رواتب الشهر بتقرأ نفس السلفة).
    """
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, req.employee_id)
    loan_id = str(uuid.uuid4())

    amount = round(req.loan_amount, 2)
    inst = round(req.monthly_payment, 2)
    if inst <= 0 or amount <= 0:
        raise HTTPException(400, "مبلغ السلفة والقسط يجب أن يكونا موجبَين")
    if inst > amount:
        raise HTTPException(400, "القسط أكبر من مبلغ السلفة")
    start_month = _month(req.start_month, "شهر بداية الخصم")
    grant_date = _iso(req.grant_date, "تاريخ الصرف").isoformat()
    pay_acc = _pay_code(req.payment_source)

    lines = [
        await je_line(company_id, ACC["loans_ar"], debit=amount,
                      desc=f"سلفة {emp.get('name','')} — {req.reason}"),
        await je_line(company_id, pay_acc, credit=amount,
                      desc=f"صرف سلفة — {emp.get('name','')}"),
    ]
    je_id = await _post_entry(company_id, current_user["user_id"], grant_date,
                             f"صرف سلفة — {emp.get('name','')} — {amount:,.2f} ج.م", lines, loan_id)

    schedule = []
    remaining = amount
    y, m = map(int, start_month.split("-"))
    while remaining > 0.01:
        installment = round(min(inst, remaining), 2)
        schedule.append({"month": f"{y}-{m:02d}", "amount": installment,
                         "paid": False, "paid_date": None, "je_id": None})
        remaining = round(remaining - installment, 2)
        m += 1
        if m > 12: y += 1; m = 1

    count = await db.employee_loans.count_documents({"company_id": company_id})
    loan = {
        "id": loan_id, "company_id": company_id,
        "employee_id": req.employee_id,
        "employee_name": emp.get("name", ""),
        # Payroll (api/payroll.py) reads the same collection: it deducts
        # `installment_amount` for loans that are active from start_month. This
        # engine wrote `monthly_payment` only, so payroll deducted 0 for its
        # loans; the payroll-shaped fields are written too now.
        "loan_number": f"LOAN-HR-{date.today().year}-{count + 1:05d}",
        "loan_date": grant_date,
        "amount": amount,
        "installments": len(schedule),
        "installment_amount": inst,
        "paid_amount": 0.0,
        "loan_amount": amount,
        "monthly_payment": inst,
        "remaining_amount": amount,
        "status": "active",
        "grant_date": grant_date,
        "start_month": start_month,
        "reason": req.reason,
        "schedule": schedule,
        "grant_je_id": je_id,
        "total_months": len(schedule),
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.employee_loans.insert_one(loan); loan.pop("_id", None)

    return {
        "message":  f"تم صرف سلفة {amount:,.2f} ج.م لـ {emp.get('name','')}",
        "loan":     loan,
        "schedule_preview": schedule[:3],
        "total_months": len(schedule),
        "journal":  {"id": je_id, "lines": _lines_view(lines)},
    }


@router.post("/loans/{loan_id}/deduct")
async def deduct_loan_installment(loan_id: str, data: dict,
                                  current_user: dict = Depends(get_current_user)):
    """
    سداد قسط نقداً أو بتحويل بنكي (خارج كشف الرواتب):
    مدين 161 الخزينة / 162 البنك — دائن 134 سلف الموظفين
    """
    company_id = current_user["company_id"]
    loan = await db.employee_loans.find_one(
        {"id": loan_id, "company_id": company_id}, {"_id": 0})
    if not loan:
        raise HTTPException(404, "السلفة غير موجودة")
    remaining = _num(loan.get("remaining_amount"))
    if remaining <= 0:
        raise HTTPException(400, "السلفة مُسدَّدة بالكامل")

    method = data.get("method", "cash")
    # "payroll" posted Dr 253 / Cr 134 here while the payroll run also deducts
    # the installment and credits 134 — the same installment was taken twice.
    if method == "payroll":
        raise HTTPException(400, "القسط يُخصم تلقائياً عند اعتماد كشف الرواتب — هنا تُسجَّل السداد النقدي أو البنكي فقط")
    dr_acc = _pay_code(method if method in PAY_ACCOUNTS else "cash")

    amount = round(_num(data.get("amount")) or _num(loan.get("installment_amount") or loan.get("monthly_payment")), 2)
    if amount <= 0:
        raise HTTPException(400, "مبلغ القسط يجب أن يكون أكبر من صفر")
    amount = min(amount, remaining)
    date_str = _iso(data.get("date") or date.today().isoformat(), "التاريخ").isoformat()

    schedule = loan.get("schedule", [])
    month = data.get("month")
    slot_idx = next((i for i, s in enumerate(schedule)
                     if not s.get("paid") and (not month or s.get("month") == month)), None)
    label = month or (schedule[slot_idx]["month"] if slot_idx is not None else date_str[:7])

    lines = [
        await je_line(company_id, dr_acc, debit=amount,
                      desc=f"سداد قسط سلفة {loan.get('employee_name','')} — {label}"),
        await je_line(company_id, ACC["loans_ar"], credit=amount,
                      desc=f"تسديد قسط سلفة — {loan.get('employee_name','')} — {label}"),
    ]
    # reserve the amount first so two clicks cannot both pass the remaining check
    res = await db.employee_loans.update_one(
        {"id": loan_id, "company_id": company_id, "remaining_amount": {"$gte": amount - 0.005}},
        {"$inc": {"remaining_amount": -amount, "paid_amount": amount}})
    if res.modified_count == 0:
        raise HTTPException(400, "تغيّر رصيد السلفة — أعد التحميل")
    try:
        je_id = await _post_entry(company_id, current_user["user_id"], date_str,
                                 f"سداد قسط سلفة — {loan.get('employee_name','')} — {label}", lines, loan_id)
    except HTTPException:
        await db.employee_loans.update_one({"id": loan_id, "company_id": company_id},
                                           {"$inc": {"remaining_amount": amount, "paid_amount": -amount}})
        raise

    new_remaining = round(remaining - amount, 2)
    upd = {"remaining_amount": max(new_remaining, 0)}
    if new_remaining <= 0.005:
        upd["status"] = "paid"     # payroll's own status for a finished loan
    if slot_idx is not None:
        upd[f"schedule.{slot_idx}.paid"] = True
        upd[f"schedule.{slot_idx}.paid_date"] = date_str
        upd[f"schedule.{slot_idx}.je_id"] = je_id
    await db.employee_loans.update_one({"id": loan_id, "company_id": company_id}, {"$set": upd})

    return {
        "message":     f"تم تسجيل سداد {amount:,.2f} ج.م من سلفة {loan.get('employee_name','')}",
        "remaining":   max(new_remaining, 0),
        "status":      upd.get("status", "active"),
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
    loans = await db.employee_loans.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    total_outstanding = round(sum(_num(l.get("remaining_amount")) for l in loans
                                  if l.get("status") in ("active", "approved")), 2)
    return {"loans": loans, "total": len(loans), "total_outstanding": total_outstanding}


# ══════════════════════════════════════════════════════════════
# 2. COMMISSION ENGINE — محرك العمولات والحوافز
# ══════════════════════════════════════════════════════════════

@router.post("/commissions/calculate")
async def calculate_commissions(data: dict,
                                current_user: dict = Depends(get_current_user)):
    """
    حساب عمولات مندوبي المبيعات وإثبات استحقاقها:
    مدين 3421 عمولات مندوبي المبيعات / دائن 2201 عمولات مبيعات مستحقة

    dry_run=true يرجع الحساب والقيد بدون ترحيل (للمعاينة).
    manual_bases={employee_id: amount} يحدد وعاء العمولة يدوياً — الفواتير
    لا تحمل حقل مندوب بعد، فبدونه يكون الوعاء صفراً.
    """
    company_id = current_user["company_id"]
    period     = _month(data.get("period"), "الفترة")
    calc_basis = data.get("basis", "invoiced")
    dry_run    = bool(data.get("dry_run", False))
    manual     = data.get("manual_bases") or {}

    # Re-running the same month posted a second accrual on top of the first.
    if not dry_run and await db.commission_runs.find_one({"company_id": company_id, "period": period}):
        raise HTTPException(400, f"تم احتساب عمولات {period} وترحيلها من قبل")

    y, m = map(int, period.split("-"))
    date_from = f"{period}-01"
    next_m = date(y, m, 1) + relativedelta(months=1)
    date_to = next_m.isoformat()
    month_end = (next_m - relativedelta(days=1)).isoformat()

    rules = await db.commission_rules.find(
        {"company_id": company_id, "active": True}, {"_id": 0}).to_list(None)
    if not rules:
        return {"message": "لا توجد قواعد عمولات — عرّف قاعدة لكل مندوب أولاً",
                "total_commission": 0, "breakdown": [], "lines": []}

    results, total_all, je_lines = [], 0.0, []
    for rule in rules:
        emp_id = rule["employee_id"]
        emp = await db.employees.find_one({"id": emp_id, "company_id": company_id}, {"_id": 0})
        if not emp:          # a deleted employee used to 404 the whole run
            continue
        rate = _num(rule.get("commission_rate"))
        basis = rule.get("basis", calc_basis)
        max_cap = rule.get("max_monthly")

        if emp_id in manual:
            base = _num(manual[emp_id]); basis = "manual"
        elif basis == "invoiced":
            invoices = await db.invoices.find({
                "company_id": company_id, "document_type": "sales_invoice",
                "salesperson_id": emp_id,
                "status": {"$nin": ["cancelled", "draft"]},
                "document_date": {"$gte": date_from, "$lt": date_to},
            }, {"_id": 0, "grand_total": 1, "total_tax": 1}).to_list(None)
            # commission was paid on grand_total, i.e. on the VAT too
            base = sum(_num(i.get("grand_total")) - _num(i.get("total_tax")) for i in invoices)
        else:
            payments = await db.invoice_payments.find({
                "company_id": company_id, "salesperson_id": emp_id,
                "payment_date": {"$gte": date_from, "$lt": date_to},
            }, {"_id": 0, "amount": 1}).to_list(None)
            base = sum(_num(p.get("amount")) for p in payments)

        commission = round(base * rate, 2)
        if max_cap:
            commission = min(commission, _num(max_cap))
        if commission <= 0:
            continue
        total_all += commission
        results.append({"employee_id": emp_id, "employee_name": emp.get("name", ""),
                        "basis": basis, "base_amount": round(base, 2),
                        "rate": round(rate * 100, 2), "commission": commission})
        je_lines.append(await je_line(company_id, ACC["commission_exp"], debit=commission,
                                      desc=f"عمولة {emp.get('name','')} — {period}"))
        je_lines.append(await je_line(company_id, ACC["commission_pay"], credit=commission,
                                      desc=f"مستحق عمولة {emp.get('name','')} — {period}"))

    total_all = round(total_all, 2)
    je_id = None
    if je_lines and not dry_run:
        je_id = await _post_entry(company_id, current_user["user_id"], month_end,
                                 f"عمولات مندوبي المبيعات — {period}", je_lines)
        await db.commission_runs.insert_one({
            "id": str(uuid.uuid4()), "company_id": company_id, "period": period,
            "total": total_all, "paid": 0.0, "breakdown": results, "journal_entry_id": je_id,
            "created_by": current_user["user_id"], "created_at": datetime.now(timezone.utc).isoformat()})

    return {
        "message":        f"{'معاينة' if dry_run else 'تم احتساب'} عمولات {len(results)} مندوب لفترة {period}",
        "period":         period,
        "dry_run":        dry_run,
        "total_commission": total_all,
        "breakdown":      results,
        "lines":          _lines_view(je_lines),
        "journal_entry_id": je_id,
        "tax_note":       "العمولات تخضع لضريبة كسب العمل — أضفها لكشف الراتب الشهري",
    }


@router.get("/commissions/rules")
async def list_commission_rules(current_user: dict = Depends(get_current_user)):
    rules = await db.commission_rules.find(
        {"company_id": current_user["company_id"], "active": True}, {"_id": 0}).to_list(500)
    runs = await db.commission_runs.find(
        {"company_id": current_user["company_id"]}, {"_id": 0, "breakdown": 0}).sort("period", -1).to_list(60)
    return {"rules": rules, "runs": runs}


@router.post("/commissions/rules")
async def create_commission_rule(data: dict,
                                 current_user: dict = Depends(get_current_user)):
    """تعريف قاعدة عمولة لمندوب (النسبة كسر عشري: 0.05 = 5%)"""
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, data.get("employee_id", ""))
    rate = _num(data.get("commission_rate"))
    if not 0 < rate <= 1:
        raise HTTPException(400, "نسبة العمولة بين 0 و1 (مثال 0.05 = 5%)")
    basis = data.get("basis", "invoiced")
    if basis not in ("invoiced", "collected"):
        raise HTTPException(400, "الأساس: invoiced (المفوتر) أو collected (المحصَّل)")
    cap = data.get("max_monthly")
    cap = _num(cap) if cap not in (None, "") else None
    # a second rule for the same rep was added beside the first and both paid
    await db.commission_rules.update_many(
        {"company_id": company_id, "employee_id": emp["id"], "active": True}, {"$set": {"active": False}})
    rule = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "employee_id": emp["id"], "employee_name": emp.get("name", ""),
        "commission_rate": rate, "basis": basis, "max_monthly": cap,
        "active": True, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.commission_rules.insert_one(rule); rule.pop("_id", None)
    return {"message": f"تم تعريف قاعدة عمولة {rate*100:.1f}%", "rule": rule}


@router.post("/commissions/{period}/pay")
async def pay_commissions(period: str, data: dict,
                          current_user: dict = Depends(get_current_user)):
    """صرف العمولات المستحقة: مدين 2201 / دائن 162 البنك أو 161 الخزينة"""
    company_id = current_user["company_id"]
    period = _month(period, "الفترة")
    amount = round(_num(data.get("amount")), 2)
    date_str = _iso(data.get("date") or date.today().isoformat(), "التاريخ").isoformat()
    pay_acc = _pay_code(data.get("payment_source", "bank"))

    # any amount was accepted, for a month that was never accrued, so 2201
    # went into a debit balance
    run = await db.commission_runs.find_one({"company_id": company_id, "period": period}, {"_id": 0})
    if not run:
        raise HTTPException(400, f"لا توجد عمولات محتسبة لفترة {period}")
    due = round(_num(run.get("total")) - _num(run.get("paid")), 2)
    if amount <= 0:
        amount = due
    if amount <= 0 or amount > due + 0.005:
        raise HTTPException(400, f"المتبقي للصرف عن {period}: {due:,.2f} ج.م")

    lines = [
        await je_line(company_id, ACC["commission_pay"], debit=amount,
                      desc=f"صرف عمولات مندوبي المبيعات — {period}"),
        await je_line(company_id, pay_acc, credit=amount, desc=f"صرف عمولات — {period}"),
    ]
    je_id = await _post_entry(company_id, current_user["user_id"], date_str,
                             f"صرف عمولات — {period}", lines, run["id"])
    await db.commission_runs.update_one({"id": run["id"], "company_id": company_id},
                                        {"$inc": {"paid": amount}})
    return {"message": f"تم صرف عمولات {amount:,.2f} ج.م — {period}", "journal_entry_id": je_id}


# ══════════════════════════════════════════════════════════════
# 3. ASSET CUSTODY — تتبع العهد العينية
# ══════════════════════════════════════════════════════════════

class CustodyRequest(BaseModel):
    employee_id:  str
    asset_type:   str   # laptop | phone_line | car | sim_card | other
    asset_name:   str
    asset_code:   Optional[str] = None
    serial_number: Optional[str] = None
    value:        float = 0.0
    hand_over_date: str
    source_account: str = "124"   # من أين خرجت العهدة (مخزون / أصل ثابت)


@router.get("/custody")
async def list_custody(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    q = {"company_id": current_user["company_id"]}
    if status: q["status"] = status
    rows = await db.employee_custody.find(q, {"_id": 0}).sort("hand_over_date", -1).to_list(1000)
    return {"custody": rows, "total": len(rows)}


@router.post("/custody/assign")
async def assign_custody(req: CustodyRequest,
                         current_user: dict = Depends(get_current_user)):
    """
    تسليم عهدة عينية لموظف — إن كانت لها قيمة:
    مدين 1342 عهد عينية لدى الموظفين / دائن حساب المصدر (124 قطع غيار ومهمات افتراضياً)
    """
    company_id = current_user["company_id"]
    emp = await get_employee(company_id, req.employee_id)
    if not req.asset_name.strip():
        raise HTTPException(400, "اكتب اسم العهدة")
    if req.value < 0:
        raise HTTPException(400, "القيمة لا تكون سالبة")
    # the credit side was always 124 (spare parts) even for a laptop carried
    # as a fixed asset; the source is chosen now, from asset accounts only
    if req.source_account not in CUSTODY_SOURCES:
        raise HTTPException(400, "حساب المصدر يجب أن يكون حساب مخزون أو أصل ثابت")
    hand_over = _iso(req.hand_over_date, "تاريخ التسليم").isoformat()
    custody_id = str(uuid.uuid4())

    je_id = None
    if req.value > 0:
        value = round(req.value, 2)
        lines = [
            await je_line(company_id, ACC["custody_ar"], debit=value,
                          desc=f"عهدة {req.asset_name} — {emp.get('name','')}"),
            await je_line(company_id, req.source_account, credit=value,
                          desc=f"تحويل {req.asset_name} لعهدة {emp.get('name','')}"),
        ]
        je_id = await _post_entry(company_id, current_user["user_id"], hand_over,
                                 f"تسليم عهدة — {req.asset_name} — {emp.get('name','')}", lines, custody_id)

    custody = {
        "id": custody_id, "company_id": company_id,
        "employee_id": emp["id"], "employee_name": emp.get("name", ""),
        "asset_type": req.asset_type, "asset_name": req.asset_name.strip(),
        "asset_code": req.asset_code, "serial_number": req.serial_number,
        "value": round(req.value, 2), "source_account": req.source_account,
        "hand_over_date": hand_over, "return_date": None,
        "status": "assigned", "assign_je_id": je_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.employee_custody.insert_one(custody); custody.pop("_id", None)
    return {"message": f"تم تسليم {req.asset_name} لـ {emp.get('name','')}",
            "custody": custody, "custody_id": custody_id}


@router.put("/custody/{custody_id}/return")
async def return_custody(custody_id: str, data: dict,
                         current_user: dict = Depends(get_current_user)):
    """
    استرداد عهدة: مدين حساب المصدر / دائن 1342
    مفقودة: مدين 3365 خسائر عهد ومفقودات (أو 134 سلف الموظفين إن حُمِّلت عليه) / دائن 1342
    """
    company_id = current_user["company_id"]
    custody = await db.employee_custody.find_one(
        {"id": custody_id, "company_id": company_id}, {"_id": 0})
    if not custody:
        raise HTTPException(404, "العهدة غير موجودة")
    if custody["status"] != "assigned":
        raise HTTPException(400, "العهدة مُستردة أو مُقفلة من قبل")

    return_date = _iso(data.get("date") or date.today().isoformat(), "تاريخ الاسترداد").isoformat()
    condition = data.get("condition", "good")
    if condition not in ("good", "damaged", "lost"):
        raise HTTPException(400, "الحالة: سليمة أو تالفة أو مفقودة")
    charge_employee = bool(data.get("charge_employee", False))
    value = round(_num(custody.get("value")), 2)
    je_id = None

    if value > 0:
        if condition == "lost":
            dr = ACC["loans_ar"] if charge_employee else ACC["lost_custody"]
            dr_desc = (f"تحميل قيمة عهدة مفقودة على {custody['employee_name']}" if charge_employee
                       else f"خسارة عهدة مفقودة — {custody['asset_name']}")
        else:
            dr = custody.get("source_account") or "124"
            dr_desc = f"استرجاع عهدة — {custody['asset_name']}"
        lines = [
            await je_line(company_id, dr, debit=value, desc=dr_desc),
            await je_line(company_id, ACC["custody_ar"], credit=value,
                          desc=f"إقفال عهدة — {custody['asset_name']} — {condition}"),
        ]
        je_id = await _post_entry(company_id, current_user["user_id"], return_date,
                                 f"استرجاع عهدة — {custody['asset_name']}", lines, custody_id)
        if condition == "lost" and charge_employee:
            # a debit on 134 with no loan record is never deducted by payroll or
            # the clearance; record it as a loan so both recover it
            y, m = map(int, return_date[:7].split("-"))
            m += 1
            if m > 12: y += 1; m = 1
            count = await db.employee_loans.count_documents({"company_id": company_id})
            await db.employee_loans.insert_one({
                "id": str(uuid.uuid4()), "company_id": company_id,
                "employee_id": custody["employee_id"], "employee_name": custody.get("employee_name", ""),
                "loan_number": f"LOAN-HR-{date.today().year}-{count + 1:05d}", "loan_date": return_date,
                "amount": value, "loan_amount": value, "installments": 1, "installment_amount": value,
                "monthly_payment": value, "paid_amount": 0.0, "remaining_amount": value,
                "status": "active", "grant_date": return_date, "start_month": f"{y}-{m:02d}",
                "reason": f"قيمة عهدة مفقودة — {custody['asset_name']}", "schedule": [],
                "grant_je_id": je_id, "created_by": current_user["user_id"],
                "created_at": datetime.now(timezone.utc).isoformat()})

    await db.employee_custody.update_one(
        {"id": custody_id, "company_id": company_id},
        {"$set": {"status": "lost" if condition == "lost" else "returned",
                  "return_date": return_date, "condition": condition,
                  "charged_to_employee": charge_employee and condition == "lost",
                  "return_je_id": je_id}})
    return {"message": f"تم إقفال عهدة {custody['asset_name']}", "condition": condition,
            "journal_entry_id": je_id}


@router.get("/custody/employee/{employee_id}")
async def get_employee_custody(employee_id: str,
                               current_user: dict = Depends(get_current_user)):
    """قائمة العهد المسجلة على موظف"""
    items = await db.employee_custody.find({
        "employee_id": employee_id, "company_id": current_user["company_id"], "status": "assigned"
    }, {"_id": 0}).to_list(None)
    return {
        "employee_id": employee_id,
        "custody_items": items,
        "total_items": len(items),
        "clearance_blocked": len(items) > 0,
        "note": "يجب استرداد كل العهد قبل إصدار إخلاء الطرف" if items else "لا عهد مسجلة",
    }


# ══════════════════════════════════════════════════════════════
# 4. OFFBOARDING & SETTLEMENT — تصفية نهاية الخدمة وإخلاء الطرف
# ══════════════════════════════════════════════════════════════

async def _settlement(company_id: str, emp: dict, termination_date: str, reason: str,
                      gratuity_account: str, payment_source: str) -> dict:
    """The numbers and the entry for a clearance — shared by preview and post.

    Was: debits gratuity (223) + leave encashment (253), credits bank with
    dues − loans and 134 with the WHOLE loan balance. When the loans exceeded
    the dues the entry did not balance and the call failed with a 500 — after
    the loans had already been marked settled. Now only the part of the loans
    the dues can cover is recovered here; the rest stays on 134 as a debt.
    Leave encashment was debited to 253 (accrued wages) although nothing had
    been accrued there, leaving 253 with a debit balance; it is an expense (331)."""
    policy = await get_policy(company_id)
    eid = emp["id"]
    monthly = monthly_wage(emp)
    daily_rate = round(monthly / 30, 2)
    service_yrs = calc_service_years(emp.get("hire_date", ""), termination_date)
    g = gratuity_amount(policy, monthly, service_yrs, reason)
    gratuity = g["total"]

    year = int(termination_date[:4])
    entitlement = annual_leave_entitlement(service_yrs, _age(emp), policy)
    taken = await leave_days_taken(company_id, eid, year, "annual")
    rec = await db.leave_balances.find_one({"employee_id": eid, "company_id": company_id, "year": year})
    carried = _num(rec.get("carried_over")) if rec else 0
    leave_balance = max(entitlement + carried - taken, 0)
    leave_encash = round(leave_balance * daily_rate, 2)

    open_loans = await db.employee_loans.find({
        "employee_id": eid, "company_id": company_id,
        "status": {"$in": ["active", "approved"]}, "remaining_amount": {"$gt": 0}}, {"_id": 0}).to_list(None)
    loan_balance = round(sum(_num(l.get("remaining_amount")) for l in open_loans), 2)

    total_due = round(gratuity + leave_encash, 2)
    loan_recovered = round(min(loan_balance, total_due), 2)
    net_payable = round(total_due - loan_recovered, 2)

    rows = []   # (code, debit, credit, description)
    if gratuity > 0:
        rows.append((gratuity_account, gratuity, 0, f"مكافأة نهاية خدمة — {emp.get('name','')} ({service_yrs:.1f} سنة)"))
    if leave_encash > 0:
        rows.append((ACC["salaries_exp"], leave_encash, 0, f"مقابل رصيد إجازات — {leave_balance:g} يوم"))
    if net_payable > 0:
        rows.append((_pay_code(payment_source), 0, net_payable, f"صافي مستحقات {emp.get('name','')}"))
    if loan_recovered > 0:
        rows.append((ACC["loans_ar"], 0, loan_recovered, f"خصم رصيد سلف {emp.get('name','')} من المستحقات"))

    return {"policy_note": g["note"], "service_years": round(service_yrs, 2), "gratuity": gratuity,
            "gratuity_factor": g["factor"], "leave_encashment": leave_encash, "leave_days": leave_balance,
            "daily_rate": daily_rate, "total_due": total_due, "loan_balance": loan_balance,
            "loan_deduction": loan_recovered, "loan_remaining_after": round(loan_balance - loan_recovered, 2),
            "net_payable": net_payable, "rows": rows, "open_loans": open_loans}


@router.post("/offboarding/{employee_id}/clearance")
async def generate_clearance(employee_id: str, data: dict,
                             current_user: dict = Depends(get_current_user)):
    """
    تصفية مستحقات نهاية الخدمة وإخلاء الطرف (dry_run=true للمعاينة بدون ترحيل)

    Guard: يُمنع الإخلاء مع وجود عهد غير مستردة (force_clear للتجاوز).
    القيد: مدين 223 (أو 331) مكافأة + 331 مقابل إجازات / دائن 162 صافي + 134 السلف المستردة
    """
    company_id = current_user["company_id"]
    termination_date = _iso(data.get("termination_date") or date.today().isoformat(),
                            "تاريخ إنهاء الخدمة").isoformat()
    reason = data.get("termination_reason", "resignation")
    force_clear = bool(data.get("force_clear", False))
    dry_run = bool(data.get("dry_run", False))
    gratuity_account = str(data.get("gratuity_account") or ACC["gratuity_prov"])
    if gratuity_account not in (ACC["gratuity_prov"], ACC["salaries_exp"]):
        raise HTTPException(400, "حساب المكافأة: 223 مخصص المكافأة أو 331 رواتب وأجور")
    payment_source = data.get("payment_source", "bank")

    emp = await get_employee(company_id, employee_id)
    # a second click posted the whole settlement again
    if emp.get("status") == "terminated" or emp.get("clearance_je_id"):
        raise HTTPException(400, "تمت تصفية هذا الموظف من قبل")

    pending_custody = await db.employee_custody.find(
        {"employee_id": employee_id, "company_id": company_id, "status": "assigned"}, {"_id": 0}).to_list(None)
    if pending_custody and not force_clear:
        return {
            "clearance_blocked": True,
            "reason": "يجب استرداد العهد المسجلة قبل إخلاء الطرف",
            "pending_custody": [{"id": c["id"], "asset": c["asset_name"], "since": c["hand_over_date"]}
                                for c in pending_custody],
        }

    s = await _settlement(company_id, emp, termination_date, reason, gratuity_account, payment_source)
    lines = [await je_line(company_id, code, debit=dr, credit=cr, desc=desc) for code, dr, cr, desc in s["rows"]]
    td = round(sum(l["debit"] for l in lines), 2)
    tc = round(sum(l["credit"] for l in lines), 2)
    settlement = {k: s[k] for k in ("gratuity", "gratuity_factor", "leave_encashment", "leave_days", "daily_rate",
                                    "total_due", "loan_balance", "loan_deduction", "loan_remaining_after",
                                    "net_payable")}
    out = {"employee": emp.get("name", ""), "service_years": s["service_years"],
           "termination_date": termination_date, "clearance_blocked": False,
           "settlement": settlement, "note": s["policy_note"], "lines": _lines_view(lines),
           "journal": {"debit": td, "credit": tc, "balanced": abs(td - tc) < 0.01},
           "pending_custody_count": len(pending_custody)}
    if dry_run:
        return {**out, "dry_run": True}

    je_id = None
    if lines and td > 0:
        je_id = await _post_entry(company_id, current_user["user_id"], termination_date,
                                 f"تصفية نهاية خدمة — {emp.get('name','')} — {termination_date}",
                                 lines, employee_id)

    # loans: reduce by what was recovered, oldest first — only after posting
    left = s["loan_deduction"]
    for loan in sorted(s["open_loans"], key=lambda l: l.get("created_at", "")):
        if left <= 0:
            break
        take = round(min(left, _num(loan.get("remaining_amount"))), 2)
        rem = round(_num(loan.get("remaining_amount")) - take, 2)
        await db.employee_loans.update_one(
            {"id": loan["id"], "company_id": company_id},
            {"$set": {"remaining_amount": rem, "status": "paid" if rem <= 0.005 else loan.get("status", "active"),
                      "settled_in_clearance": je_id},
             "$inc": {"paid_amount": take}})
        left = round(left - take, 2)

    await db.employees.update_one(
        {"id": employee_id, "company_id": company_id},
        {"$set": {"status": "terminated", "is_active": False, "termination_date": termination_date,
                  "termination_reason": reason, "clearance_je_id": je_id}})

    return {**out, "message": f"تم إخلاء طرف {emp.get('name','')}", "journal_entry_id": je_id,
            "status": "terminated",
            "warning": (f"يتبقى على الموظف {s['loan_remaining_after']:,.2f} ج.م سلف لم تغطها المستحقات"
                        if s["loan_remaining_after"] > 0 else None)}


@router.get("/offboarding/{employee_id}/preview")
async def preview_clearance(employee_id: str, termination_date: str = None,
                            termination_reason: str = "resignation",
                            current_user: dict = Depends(get_current_user)):
    """معاينة حساب التصفية بدون ترحيل (نفس حساب الإخلاء الفعلي)"""
    company_id = current_user["company_id"]
    term_date = _iso(termination_date or date.today().isoformat(), "تاريخ إنهاء الخدمة").isoformat()
    emp = await get_employee(company_id, employee_id)
    s = await _settlement(company_id, emp, term_date, termination_reason, ACC["gratuity_prov"], "bank")
    custody = await db.employee_custody.count_documents(
        {"employee_id": employee_id, "company_id": company_id, "status": "assigned"})
    return {
        "employee": emp.get("name", ""),
        "service_years": s["service_years"],
        # the preview ignored the resignation factor and the leave taken,
        # so it never matched what the clearance then posted
        "preview": {"gratuity_estimate": s["gratuity"], "leave_encashment_estimate": s["leave_encashment"],
                    "loan_deduction": s["loan_deduction"], "net_estimate": s["net_payable"]},
        "custody_count": custody,
        "clearance_blocked": custody > 0,
    }
