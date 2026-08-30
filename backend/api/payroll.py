"""
Payroll API with Accounting Integration
واجهة الرواتب المتكاملة مع المحاسبة
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Response
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
import uuid

from services.audit_helper import log_financial_action

from database import db
from api.users import get_current_user
from models.payroll import (
    PayrollRun, EmployeePayroll, PayrollAllowance, PayrollDeduction,
    PayrollSettings, EmployeeLoan, EndOfService,
    PayrollStatus, AllowanceType, DeductionType, LoanStatus, EndOfServiceStatus
)
from models.hr_settings import (
    CompanyHRSettings, LateDeductionMethod, AbsenceDeductionMethod, 
    OvertimeCalculationMethod, AttendancePayrollSummary
)
from models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
import logging
logger = logging.getLogger(__name__)
from services.accounting_service import AccountingService
from services.email_service import send_bulk_payslip_notifications, send_payroll_approved_notification

router = APIRouter(prefix="/api/payroll", tags=["Payroll"])


# ==========================================
# Request Models
# ==========================================

class LoanRequest(BaseModel):
    employee_id: str
    amount: float
    installments: int
    start_month: str
    reason: Optional[str] = None


class PayrollRunRequest(BaseModel):
    month: str  # YYYY-MM


class PayrollAdjustmentRequest(BaseModel):
    employee_id: str
    allowances: Optional[List[dict]] = []
    deductions: Optional[List[dict]] = []


class EndOfServiceRequest(BaseModel):
    employee_id: str
    end_date: str
    termination_reason: Optional[str] = None
    other_entitlements: float = 0.0
    other_deductions: float = 0.0


# ==========================================
# Helper Functions
# ==========================================

async def generate_number(company_id: str, prefix: str, collection: str) -> str:
    """توليد رقم تسلسلي"""
    year = datetime.now().year
    count = await db[collection].count_documents({
        "company_id": company_id,
        f"{prefix.lower()}_number": {"$regex": f"^{prefix}-{year}"}
    })
    return f"{prefix}-{year}-{str(count + 1).zfill(5)}"


async def get_payroll_settings(company_id: str) -> dict:
    """الحصول على إعدادات الرواتب"""
    settings = await db.payroll_settings.find_one({"company_id": company_id})
    if not settings:
        # إنشاء إعدادات افتراضية
        default_settings = PayrollSettings(company_id=company_id)
        await db.payroll_settings.insert_one(default_settings.dict())
        settings = default_settings.dict()
    return settings


async def calculate_social_insurance(basic_salary: float, settings: dict) -> tuple:
    """حساب التأمينات الاجتماعية"""
    insurable_salary = min(
        max(basic_salary, settings.get("social_insurance_min_wage", 1400)),
        settings.get("social_insurance_max_wage", 12600)
    )
    
    employee_share = insurable_salary * (settings.get("employee_social_insurance_rate", 11) / 100)
    company_share = insurable_salary * (settings.get("company_social_insurance_rate", 18.75) / 100)
    
    return round(employee_share, 2), round(company_share, 2)


async def calculate_income_tax(annual_taxable_income: float, settings: dict,
                               company_id: str = None, tax_year: int = None) -> float:
    """
    حساب ضريبة كسب العمل — قانون 91/2005 وتعديلاته
    
    الأولوية في قراءة الشرائح:
    1. DB collection: payroll_tax_brackets (قابل للتعديل بدون كود)
    2. settings["income_tax_brackets"] (إعدادات الشركة)
    3. DEFAULT_TAX_BRACKETS_2024 (الافتراضي)
    
    الحساب: tax = annual_income × rate - bracket_discount
    (O(1) بعد إيجاد الشريحة الصحيحة)
    """
    if tax_year is None:
        tax_year = settings.get("tax_year", 2024)
    
    # ── 1. الإعفاء الشخصي (21,000 ج.م بعد تعديل 2023) ──────────
    personal_exemption = settings.get("personal_exemption", 21000)
    taxable = annual_taxable_income - personal_exemption
    if taxable <= 0:
        return 0.0
    
    # ── 2. جلب الشرائح من DB أولاً ──────────────────────────────
    db_brackets = None
    if company_id:
        try:
            db_brackets = await db.payroll_tax_brackets.find(
                {"tax_year": tax_year, "is_active": True,
                 "$or": [{"company_id": company_id}, {"company_id": None}]},
                {"_id": 0}
            ).sort("bracket_order", 1).to_list(length=10)
        except Exception:
            db_brackets = None
    
    if not db_brackets:
        # ── 3. Fallback: settings → DEFAULT ──────────────────────
        settings_brackets = settings.get("income_tax_brackets")
        if settings_brackets:
            db_brackets = [{"range_min": b.get("from", 0),
                            "range_max": b.get("to"),
                            "rate":      b.get("rate", 0) / 100,  # convert % to decimal
                            "bracket_discount": 0}
                           for b in settings_brackets]
        else:
            from models.enterprise_accounting import DEFAULT_TAX_BRACKETS_2024
            db_brackets = [b.dict() for b in DEFAULT_TAX_BRACKETS_2024]
    
    # ── 4. Seed DB if empty (first run) ──────────────────────────
    if company_id and not await db.payroll_tax_brackets.count_documents(
            {"tax_year": tax_year, "company_id": None}):
        from models.enterprise_accounting import DEFAULT_TAX_BRACKETS_2024
        import uuid as _uuid
        for b in DEFAULT_TAX_BRACKETS_2024:
            d = b.dict(); d["id"] = str(_uuid.uuid4())
            await db.payroll_tax_brackets.insert_one(d)
    
    # ── 5. Find the correct bracket and compute tax ───────────────
    annual_tax = 0.0
    remaining  = taxable
    
    for b in db_brackets:
        b_min  = float(b.get("range_min", 0))
        b_max  = b.get("range_max")
        b_max  = float(b_max) if b_max is not None else float("inf")
        rate   = float(b.get("rate", 0))  # already decimal (0.025 not 2.5)
        disc   = float(b.get("bracket_discount", 0))
        
        if taxable < b_min:
            break  # income below this bracket
        
        if b_max == float("inf") or taxable <= b_max:
            # ── O(1) calculation using bracket_discount ──────────
            if disc > 0:
                annual_tax = taxable * rate - disc
            else:
                # Standard iterative for zero-discount brackets
                bracket_amt = min(remaining, b_max - b_min)
                annual_tax += bracket_amt * rate
                remaining  -= bracket_amt
            break
        else:
            bracket_amt = b_max - b_min
            annual_tax += bracket_amt * rate
            remaining  -= bracket_amt
    
    monthly_tax = max(annual_tax, 0) / 12
    return round(monthly_tax, 2)


async def get_employee_loans(employee_id: str, month: str) -> List[dict]:
    """الحصول على أقساط السُلف المستحقة"""
    loans = await db.employee_loans.find({
        "employee_id": employee_id,
        "status": {"$in": ["approved", "active"]},
        "start_month": {"$lte": month},
        "remaining_amount": {"$gt": 0}
    }).to_list(length=None)
    
    return [{
        "loan_id": loan["id"],
        "loan_number": loan.get("loan_number"),
        "installment_amount": loan.get("installment_amount", 0),
        "remaining_amount": loan.get("remaining_amount", 0)
    } for loan in loans]


async def get_hr_settings(company_id: str) -> dict:
    """الحصول على إعدادات الموارد البشرية"""
    settings = await db.company_hr_settings.find_one({"company_id": company_id}, {"_id": 0})
    if not settings:
        # إنشاء إعدادات افتراضية
        default_settings = CompanyHRSettings(company_id=company_id)
        await db.company_hr_settings.insert_one(default_settings.dict())
        settings = default_settings.dict()
    return settings


async def calculate_attendance_for_payroll(
    employee_id: str, 
    month: str, 
    basic_salary: float,
    hr_settings: dict
) -> AttendancePayrollSummary:
    """
    حساب تأثير الحضور على الراتب
    يجمع بيانات الحضور للشهر ويحسب الخصومات والمكافآت
    """
    year, mon = map(int, month.split("-"))
    start_date = f"{month}-01"
    if mon == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{mon + 1:02d}-01"
    
    # جلب سجلات الحضور
    records = await db.attendance_records.find({
        "employee_id": employee_id,
        "date": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).to_list(length=None)
    
    summary = AttendancePayrollSummary(
        employee_id=employee_id,
        month=month
    )
    
    # حساب المعدلات
    daily_rate = basic_salary / hr_settings.get("standard_working_days_per_month", 22)
    hourly_rate = daily_rate / hr_settings.get("standard_working_hours_per_day", 8)
    minute_rate = hourly_rate / 60
    
    for record in records:
        summary.working_days += 1
        status = record.get("status", "present")
        
        if status in ["present", "late", "early_leave"]:
            summary.present_days += 1
        elif status == "absent":
            if record.get("is_excused"):
                summary.excused_absent_days += 1
            else:
                summary.absent_days += 1
        
        if status == "late":
            summary.late_days += 1
        
        # تجميع دقائق التأخير
        late_minutes = record.get("late_minutes", 0)
        grace_period = hr_settings.get("grace_period_minutes", 15)
        if late_minutes > grace_period:
            summary.total_late_minutes += (late_minutes - grace_period)
        
        # تجميع ساعات الأوفرتايم
        summary.total_overtime_hours += record.get("overtime_hours", 0) or record.get("regular_overtime", 0)
        summary.holiday_overtime_hours += record.get("holiday_overtime", 0)
        summary.night_overtime_hours += record.get("night_overtime", 0)
    
    # ==========================================
    # حساب خصم التأخير
    # ==========================================
    if hr_settings.get("late_deduction_enabled", True) and summary.total_late_minutes > 0:
        method = hr_settings.get("late_deduction_method", "per_minute")
        
        if method == "per_minute":
            # خصم لكل دقيقة
            rate = hr_settings.get("late_deduction_per_minute_rate", 1.0)
            summary.late_deduction_amount = round(summary.total_late_minutes * minute_rate * rate, 2)
        
        elif method == "per_hour":
            # خصم بالساعة فقط (تجاهل أقل من ساعة)
            late_hours = summary.total_late_minutes // 60
            rate = hr_settings.get("late_deduction_per_hour_rate", 1.0)
            summary.late_deduction_amount = round(late_hours * hourly_rate * rate, 2)
        
        elif method == "brackets":
            # شرائح التأخير
            brackets = hr_settings.get("late_brackets", [])
            total_deduction_minutes = 0
            for bracket in brackets:
                if summary.total_late_minutes >= bracket.get("from_minutes", 0):
                    if summary.total_late_minutes <= bracket.get("to_minutes", 999999):
                        total_deduction_minutes = bracket.get("deduction_minutes", 0)
                        break
            summary.late_deduction_amount = round(total_deduction_minutes * minute_rate, 2)
    
    # ==========================================
    # حساب خصم الغياب
    # ==========================================
    if hr_settings.get("absence_deduction_enabled", True):
        method = hr_settings.get("absence_deduction_method", "full_day")
        
        # الغياب بدون عذر
        unexcused_absence = summary.absent_days
        
        # إذا كان الغياب المعذور يخصم أيضاً
        if hr_settings.get("excused_absence_deduction", False):
            unexcused_absence += summary.excused_absent_days
        
        if unexcused_absence > 0:
            if method == "full_day":
                # خصم يوم كامل لكل يوم غياب
                days_multiplier = hr_settings.get("absence_deduction_days", 1.0)
                summary.absence_deduction_amount = round(unexcused_absence * daily_rate * days_multiplier, 2)
            
            elif method == "day_plus_penalty":
                # يوم + جزاء
                days_multiplier = hr_settings.get("absence_deduction_days", 1.0)
                penalty_pct = hr_settings.get("absence_penalty_percentage", 0) / 100
                base_deduction = unexcused_absence * daily_rate * days_multiplier
                penalty = base_deduction * penalty_pct
                summary.absence_deduction_amount = round(base_deduction + penalty, 2)
    
    # ==========================================
    # حساب مكافأة الأوفرتايم
    # ==========================================
    if hr_settings.get("overtime_enabled", True):
        method = hr_settings.get("overtime_calculation_method", "hourly")
        
        if method == "hourly" or method == "daily":
            # حساب الأوفرتايم العادي
            ot_rate = hr_settings.get("overtime_rate", 1.5)
            regular_ot_amount = summary.total_overtime_hours * hourly_rate * ot_rate
            
            # حساب أوفرتايم العطلات
            holiday_ot_rate = hr_settings.get("overtime_holiday_rate", 2.0)
            holiday_ot_amount = summary.holiday_overtime_hours * hourly_rate * holiday_ot_rate
            
            # حساب الأوفرتايم الليلي
            night_ot_rate = hr_settings.get("overtime_night_rate", 1.25)
            night_ot_amount = summary.night_overtime_hours * hourly_rate * night_ot_rate
            
            summary.overtime_bonus_amount = round(regular_ot_amount + holiday_ot_amount + night_ot_amount, 2)
    
    # ==========================================
    # صافي التعديلات
    # ==========================================
    summary.net_attendance_adjustment = round(
        summary.overtime_bonus_amount - summary.late_deduction_amount - summary.absence_deduction_amount, 
        2
    )
    
    return summary


async def create_payroll_journal_entry(payroll: dict, settings: dict, user_id: str) -> str:
    """إنشاء القيد المحاسبي للرواتب"""
    service = AccountingService(db)
    company_id = payroll["company_id"]
    
    # الحصول على الحسابات - بناء قاموس شامل
    accounts = await service.get_all_accounts(company_id, True)
    accounts_by_code = {acc["account_code"]: acc for acc in accounts}
    accounts_by_id = {acc["id"]: acc for acc in accounts}
    
    # دالة مساعدة للحصول على بيانات الحساب
    def get_account_info(setting_value, default_code):
        """الحصول على معلومات الحساب من الإعدادات أو الكود الافتراضي"""
        if setting_value and setting_value in accounts_by_id:
            acc = accounts_by_id[setting_value]
            return acc["id"], acc["account_code"], acc.get("account_name") or acc.get("name", "")
        elif default_code in accounts_by_code:
            acc = accounts_by_code[default_code]
            return acc["id"], acc["account_code"], acc.get("account_name") or acc.get("name", "")
        return None, default_code, f"حساب {default_code}"
    
    # الحصول على الحسابات المطلوبة مع معلوماتها الكاملة
    # تم تحديث الأكواد الافتراضية لتتوافق مع دليل الحسابات المصري
    # الأكواد تتوافق مع دليل الحسابات المصري — قانون 148/2019 و91/2005
    sal_id,    sal_code,    sal_name    = get_account_info(settings.get("salaries_expense_account"),         "331")  # رواتب وأجور إدارية
    allow_id,  allow_code,  allow_name  = get_account_info(settings.get("allowances_expense_account"),       "331")  # بدلات (نفس حساب الرواتب)
    si_exp_id, si_exp_code, si_exp_name = get_account_info(settings.get("social_insurance_expense_account"),"331")  # تأمينات حصة الشركة 18.75%
    si_pay_id, si_pay_code, si_pay_name = get_account_info(settings.get("social_insurance_payable_account"),"255")  # التأمينات الاجتماعية المستحقة
    tax_id,    tax_code,    tax_name    = get_account_info(settings.get("income_tax_payable_account"),       "254")  # ضريبة كسب العمل
    sal_pay_id,sal_pay_code,sal_pay_name= get_account_info(settings.get("salaries_payable_account"),        "253")  # صافي الرواتب المستحقة
    loan_id,   loan_code,   loan_name   = get_account_info(settings.get("loans_receivable_account"),        "134")  # سلف الموظفين
    # صناديق إجبارية — قانون 148/2019
    emg_exp_id,emg_exp_code,emg_exp_name= get_account_info(None, "339")  # مصروف صندوق الطوارئ 1%
    emg_pay_id,emg_pay_code,emg_pay_name= get_account_info(None, "258")  # صندوق الطوارئ مستحق
    mrt_pay_id,mrt_pay_code,mrt_pay_name= get_account_info(None, "259")  # صندوق الشهداء 0.05% مستحق
    uhi_exp_id,uhi_exp_code,uhi_exp_name= get_account_info(None, "340")  # مصروف التأمين الصحي الشامل 0.25%
    uhi_pay_id,uhi_pay_code,uhi_pay_name= get_account_info(None, "262")  # التأمين الصحي الشامل مستحق
    
    lines = []
    
    # مدين: مصروف الرواتب الأساسية
    if payroll["total_basic_salary"] > 0 and sal_id:
        lines.append(JournalEntryLine(
            account_id=sal_id,
            account_code=sal_code,
            account_name=sal_name,
            debit=payroll["total_basic_salary"],
            credit=0,
            description="الرواتب الأساسية"
        ))
    
    # مدين: مصروف البدلات
    if payroll["total_allowances"] > 0 and allow_id:
        lines.append(JournalEntryLine(
            account_id=allow_id,
            account_code=allow_code,
            account_name=allow_name,
            debit=payroll["total_allowances"],
            credit=0,
            description="البدلات"
        ))
    
    # مدين: تأمينات حصة الشركة 18.75% (قانون 148/2019)
    company_si = payroll["total_basic_salary"] * (settings.get("company_social_insurance_rate", 18.75) / 100)
    if company_si > 0 and si_exp_id:
        lines.append(JournalEntryLine(
            account_id=si_exp_id, account_code=si_exp_code, account_name=si_exp_name,
            debit=round(company_si, 2), credit=0,
            description="تأمينات اجتماعية — حصة الشركة 18.75%"
        ))

    # مدين: مصروف صندوق إعانة الطوارئ 1% من أجر الاشتراك الأساسي
    emergency_basic = payroll["total_basic_salary"]  # أجر الاشتراك الأساسي
    emg_amount = round(emergency_basic * 0.01, 2)
    if emg_amount > 0 and emg_exp_id:
        lines.append(JournalEntryLine(
            account_id=emg_exp_id, account_code=emg_exp_code, account_name=emg_exp_name,
            debit=emg_amount, credit=0,
            description="صندوق إعانة الطوارئ للعمال — 1%"
        ))

    # مدين: مصروف التأمين الصحي الشامل — حصة الشركة 0.25% من إجمالي الإيرادات
    # يُحسب تقريباً على إجمالي الأجر الشامل
    gross_payroll = payroll.get("total_gross_salary", payroll["total_basic_salary"])
    uhi_amount = round(gross_payroll * 0.0025, 2)
    if uhi_amount > 0 and uhi_exp_id:
        lines.append(JournalEntryLine(
            account_id=uhi_exp_id, account_code=uhi_exp_code, account_name=uhi_exp_name,
            debit=uhi_amount, credit=0,
            description="التأمين الصحي الشامل — حصة الشركة 0.25%"
        ))

    # دائن: التأمينات الاجتماعية مستحقة (حصة الموظف + حصة الشركة)
    total_si = payroll["total_social_insurance"] + company_si
    if total_si > 0 and si_pay_id:
        lines.append(JournalEntryLine(
            account_id=si_pay_id, account_code=si_pay_code, account_name=si_pay_name,
            debit=0, credit=round(total_si, 2),
            description="التأمينات الاجتماعية مستحقة — حصة الموظف + الشركة"
        ))

    # دائن: صندوق إعانة الطوارئ مستحق
    if emg_amount > 0 and emg_pay_id:
        lines.append(JournalEntryLine(
            account_id=emg_pay_id, account_code=emg_pay_code, account_name=emg_pay_name,
            debit=0, credit=emg_amount,
            description="صندوق إعانة الطوارئ مستحق"
        ))

    # مدين + دائن: صندوق تكريم الشهداء والمفقودين 0.05% — قانون 148/2019
    martyrs_amount = round(emergency_basic * 0.0005, 2)
    mrt_exp_id, mrt_exp_code, mrt_exp_name = get_account_info(None, "338")  # مصروف صندوق الشهداء
    if martyrs_amount > 0:
        # مدين: مصروف صندوق تكريم الشهداء
        if mrt_exp_id:
            lines.append(JournalEntryLine(
                account_id=mrt_exp_id, account_code=mrt_exp_code, account_name=mrt_exp_name,
                debit=martyrs_amount, credit=0,
                description="مصروف صندوق تكريم الشهداء والمفقودين — 0.05%"
            ))
        # دائن: صندوق تكريم الشهداء مستحق
        if mrt_pay_id:
            lines.append(JournalEntryLine(
                account_id=mrt_pay_id, account_code=mrt_pay_code, account_name=mrt_pay_name,
                debit=0, credit=martyrs_amount,
                description="صندوق تكريم الشهداء والمفقودين مستحق — 0.05%"
            ))

    # دائن: التأمين الصحي الشامل مستحق
    if uhi_amount > 0 and uhi_pay_id:
        lines.append(JournalEntryLine(
            account_id=uhi_pay_id, account_code=uhi_pay_code, account_name=uhi_pay_name,
            debit=0, credit=uhi_amount,
            description="التأمين الصحي الشامل مستحق — 0.25%"
        ))
    
    # دائن: ضريبة كسب العمل مستحقة
    if payroll["total_income_tax"] > 0 and tax_id:
        lines.append(JournalEntryLine(
            account_id=tax_id,
            account_code=tax_code,
            account_name=tax_name,
            debit=0,
            credit=payroll["total_income_tax"],
            description="ضريبة كسب العمل مستحقة"
        ))
    
    # دائن: سُلف (تخفيض رصيد السُلف)
    if payroll["total_loans"] > 0 and loan_id:
        lines.append(JournalEntryLine(
            account_id=loan_id,
            account_code=loan_code,
            account_name=loan_name,
            debit=0,
            credit=payroll["total_loans"],
            description="خصم أقساط سُلف"
        ))
    
    # دائن: صافي الرواتب المستحقة
    if sal_pay_id:
        lines.append(JournalEntryLine(
            account_id=sal_pay_id,
            account_code=sal_pay_code,
            account_name=sal_pay_name,
            debit=0,
            credit=payroll["total_net_salary"],
            description="صافي الرواتب المستحقة"
        ))
    
    # ══ التحقق من توازن القيد (مدين = دائن) ══════════════
    total_debit  = round(sum(l.debit  for l in lines), 2)
    total_credit = round(sum(l.credit for l in lines), 2)
    diff = abs(total_debit - total_credit)
    if diff > 0.01:  # tolerance 1 qirsh for rounding
        # Log the imbalance for debugging
        import logging
        logging.warning(
            f"Payroll journal imbalance: debit={total_debit}, credit={total_credit}, diff={diff}"
        )
        # Auto-correct with rounding adjustment to salaries payable
        if sal_pay_id and lines:
            for l in lines:
                if l.account_id == sal_pay_id:
                    l.credit = round(l.credit + (total_debit - total_credit), 2)
                    break

    # التحقق من وجود سطور في القيد
    if not lines:
        raise HTTPException(status_code=400, detail="لا يمكن إنشاء قيد محاسبي - الحسابات غير متوفرة")
    
    # إنشاء القيد - entry_number سيتم توليده تلقائياً بواسطة AccountingService
    entry = JournalEntry(
        company_id=company_id,
        entry_number=0,  # سيتم استبداله برقم تسلسلي من AccountingService
        entry_date=datetime.now().strftime("%Y-%m-%d"),
        reference=payroll["payroll_number"],
        description=f"قيد رواتب شهر {payroll['month']}",
        lines=[line.dict() for line in lines],
        source_type="payroll",
        source_id=payroll["id"],
        created_by=user_id
    )
    
    result = await service.create_journal_entry(entry)
    return result.get("id"), result.get("entry_number")


# ==========================================
# Settings Endpoints
# ==========================================

@router.get("/settings")
async def get_settings(current_user: dict = Depends(get_current_user)):
    """الحصول على إعدادات الرواتب"""
    settings = await get_payroll_settings(current_user["company_id"])
    settings.pop("_id", None)
    
    # Convert float('inf') to a large number for JSON serialization
    if "income_tax_brackets" in settings:
        for bracket in settings["income_tax_brackets"]:
            if bracket.get("to") == float('inf') or (isinstance(bracket.get("to"), float) and bracket.get("to") > 1e308):
                bracket["to"] = 999999999
    
    return settings


@router.put("/settings")
async def update_settings(
    settings: dict,
    current_user: dict = Depends(get_current_user)
):
    """تحديث إعدادات الرواتب"""
    settings["updated_at"] = datetime.utcnow()
    
    await db.payroll_settings.update_one(
        {"company_id": current_user["company_id"]},
        {"$set": settings},
        upsert=True
    )
    
    return {"message": "تم تحديث الإعدادات بنجاح"}


# ==========================================
# Loans Endpoints (السُلف)
# ==========================================

@router.get("/loans")
async def get_loans(
    employee_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على السُلف"""
    query = {"company_id": current_user["company_id"]}
    if employee_id:
        query["employee_id"] = employee_id
    if status:
        query["status"] = status
    
    loans = await db.employee_loans.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(length=None)
    
    return {"loans": loans}


@router.post("/loans")
async def create_loan(
    request: LoanRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء سُلفة جديدة"""
    company_id = current_user["company_id"]
    
    # الحصول على بيانات الموظف
    employee = await db.employees.find_one({"id": request.employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    # حساب القسط
    installment = round(request.amount / request.installments, 2)
    
    loan_number = await generate_number(company_id, "LOAN", "employee_loans")
    
    loan = EmployeeLoan(
        company_id=company_id,
        employee_id=request.employee_id,
        employee_name=employee.get("name"),
        loan_number=loan_number,
        loan_date=datetime.now().strftime("%Y-%m-%d"),
        amount=request.amount,
        installments=request.installments,
        installment_amount=installment,
        remaining_amount=request.amount,
        start_month=request.start_month,
        reason=request.reason
    )
    
    await db.employee_loans.insert_one(loan.dict())
    
    return {"message": "تم إنشاء السُلفة بنجاح", "loan": loan.dict()}


@router.post("/loans/{loan_id}/approve")
async def approve_loan(
    loan_id: str,
    current_user: dict = Depends(get_current_user)
):
    """اعتماد السُلفة"""
    loan = await db.employee_loans.find_one({
        "id": loan_id,
        "company_id": current_user["company_id"]
    })
    
    if not loan:
        raise HTTPException(status_code=404, detail="السُلفة غير موجودة")
    
    if loan["status"] != "pending":
        raise HTTPException(status_code=400, detail="لا يمكن اعتماد هذه السُلفة")
    
    # إنشاء قيد محاسبي للسُلفة
    settings = await get_payroll_settings(current_user["company_id"])
    service = AccountingService(db)
    
    # الحصول على الحسابات مع معلوماتها الكاملة
    accounts = await service.get_all_accounts(current_user["company_id"], True)
    accounts_by_code = {acc["account_code"]: acc for acc in accounts}
    
    def get_acc(setting_val, default_code):
        if setting_val:
            for acc in accounts:
                if acc["id"] == setting_val:
                    return acc["id"], acc["account_code"], acc.get("account_name") or acc.get("name", "")
        if default_code in accounts_by_code:
            acc = accounts_by_code[default_code]
            return acc["id"], acc["account_code"], acc.get("account_name") or acc.get("name", "")
        return None, default_code, f"حساب {default_code}"
    
    loan_id_acc, loan_code, loan_name = get_acc(settings.get("loans_receivable_account"), "134")  # سلف الموظفين
    bank_id, bank_code, bank_name = get_acc(settings.get("bank_account"), "162")  # النقدية بالبنوك الجارية
    
    if not loan_id_acc or not bank_id:
        raise HTTPException(status_code=400, detail="الحسابات المحاسبية غير متوفرة")
    
    entry = JournalEntry(
        company_id=current_user["company_id"],
        entry_number=0,  # سيتم استبداله برقم تسلسلي من AccountingService
        entry_date=datetime.now().strftime("%Y-%m-%d"),
        reference=loan["loan_number"],
        description=f"سُلفة للموظف {loan['employee_name']}",
        lines=[
            JournalEntryLine(
                account_id=loan_id_acc,
                account_code=loan_code,
                account_name=loan_name,
                debit=loan["amount"],
                credit=0,
                description="سُلف مستحقة على الموظفين"
            ).dict(),
            JournalEntryLine(
                account_id=bank_id,
                account_code=bank_code,
                account_name=bank_name,
                debit=0,
                credit=loan["amount"],
                description="صرف من البنك"
            ).dict()
        ],
        source_type="loan",
        source_id=loan_id,
        created_by=current_user["user_id"]
    )
    
    result = await service.create_journal_entry(entry)
    
    # تحديث حالة السُلفة
    await db.employee_loans.update_one(
        {"id": loan_id},
        {"$set": {
            "status": "approved",
            "approved_by": current_user["user_id"],
            "approved_at": datetime.utcnow()
        }}
    )
    
    return {"message": "تم اعتماد السُلفة بنجاح", "journal_entry": result.get("entry_number")}


# ==========================================
# Payroll Run Endpoints (مسير الرواتب)
# ==========================================

@router.get("/runs")
async def get_payroll_runs(
    year: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على مسيرات الرواتب"""
    query = {"company_id": current_user["company_id"]}
    if year:
        query["year"] = year
    if status:
        query["status"] = status
    
    runs = await db.payroll_runs.find(query, {"_id": 0}).sort(
        "month", -1
    ).to_list(length=None)
    
    return {"payroll_runs": runs, "total": total, "page": page, "limit": limit, "pages": -(-total // limit)}


@router.get("/runs/{run_id}")
async def get_payroll_run(
    run_id: str,
    current_user: dict = Depends(get_current_user)
):
    """الحصول على تفاصيل مسير الرواتب"""
    run = await db.payroll_runs.find_one({
        "id": run_id,
        "company_id": current_user["company_id"]
    }, {"_id": 0})
    
    if not run:
        raise HTTPException(status_code=404, detail="مسير الرواتب غير موجود")
    
    return run


@router.post("/runs")
async def create_payroll_run(
    request: PayrollRunRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء مسير رواتب جديد"""
    company_id = current_user["company_id"]
    
    # التحقق من عدم وجود مسير للشهر
    existing = await db.payroll_runs.find_one({
        "company_id": company_id,
        "month": request.month
    })
    if existing:
        raise HTTPException(status_code=400, detail="يوجد مسير رواتب لهذا الشهر بالفعل")
    
    # تحليل الشهر
    year, month_num = map(int, request.month.split("-"))
    
    payroll_number = await generate_number(company_id, "PAY", "payroll_runs")
    
    payroll = PayrollRun(
        company_id=company_id,
        payroll_number=payroll_number,
        month=request.month,
        year=year,
        month_number=month_num,
        created_by=current_user["user_id"]
    )
    
    await db.payroll_runs.insert_one(payroll.dict())
    
    return {"message": "تم إنشاء مسير الرواتب بنجاح", "payroll_run": payroll.dict()}


@router.post("/runs/{run_id}/calculate")
async def calculate_payroll(
    run_id: str,
    current_user: dict = Depends(get_current_user)
):
    """حساب الرواتب مع ربط الحضور"""
    company_id = current_user["company_id"]
    
    payroll = await db.payroll_runs.find_one({
        "id": run_id,
        "company_id": company_id
    })
    
    if not payroll:
        raise HTTPException(status_code=404, detail="مسير الرواتب غير موجود")
    
    if payroll["status"] not in ["draft", "calculated"]:
        raise HTTPException(status_code=400, detail="لا يمكن حساب هذا المسير")
    
    settings = await get_payroll_settings(company_id)
    hr_settings = await get_hr_settings(company_id)
    
    # الحصول على الموظفين النشطين
    employees = await db.employees.find({
        "company_id": company_id,
        "is_active": True
    }).to_list(length=None)
    
    employee_payrolls = []
    totals = {
        "basic_salary": 0,
        "allowances": 0,
        "gross_salary": 0,
        "deductions": 0,
        "net_salary": 0,
        "social_insurance": 0,
        "income_tax": 0,
        "loans": 0,
        "other_deductions": 0,
        "late_deductions": 0,
        "absence_deductions": 0,
        "overtime_bonus": 0
    }
    
    for emp in employees:
        basic_salary = emp.get("basic_salary", 0)
        
        # ══ جلب ملف التأمين الضريبي (إن وجد) ══════════════════
        # employee_tax_insurance_profiles — قانون 148/2019 + 91/2005
        insurance_profile = await db.employee_insurance_profiles.find_one(
            {"employee_id": emp["id"], "company_id": company_id}, {"_id": 0}
        )
        # أجر الاشتراك التأميني — من الملف أو من الراتب الأساسي
        insured_salary = (
            insurance_profile.get("insured_basic_salary") or
            insurance_profile.get("insured_salary") or
            basic_salary
        ) if insurance_profile else basic_salary
        
        # البدلات المعفاة + التأمين الطبي الخاص (يُخصمان من الوعاء الضريبي)
        allowances_exempt   = float(insurance_profile.get("allowances_tax_exempt",   0)) if insurance_profile else 0.0
        medical_deduction   = float(insurance_profile.get("medical_insurance_deduction", 0)) if insurance_profile else 0.0
        pension_deduction   = float(insurance_profile.get("pension_deduction",        0)) if insurance_profile else 0.0
        bank_iban           = insurance_profile.get("bank_account_iban")               if insurance_profile else None
        
        # ==========================================
        # حساب تأثير الحضور على الراتب
        # ==========================================
        attendance_summary = await calculate_attendance_for_payroll(
            emp["id"], 
            payroll["month"], 
            basic_salary,
            hr_settings
        )
        
        # البدلات
        allowances = []
        emp_allowances = await db.allowances.find({
            "employee_id": emp["id"],
            "month": payroll["month"]
        }).to_list(length=None)
        
        total_allowances = 0
        for allow in emp_allowances:
            allowances.append(PayrollAllowance(
                allowance_type=AllowanceType.OTHER,
                name=allow.get("type"),
                amount=allow.get("amount", 0)
            ))
            total_allowances += allow.get("amount", 0)
        
        # إضافة مكافأة الأوفرتايم كبدل
        if attendance_summary.overtime_bonus_amount > 0:
            allowances.append(PayrollAllowance(
                allowance_type=AllowanceType.OTHER,
                name="مكافأة عمل إضافي",
                name_en="Overtime Bonus",
                amount=attendance_summary.overtime_bonus_amount
            ))
            total_allowances += attendance_summary.overtime_bonus_amount
            totals["overtime_bonus"] += attendance_summary.overtime_bonus_amount
        
        gross_salary = basic_salary + total_allowances
        
        # الخصومات
        deductions = []
        
        # 1. التأمينات الاجتماعية
        # قانون 148/2019: التأمين على أجر الاشتراك (وليس الراتب الأساسي مباشرة)
        # استخدام insured_salary من الملف التأميني إن وجد
        emp_si, company_si = await calculate_social_insurance(insured_salary, settings)
        if emp_si > 0:
            deductions.append(PayrollDeduction(
                deduction_type=DeductionType.SOCIAL_INSURANCE,
                name="تأمينات اجتماعية",
                name_en="Social Insurance",
                amount=emp_si
            ))
            totals["social_insurance"] += emp_si
        
        # 2. ضريبة كسب العمل
        # قانون 91/2005 م.38: الوعاء الضريبي =
        #   الأجر الشامل - التأمينات الاجتماعية
        #                 - البدلات المعفاة ضريبياً
        #                 - اشتراكات التأمين الطبي الخاص
        #                 - اشتراكات صندوق المعاشات الخاص
        annual_taxable = max(
            (gross_salary - emp_si - allowances_exempt - medical_deduction - pension_deduction) * 12,
            0
        )
        monthly_tax = await calculate_income_tax(
            annual_taxable, settings,
            company_id=company_id,
            tax_year=settings.get("tax_year", 2024)
        )
        if monthly_tax > 0:
            deductions.append(PayrollDeduction(
                deduction_type=DeductionType.INCOME_TAX,
                name="ضريبة كسب العمل",
                name_en="Income Tax",
                amount=monthly_tax
            ))
            totals["income_tax"] += monthly_tax
        
        # 3. السُلف
        loans = await get_employee_loans(emp["id"], payroll["month"])
        for loan in loans:
            deductions.append(PayrollDeduction(
                deduction_type=DeductionType.LOAN,
                name="قسط سُلفة",
                name_en="Loan Installment",
                amount=loan["installment_amount"],
                reference_id=loan["loan_id"]
            ))
            totals["loans"] += loan["installment_amount"]
        
        # 4. خصم التأخير (من الحضور)
        if attendance_summary.late_deduction_amount > 0:
            deductions.append(PayrollDeduction(
                deduction_type=DeductionType.OTHER,
                name="خصم تأخير",
                name_en="Late Deduction",
                amount=attendance_summary.late_deduction_amount
            ))
            totals["late_deductions"] += attendance_summary.late_deduction_amount
            totals["other_deductions"] += attendance_summary.late_deduction_amount
        
        # 5. خصم الغياب (من الحضور)
        if attendance_summary.absence_deduction_amount > 0:
            deductions.append(PayrollDeduction(
                deduction_type=DeductionType.OTHER,
                name="خصم غياب",
                name_en="Absence Deduction",
                amount=attendance_summary.absence_deduction_amount
            ))
            totals["absence_deductions"] += attendance_summary.absence_deduction_amount
            totals["other_deductions"] += attendance_summary.absence_deduction_amount
        
        # 6. خصومات أخرى (يدوية)
        emp_deductions = await db.deductions.find({
            "employee_id": emp["id"],
            "month": payroll["month"]
        }).to_list(length=None)
        
        for ded in emp_deductions:
            deductions.append(PayrollDeduction(
                deduction_type=DeductionType.OTHER,
                name=ded.get("type"),
                amount=ded.get("amount", 0)
            ))
            totals["other_deductions"] += ded.get("amount", 0)
        
        total_deductions = sum(d.amount for d in deductions)
        net_salary = gross_salary - total_deductions
        
        # تجميع بيانات الموظف مع بيانات الحضور
        emp_payroll_data = {
            "employee_id": emp["id"],
            "employee_name": emp.get("name"),
            "department": emp.get("department"),
            "position": emp.get("position"),
            "basic_salary": basic_salary,
            "allowances": [a.dict() for a in allowances],
            "total_allowances": total_allowances,
            "deductions": [d.dict() for d in deductions],
            "total_deductions": total_deductions,
            "gross_salary": gross_salary,
        "insured_salary": insured_salary,          # أجر الاشتراك التأميني
        "allowances_exempt": allowances_exempt,     # بدلات معفاة ضريبياً
        "medical_deduction": medical_deduction,    # تأمين طبي خاص
        "bank_iban": bank_iban,                    # IBAN للصرف
            "net_salary": net_salary,
            # بيانات الحضور
            "attendance_summary": {
                "present_days": attendance_summary.present_days,
                "absent_days": attendance_summary.absent_days,
                "late_days": attendance_summary.late_days,
                "total_late_minutes": attendance_summary.total_late_minutes,
                "total_overtime_hours": round(attendance_summary.total_overtime_hours, 2),
                "late_deduction": attendance_summary.late_deduction_amount,
                "absence_deduction": attendance_summary.absence_deduction_amount,
                "overtime_bonus": attendance_summary.overtime_bonus_amount
            }
        }
        
        employee_payrolls.append(emp_payroll_data)
        
        # تجميع الإجماليات
        totals["basic_salary"] += basic_salary
        totals["allowances"] += total_allowances
        totals["gross_salary"] += gross_salary
        totals["deductions"] += total_deductions
        totals["net_salary"] += net_salary
    
    # تحديث مسير الرواتب
    update_data = {
        "employees": employee_payrolls,
        "total_employees": len(employee_payrolls),
        "total_basic_salary": round(totals["basic_salary"], 2),
        "total_allowances": round(totals["allowances"], 2),
        "total_gross_salary": round(totals["gross_salary"], 2),
        "total_deductions": round(totals["deductions"], 2),
        "total_net_salary": round(totals["net_salary"], 2),
        "total_social_insurance": round(totals["social_insurance"], 2),
        "total_income_tax": round(totals["income_tax"], 2),
        "total_loans": round(totals["loans"], 2),
        "total_other_deductions": round(totals["other_deductions"], 2),
        # إجماليات الحضور الجديدة
        "total_late_deductions": round(totals["late_deductions"], 2),
        "total_absence_deductions": round(totals["absence_deductions"], 2),
        "total_overtime_bonus": round(totals["overtime_bonus"], 2),
        "status": "calculated",
        "calculated_at": datetime.utcnow()
    }
    
    await db.payroll_runs.update_one({"id": run_id}, {"$set": update_data})
    
    return {
        "message": "تم حساب الرواتب بنجاح",
        "summary": {
            "employees": len(employee_payrolls),
            "gross_salary": round(totals["gross_salary"], 2),
            "deductions": round(totals["deductions"], 2),
            "net_salary": round(totals["net_salary"], 2),
            "attendance_adjustments": {
                "late_deductions": round(totals["late_deductions"], 2),
                "absence_deductions": round(totals["absence_deductions"], 2),
                "overtime_bonus": round(totals["overtime_bonus"], 2)
            }
        }
    }


@router.post("/runs/{run_id}/approve")
async def approve_payroll(
    run_id: str,
    current_user: dict = Depends(get_current_user)
):
    """اعتماد مسير الرواتب وإنشاء القيد المحاسبي"""
    company_id = current_user["company_id"]
    
    payroll = await db.payroll_runs.find_one({
        "id": run_id,
        "company_id": company_id
    })
    
    if not payroll:
        raise HTTPException(status_code=404, detail="مسير الرواتب غير موجود")
    
    if payroll["status"] != "calculated":
        raise HTTPException(status_code=400, detail="يجب حساب الرواتب أولاً")
    
    settings = await get_payroll_settings(company_id)
    
    # إنشاء القيد المحاسبي
    journal_id, journal_number = await create_payroll_journal_entry(
        payroll, settings, current_user["user_id"]
    )
    
    # ترحيل القيد — يحدّث أرصدة الحسابات ويظهر في الميزانية والأستاذ
    if journal_id:
        try:
            service = AccountingService(db)
            await service.post_journal_entry(journal_id, current_user["user_id"])
        except Exception as e:
            logger.warning(f"Could not auto-post payroll journal {journal_id}: {e}")
    
    # تحديث أرصدة السُلف
    for emp in payroll.get("employees", []):
        for ded in emp.get("deductions", []):
            if ded.get("deduction_type") == "loan" and ded.get("reference_id"):
                loan = await db.employee_loans.find_one({"id": ded["reference_id"]})
                if loan:
                    new_paid = loan.get("paid_amount", 0) + ded["amount"]
                    new_remaining = loan.get("remaining_amount", loan["amount"]) - ded["amount"]
                    new_status = "paid" if new_remaining <= 0 else "active"
                    
                    await db.employee_loans.update_one(
                        {"id": ded["reference_id"]},
                        {"$set": {
                            "paid_amount": new_paid,
                            "remaining_amount": max(0, new_remaining),
                            "status": new_status
                        }}
                    )
    
    # تحديث مسير الرواتب
    await db.payroll_runs.update_one(
        {"id": run_id},
        {"$set": {
            "status": "approved",
            "journal_entry_id": journal_id,
            "journal_entry_number": journal_number,
            "approved_by": current_user["user_id"],
            "approved_at": datetime.utcnow()
        }}
    )
    
    return {
        "message": "تم اعتماد مسير الرواتب بنجاح",
        "journal_entry_number": journal_number
    }


@router.post("/runs/{run_id}/pay")
async def pay_payroll(
    run_id: str,
    payment_method: str = Query("bank_transfer"),
    current_user: dict = Depends(get_current_user)
):
    """تسجيل صرف الرواتب"""
    company_id = current_user["company_id"]
    
    payroll = await db.payroll_runs.find_one({
        "id": run_id,
        "company_id": company_id
    })
    
    if not payroll:
        raise HTTPException(status_code=404, detail="مسير الرواتب غير موجود")
    
    if payroll["status"] != "approved":
        raise HTTPException(status_code=400, detail="يجب اعتماد المسير أولاً")
    
    settings = await get_payroll_settings(company_id)
    service = AccountingService(db)
    
    # الحصول على الحسابات مع معلوماتها الكاملة
    accounts = await service.get_all_accounts(company_id, True)
    accounts_by_code = {acc["account_code"]: acc for acc in accounts}
    
    def get_acc(setting_val, default_code):
        if setting_val:
            for acc in accounts:
                if acc["id"] == setting_val:
                    return acc["id"], acc["account_code"], acc.get("account_name") or acc.get("name", "")
        if default_code in accounts_by_code:
            acc = accounts_by_code[default_code]
            return acc["id"], acc["account_code"], acc.get("account_name") or acc.get("name", "")
        return None, default_code, f"حساب {default_code}"
    
    sal_pay_id, sal_pay_code, sal_pay_name = get_acc(settings.get("salaries_payable_account"), "253")  # مصروفات مستحقة
    bank_id, bank_code, bank_name = get_acc(settings.get("bank_account"), "111")  # البنك
    
    if not sal_pay_id or not bank_id:
        raise HTTPException(status_code=400, detail="الحسابات المحاسبية غير متوفرة")
    
    # إنشاء قيد الصرف
    entry = JournalEntry(
        company_id=company_id,
        entry_number=0,  # سيتم استبداله برقم تسلسلي من AccountingService
        entry_date=datetime.now().strftime("%Y-%m-%d"),
        reference=payroll["payroll_number"],
        description=f"صرف رواتب شهر {payroll['month']}",
        lines=[
            JournalEntryLine(
                account_id=sal_pay_id,
                account_code=sal_pay_code,
                account_name=sal_pay_name,
                debit=payroll["total_net_salary"],
                credit=0,
                description="إقفال الرواتب المستحقة"
            ).dict(),
            JournalEntryLine(
                account_id=bank_id,
                account_code=bank_code,
                account_name=bank_name,
                debit=0,
                credit=payroll["total_net_salary"],
                description="صرف من البنك"
            ).dict()
        ],
        source_type="payroll_payment",
        source_id=run_id,
        created_by=current_user["user_id"]
    )
    
    result = await service.create_journal_entry(entry)
    
    # ترحيل قيد الصرف — يحدّث رصيد البنك في الميزانية
    payment_journal_id = result.get("id")
    if payment_journal_id:
        try:
            await service.post_journal_entry(payment_journal_id, current_user["user_id"])
        except Exception as e:
            logger.warning(f"Could not auto-post payment journal {payment_journal_id}: {e}")
    
    # تحديث مسير الرواتب
    await db.payroll_runs.update_one(
        {"id": run_id},
        {"$set": {
            "status": "paid",
            "payment_method": payment_method,
            "payment_date": datetime.now().strftime("%Y-%m-%d"),
            "paid_at": datetime.utcnow()
        }}
    )
    
    return {
        "message": "تم تسجيل صرف الرواتب بنجاح",
        "payment_journal_entry": result.get("entry_number")
    }


# ==========================================
# Email Notifications Endpoints
# ==========================================

@router.post("/runs/{run_id}/send-payslips")
async def send_payslip_emails(
    run_id: str,
    current_user: dict = Depends(get_current_user)
):
    """إرسال قسائم الرواتب بالبريد الإلكتروني للموظفين"""
    company_id = current_user["company_id"]
    
    payroll = await db.payroll_runs.find_one({
        "id": run_id,
        "company_id": company_id
    })
    
    if not payroll:
        raise HTTPException(status_code=404, detail="مسير الرواتب غير موجود")
    
    if payroll["status"] not in ["approved", "paid"]:
        raise HTTPException(status_code=400, detail="يجب اعتماد المسير أولاً قبل إرسال الإشعارات")
    
    # الحصول على معلومات الشركة
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0, "company_name": 1})
    company_name = company.get("company_name", "DataLife Account") if company else "DataLife Account"
    
    # الحصول على قائمة الموظفين مع بريدهم الإلكتروني
    employees_data = []
    for emp in payroll.get("employees", []):
        # الحصول على بريد الموظف
        employee = await db.employees.find_one({"id": emp["employee_id"]}, {"_id": 0, "email": 1})
        emp_email = employee.get("email") if employee else None
        
        employees_data.append({
            "employee_name": emp.get("employee_name"),
            "email": emp_email,
            "employee_id": emp.get("employee_id", ""),
            "department": emp.get("department", ""),
            "position": emp.get("position", ""),
            "basic_salary": emp.get("basic_salary", 0),
            "total_allowances": emp.get("total_allowances", 0),
            "allowances_breakdown": emp.get("allowances", []),
            "gross_salary": emp.get("gross_salary", 0),
            "total_deductions": emp.get("total_deductions", 0),
            "deductions_breakdown": emp.get("deductions", []),
            "social_insurance": emp.get("social_insurance", 0),
            "income_tax": emp.get("income_tax", 0),
            "stamp_duty": emp.get("stamp_duty", 0),
            "net_salary": emp.get("net_salary", 0),
            "payment_method": emp.get("payment_method", "bank_transfer"),
            "approved_by": current_user.get("full_name", "المسؤول المالي"),
        })
    
    # إرسال الإشعارات
    results = await send_bulk_payslip_notifications(
        employees_data=employees_data,
        month=payroll["month"],
        company_name=company_name
    )
    
    # تسجيل الإرسال
    await db.payroll_runs.update_one(
        {"id": run_id},
        {"$set": {
            "payslips_sent": True,
            "payslips_sent_at": datetime.utcnow(),
            "payslips_sent_count": results["sent"]
        }}
    )
    
    return {
        "message": f"تم إرسال {results['sent']} قسيمة راتب من أصل {results['total']}",
        "results": results
    }




# ==========================================
# End of Service Endpoints
# ==========================================

@router.get("/end-of-service")
async def get_end_of_service_settlements(
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على تسويات نهاية الخدمة"""
    query = {"company_id": current_user["company_id"]}
    if status:
        query["status"] = status
    
    settlements = await db.end_of_service.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).to_list(length=None)
    
    return {"settlements": settlements}


@router.post("/end-of-service")
async def create_end_of_service(
    request: EndOfServiceRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء تسوية نهاية خدمة"""
    company_id = current_user["company_id"]
    
    employee = await db.employees.find_one({"id": request.employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    settings = await get_payroll_settings(company_id)
    
    # حساب مدة الخدمة
    hire_date = datetime.strptime(employee["hire_date"], "%Y-%m-%d")
    end_date = datetime.strptime(request.end_date, "%Y-%m-%d")
    service_days = (end_date - hire_date).days
    years = service_days / 365.25
    months = int(service_days / 30.44)
    
    basic_salary = employee.get("basic_salary", 0)
    
    # حساب مكافأة نهاية الخدمة
    eos_amount = 0
    if years <= 5:
        eos_amount = years * basic_salary * settings.get("eos_rate_first_5_years", 0.5)
    else:
        eos_amount = (5 * basic_salary * settings.get("eos_rate_first_5_years", 0.5)) + \
                     ((years - 5) * basic_salary * settings.get("eos_rate_after_5_years", 1.0))
    
    # الحصول على السُلف المستحقة
    pending_loans = await db.employee_loans.aggregate([
        {"$match": {
            "employee_id": request.employee_id,
            "status": {"$in": ["approved", "active"]},
            "remaining_amount": {"$gt": 0}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$remaining_amount"}}}
    ]).to_list(length=1)
    
    pending_loans_amount = pending_loans[0]["total"] if pending_loans else 0
    
    total_entitlements = eos_amount + request.other_entitlements
    total_deductions = pending_loans_amount + request.other_deductions
    net_settlement = total_entitlements - total_deductions
    
    settlement_number = await generate_number(company_id, "EOS", "end_of_service")
    
    settlement = EndOfService(
        company_id=company_id,
        employee_id=request.employee_id,
        employee_name=employee.get("name"),
        settlement_number=settlement_number,
        settlement_date=datetime.now().strftime("%Y-%m-%d"),
        hire_date=employee["hire_date"],
        end_date=request.end_date,
        years_of_service=round(years, 2),
        months_of_service=months,
        last_basic_salary=basic_salary,
        last_gross_salary=basic_salary,
        end_of_service_amount=round(eos_amount, 2),
        other_entitlements=request.other_entitlements,
        total_entitlements=round(total_entitlements, 2),
        pending_loans=pending_loans_amount,
        other_deductions=request.other_deductions,
        total_deductions=round(total_deductions, 2),
        net_settlement=round(net_settlement, 2),
        termination_reason=request.termination_reason,
        created_by=current_user["user_id"]
    )
    
    await db.end_of_service.insert_one(settlement.dict())
    
    return {"message": "تم إنشاء تسوية نهاية الخدمة", "settlement": settlement.dict()}


@router.post("/end-of-service/{settlement_id}/approve")
async def approve_end_of_service(
    settlement_id: str,
    current_user: dict = Depends(get_current_user)
):
    """اعتماد تسوية نهاية الخدمة"""
    company_id = current_user["company_id"]
    
    settlement = await db.end_of_service.find_one({
        "id": settlement_id,
        "company_id": company_id
    })
    
    if not settlement:
        raise HTTPException(status_code=404, detail="التسوية غير موجودة")
    
    if settlement["status"] != "pending":
        raise HTTPException(status_code=400, detail="لا يمكن اعتماد هذه التسوية")
    
    settings = await get_payroll_settings(company_id)
    service = AccountingService(db)
    
    # الحصول على الحسابات مع معلوماتها الكاملة
    accounts = await service.get_all_accounts(company_id, True)
    accounts_by_code = {acc["account_code"]: acc for acc in accounts}
    
    def get_acc(setting_val, default_code):
        if setting_val:
            for acc in accounts:
                if acc["id"] == setting_val:
                    return acc["id"], acc["account_code"], acc.get("account_name") or acc.get("name", "")
        if default_code in accounts_by_code:
            acc = accounts_by_code[default_code]
            return acc["id"], acc["account_code"], acc.get("account_name") or acc.get("name", "")
        return None, default_code, f"حساب {default_code}"
    
    eos_id, eos_code, eos_name = get_acc(settings.get("eos_provision_account"), "2600")  # القروض طويلة الأجل
    loan_id, loan_code, loan_name = get_acc(settings.get("loans_receivable_account"), "134")  # سلف الموظفين
    bank_id, bank_code, bank_name = get_acc(settings.get("bank_account"), "162")  # النقدية بالبنوك الجارية
    
    lines = []
    
    # مدين: مخصص نهاية الخدمة
    if settlement["end_of_service_amount"] > 0 and eos_id:
        lines.append(JournalEntryLine(
            account_id=eos_id,
            account_code=eos_code,
            account_name=eos_name,
            debit=settlement["end_of_service_amount"],
            credit=0,
            description="مكافأة نهاية الخدمة"
        ).dict())
    
    # دائن: سُلف (تسوية)
    if settlement["pending_loans"] > 0 and loan_id:
        lines.append(JournalEntryLine(
            account_id=loan_id,
            account_code=loan_code,
            account_name=loan_name,
            debit=0,
            credit=settlement["pending_loans"],
            description="تسوية سُلف"
        ).dict())
    
    # دائن: البنك (صافي المستحق)
    if bank_id:
        lines.append(JournalEntryLine(
            account_id=bank_id,
            account_code=bank_code,
            account_name=bank_name,
            debit=0,
            credit=settlement["net_settlement"],
            description="صرف تسوية نهاية الخدمة"
        ).dict())
    
    if not lines:
        raise HTTPException(status_code=400, detail="الحسابات المحاسبية غير متوفرة")
    
    entry = JournalEntry(
        company_id=company_id,
        entry_number=0,  # سيتم استبداله برقم تسلسلي من AccountingService
        entry_date=datetime.now().strftime("%Y-%m-%d"),
        reference=settlement["settlement_number"],
        description=f"تسوية نهاية خدمة - {settlement['employee_name']}",
        lines=lines,
        source_type="end_of_service",
        source_id=settlement_id,
        created_by=current_user["user_id"]
    )
    
    result = await service.create_journal_entry(entry)
    
    # إيقاف الموظف
    await db.employees.update_one(
        {"id": settlement["employee_id"]},
        {"$set": {"is_active": False}}
    )
    
    # تسوية السُلف
    await db.employee_loans.update_many(
        {
            "employee_id": settlement["employee_id"],
            "status": {"$in": ["approved", "active"]}
        },
        {"$set": {"status": "paid", "remaining_amount": 0}}
    )
    
    # تحديث التسوية
    await db.end_of_service.update_one(
        {"id": settlement_id},
        {"$set": {
            "status": "approved",
            "journal_entry_id": result.get("id"),
            "approved_by": current_user["user_id"],
            "approved_at": datetime.utcnow()
        }}
    )
    
    return {"message": "تم اعتماد التسوية بنجاح", "journal_entry": result.get("entry_number")}


# ==========================================
# Reports Endpoints
# ==========================================

@router.get("/reports/monthly-cost")
async def get_monthly_cost_report(
    year: int = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """تقرير تكلفة الرواتب الشهرية"""
    query = {
        "company_id": current_user["company_id"],
        "year": year,
        "status": {"$in": ["approved", "paid"]}
    }
    
    payrolls = await db.payroll_runs.find(query, {"_id": 0}).sort("month", 1).to_list(length=None)
    
    report = []
    totals = {
        "basic_salary": 0,
        "allowances": 0,
        "gross_salary": 0,
        "social_insurance": 0,
        "income_tax": 0,
        "other_deductions": 0,
        "net_salary": 0
    }
    
    for p in payrolls:
        month_data = {
            "month": p["month"],
            "employees": p.get("total_employees", 0),
            "basic_salary": p.get("total_basic_salary", 0),
            "allowances": p.get("total_allowances", 0),
            "gross_salary": p.get("total_gross_salary", 0),
            "social_insurance": p.get("total_social_insurance", 0),
            "income_tax": p.get("total_income_tax", 0),
            "other_deductions": p.get("total_other_deductions", 0) + p.get("total_loans", 0),
            "net_salary": p.get("total_net_salary", 0)
        }
        report.append(month_data)
        
        for key in totals:
            totals[key] += month_data.get(key, 0)
    
    return {"report": report, "totals": totals, "year": year}


@router.get("/reports/department-cost")
async def get_department_cost_report(
    month: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """تقرير تكلفة الموظفين حسب القسم"""
    payroll = await db.payroll_runs.find_one({
        "company_id": current_user["company_id"],
        "month": month
    })
    
    if not payroll:
        return {"report": [], "month": month}
    
    # تجميع حسب القسم
    departments = {}
    for emp in payroll.get("employees", []):
        dept = emp.get("department") or "غير محدد"
        if dept not in departments:
            departments[dept] = {
                "department": dept,
                "employees": 0,
                "basic_salary": 0,
                "allowances": 0,
                "gross_salary": 0,
                "deductions": 0,
                "net_salary": 0
            }
        
        departments[dept]["employees"] += 1
        departments[dept]["basic_salary"] += emp.get("basic_salary", 0)
        departments[dept]["allowances"] += emp.get("total_allowances", 0)
        departments[dept]["gross_salary"] += emp.get("gross_salary", 0)
        departments[dept]["deductions"] += emp.get("total_deductions", 0)
        departments[dept]["net_salary"] += emp.get("net_salary", 0)
    
    return {"report": list(departments.values()), "month": month}


@router.get("/reports/payslip/{run_id}/{employee_id}")
async def get_payslip(
    run_id: str,
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """الحصول على قسيمة الراتب"""
    payroll = await db.payroll_runs.find_one({
        "id": run_id,
        "company_id": current_user["company_id"]
    })
    
    if not payroll:
        raise HTTPException(status_code=404, detail="مسير الرواتب غير موجود")
    
    employee_payroll = None
    for emp in payroll.get("employees", []):
        if emp["employee_id"] == employee_id:
            employee_payroll = emp
            break
    
    if not employee_payroll:
        raise HTTPException(status_code=404, detail="الموظف غير موجود في هذا المسير")
    
    company = await db.companies.find_one({"id": current_user["company_id"]})
    
    return {
        "company_name": company.get("name") if company else "",
        "month": payroll["month"],
        "payroll_number": payroll["payroll_number"],
        "employee": employee_payroll
    }



# ==========================================
# HR Settings Endpoints (إعدادات الموارد البشرية)
# ==========================================

class HRSettingsUpdateRequest(BaseModel):
    """طلب تحديث إعدادات HR"""
    late_deduction_enabled: Optional[bool] = None
    late_deduction_method: Optional[str] = None
    grace_period_minutes: Optional[int] = None
    late_deduction_per_minute_rate: Optional[float] = None
    late_deduction_per_hour_rate: Optional[float] = None
    late_brackets: Optional[List[dict]] = None
    max_late_minutes_before_absence: Optional[int] = None
    
    absence_deduction_enabled: Optional[bool] = None
    absence_deduction_method: Optional[str] = None
    absence_deduction_days: Optional[float] = None
    absence_penalty_percentage: Optional[float] = None
    excused_absence_deduction: Optional[bool] = None
    
    overtime_enabled: Optional[bool] = None
    overtime_calculation_method: Optional[str] = None
    overtime_rate: Optional[float] = None
    overtime_holiday_rate: Optional[float] = None
    overtime_night_rate: Optional[float] = None
    max_monthly_overtime_hours: Optional[float] = None
    overtime_requires_approval: Optional[bool] = None
    
    standard_working_hours_per_day: Optional[float] = None
    standard_working_days_per_month: Optional[int] = None
    weekend_days: Optional[List[str]] = None
    round_late_minutes_to: Optional[int] = None
    round_overtime_minutes_to: Optional[int] = None


@router.get("/hr-settings")
async def get_company_hr_settings(current_user: dict = Depends(get_current_user)):
    """الحصول على إعدادات الموارد البشرية للشركة"""
    settings = await get_hr_settings(current_user["company_id"])
    return settings


@router.put("/hr-settings")
async def update_company_hr_settings(
    request: HRSettingsUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """تحديث إعدادات الموارد البشرية للشركة"""
    company_id = current_user["company_id"]
    
    # تحضير البيانات للتحديث
    update_data = {k: v for k, v in request.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    await db.company_hr_settings.update_one(
        {"company_id": company_id},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "تم تحديث إعدادات الموارد البشرية بنجاح"}


@router.get("/attendance-payroll-preview")
async def get_attendance_payroll_preview(
    month: str = Query(...),
    employee_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """معاينة تأثير الحضور على الراتب قبل إنشاء المسير"""
    company_id = current_user["company_id"]
    hr_settings = await get_hr_settings(company_id)
    
    query = {"company_id": company_id, "is_active": True}
    if employee_id:
        query["id"] = employee_id
    
    employees = await db.employees.find(query).to_list(length=None)
    
    previews = []
    totals = {
        "late_deduction": 0,
        "absence_deduction": 0,
        "overtime_bonus": 0,
        "net_adjustment": 0
    }
    
    for emp in employees:
        basic_salary = emp.get("basic_salary", 0)
        summary = await calculate_attendance_for_payroll(
            emp["id"], month, basic_salary, hr_settings
        )
        
        previews.append({
            "employee_id": emp["id"],
            "employee_name": emp.get("name"),
            "department": emp.get("department"),
            "basic_salary": basic_salary,
            "present_days": summary.present_days,
            "absent_days": summary.absent_days,
            "late_days": summary.late_days,
            "total_late_minutes": summary.total_late_minutes,
            "total_overtime_hours": round(summary.total_overtime_hours, 2),
            "late_deduction": summary.late_deduction_amount,
            "absence_deduction": summary.absence_deduction_amount,
            "overtime_bonus": summary.overtime_bonus_amount,
            "net_adjustment": summary.net_attendance_adjustment
        })
        
        totals["late_deduction"] += summary.late_deduction_amount
        totals["absence_deduction"] += summary.absence_deduction_amount
        totals["overtime_bonus"] += summary.overtime_bonus_amount
        totals["net_adjustment"] += summary.net_attendance_adjustment
    
    return {
        "month": month,
        "employees": previews,
        "totals": {
            "late_deduction": round(totals["late_deduction"], 2),
            "absence_deduction": round(totals["absence_deduction"], 2),
            "overtime_bonus": round(totals["overtime_bonus"], 2),
            "net_adjustment": round(totals["net_adjustment"], 2)
        }
    }


@router.get("/runs/{run_id}/bank-transfer-report")
async def get_bank_transfer_report(
    run_id: str,
    current_user: dict = Depends(get_current_user)
):
    """تقرير التحويلات البنكية — يُصدَّر للبنك لتنفيذ التحويلات"""
    company_id = current_user["company_id"]

    payroll = await db.payroll_runs.find_one({"id": run_id, "company_id": company_id})
    if not payroll:
        raise HTTPException(status_code=404, detail="مسير الرواتب غير موجود")
    if payroll["status"] not in ["approved", "paid"]:
        raise HTTPException(status_code=400, detail="يجب اعتماد المسير أولاً")

    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    company_name = company.get("name", "") if company else ""

    rows = []
    totals = {"bank_transfer": 0, "cash": 0, "instapay": 0, "vodafone_cash": 0, "total": 0}

    for emp in payroll.get("employees", []):
        # Get employee bank info
        emp_doc = await db.employees.find_one({"id": emp["employee_id"]}, {"_id": 0})
        emp_user = await db.users.find_one({"id": emp["employee_id"]}, {"_id": 0})

        bank_name   = ""
        account_no  = ""
        iban        = ""
        wallet_no   = ""
        pay_method  = emp.get("payment_method", "bank_transfer")

        if emp_doc:
            bank_name  = emp_doc.get("bank_name", "")
            account_no = emp_doc.get("bank_account_number", "")
            iban       = emp_doc.get("iban", "")
            wallet_no  = emp_doc.get("wallet_number", "")
            if not pay_method or pay_method == "bank_transfer":
                pay_method = emp_doc.get("payment_method", "bank_transfer")

        net = emp.get("net_salary", 0)
        totals[pay_method] = totals.get(pay_method, 0) + net
        totals["total"] += net

        rows.append({
            "employee_id":   emp["employee_id"],
            "employee_name": emp.get("employee_name", ""),
            "department":    emp.get("department", ""),
            "position":      emp.get("position", ""),
            "net_salary":    net,
            "payment_method": pay_method,
            "bank_name":     bank_name,
            "account_number": account_no,
            "iban":          iban,
            "wallet_number": wallet_no,
            "email":         emp_user.get("email", "") if emp_user else "",
        })

    # Group by payment method
    by_method = {}
    for r in rows:
        m = r["payment_method"]
        if m not in by_method:
            by_method[m] = []
        by_method[m].append(r)

    return {
        "payroll_number": payroll["payroll_number"],
        "month":          payroll["month"],
        "company_name":   company_name,
        "status":         payroll["status"],
        "generated_at":   datetime.now(timezone.utc).isoformat(),
        "employees":      rows,
        "by_method":      by_method,
        "totals":         totals,
        "summary": {
            "total_employees":  len(rows),
            "bank_transfer":    {"count": len(by_method.get("bank_transfer", [])), "total": totals.get("bank_transfer", 0)},
            "cash":             {"count": len(by_method.get("cash", [])),          "total": totals.get("cash", 0)},
            "instapay":         {"count": len(by_method.get("instapay", [])),      "total": totals.get("instapay", 0)},
            "vodafone_cash":    {"count": len(by_method.get("vodafone_cash", [])), "total": totals.get("vodafone_cash", 0)},
            "total_net":        totals["total"],
        }
    }


@router.post("/runs/{run_id}/pay-with-method")
async def pay_with_method(
    run_id: str,
    payment_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """صرف الرواتب مع تحديد طريقة الصرف لكل موظف"""
    company_id = current_user["company_id"]

    payroll = await db.payroll_runs.find_one({"id": run_id, "company_id": company_id})
    if not payroll:
        raise HTTPException(status_code=404, detail="مسير الرواتب غير موجود")
    if payroll["status"] != "approved":
        raise HTTPException(status_code=400, detail="يجب اعتماد المسير أولاً")

    default_method  = payment_data.get("default_method", "bank_transfer")
    employee_methods = payment_data.get("employee_methods", {})  # {employee_id: method}

    # Update each employee payment method in the run
    employees = payroll.get("employees", [])
    for emp in employees:
        eid = emp["employee_id"]
        emp["payment_method"] = employee_methods.get(eid, default_method)

    await db.payroll_runs.update_one(
        {"id": run_id},
        {"$set": {"employees": employees, "default_payment_method": default_method}}
    )

    # Now trigger normal pay flow
    from fastapi import BackgroundTasks
    return await pay_payroll(run_id, default_method, current_user)


@router.get("/runs/{run_id}/export/csv")
async def export_payroll_csv(
    run_id: str,
    current_user: dict = Depends(get_current_user)
):
    """تصدير كشف الرواتب بصيغة CSV متوافق مع Excel"""
    run = await db.payroll_runs.find_one(
        {"id": run_id, "company_id": current_user["company_id"]}, {"_id": 0}
    )
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")

    import csv, io
    output = io.StringIO()
    output.write("\ufeff")  # UTF-8 BOM for Arabic in Excel
    fieldnames = [
        "اسم الموظف", "الوظيفة", "القسم", "الراتب الأساسي",
        "البدلات", "الخصومات", "التأمينات", "ضريبة الدخل", "صافي الراتب", "طريقة الصرف"
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for emp in run.get("employees", []):
        writer.writerow({
            "اسم الموظف": emp.get("employee_name", ""),
            "الوظيفة": emp.get("job_title", ""),
            "القسم": emp.get("department", ""),
            "الراتب الأساسي": emp.get("basic_salary", 0),
            "البدلات": emp.get("total_allowances", 0),
            "الخصومات": emp.get("total_deductions", 0),
            "التأمينات": emp.get("social_insurance", 0),
            "ضريبة الدخل": emp.get("income_tax", 0),
            "صافي الراتب": emp.get("net_salary", 0),
            "طريقة الصرف": emp.get("payment_method", "بنك"),
        })
    month_str = f"{run.get('year', '')}-{run.get('month', '')}"
    return Response(
        content=output.getvalue().encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="payroll_{month_str}.csv"'}
    )


@router.get("/runs/{run_id}/export/excel")
async def export_payroll_excel(
    run_id: str,
    current_user: dict = Depends(get_current_user)
):
    """تصدير كشف الرواتب بصيغة Excel (.xlsx) مع تنسيق عربي"""
    run = await db.payroll_runs.find_one(
        {"id": run_id, "company_id": current_user["company_id"]}, {"_id": 0}
    )
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")

    import io, xlsxwriter
    output = io.BytesIO()
    wb = xlsxwriter.Workbook(output, {"in_memory": True})
    ws = wb.add_worksheet("كشف الرواتب")
    ws.right_to_left()

    hdr = wb.add_format({"bold": True, "bg_color": "#1e3a8a", "font_color": "white",
                          "align": "center", "border": 1, "font_name": "Arial"})
    num = wb.add_format({"num_format": "#,##0.00", "border": 1, "font_name": "Arial"})
    txt = wb.add_format({"border": 1, "font_name": "Arial"})
    tot = wb.add_format({"bold": True, "bg_color": "#dbeafe", "num_format": "#,##0.00",
                          "border": 1, "font_name": "Arial"})

    headers = ["#", "اسم الموظف", "الوظيفة", "القسم", "الراتب الأساسي",
               "البدلات", "الخصومات", "التأمينات", "ضريبة الدخل", "صافي الراتب"]
    widths   = [5,    25,           18,         15,       15,
                12,       12,          12,          12,            15]
    for c, (h, w) in enumerate(zip(headers, widths)):
        ws.write(0, c, h, hdr)
        ws.set_column(c, c, w)

    keys = ["basic_salary","total_allowances","total_deductions","social_insurance","income_tax","net_salary"]
    totals = {k: 0 for k in keys}
    for row, emp in enumerate(run.get("employees", []), 1):
        ws.write(row, 0, row, txt)
        ws.write(row, 1, emp.get("employee_name", ""), txt)
        ws.write(row, 2, emp.get("job_title", ""), txt)
        ws.write(row, 3, emp.get("department", ""), txt)
        ws.write(row, 4, emp.get("basic_salary", 0), num)
        ws.write(row, 5, emp.get("total_allowances", 0), num)
        ws.write(row, 6, emp.get("total_deductions", 0), num)
        ws.write(row, 7, emp.get("social_insurance", 0), num)
        ws.write(row, 8, emp.get("income_tax", 0), num)
        ws.write(row, 9, emp.get("net_salary", 0), num)
        for k in keys:
            totals[k] += emp.get(k, 0)

    last = len(run.get("employees", [])) + 1
    ws.write(last, 0, "الإجمالي", tot)
    ws.write(last, 1, run.get("total_employees", ""), tot)
    ws.write(last, 2, "", tot)
    ws.write(last, 3, "", tot)
    ws.write(last, 4, totals["basic_salary"], tot)
    ws.write(last, 5, totals["total_allowances"], tot)
    ws.write(last, 6, totals["total_deductions"], tot)
    ws.write(last, 7, totals["social_insurance"], tot)
    ws.write(last, 8, totals["income_tax"], tot)
    ws.write(last, 9, totals["net_salary"], tot)
    wb.close()

    month_str = f"{run.get('year', '')}-{run.get('month', '')}"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="payroll_{month_str}.xlsx"'}
    )


# ══════════════════════════════════════════════════════
# القيد ج — صرف المرتبات وسداد الالتزامات الحكومية
# ══════════════════════════════════════════════════════

@router.post("/runs/{run_id}/disburse")
async def disburse_payroll(
    run_id: str,
    data: dict = {},
    current_user: dict = Depends(get_current_user)
):
    """
    إنشاء قيود صرف المرتبات وسداد الالتزامات الحكومية
    
    القيد أ: من حـ/ الأجور المستحقة → إلى حـ/ البنك / الخزينة
    القيد ب: من حـ/ مذكورين (ضرائب + تأمينات + صناديق) → إلى حـ/ البنك
    """
    company_id = current_user["company_id"]
    
    run = await db.payroll_runs.find_one({"id": run_id, "company_id": company_id}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="مسير الرواتب غير موجود")
    if run.get("status") != "approved":
        raise HTTPException(status_code=400, detail="يجب اعتماد المسير قبل الصرف")
    if run.get("disbursed"):
        raise HTTPException(status_code=400, detail="تم صرف هذا المسير مسبقاً")
    
    settings  = await get_payroll_settings(company_id)
    service   = AccountingService(db)
    accounts  = await service.get_all_accounts(company_id, True)
    by_code   = {a["account_code"]: a for a in accounts}
    by_id     = {a["id"]: a for a in accounts}
    
    def acct(setting_key, default_code):
        val = settings.get(setting_key)
        if val and val in by_id:
            a = by_id[val]
            return a["id"], a["account_code"], a.get("account_name", "")
        if default_code in by_code:
            a = by_code[default_code]
            return a["id"], a["account_code"], a.get("account_name", "")
        return None, default_code, f"حساب {default_code}"
    
    # حسابات القيد
    sal_pay_id,  sal_pay_code,  sal_pay_name  = acct("salaries_payable_account_id",      "220")
    bank_id,     bank_code,     bank_name      = acct("bank_account_id",                  "112")
    si_pay_id,   si_pay_code,   si_pay_name    = acct("social_insurance_payable_account_id","260")
    tax_id,      tax_code,      tax_name       = acct("income_tax_payable_account_id",    "261")
    emg_pay_id,  emg_pay_code,  emg_pay_name   = acct(None,                               "258")
    mrt_pay_id,  mrt_pay_code,  mrt_pay_name   = acct(None,                               "259")
    uhi_pay_id,  uhi_pay_code,  uhi_pay_name   = acct(None,                               "262")
    
    payroll_month = f"{run.get('year', '')}/{run.get('month', '')}"
    entry_date = datetime.now().strftime("%Y-%m-%d")
    
    # ══ القيد أ: صرف الرواتب ══════════════════════════
    # من حـ/ الأجور والمرتبات المستحقة → إلى حـ/ البنك
    # ════════════════════════════════════════════════════
    lines_a = []
    if sal_pay_id and run.get("total_net_salary", 0) > 0:
        lines_a.append(JournalEntryLine(
            account_id=sal_pay_id, account_code=sal_pay_code, account_name=sal_pay_name,
            debit=run["total_net_salary"], credit=0,
            description=f"صرف صافي رواتب شهر {payroll_month}"
        ))
        if bank_id:
            lines_a.append(JournalEntryLine(
                account_id=bank_id, account_code=bank_code, account_name=bank_name,
                debit=0, credit=run["total_net_salary"],
                description=f"صرف صافي رواتب شهر {payroll_month} من البنك"
            ))
    
    if lines_a:
        entry_a = JournalEntry(
            company_id=company_id,
            entry_number=0,
            entry_date=entry_date,
            reference=f"{run.get('payroll_number', run_id)}-DISBURSE",
            description=f"قيد صرف رواتب شهر {payroll_month}",
            lines=[l.dict() for l in lines_a],
            source_type="payroll_disbursement",
            source_id=run_id,
            created_by=current_user["id"]
        )
        await service.create_journal_entry(entry_a)
    
    # ══ القيد ب: سداد الالتزامات الحكومية ═══════════
    # من حـ/ مذكورين → إلى حـ/ البنك
    # ════════════════════════════════════════════════════
    lines_b = []
    company_si = round(run.get("total_basic_salary", 0) *
                       (settings.get("company_social_insurance_rate", 18.75) / 100), 2)
    total_si   = round(run.get("total_social_insurance", 0) + company_si, 2)
    total_tax  = run.get("total_income_tax", 0)
    
    # مدين: التأمينات الاجتماعية مستحقة
    if total_si > 0 and si_pay_id:
        lines_b.append(JournalEntryLine(
            account_id=si_pay_id, account_code=si_pay_code, account_name=si_pay_name,
            debit=total_si, credit=0,
            description="سداد التأمينات الاجتماعية لهيئة التأمينات"
        ))
    
    # مدين: ضريبة كسب العمل مستحقة
    if total_tax > 0 and tax_id:
        lines_b.append(JournalEntryLine(
            account_id=tax_id, account_code=tax_code, account_name=tax_name,
            debit=total_tax, credit=0,
            description="سداد ضريبة كسب العمل لمصلحة الضرائب"
        ))
    
    # مدين: صندوق الطوارئ مستحق
    emg_amount = round(run.get("total_basic_salary", 0) * 0.01, 2)
    if emg_amount > 0 and emg_pay_id:
        lines_b.append(JournalEntryLine(
            account_id=emg_pay_id, account_code=emg_pay_code, account_name=emg_pay_name,
            debit=emg_amount, credit=0,
            description="سداد صندوق إعانة الطوارئ — 1%"
        ))
    
    # مدين: صندوق الشهداء مستحق
    mrt_amount = round(run.get("total_basic_salary", 0) * 0.0005, 2)
    if mrt_amount > 0 and mrt_pay_id:
        lines_b.append(JournalEntryLine(
            account_id=mrt_pay_id, account_code=mrt_pay_code, account_name=mrt_pay_name,
            debit=mrt_amount, credit=0,
            description="سداد صندوق تكريم الشهداء — 0.05%"
        ))
    
    # مدين: التأمين الصحي الشامل مستحق
    gross_payroll = run.get("total_gross_salary", run.get("total_basic_salary", 0))
    uhi_amount = round(gross_payroll * 0.0025, 2)
    if uhi_amount > 0 and uhi_pay_id:
        lines_b.append(JournalEntryLine(
            account_id=uhi_pay_id, account_code=uhi_pay_code, account_name=uhi_pay_name,
            debit=uhi_amount, credit=0,
            description="سداد التأمين الصحي الشامل — 0.25%"
        ))
    
    # دائن: البنك (إجمالي المدفوعات الحكومية)
    total_gov = round(total_si + total_tax + emg_amount + mrt_amount + uhi_amount, 2)
    if total_gov > 0 and bank_id and lines_b:
        lines_b.append(JournalEntryLine(
            account_id=bank_id, account_code=bank_code, account_name=bank_name,
            debit=0, credit=total_gov,
            description="سداد الالتزامات الحكومية (ضرائب + تأمينات + صناديق)"
        ))
    
    if lines_b:
        entry_b = JournalEntry(
            company_id=company_id,
            entry_number=0,
            entry_date=entry_date,
            reference=f"{run.get('payroll_number', run_id)}-GOV",
            description=f"قيد سداد الالتزامات الحكومية شهر {payroll_month}",
            lines=[l.dict() for l in lines_b],
            source_type="payroll_government",
            source_id=run_id,
            created_by=current_user["id"]
        )
        await service.create_journal_entry(entry_b)
    
    # تحديث حالة الصرف
    await db.payroll_runs.update_one(
        {"id": run_id},
        {"$set": {
            "disbursed": True,
            "disbursed_at": datetime.utcnow().isoformat(),
            "disbursed_by": current_user["id"],
            "status": "paid"
        }}
    )
    
    # Audit log
    await db.activity_logs.insert_one({
        "company_id": company_id,
        "user_id": current_user["id"],
        "action": "payroll_disburse",
        "module": "payroll",
        "details": f"صرف رواتب شهر {payroll_month} — صافي: {run.get('total_net_salary', 0):,.2f} + التزامات حكومية: {total_gov:,.2f}",
        "created_at": datetime.utcnow().isoformat()
    })
    
    return {
        "success": True,
        "message": f"تم إنشاء قيدي الصرف والالتزامات الحكومية لشهر {payroll_month}",
        "entries": {
            "disbursement": {
                "description": "قيد صرف الرواتب",
                "amount": run.get("total_net_salary", 0)
            },
            "government": {
                "description": "قيد سداد الالتزامات الحكومية",
                "breakdown": {
                    "social_insurance": total_si,
                    "income_tax": total_tax,
                    "emergency_fund": emg_amount,
                    "martyrs_fund": mrt_amount,
                    "uhi": uhi_amount,
                    "total": total_gov
                }
            }
        }
    }
