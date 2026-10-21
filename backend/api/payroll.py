"""
Payroll API with Accounting Integration
واجهة الرواتب المتكاملة مع المحاسبة
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Response
import os
import re
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel
import uuid
import asyncio

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
from dependencies import get_current_user
from datetime import timezone

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
    # optional scope: a large company splits the month into runs by
    # department and/or branch (one run document holds every employee)
    department: Optional[str] = None
    branch: Optional[str] = None


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
        f"{prefix.lower()}_number": {"$regex": f"^{re.escape(prefix)}-{year}"}
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
    """حساب التأمينات الاجتماعية — قانون 148/2019 (services/egypt_payroll)."""
    from services.egypt_payroll import social_insurance
    r = social_insurance(basic_salary, settings)
    return r["employee"], r["employer"]


async def calculate_income_tax(annual_taxable_income: float, settings: dict,
                               company_id: str = None, tax_year: int = None) -> float:
    """ضريبة كسب العمل الشهرية — قانون 91/2005 معدلاً بالقانون 7/2024.

    annual_taxable_income = (pay − employee insurance − exempt items) × 12.
    One calculator for the whole program (services/egypt_payroll); the old
    DB / settings bracket tables gave three different answers and none was
    the law's.
    """
    from services.egypt_payroll import annual_tax, exemption_from
    taxable = annual_taxable_income - exemption_from(settings)
    return round(annual_tax(taxable) / 12, 2) if taxable > 0 else 0.0


async def get_employee_loans(employee_id: str, month: str, company_id: str) -> List[dict]:
    """الحصول على أقساط السُلف المستحقة — لشركة المسير فقط.

    It matched by employee id alone, so a payroll could pick up (and then mark
    paid) a loan belonging to another company's record with the same id."""
    loans = await db.employee_loans.find({
        "company_id": company_id,
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
    hr_settings: dict,
    company_id: Optional[str] = None,
) -> AttendancePayrollSummary:
    """
    حساب تأثير الحضور على الراتب
    يجمع بيانات الحضور للشهر ويحسب الخصومات والمكافآت
    (one employee; the payroll run prefetches all employees' records instead)
    """
    year, mon = map(int, month.split("-"))
    start_date = f"{month}-01"
    if mon == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{mon + 1:02d}-01"
    
    # جلب سجلات الحضور
    q = {"employee_id": employee_id, "date": {"$gte": start_date, "$lt": end_date}}
    if company_id:
        q["company_id"] = company_id
    records = await db.attendance_records.find(q, {"_id": 0}).to_list(length=None)
    return attendance_summary_from_records(employee_id, month, basic_salary, hr_settings, records)


def attendance_summary_from_records(
    employee_id: str,
    month: str,
    basic_salary: float,
    hr_settings: dict,
    records: list,
) -> AttendancePayrollSummary:
    """The attendance arithmetic on already-fetched records of the month."""
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
    si_exp_id, si_exp_code, si_exp_name = get_account_info(settings.get("social_insurance_expense_account"),"3367")  # تأمينات حصة الشركة 18.75%
    si_pay_id, si_pay_code, si_pay_name = get_account_info(settings.get("social_insurance_payable_account"),"255")  # التأمينات الاجتماعية المستحقة
    tax_id,    tax_code,    tax_name    = get_account_info(settings.get("income_tax_payable_account"),       "266")  # ضريبة كسب العمل
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
    # employer share as computed per employee on the capped insurable wage — it
    # was 18.75% of the whole basic payroll, overstating it for every salary above the cap
    company_si = payroll.get("total_company_social_insurance")
    if company_si is None:
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

    # مدين + دائن: صندوق دعم الأشخاص ذوي الإعاقة — قانون 10/2018
    # كان غير مسجَّل إطلاقاً رغم أنه استقطاع واجب على المنشأة
    disability_rate = float(os.environ.get("DISABILITY_FUND_RATE", "0.0005"))
    disability_amount = round(emergency_basic * disability_rate, 2)
    dis_exp_id, dis_exp_code, dis_exp_name = get_account_info(None, "3383")
    dis_pay_id, dis_pay_code, dis_pay_name = get_account_info(None, "269")
    if disability_amount > 0 and dis_exp_id and dis_pay_id:
        lines.append(JournalEntryLine(
            account_id=dis_exp_id, account_code=dis_exp_code, account_name=dis_exp_name,
            debit=disability_amount, credit=0,
            description="مصروف صندوق دعم ذوي الإعاقة — حصة المنشأة"))
        lines.append(JournalEntryLine(
            account_id=dis_pay_id, account_code=dis_pay_code, account_name=dis_pay_name,
            debit=0, credit=disability_amount,
            description="صندوق دعم ذوي الإعاقة مستحق"))

    # مدين + دائن: صندوق تكريم الشهداء والمفقودين 0.05% — قانون 148/2019
    martyrs_amount = round(emergency_basic * 0.0005, 2)
    # 338 is "مصروفات تأمين" in this chart — the martyrs fund was being posted
    # to insurance expenses. 3382 is the fund's own account.
    mrt_exp_id, mrt_exp_code, mrt_exp_name = get_account_info(None, "3382")
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
    
    # دائن: خصومات الغياب والتأخير والجزاءات والخصومات اليدوية — تخفّض مصروف
    # الأجور. They were in nobody's line: the "rounding" fix below pushed the
    # whole difference into salaries payable, so the company appeared to owe
    # its staff the very amounts it had deducted.
    other_ded = round(float(payroll.get("total_other_deductions") or 0), 2)
    # penalties: the company's choice (الإعدادات ← سياسات الشركة) — reduce the
    # wages expense with the other deductions, or hold them in 250 for the
    # staff's social services
    penalties = round(float(payroll.get("total_penalties") or 0), 2)
    if penalties > 0:
        from api.company_policies import penalties_treatment
        if await penalties_treatment(company_id) == "welfare_fund":
            fund = await db.chart_of_accounts.find_one({"company_id": company_id, "account_code": "250"}, {"_id": 0})
            if not fund:
                raise HTTPException(status_code=400, detail="الحساب 250 (حصيلة الجزاءات) غير موجود — شغّل مزامنة الحسابات الافتراضية")
            lines.append(JournalEntryLine(
                account_id=fund["id"], account_code="250", account_name=fund["account_name"],
                debit=0, credit=penalties, description="حصيلة الجزاءات — للخدمات الاجتماعية للعاملين"))
            other_ded = round(other_ded - penalties, 2)
    if other_ded > 0 and sal_id:
        lines.append(JournalEntryLine(
            account_id=sal_id, account_code=sal_code, account_name=sal_name,
            debit=0, credit=other_ded,
            description="خصومات الغياب والتأخير والجزاءات"
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
    # A platform account has no company of its own. Reading company_id blindly
    # raised a 500 that read as a broken server; it is a missing context, and
    # the screen should say so.
    if not current_user.get("company_id"):
        raise HTTPException(status_code=400,
                            detail="هذا الحساب غير مرتبط بشركة — اختر شركة أو استخدم حساباً تابعاً لها")

    from services import egypt_payroll as ep
    settings = await get_payroll_settings(current_user["company_id"])
    settings.pop("_id", None)
    # what the payroll actually uses — not the old defaults a settings row may hold
    lo, hi = ep.insurance_limits(settings)
    settings.update({
        "social_insurance_min_wage": lo, "social_insurance_max_wage": hi,
        "insurance_year": settings.get("insurance_year") or ep.INSURANCE_YEAR,
        "personal_exemption": ep.exemption_from(settings),
        "income_tax_brackets": [{"from": b["from"], "to": b["to"] or 999999999, "rate": round(b["rate"] * 100, 2)}
                                for b in ep.brackets_table()],
        "employee_social_insurance_rate": ep.EMPLOYEE_RATE, "company_social_insurance_rate": ep.EMPLOYER_RATE,
        "tax_law": "قانون 91/2005 معدلاً بالقانون 7/2024 — يُطبَّق تلقائياً",
    })
    return settings


@router.put("/settings")
async def update_settings(
    settings: dict,
    current_user: dict = Depends(get_current_user)
):
    """تحديث إعدادات الرواتب — only the fields a company may set.

    It wrote the whole body into the settings row, so any field (rates, the
    company id...) could be changed. The tax brackets and insurance rates are
    the law's and are not settings; the insurable-wage limits change every
    January and are."""
    allowed = {"social_insurance_min_wage", "social_insurance_max_wage", "insurance_year",
               "overtime_rate", "overtime_rate_holiday", "working_days_per_month", "working_hours_per_day"}
    clean = {k: v for k, v in (settings or {}).items() if k in allowed}
    for k in ("social_insurance_min_wage", "social_insurance_max_wage"):
        if k in clean:
            try:
                clean[k] = float(clean[k])
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="قيمة غير صحيحة لحد أجر الاشتراك")
            if clean[k] <= 0:
                raise HTTPException(status_code=400, detail="حد أجر الاشتراك يجب أن يكون أكبر من صفر")
    lo = clean.get("social_insurance_min_wage")
    hi = clean.get("social_insurance_max_wage")
    if lo and hi and lo >= hi:
        raise HTTPException(status_code=400, detail="الحد الأدنى لأجر الاشتراك يجب أن يكون أقل من الحد الأقصى")
    if not clean:
        raise HTTPException(status_code=400, detail="لا توجد إعدادات قابلة للتعديل")
    clean["updated_at"] = datetime.utcnow()
    clean["updated_by"] = current_user.get("user_id")
    
    await db.payroll_settings.update_one(
        {"company_id": current_user["company_id"]},
        {"$set": clean},
        upsert=True
    )
    
    return {"message": "تم تحديث الإعدادات بنجاح"}


# ==========================================
# Loans Endpoints (السُلف)
# ==========================================

async def _adopt_portal_loan_requests(company_id: str):
    """Loan requests the employee portal saved before they reached HR (only in
    ess_requests) become pending loans here, once each."""
    async for r in db.ess_requests.find({"company_id": company_id, "request_type": "loan",
                                         "status": "pending", "loan_id": {"$exists": False}}, {"_id": 0}):
        amount = float(r.get("amount") or 0)
        n = max(1, int(r.get("installments") or 3))
        if amount <= 0:
            continue
        nxt = (datetime.utcnow().replace(day=1) + timedelta(days=32)).strftime("%Y-%m")
        loan = EmployeeLoan(company_id=company_id, employee_id=r["employee_id"],
                            employee_name=r.get("employee_name", ""),
                            loan_number=await generate_number(company_id, "LOAN", "employee_loans"),
                            loan_date=str(r.get("created_at", ""))[:10] or datetime.utcnow().strftime("%Y-%m-%d"),
                            amount=round(amount, 2), installments=n, installment_amount=round(amount / n, 2),
                            remaining_amount=round(amount, 2), start_month=nxt,
                            reason=r.get("reason") or "طلب من بوابة الموظف", notes="ess")
        doc = loan.dict(); doc.update({"source": "ess", "ess_request_id": r["id"]})
        await db.employee_loans.insert_one(doc)
        await db.ess_requests.update_one({"id": r["id"]}, {"$set": {"loan_id": loan.id, "loan_number": loan.loan_number}})


@router.get("/loans")
async def get_loans(
    employee_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على السُلف"""
    await _adopt_portal_loan_requests(current_user["company_id"])
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
    employee = await db.employees.find_one({"id": request.employee_id, "company_id": company_id})
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
    # Post before marking the loan approved: the entry used to stay a draft,
    # so disbursed loans never reached the ledger. If posting fails, the loan
    # is not approved either.
    await service.post_journal_entry(result["id"], current_user["user_id"])

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
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على مسيرات الرواتب

    The response referenced total/page/limit that were never defined, so
    every call raised NameError -> 500 and the payroll runs page was empty.
    """
    query = {"company_id": current_user["company_id"]}
    if year:
        query["year"] = year
    if status:
        query["status"] = status

    total = await db.payroll_runs.count_documents(query)
    runs = await db.payroll_runs.find(query, {"_id": 0}).sort(
        [("year", -1), ("month", -1)]
    ).skip((page - 1) * limit).limit(limit).to_list(length=limit)

    return {"payroll_runs": runs, "total": total, "page": page, "limit": limit,
            "pages": -(-total // limit)}


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


# ── كشف المرتبات التفصيلي ────────────────────────────────────
# deduction columns, in the order a payroll sheet shows them; every deduction
# of a run falls in exactly one, so the columns add up to total_deductions
SHEET_DEDUCTIONS = [
    ("social_insurance", "تأمينات (حصة الموظف)"), ("income_tax", "ضريبة كسب العمل"),
    ("loans", "أقساط السلف"), ("late", "خصم تأخير"), ("absence", "خصم غياب"),
    ("penalties", "جزاءات"), ("other", "خصومات أخرى"),
]


def _deduction_column(d: dict) -> str:
    t, name = d.get("deduction_type"), str(d.get("name") or "")
    if t in ("social_insurance", "income_tax", "absence", "late"):
        return t
    if t in ("loan", "advance"):
        return "loans"
    if t == "penalty":
        return "penalties"
    if "تأخير" in name:
        return "late"
    if "غياب" in name:
        return "absence"
    return "other"


async def build_payroll_sheet(run: dict, company_id: str, department: str = None, branch: str = None) -> dict:
    emps = run.get("employees") or []
    # older runs did not store the code or branch: read them from the employee
    ids = [e.get("employee_id") for e in emps if not e.get("branch") or not e.get("employee_code")]
    extra = {x["id"]: x for x in await db.employees.find(
        {"company_id": company_id, "id": {"$in": ids}},
        {"_id": 0, "id": 1, "employee_code": 1, "branch": 1, "department": 1}).to_list(None)} if ids else {}

    allowance_cols, rows = [], []
    for e in emps:
        x = extra.get(e.get("employee_id"), {})
        row = {
            "employee_id": e.get("employee_id"), "employee_code": e.get("employee_code") or x.get("employee_code") or "",
            "employee_name": e.get("employee_name") or "", "position": e.get("position") or e.get("job_title") or "",
            "department": e.get("department") or x.get("department") or "", "branch": e.get("branch") or x.get("branch") or "",
            "basic_salary": round(float(e.get("basic_salary") or 0), 2), "allowances": {},
            "total_allowances": round(float(e.get("total_allowances") or 0), 2),
            "gross_salary": round(float(e.get("gross_salary") or 0), 2),
            "insured_salary": round(float(e.get("insured_salary") or 0), 2),
            "deductions": {k: 0.0 for k, _ in SHEET_DEDUCTIONS},
            "total_deductions": round(float(e.get("total_deductions") or 0), 2),
            "net_salary": round(float(e.get("net_salary") or 0), 2),
            "company_social_insurance": round(float(e.get("company_social_insurance") or 0), 2),
            "present_days": (e.get("attendance_summary") or {}).get("present_days"),
            "absent_days": (e.get("attendance_summary") or {}).get("absent_days"),
            "overtime_hours": (e.get("attendance_summary") or {}).get("total_overtime_hours"),
            "bank_iban": e.get("bank_iban") or "",
        }
        for a in e.get("allowances") or []:
            name = str(a.get("name") or a.get("allowance_type") or "بدل")
            if name not in allowance_cols:
                allowance_cols.append(name)
            row["allowances"][name] = round(row["allowances"].get(name, 0) + float(a.get("amount") or 0), 2)
        for d in e.get("deductions") or []:
            k = _deduction_column(d)
            row["deductions"][k] = round(row["deductions"][k] + float(d.get("amount") or 0), 2)
        row["total_cost"] = round(row["gross_salary"] + row["company_social_insurance"], 2)
        rows.append(row)

    departments = sorted({r["department"] for r in rows if r["department"]})
    branches = sorted({r["branch"] for r in rows if r["branch"]})
    if department:
        rows = [r for r in rows if (r["department"] or "") == department]
    if branch:
        rows = [r for r in rows if (r["branch"] or "") == branch]

    def tot(f):
        return round(sum(f(r) for r in rows), 2)
    totals = {
        "employees": len(rows),
        "basic_salary": tot(lambda r: r["basic_salary"]),
        "allowances": {c: tot(lambda r, c=c: r["allowances"].get(c, 0)) for c in allowance_cols},
        "total_allowances": tot(lambda r: r["total_allowances"]),
        "gross_salary": tot(lambda r: r["gross_salary"]),
        "deductions": {k: tot(lambda r, k=k: r["deductions"][k]) for k, _ in SHEET_DEDUCTIONS},
        "total_deductions": tot(lambda r: r["total_deductions"]),
        "net_salary": tot(lambda r: r["net_salary"]),
        "company_social_insurance": tot(lambda r: r["company_social_insurance"]),
        "total_cost": tot(lambda r: r["total_cost"]),
    }
    # a deduction column nobody has is left out of the sheet
    used = [{"key": k, "label": l} for k, l in SHEET_DEDUCTIONS if totals["deductions"][k] or k in ("social_insurance", "income_tax")]
    by_department = {}
    for r in rows:
        g = by_department.setdefault(r["department"] or "بدون قسم", {"employees": 0, "gross_salary": 0.0, "net_salary": 0.0, "total_cost": 0.0})
        g["employees"] += 1
        for k in ("gross_salary", "net_salary", "total_cost"):
            g[k] = round(g[k] + r[k], 2)
    return {"run": {k: run.get(k) for k in ("id", "run_number", "month", "status", "journal_entry_id")},
            "allowance_columns": allowance_cols, "deduction_columns": used, "rows": rows, "totals": totals,
            "departments": departments, "branches": branches, "by_department": by_department}


# ── who sees salary figures in payroll sheets and exports ──────────
# Every role that could open /api/payroll got every salary, national ID and
# IBAN. Roles without salary clearance (api.data_protection) now get the
# sheet/exports with money columns empty; the bank file is refused. A full
# view is recorded as pii_viewed in the audit trail.

def _salary_ok(user: dict) -> bool:
    from api.data_protection import has_salary_clearance
    return has_salary_clearance(user)


async def _note_payroll_view(user: dict, run_id: str, what: str, fields: list) -> None:
    from api.data_protection import log_pii_view
    await log_pii_view(user, "payroll_run", run_id, fields, f"كشف/تصدير رواتب: {what}")


async def _sheet_for_role(sheet: dict, user: dict, run_id: str, what: str) -> dict:
    if _salary_ok(user):
        await _note_payroll_view(user, run_id, what, ["salary"])
        return {**sheet, "salary_hidden": False}
    from api.data_protection import mask_employee
    rows = []
    for r in sheet.get("rows", []):
        m = mask_employee(r, user)
        m["allowances"] = {k: None for k in (r.get("allowances") or {})}
        m["deductions"] = {k: None for k in (r.get("deductions") or {})}
        rows.append(m)
    t = dict(sheet.get("totals") or {})
    for k in list(t):
        if k == "allowances" or k == "deductions":
            t[k] = {kk: None for kk in (t[k] or {})}
        elif k != "employees":
            t[k] = None
    by_dep = [{k: (v if k in ("department", "name", "employees", "count") else None) for k, v in d.items()}
              if isinstance(d, dict) else d for d in (sheet.get("by_department") or [])]
    return {**sheet, "rows": rows, "totals": t, "by_department": by_dep, "salary_hidden": True}


def _masked_run_rows(run: dict, user: dict) -> list:
    from api.data_protection import mask_employee
    return [mask_employee(e, user) for e in run.get("employees", [])]


async def _require_payroll_access(user: dict) -> None:
    """Payslips, the payroll sheet and every export: HR (hr permission), the
    payroll/finance roles with salary clearance, or a top role. The middleware
    only checks the /api/payroll prefix and may be in "log" mode; employees see
    their own payslip through /api/ess only."""
    from services.route_permissions import EMPLOYEE_ROLES, effective_permissions
    stored = await db.users.find_one({"id": user.get("user_id")},
                                     {"_id": 0, "role": 1, "permissions": 1, "is_platform_admin": 1}) or {}
    role = stored.get("role") or user.get("role")
    if role in EMPLOYEE_ROLES:
        raise HTTPException(403, "قسيمة راتبك من بوابة الموظف")
    if stored.get("is_platform_admin") or user.get("is_platform_admin"):
        return
    from api.data_protection import TOP_ROLES as _TOP, PAYROLL_ROLES as _PAY
    if role in _TOP or role in _PAY or "hr" in effective_permissions({**stored, "role": role}):
        return
    raise HTTPException(403, "ليس لديك صلاحية الاطلاع على الرواتب")


@router.get("/runs/{run_id}/sheet")
async def payroll_sheet(run_id: str, department: Optional[str] = None, branch: Optional[str] = None,
                        format: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """كشف المرتبات بكل مشتملاته لكل موظف — مع فلتر بالإدارة / القسم والفرع، وتصدير Excel."""
    await _require_payroll_access(current_user)
    run = await db.payroll_runs.find_one({"id": run_id, "company_id": current_user["company_id"]}, {"_id": 0})
    if not run:
        raise HTTPException(404, "مسير الرواتب غير موجود")
    sheet = await build_payroll_sheet(run, current_user["company_id"], department, branch)
    sheet = await _sheet_for_role(sheet, current_user, run_id, "xlsx" if format == "xlsx" else "sheet")
    if format != "xlsx":
        return sheet

    import io, xlsxwriter
    out = io.BytesIO()
    wb = xlsxwriter.Workbook(out, {"in_memory": True})
    ws = wb.add_worksheet("كشف المرتبات")
    ws.right_to_left()
    hdr = wb.add_format({"bold": True, "bg_color": "#1e3a8a", "font_color": "white", "align": "center",
                         "valign": "vcenter", "text_wrap": True, "border": 1, "font_name": "Arial"})
    num = wb.add_format({"num_format": "#,##0.00", "border": 1, "font_name": "Arial"})
    txt = wb.add_format({"border": 1, "font_name": "Arial"})
    tot = wb.add_format({"bold": True, "bg_color": "#dbeafe", "num_format": "#,##0.00", "border": 1, "font_name": "Arial"})
    title = f"كشف مرتبات {run.get('month', '')}" + (f" — {department}" if department else "") + (f" — {branch}" if branch else "")
    ws.write(0, 0, title, wb.add_format({"bold": True, "font_size": 14, "font_name": "Arial"}))
    cols = (["#", "الكود", "الموظف", "الوظيفة", "الإدارة / القسم", "الفرع", "الأساسي"]
            + sheet["allowance_columns"] + ["إجمالي البدلات", "إجمالي الاستحقاق", "الأجر التأميني"]
            + [d["label"] for d in sheet["deduction_columns"]] + ["إجمالي الخصومات", "صافي المرتب",
               "تأمينات (حصة الشركة)", "التكلفة على الشركة"])
    for c, h in enumerate(cols):
        ws.write(2, c, h, hdr)
        ws.set_column(c, c, 22 if c in (2, 3, 4) else 13)
    for i, r in enumerate(sheet["rows"], 1):
        vals = ([i, r["employee_code"], r["employee_name"], r["position"], r["department"], r["branch"], r["basic_salary"]]
                + [r["allowances"].get(c, 0) for c in sheet["allowance_columns"]]
                + [r["total_allowances"], r["gross_salary"], r["insured_salary"]]
                + [r["deductions"][d["key"]] for d in sheet["deduction_columns"]]
                + [r["total_deductions"], r["net_salary"], r["company_social_insurance"], r["total_cost"]])
        for c, v in enumerate(vals):
            ws.write(2 + i, c, v, num if isinstance(v, (int, float)) and c >= 6 else txt)
    t = sheet["totals"]
    last = 3 + len(sheet["rows"])
    tvals = (["الإجمالي", "", f"{t['employees']} موظف", "", "", "", t["basic_salary"]]
             + [t["allowances"][c] for c in sheet["allowance_columns"]]
             + [t["total_allowances"], t["gross_salary"], ""]
             + [t["deductions"][d["key"]] for d in sheet["deduction_columns"]]
             + [t["total_deductions"], t["net_salary"], t["company_social_insurance"], t["total_cost"]])
    for c, v in enumerate(tvals):
        ws.write(last, c, v, tot)
    ws.freeze_panes(3, 3)
    wb.close()
    return Response(content=out.getvalue(),
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="payroll_sheet_{run.get("month", "")}.xlsx"'})


def _scopes_overlap(a: dict, b: dict) -> bool:
    """Two runs of the same month may share an employee unless they name a
    different value on at least one of department / branch."""
    for k in ("department", "branch"):
        va, vb = (a.get(k) or None), (b.get(k) or None)
        if va and vb and va != vb:
            return False
    return True


@router.post("/runs")
async def create_payroll_run(
    request: PayrollRunRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء مسير رواتب جديد — للشركة كلها أو لإدارة/فرع بعينه.

    A run embeds every employee's calculation in one document (≈1–3 KB per
    employee; MongoDB caps a document at 16 MB). Large companies split the
    month into runs by department and/or branch; two runs of the same month
    must not be able to contain the same employee.
    """
    company_id = current_user["company_id"]
    department = (request.department or "").strip() or None
    branch = (request.branch or "").strip() or None
    scope = {"department": department, "branch": branch}

    # التحقق من عدم وجود مسير يغطي نفس الموظفين في نفس الشهر
    async for existing in db.payroll_runs.find(
            {"company_id": company_id, "month": request.month},
            {"_id": 0, "id": 1, "department": 1, "branch": 1}):
        if _scopes_overlap(existing, scope):
            if not (existing.get("department") or existing.get("branch")) and not (department or branch):
                raise HTTPException(status_code=400, detail="يوجد مسير رواتب لهذا الشهر بالفعل")
            raise HTTPException(status_code=400, detail=(
                "يوجد مسير رواتب لهذا الشهر يشمل نفس الموظفين"
                + (f" (الإدارة: {existing.get('department')})" if existing.get("department") else "")
                + (f" (الفرع: {existing.get('branch')})" if existing.get("branch") else "")
                + " — لا يمكن تقسيم الشهر إلا إلى مسيرات لا تتداخل (إدارات مختلفة أو فروع مختلفة)"))

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
    doc = payroll.dict()
    doc["department"] = department
    doc["branch"] = branch

    await db.payroll_runs.insert_one(doc)
    doc.pop("_id", None)

    return {"message": "تم إنشاء مسير الرواتب بنجاح", "payroll_run": doc}


# ── Payroll calculation ──────────────────────────────────────────
# The calculation used to run six queries per employee (insurance profile,
# attendance, allowances, loans, manual deductions, penalties): 5,000
# employees ≈ 30,000 round-trips, past nginx's 60 s. Every input is now read
# once per chunk of PREFETCH_CHUNK employees with {company_id, employee_id:
# {$in: ids}} and grouped in memory; the arithmetic is unchanged
# (_compute_employee_payroll is the old loop body). Runs above
# BACKGROUND_THRESHOLD employees are calculated in a background task whose
# progress is kept in payroll_jobs.
PREFETCH_CHUNK = 500
BACKGROUND_THRESHOLD = 300
# MongoDB refuses a document over 16 MB; the run embeds every employee, so
# refuse well before that and ask for the run to be split.
MAX_RUN_DOC_BYTES = 12 * 1024 * 1024
CALC_LOCK_MINUTES = 30
_background_tasks: set = set()


def _month_range(month: str) -> tuple:
    year, mon = map(int, month.split("-"))
    start = f"{month}-01"
    end = f"{year + 1}-01-01" if mon == 12 else f"{year}-{mon + 1:02d}-01"
    return start, end


async def prefetch_payroll_inputs(company_id: str, month: str, emp_ids: list) -> dict:
    """Everything the calculation reads per employee, for `emp_ids`, in six
    queries per PREFETCH_CHUNK ids. Lists keep the collection's natural order,
    as the per-employee queries returned them."""
    start, end = _month_range(month)
    out = {k: {} for k in ("profiles", "attendance", "allowances", "loans", "deductions", "penalties")}
    for i in range(0, len(emp_ids), PREFETCH_CHUNK):
        ids = emp_ids[i:i + PREFETCH_CHUNK]
        base = {"company_id": company_id, "employee_id": {"$in": ids}}
        async for p in db.employee_insurance_profiles.find(base, {"_id": 0}):
            out["profiles"].setdefault(p.get("employee_id"), p)     # find_one took the first
        async for r in db.attendance_records.find(
                {**base, "date": {"$gte": start, "$lt": end}}, {"_id": 0}):
            out["attendance"].setdefault(r.get("employee_id"), []).append(r)
        async for a in db.allowances.find({**base, "month": month}, {"_id": 0}):
            out["allowances"].setdefault(a.get("employee_id"), []).append(a)
        async for loan in db.employee_loans.find({
                **base, "status": {"$in": ["approved", "active"]},
                "start_month": {"$lte": month}, "remaining_amount": {"$gt": 0}}, {"_id": 0}):
            out["loans"].setdefault(loan.get("employee_id"), []).append({
                "loan_id": loan["id"],
                "loan_number": loan.get("loan_number"),
                "installment_amount": loan.get("installment_amount", 0),
                "remaining_amount": loan.get("remaining_amount", 0)})
        async for d in db.deductions.find({**base, "month": month}, {"_id": 0}):
            out["deductions"].setdefault(d.get("employee_id"), []).append(d)
        async for pen in db.penalties.find({
                **base, "date": {"$gte": f"{month}-01", "$lte": f"{month}-31"},
                "status": {"$in": ["pending", "approved"]}}, {"_id": 0}):
            out["penalties"].setdefault(pen.get("employee_id"), []).append(pen)
    return out


async def _compute_employee_payroll(emp: dict, month: str, company_id: str, settings: dict,
                                    hr_settings: dict, inputs: dict, totals: dict) -> dict:
    """One employee's payroll from prefetched inputs — no database access."""
    eid = emp["id"]
    basic_salary = emp.get("basic_salary", 0)

    # ══ ملف التأمين الضريبي (إن وجد) — قانون 148/2019 + 91/2005 ══
    insurance_profile = inputs["profiles"].get(eid)
    # أجر الاشتراك التأميني — من الملف أو من الراتب الأساسي
    insured_salary = (
        insurance_profile.get("insured_basic_salary") or
        insurance_profile.get("insured_salary") or
        basic_salary
    ) if insurance_profile else basic_salary

    # البدلات المعفاة + التأمين الطبي الخاص (يُخصمان من الوعاء الضريبي)
    allowances_exempt = float(insurance_profile.get("allowances_tax_exempt", 0)) if insurance_profile else 0.0
    medical_deduction = float(insurance_profile.get("medical_insurance_deduction", 0)) if insurance_profile else 0.0
    pension_deduction = float(insurance_profile.get("pension_deduction", 0)) if insurance_profile else 0.0
    bank_iban = insurance_profile.get("bank_account_iban") if insurance_profile else None

    # حساب تأثير الحضور على الراتب
    attendance_summary = attendance_summary_from_records(
        eid, month, basic_salary, hr_settings, inputs["attendance"].get(eid, []))

    # البدلات
    allowances = []
    total_allowances = 0
    for allow in inputs["allowances"].get(eid, []):
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

    deductions = []

    # 1. التأمينات الاجتماعية — على أجر الاشتراك (قانون 148/2019)
    emp_si, company_si = await calculate_social_insurance(insured_salary, settings)
    if emp_si > 0:
        deductions.append(PayrollDeduction(
            deduction_type=DeductionType.SOCIAL_INSURANCE,
            name="تأمينات اجتماعية",
            name_en="Social Insurance",
            amount=emp_si
        ))
        totals["social_insurance"] += emp_si
    totals["company_social_insurance"] = totals.get("company_social_insurance", 0) + company_si

    # 2. ضريبة كسب العمل — قانون 91/2005 م.38: الوعاء = الأجر الشامل
    #    - التأمينات - البدلات المعفاة - التأمين الطبي الخاص - صندوق المعاشات الخاص
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
    for loan in inputs["loans"].get(eid, []):
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
    for ded in inputs["deductions"].get(eid, []):
        deductions.append(PayrollDeduction(
            deduction_type=DeductionType.OTHER,
            name=ded.get("type"),
            amount=ded.get("amount", 0)
        ))
        totals["other_deductions"] += ded.get("amount", 0)

    # 7. الجزاءات المسجلة في الموارد البشرية ولم يخصمها مسير معتمد بعد
    for pen in inputs["penalties"].get(eid, []):
        amt = round(float(pen.get("amount") or 0), 2)
        if amt <= 0:
            continue
        deductions.append(PayrollDeduction(
            deduction_type=DeductionType.PENALTY,
            name=f"جزاء — {pen.get('violation', '')}"[:120],
            amount=amt,
            reference_id=pen.get("id")
        ))
        totals["other_deductions"] += amt
        totals["penalties"] = totals.get("penalties", 0) + amt

    total_deductions = sum(d.amount for d in deductions)
    net_salary = gross_salary - total_deductions

    totals["basic_salary"] += basic_salary
    totals["allowances"] += total_allowances
    totals["gross_salary"] += gross_salary
    totals["deductions"] += total_deductions
    totals["net_salary"] += net_salary

    return {
        "employee_id": eid,
        "employee_name": emp.get("name"),
        "employee_code": emp.get("employee_code"),
        "department": emp.get("department"),
        "branch": emp.get("branch"),
        "position": emp.get("position"),
        "basic_salary": basic_salary,
        "allowances": [a.dict() for a in allowances],
        "total_allowances": total_allowances,
        "deductions": [d.dict() for d in deductions],
        "total_deductions": total_deductions,
        "gross_salary": gross_salary,
        "insured_salary": insured_salary,          # أجر الاشتراك التأميني
        "employee_social_insurance": emp_si,
        "social_insurance": emp_si,
        "company_social_insurance": company_si,
        "income_tax": monthly_tax,
        "allowances_exempt": allowances_exempt,     # بدلات معفاة ضريبياً
        "medical_deduction": medical_deduction,    # تأمين طبي خاص
        "bank_iban": bank_iban,                    # IBAN للصرف
        "net_salary": net_salary,
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


class PayrollTooLarge(Exception):
    pass


def _bson_size(doc: dict) -> int:
    import bson
    try:
        return len(bson.encode(doc))
    except Exception:
        # an exotic value bson cannot encode directly: a JSON estimate
        import json
        return len(json.dumps(doc, default=str, ensure_ascii=False).encode("utf-8"))


def _run_employee_query(payroll: dict) -> dict:
    q = {"company_id": payroll["company_id"], "is_active": True}
    if payroll.get("department"):
        q["department"] = payroll["department"]
    if payroll.get("branch"):
        q["branch"] = payroll["branch"]
    return q


async def _calculate_run(payroll: dict, job_id: Optional[str] = None) -> dict:
    """Calculate and save a run (lock already held). Returns the summary."""
    company_id = payroll["company_id"]
    month = payroll["month"]
    settings = await get_payroll_settings(company_id)
    hr_settings = await get_hr_settings(company_id)

    employees = await db.employees.find(_run_employee_query(payroll), {"_id": 0}).to_list(length=None)
    if job_id:
        await db.payroll_jobs.update_one({"id": job_id}, {"$set": {"total": len(employees)}})

    employee_payrolls = []
    totals = {
        "basic_salary": 0, "allowances": 0, "gross_salary": 0, "deductions": 0,
        "net_salary": 0, "social_insurance": 0, "income_tax": 0, "loans": 0,
        "other_deductions": 0, "late_deductions": 0, "absence_deductions": 0,
        "overtime_bonus": 0
    }
    for i in range(0, len(employees), PREFETCH_CHUNK):
        chunk = employees[i:i + PREFETCH_CHUNK]
        inputs = await prefetch_payroll_inputs(company_id, month, [e["id"] for e in chunk])
        for emp in chunk:
            employee_payrolls.append(await _compute_employee_payroll(
                emp, month, company_id, settings, hr_settings, inputs, totals))
        if job_id:
            await db.payroll_jobs.update_one(
                {"id": job_id}, {"$set": {"processed": len(employee_payrolls)}})
            await asyncio.sleep(0)      # the arithmetic is CPU work: let other requests in between chunks

    update_data = {
        "employees": employee_payrolls,
        "total_employees": len(employee_payrolls),
        "total_basic_salary": round(totals["basic_salary"], 2),
        "total_allowances": round(totals["allowances"], 2),
        "total_gross_salary": round(totals["gross_salary"], 2),
        "total_deductions": round(totals["deductions"], 2),
        "total_net_salary": round(totals["net_salary"], 2),
        "total_social_insurance": round(totals["social_insurance"], 2),
        # employer share: the sum of each employee's share on his capped wage
        "total_company_social_insurance": round(totals.get("company_social_insurance", 0), 2),
        "total_income_tax": round(totals["income_tax"], 2),
        "total_loans": round(totals["loans"], 2),
        "total_other_deductions": round(totals["other_deductions"], 2),
        "total_penalties": round(totals.get("penalties", 0), 2),
        "total_late_deductions": round(totals["late_deductions"], 2),
        "total_absence_deductions": round(totals["absence_deductions"], 2),
        "total_overtime_bonus": round(totals["overtime_bonus"], 2),
        "status": "calculated",
        "calculated_at": datetime.utcnow()
    }

    # the saved document = the run as it is + this update
    size = _bson_size({**{k: v for k, v in payroll.items() if k != "_id"}, **update_data})
    if size > MAX_RUN_DOC_BYTES:
        raise PayrollTooLarge(
            f"حجم مسير الرواتب ({size / 1024 / 1024:.1f} ميجابايت لعدد {len(employee_payrolls)} موظف) "
            f"يتجاوز الحد الآمن ({MAX_RUN_DOC_BYTES / 1024 / 1024:g} ميجابايت) لمستند واحد في قاعدة البيانات. "
            "قسّم رواتب هذا الشهر إلى أكثر من مسير حسب الإدارة أو الفرع (عند إنشاء المسير) ثم احسب كل مسير على حدة.")

    await db.payroll_runs.update_one({"id": payroll["id"], "company_id": company_id}, {"$set": update_data})
    return {
        "employees": len(employee_payrolls),
        "gross_salary": round(totals["gross_salary"], 2),
        "deductions": round(totals["deductions"], 2),
        "net_salary": round(totals["net_salary"], 2),
        "attendance_adjustments": {
            "late_deductions": round(totals["late_deductions"], 2),
            "absence_deductions": round(totals["absence_deductions"], 2),
            "overtime_bonus": round(totals["overtime_bonus"], 2)
        },
        "document_bytes": size,
    }


async def _claim_calculation(run_id: str, company_id: str) -> Optional[dict]:
    """Atomically take the run's calculation lock; None if another calculation
    holds it (a lock older than CALC_LOCK_MINUTES is treated as abandoned)."""
    now = datetime.utcnow()
    stale = now - timedelta(minutes=CALC_LOCK_MINUTES)
    res = await db.payroll_runs.update_one(
        {"id": run_id, "company_id": company_id, "status": {"$in": ["draft", "calculated"]},
         "$or": [{"calc_lock_at": None}, {"calc_lock_at": {"$lt": stale}}]},
        {"$set": {"calc_lock_at": now}})
    if not res.modified_count:
        return None
    return await db.payroll_runs.find_one({"id": run_id, "company_id": company_id}, {"_id": 0})


async def _release_calculation(run_id: str, company_id: str) -> None:
    await db.payroll_runs.update_one({"id": run_id, "company_id": company_id}, {"$unset": {"calc_lock_at": ""}})


def _calc_locked(run: dict) -> bool:
    at = run.get("calc_lock_at")
    return bool(at) and at > datetime.utcnow() - timedelta(minutes=CALC_LOCK_MINUTES)


async def _calculation_job(payroll: dict, job_id: str) -> None:
    try:
        summary = await _calculate_run(payroll, job_id)
        await db.payroll_jobs.update_one({"id": job_id}, {"$set": {
            "status": "done", "summary": summary, "finished_at": datetime.utcnow()}})
    except Exception as e:                                  # noqa: BLE001 — reported on the job
        if not isinstance(e, PayrollTooLarge):
            logger.exception("payroll calculation job %s failed", job_id)
        await db.payroll_jobs.update_one({"id": job_id}, {"$set": {
            "status": "error", "error": str(e) if isinstance(e, PayrollTooLarge) else f"تعذّر حساب الرواتب: {e}",
            "finished_at": datetime.utcnow()}})
    finally:
        await _release_calculation(payroll["id"], payroll["company_id"])


@router.post("/runs/{run_id}/calculate")
async def calculate_payroll(
    run_id: str,
    current_user: dict = Depends(get_current_user)
):
    """حساب الرواتب مع ربط الحضور.

    Up to BACKGROUND_THRESHOLD employees: calculated in the request, as before.
    Above it: a payroll_jobs record is created, the calculation runs in the
    background and the response is {"background": true, "job_id", "total"};
    GET /runs/{id}/job reports progress. Only one calculation of a run at a time.
    """
    company_id = current_user["company_id"]

    payroll = await db.payroll_runs.find_one({"id": run_id, "company_id": company_id}, {"_id": 0})
    if not payroll:
        raise HTTPException(status_code=404, detail="مسير الرواتب غير موجود")
    if payroll["status"] not in ["draft", "calculated"]:
        raise HTTPException(status_code=400, detail="لا يمكن حساب هذا المسير")

    payroll = await _claim_calculation(run_id, company_id)
    if not payroll:
        raise HTTPException(status_code=409, detail="يجري حساب هذا المسير الآن — انتظر حتى ينتهي الحساب الحالي")

    try:
        total = await db.employees.count_documents(_run_employee_query(payroll))
    except Exception:
        await _release_calculation(run_id, company_id)
        raise

    if total > BACKGROUND_THRESHOLD:
        job = {"id": str(uuid.uuid4()), "run_id": run_id, "company_id": company_id,
               "status": "running", "processed": 0, "total": total, "error": None,
               "created_by": current_user.get("user_id"), "created_at": datetime.utcnow()}
        await db.payroll_jobs.insert_one(dict(job))
        task = asyncio.create_task(_calculation_job(payroll, job["id"]))
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
        return {"message": f"بدأ حساب رواتب {total} موظف في الخلفية",
                "background": True, "job_id": job["id"], "total": total}

    try:
        summary = await _calculate_run(payroll)
    except PayrollTooLarge as e:
        raise HTTPException(status_code=413, detail=str(e))
    finally:
        await _release_calculation(run_id, company_id)
    summary.pop("document_bytes", None)
    return {"message": "تم حساب الرواتب بنجاح", "summary": summary}


@router.get("/runs/{run_id}/job")
async def get_calculation_job(run_id: str, current_user: dict = Depends(get_current_user)):
    """تقدّم آخر عملية حساب في الخلفية لهذا المسير."""
    company_id = current_user["company_id"]
    jobs = await db.payroll_jobs.find({"run_id": run_id, "company_id": company_id}, {"_id": 0}) \
        .sort("created_at", -1).limit(1).to_list(1)
    if not jobs:
        raise HTTPException(status_code=404, detail="لا توجد عملية حساب لهذا المسير")
    j = jobs[0]
    if j.get("status") == "running" and j.get("created_at") and \
            j["created_at"] < datetime.utcnow() - timedelta(minutes=CALC_LOCK_MINUTES):
        # the server restarted mid-job: the task is gone and the lock has expired
        j["status"], j["error"] = "error", "انقطع الحساب (أُعيد تشغيل الخادم) — أعد حساب المسير"
        await db.payroll_jobs.update_one({"id": j["id"]}, {"$set": {"status": "error", "error": j["error"]}})
    total = j.get("total") or 0
    j["percent"] = 100 if j.get("status") == "done" else (
        round(100 * (j.get("processed") or 0) / total) if total else 0)
    return j


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
    if _calc_locked(payroll):
        raise HTTPException(status_code=409, detail="يجري إعادة حساب هذا المسير الآن — اعتمده بعد انتهاء الحساب")
    
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
    
    # الجزاءات المخصومة في هذا المسير لا تُخصم مرة ثانية
    pen_ids = [d.get("reference_id") for e in payroll.get("employees", []) for d in e.get("deductions", [])
               if d.get("deduction_type") == "penalty" and d.get("reference_id")]
    if pen_ids:
        await db.penalties.update_many(
            {"company_id": company_id, "id": {"$in": pen_ids}},
            {"$set": {"status": "deducted", "payroll_run_id": payroll.get("id")}})

    # تحديث أرصدة السُلف
    for emp in payroll.get("employees", []):
        for ded in emp.get("deductions", []):
            if ded.get("deduction_type") == "loan" and ded.get("reference_id"):
                loan = await db.employee_loans.find_one({"id": ded["reference_id"], "company_id": company_id})
                if loan:
                    new_paid = loan.get("paid_amount", 0) + ded["amount"]
                    new_remaining = loan.get("remaining_amount", loan["amount"]) - ded["amount"]
                    new_status = "paid" if new_remaining <= 0 else "active"
                    
                    await db.employee_loans.update_one(
                        {"id": ded["reference_id"], "company_id": company_id},
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
    bank_id, bank_code, bank_name = get_acc(settings.get("bank_account"), "162")  # البنك (111 is Land in this chart)
    
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
    
    employee = await db.employees.find_one({"id": request.employee_id, "company_id": company_id})
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    if request.other_entitlements < 0 or request.other_deductions < 0:
        raise HTTPException(status_code=400, detail="المبالغ الأخرى لا تكون سالبة")
    if await db.end_of_service.find_one({"company_id": company_id, "employee_id": request.employee_id,
                                         "status": {"$in": ["pending", "approved"]}}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="توجد تسوية نهاية خدمة لهذا الموظف بالفعل")

    # one end-of-service rule for the company: the HR policy
    # (الموارد البشرية ← الإجازات والإضافي والجزاءات ← السياسة). This used its
    # own payroll-settings rates, so the two screens gave different amounts.
    from api.hr_engine import get_policy
    policy = await get_policy(company_id)
    
    # حساب مدة الخدمة
    hire_date = datetime.strptime(employee["hire_date"], "%Y-%m-%d")
    end_date = datetime.strptime(request.end_date, "%Y-%m-%d")
    service_days = (end_date - hire_date).days
    if service_days < 0:
        raise HTTPException(status_code=400, detail="تاريخ نهاية الخدمة قبل تاريخ التعيين")
    years = service_days / 365.25
    months = int(service_days / 30.44)
    
    basic_salary = float(employee.get("basic_salary", 0) or 0)
    
    # حساب مكافأة نهاية الخدمة
    eos_amount = 0.0
    if policy.get("gratuity_enabled", True):
        first, after = float(policy["gratuity_months_first_5"]), float(policy["gratuity_months_after_5"])
        eos_amount = (min(years, 5) * first + max(years - 5, 0) * after) * basic_salary
    
    # الحصول على السُلف المستحقة
    pending_loans = await db.employee_loans.aggregate([
        {"$match": {
            "company_id": company_id,
            "employee_id": request.employee_id,
            "status": {"$in": ["approved", "active"]},
            "remaining_amount": {"$gt": 0}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$remaining_amount"}}}
    ]).to_list(length=1)
    
    pending_loans_amount = round(pending_loans[0]["total"], 2) if pending_loans else 0.0

    # salary tax on the payout, when the company's accountant says it applies
    # (HR policy «eos_taxable»): the extra tax the lump sum adds on top of a
    # year's salary, with the Law 7/2024 brackets
    eos_tax = 0.0
    if policy.get("eos_taxable") and eos_amount > 0:
        from services.egypt_payroll import annual_tax, social_insurance, PERSONAL_EXEMPTION
        si = social_insurance(basic_salary, await get_payroll_settings(company_id))["employee"]
        base = max((basic_salary - si) * 12 - PERSONAL_EXEMPTION, 0)
        eos_tax = round(annual_tax(base + eos_amount) - annual_tax(base), 2)
    
    total_entitlements = eos_amount + request.other_entitlements
    total_deductions = pending_loans_amount + request.other_deductions + eos_tax
    net_settlement = total_entitlements - total_deductions
    if net_settlement < 0:
        raise HTTPException(status_code=400, detail=f"الخصومات أكبر من المستحقات بـ {abs(net_settlement):,.2f} — "
                                                    "سجّل الباقي كسلفة مستحقة بدل التسوية")
    
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
    
    doc = {**settlement.dict(), "income_tax": eos_tax}
    await db.end_of_service.insert_one(doc)
    doc.pop("_id", None)
    return {"message": "تم إنشاء تسوية نهاية الخدمة", "settlement": doc}


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
    
    # Every part of the settlement has its line. Other entitlements and other
    # deductions used to be in the net paid but not in the entry, so any
    # settlement with them was out of balance and could not be approved.
    def need(setting_val, code, label):
        acc_id, acc_code, acc_name = get_acc(setting_val, code)
        if not acc_id:
            raise HTTPException(status_code=400, detail=f"الحساب {code} ({label}) غير موجود في دليل الحسابات")
        return acc_id, acc_code, acc_name

    lines = []

    def add(acc, debit, credit, text):
        if round(debit or credit, 2):
            lines.append(JournalEntryLine(account_id=acc[0], account_code=acc[1], account_name=acc[2],
                                          debit=round(debit, 2), credit=round(credit, 2), description=text).dict())

    eos_tax = float(settlement.get("income_tax") or 0)
    add(need(settings.get("eos_provision_account"), "223", "مخصص مكافأة نهاية الخدمة"),
        settlement["end_of_service_amount"], 0, "مكافأة نهاية الخدمة")
    if settlement.get("other_entitlements"):
        add(need(settings.get("salaries_expense_account"), "331", "الرواتب والأجور"),
            settlement["other_entitlements"], 0, "مستحقات أخرى في التسوية")
    if settlement.get("pending_loans"):
        add(need(settings.get("loans_receivable_account"), "134", "سلف الموظفين"),
            0, settlement["pending_loans"], "تسوية سُلف")
    if settlement.get("other_deductions"):
        add(need(None, "423", "إيرادات متنوعة"), 0, settlement["other_deductions"], "خصومات أخرى من التسوية")
    if eos_tax:
        add(need(settings.get("income_tax_payable_account"), "266", "ضريبة كسب العمل المستقطعة"),
            0, eos_tax, "ضريبة كسب العمل على مكافأة نهاية الخدمة")
    if settlement["net_settlement"]:
        add(need(settings.get("bank_account"), "162", "البنك"), 0, settlement["net_settlement"],
            "صرف تسوية نهاية الخدمة")
    
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
    # Post before closing the settlement (it used to stay a draft forever).
    await service.post_journal_entry(result["id"], current_user["user_id"])

    # إيقاف الموظف
    await db.employees.update_one(
        {"id": settlement["employee_id"], "company_id": settlement["company_id"]},
        {"$set": {"is_active": False}}
    )
    
    # تسوية السُلف
    await db.employee_loans.update_many(
        {
            "company_id": settlement["company_id"],
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
    await _require_payroll_access(current_user)
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
    
    # the month's attendance of all employees in one query per chunk, not one per employee
    start, end = _month_range(month)
    records_by_emp = {}
    ids = [e["id"] for e in employees]
    for i in range(0, len(ids), PREFETCH_CHUNK):
        async for r in db.attendance_records.find(
                {"company_id": company_id, "employee_id": {"$in": ids[i:i + PREFETCH_CHUNK]},
                 "date": {"$gte": start, "$lt": end}}, {"_id": 0}):
            records_by_emp.setdefault(r.get("employee_id"), []).append(r)

    for emp in employees:
        basic_salary = emp.get("basic_salary", 0)
        summary = attendance_summary_from_records(
            emp["id"], month, basic_salary, hr_settings, records_by_emp.get(emp["id"], [])
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


PAY_METHODS = ("bank_transfer", "cash", "instapay", "vodafone_cash")
_METHOD_WORDS = {"bank": "bank_transfer", "بنك": "bank_transfer", "تحويل بنكي": "bank_transfer",
                 "نقدي": "cash", "نقدا": "cash", "انستاباي": "instapay", "فودافون كاش": "vodafone_cash"}


def _norm_method(m) -> str:
    m = str(m or "").strip()
    m = _METHOD_WORDS.get(m, _METHOD_WORDS.get(m.lower(), m.lower()))
    return m if m in PAY_METHODS else "bank_transfer"


async def _transfer_rows(payroll: dict, company_id: str) -> list:
    """One row per employee in the run with where the net salary goes.

    The employee and user lookups used to be by bare id — a run row whose id
    matched another company's employee picked up that company's bank details.
    Every lookup is now limited to the run's company. Net is rounded to 2
    decimals here, once, so the report, the bank file and the totals agree.
    Employees and users are read in chunks of PREFETCH_CHUNK ids (two queries
    per chunk instead of two per employee).
    """
    run_emps = payroll.get("employees", []) or []
    ids = list(dict.fromkeys(e.get("employee_id") for e in run_emps if e.get("employee_id")))
    emp_docs, users = {}, {}
    for i in range(0, len(ids), PREFETCH_CHUNK):
        chunk = ids[i:i + PREFETCH_CHUNK]
        async for d in db.employees.find({"company_id": company_id, "id": {"$in": chunk}}, {"_id": 0}):
            emp_docs.setdefault(d["id"], d)
        async for u in db.users.find({"company_id": company_id, "id": {"$in": chunk}},
                                     {"_id": 0, "id": 1, "email": 1}):
            users.setdefault(u["id"], u)
    rows = []
    for emp in run_emps:
        eid = emp.get("employee_id")
        emp_doc = emp_docs.get(eid) or {}
        emp_user = users.get(eid) or {}
        pay_method = emp.get("payment_method") or ""
        if not pay_method or pay_method == "bank_transfer":
            pay_method = emp_doc.get("payment_method") or "bank_transfer"
        rows.append({
            "employee_id":    eid,
            "employee_code":  emp_doc.get("employee_code", "") or "",
            "employee_name":  emp.get("employee_name", "") or emp_doc.get("name", ""),
            "national_id":    emp_doc.get("national_id", "") or "",
            "department":     emp.get("department", "") or "",
            "position":       emp.get("position", "") or "",
            "net_salary":     round(float(emp.get("net_salary", 0) or 0), 2),
            "payment_method": _norm_method(pay_method),
            "bank_name":      emp_doc.get("bank_name", "") or "",
            "account_number": emp_doc.get("bank_account_number", "") or "",
            "iban":           emp_doc.get("iban", "") or emp.get("bank_iban", "") or "",
            "wallet_number":  emp_doc.get("wallet_number", "") or "",
            "email":          emp_user.get("email", ""),
        })
    return rows


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

    rows = await _transfer_rows(payroll, company_id)
    totals = {"bank_transfer": 0, "cash": 0, "instapay": 0, "vodafone_cash": 0, "total": 0}
    for r in rows:
        totals[r["payment_method"]] = round(totals.get(r["payment_method"], 0) + r["net_salary"], 2)
        totals["total"] = round(totals["total"] + r["net_salary"], 2)

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
    await _require_payroll_access(current_user)
    run = await db.payroll_runs.find_one(
        {"id": run_id, "company_id": current_user["company_id"]}, {"_id": 0}
    )
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")

    import csv, io
    output = io.StringIO()
    # the BOM comes from encoding with utf-8-sig below; writing "\ufeff" here
    # as well put two BOMs in the file and the first header cell opened in
    # Excel as "\ufeffاسم الموظف" (a stray character before the title)
    fieldnames = [
        "اسم الموظف", "الوظيفة", "القسم", "الراتب الأساسي",
        "البدلات", "الخصومات", "التأمينات", "ضريبة الدخل", "صافي الراتب", "طريقة الصرف"
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    if _salary_ok(current_user):
        await _note_payroll_view(current_user, run_id, "csv", ["salary"])
    for emp in _masked_run_rows(run, current_user):
        writer.writerow({
            "اسم الموظف": emp.get("employee_name", ""),
            "الوظيفة": emp.get("job_title") or emp.get("position", ""),   # run rows carry `position`
            "القسم": emp.get("department", ""),
            "الراتب الأساسي": emp.get("basic_salary", 0),
            "البدلات": emp.get("total_allowances", 0),
            "الخصومات": emp.get("total_deductions", 0),
            "التأمينات": emp.get("social_insurance", 0),
            "ضريبة الدخل": emp.get("income_tax", 0),
            "صافي الراتب": emp.get("net_salary", 0),
            "طريقة الصرف": emp.get("payment_method", "بنك"),
        })
    month_str = _run_period(run)
    return Response(
        content=output.getvalue().encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="payroll_{month_str}.csv"'}
    )


def _run_period(run: dict) -> str:
    """The run's month as YYYY-MM. `month` is stored as "YYYY-MM"; the files
    used f"{year}-{month}" and printed "2026-2026-09". Very old runs kept the
    month number alone, so a bare number is still combined with `year`."""
    m = str(run.get("month") or "").strip()
    if "-" in m:
        return m
    if m and run.get("year"):
        return f"{run.get('year')}-{m.zfill(2)}"
    return m


# ── Bank salary files ────────────────────────────────────────────
# A registry of bulk-upload layouts. IMPORTANT: apart from "generic", these
# follow the layout commonly used by each bank's / wallet's bulk salary
# template (a control/header record with the company debit account, value
# date, total amount and record count, then one record per beneficiary, and
# a trailer where the template uses one). Banks change their templates and
# issue company-specific variants: every layout must be checked against the
# template the company's own bank provides before the first upload.
BANK_FILE_DISCLAIMER = ("هذه الصيغ مبنية على النماذج الشائعة لملفات الرواتب المجمّعة لدى البنوك والمحافظ، "
                        "وليست النموذج الرسمي المعتمد لأي بنك. راجِع الملف مع النموذج الذي يسلّمه بنك الشركة "
                        "قبل أول رفع، وعدّل إعدادات حساب الخصم وكود البنك.")


def _fmt_date(d: str, style: str) -> str:
    y, m, dd = d.split("-")
    return {"ymd": f"{y}{m}{dd}", "dmy/": f"{dd}/{m}/{y}", "iso": d}[style]


def _acct(r: dict) -> str:
    return r["iban"].replace(" ", "").upper() or str(r["account_number"]).strip()


def _wallet(r: dict) -> str:
    return str(r["wallet_number"] or "").strip()


def _bf_generic(rows, ctx):
    method = ctx["method"]
    if method == "bank_transfer":
        out = [["م", "كود الموظف", "اسم الموظف", "الرقم القومي", "البنك", "رقم الحساب", "IBAN",
                "المبلغ", "العملة", "المرجع", "البيان"]]
    else:
        out = [["م", "كود الموظف", "اسم الموظف", "الرقم القومي",
                "رقم الموبايل / عنوان InstaPay" if method == "instapay" else "رقم محفظة فودافون كاش",
                "المبلغ", "العملة", "المرجع", "البيان"]]
    for i, r in enumerate(rows, 1):
        head = [i, r["employee_code"], r["employee_name"], str(r["national_id"] or "").strip()]
        if method == "bank_transfer":
            out.append(head + [r["bank_name"], str(r["account_number"] or "").strip(),
                               r["iban"].replace(" ", "").upper(), r["net_salary"], "EGP", r["ref"], ctx["memo"]])
        else:
            out.append(head + [_wallet(r), r["net_salary"], "EGP", r["ref"], ctx["memo"]])
    return out


def _bf_cib(rows, ctx):
    # H / D / T records, no column-title row
    out = [["H", ctx["debit_account"], _fmt_date(ctx["value_date"], "ymd"), len(rows), ctx["total"], "EGP",
            ctx["file_ref"], ctx["bank_code"]]]
    for i, r in enumerate(rows, 1):
        out.append(["D", i, r["employee_name"], _acct(r), r["net_salary"], "EGP", r["ref"], "SALA",
                    str(r["national_id"] or "").strip()])
    out.append(["T", len(rows), ctx["total"]])
    return out


def _bf_qnb(rows, ctx):
    out = [["H", ctx["bank_code"], ctx["debit_account"], _fmt_date(ctx["value_date"], "dmy/"), ctx["total"],
            len(rows), "EGP", ctx["file_ref"]]]
    for r in rows:
        out.append(["D", _acct(r), r["employee_name"], r["net_salary"], "EGP", r["ref"], ctx["memo_en"]])
    out.append(["T", len(rows), ctx["total"]])
    return out


def _bf_nbe(rows, ctx):
    out = [["رقم حساب الخصم", "تاريخ القيمة", "عدد السجلات", "إجمالي المبلغ", "العملة", "كود البنك / الفرع"],
           [ctx["debit_account"], _fmt_date(ctx["value_date"], "dmy/"), len(rows), ctx["total"], "EGP",
            ctx["bank_code"]],
           [],
           ["م", "اسم المستفيد", "رقم الحساب", "IBAN", "المبلغ", "الرقم القومي", "البيان"]]
    for i, r in enumerate(rows, 1):
        out.append([i, r["employee_name"], str(r["account_number"] or "").strip(),
                    r["iban"].replace(" ", "").upper(), r["net_salary"], str(r["national_id"] or "").strip(),
                    ctx["memo"]])
    out.append(["الإجمالي", "", "", "", ctx["total"], "", f"{len(rows)} سجل"])
    return out


def _bf_banque_misr(rows, ctx):
    out = [["Debit Account", "Value Date", "Currency", "Total Amount", "Records Count", "Company Code"],
           [ctx["debit_account"], _fmt_date(ctx["value_date"], "dmy/"), "EGP", ctx["total"], len(rows),
            ctx["bank_code"]],
           ["Seq", "Employee ID", "Beneficiary Name", "Account Number", "IBAN", "Amount", "National ID", "Narrative"]]
    for i, r in enumerate(rows, 1):
        out.append([i, r["employee_code"], r["employee_name"], str(r["account_number"] or "").strip(),
                    r["iban"].replace(" ", "").upper(), r["net_salary"], str(r["national_id"] or "").strip(),
                    ctx["memo_en"]])
    return out


def _bf_instapay(rows, ctx):
    out = [["Debit Account", "Value Date", "Total Amount", "Records Count", "Currency"],
           [ctx["debit_account"], _fmt_date(ctx["value_date"], "iso"), ctx["total"], len(rows), "EGP"],
           ["Seq", "Mobile / IPA", "Beneficiary Name", "Amount", "Reference", "Description"]]
    for i, r in enumerate(rows, 1):
        out.append([i, _wallet(r), r["employee_name"], r["net_salary"], r["ref"], ctx["memo_en"]])
    return out


def _bf_vodafone(rows, ctx):
    out = [["Corporate Account", "Value Date", "Total Amount", "Records Count"],
           [ctx["debit_account"], _fmt_date(ctx["value_date"], "iso"), ctx["total"], len(rows)],
           ["MSISDN", "Amount", "Name", "Reference"]]
    for r in rows:
        out.append([_wallet(r), r["net_salary"], r["employee_name"], r["ref"]])
    return out


BANK_FILE_FORMATS = {
    "generic":            {"label_ar": "عام (CSV قابل للتحويل لأي بنك)", "label_en": "Generic",
                           "methods": ("bank_transfer", "instapay", "vodafone_cash"), "needs_debit": False,
                           "writer": _bf_generic},
    "cib":                {"label_ar": "البنك التجاري الدولي CIB", "label_en": "CIB",
                           "methods": ("bank_transfer",), "needs_debit": True, "writer": _bf_cib},
    "nbe":                {"label_ar": "البنك الأهلي المصري", "label_en": "National Bank of Egypt",
                           "methods": ("bank_transfer",), "needs_debit": True, "writer": _bf_nbe},
    "banque_misr":        {"label_ar": "بنك مصر", "label_en": "Banque Misr",
                           "methods": ("bank_transfer",), "needs_debit": True, "writer": _bf_banque_misr},
    "qnb":                {"label_ar": "بنك QNB", "label_en": "QNB",
                           "methods": ("bank_transfer",), "needs_debit": True, "writer": _bf_qnb},
    "instapay_bulk":      {"label_ar": "InstaPay — تحويل مجمّع", "label_en": "InstaPay bulk",
                           "methods": ("instapay",), "needs_debit": True, "writer": _bf_instapay},
    "vodafone_cash_bulk": {"label_ar": "فودافون كاش — صرف مجمّع", "label_en": "Vodafone Cash bulk",
                           "methods": ("vodafone_cash",), "needs_debit": True, "writer": _bf_vodafone},
}


def bank_file_formats_public() -> list:
    return [{"id": k, "label_ar": v["label_ar"], "label_en": v["label_en"], "methods": list(v["methods"]),
             "requires_debit_account": v["needs_debit"], "verified_template": False}
            for k, v in BANK_FILE_FORMATS.items()]


async def _bank_file_settings(company_id: str) -> dict:
    s = await db.payroll_bank_file_settings.find_one({"company_id": company_id}, {"_id": 0}) or {}
    return {"debit_account_number": s.get("debit_account_number") or "",
            "bank_code": s.get("bank_code") or "",
            "value_date": s.get("value_date") or "",
            "default_format": s.get("default_format") or "generic",
            "updated_at": s.get("updated_at")}


def render_bank_file(rows: list, ctx: dict, bank: str, file_type: str = "csv") -> tuple:
    """(bytes, media_type, extension) of the bank file for `rows`."""
    table = BANK_FILE_FORMATS[bank]["writer"](rows, ctx)
    if file_type == "xlsx":
        import io, xlsxwriter
        buf = io.BytesIO()
        wb = xlsxwriter.Workbook(buf, {"in_memory": True})
        ws = wb.add_worksheet("Salaries")
        money = wb.add_format({"num_format": "0.00"})
        for ri, row in enumerate(table):
            for ci, v in enumerate(row):
                if isinstance(v, float):
                    ws.write_number(ri, ci, v, money)
                elif isinstance(v, int) and not isinstance(v, bool):
                    ws.write_number(ri, ci, v)
                else:
                    # account numbers, IBANs, IDs and mobiles stay text (no
                    # scientific notation, no lost leading zero)
                    ws.write_string(ri, ci, str(v if v is not None else ""))
        ws.set_column(0, max((len(r) for r in table), default=1), 20)
        wb.close()
        return buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"
    import csv, io
    out = io.StringIO()
    w = csv.writer(out, quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")
    for row in table:
        # values are written as-is (no ="..." Excel trick): a bank portal that
        # reads the CSV would take the quotes and = sign as part of the number.
        w.writerow([f"{v:.2f}" if isinstance(v, float) else ("" if v is None else v) for v in row])
    return out.getvalue().encode("utf-8-sig"), "text/csv; charset=utf-8", "csv"      # BOM so Excel reads the Arabic


@router.get("/runs/{run_id}/export/bank-file")
async def export_bank_transfer_file(
    run_id: str,
    method: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    bank: str = "generic",            # plain defaults (still query params) so direct calls work
    file_type: str = "csv",
    value_date: Optional[str] = None,
):
    """ملف التحويل للبنك أو InstaPay أو فودافون كاش — طريقة واحدة لكل ملف.

    `bank` picks the layout from BANK_FILE_FORMATS: "generic" is the plain CSV
    (one header row, one row per employee paid by `method`, amounts with 2
    decimals, a reference per transfer) that any bank template can be filled
    from; the others follow the common bulk-upload layout of CIB, NBE, Banque
    Misr, QNB, InstaPay and Vodafone Cash with the company debit account, value
    date, total and record count (bank-file-settings). Those layouts are NOT
    the banks' official specifications and must be checked against the
    template the company's bank provides. `file_type` = csv | xlsx.
    An employee without the account details the method needs stops the file,
    naming who, rather than sending a blank transfer.
    """
    await _require_payroll_access(current_user)
    if bank not in BANK_FILE_FORMATS:
        raise HTTPException(status_code=400, detail=f"صيغة البنك غير معروفة: {bank}")
    fmt = BANK_FILE_FORMATS[bank]
    method = method or fmt["methods"][0]
    if method not in ("bank_transfer", "instapay", "vodafone_cash"):
        raise HTTPException(status_code=400, detail="طريقة الصرف يجب أن تكون bank_transfer أو instapay أو vodafone_cash")
    if method not in fmt["methods"]:
        raise HTTPException(status_code=400, detail=f"صيغة {fmt['label_ar']} لا تصلح لطريقة الصرف المختارة")
    if file_type not in ("csv", "xlsx"):
        raise HTTPException(status_code=400, detail="نوع الملف csv أو xlsx")
    company_id = current_user["company_id"]
    payroll = await db.payroll_runs.find_one({"id": run_id, "company_id": company_id}, {"_id": 0})
    if not payroll:
        raise HTTPException(status_code=404, detail="مسير الرواتب غير موجود")
    if payroll.get("status") not in ("approved", "paid"):
        raise HTTPException(status_code=400, detail="يجب اعتماد المسير أولاً")
    from api.data_protection import has_pii_clearance
    if not (_salary_ok(current_user) and has_pii_clearance(current_user)):
        # a bank file with masked accounts is useless and a full one is
        # exactly the data this role may not see
        raise HTTPException(status_code=403, detail="ملف التحويل البنكي لمدير الموارد البشرية أو المدير المالي أو الإدارة العليا فقط")

    settings = await _bank_file_settings(company_id)
    if fmt["needs_debit"] and not settings["debit_account_number"]:
        raise HTTPException(status_code=422, detail={
            "message": "أدخل رقم حساب الخصم للشركة في إعدادات ملف البنك قبل تصدير هذه الصيغة.",
            "errors": ["رقم حساب الخصم غير مسجل"]})
    today = datetime.now(timezone(timedelta(hours=2))).strftime("%Y-%m-%d")    # Cairo
    vd = value_date or settings["value_date"] or today
    try:
        datetime.strptime(vd, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="تاريخ القيمة بصيغة YYYY-MM-DD")
    if vd < today and not value_date:
        vd = today              # a saved date that has passed: banks refuse back-dated value dates

    await _note_payroll_view(current_user, run_id, f"bank-file {method} {bank}",
                             ["salary", "national_id", "iban", "bank_account_number"])

    rows = [r for r in await _transfer_rows(payroll, company_id)
            if r["payment_method"] == method and r["net_salary"] > 0]
    if not rows:
        raise HTTPException(status_code=404, detail="لا يوجد موظفون يُصرف لهم بهذه الطريقة في هذا المسير")

    def mobile_ok(v):
        d = "".join(ch for ch in v if ch.isdigit())
        return len(d) == 11 and d.startswith("01")

    missing = []
    for r in rows:
        iban = r["iban"].replace(" ", "").upper()
        if method == "bank_transfer" and not (iban or r["account_number"]):
            missing.append(f"{r['employee_name']}: لا يوجد IBAN ولا رقم حساب")
        elif method == "bank_transfer" and iban and not (
                len(iban) == 29 and iban.startswith("EG") and iban[2:].isdigit()):
            # an Egyptian IBAN is EG + 27 digits; anything else bounces at the bank
            missing.append(f"{r['employee_name']}: IBAN «{r['iban']}» غير صحيح (EG + 27 رقماً)")
        elif method == "vodafone_cash" and not mobile_ok(r["wallet_number"]):
            missing.append(f"{r['employee_name']}: رقم المحفظة «{r['wallet_number']}» ليس رقم موبايل مصري (11 رقماً يبدأ بـ 01)")
        elif method == "instapay" and not (mobile_ok(r["wallet_number"]) or "@" in r["wallet_number"]):
            missing.append(f"{r['employee_name']}: لا يوجد رقم موبايل أو عنوان InstaPay (مثل name@instapay)")
    if missing:
        raise HTTPException(status_code=422, detail={
            "message": f"لم يُصدَّر الملف — {len(missing)} موظف بياناتهم ناقصة. أكملها في بيانات الموظف ثم صدّر مرة أخرى.",
            "errors": missing})

    period = _run_period(payroll)
    ref_base = f"SAL-{payroll.get('payroll_number') or period}"
    total = 0.0
    for i, r in enumerate(rows, 1):
        r["ref"] = f"{ref_base}-{r['employee_code'] or i}"
        total = round(total + r["net_salary"], 2)
    ctx = {"method": method, "period": period, "memo": f"راتب {period}", "memo_en": f"Salary {period}",
           "debit_account": settings["debit_account_number"], "bank_code": settings["bank_code"],
           "value_date": vd, "total": total, "file_ref": ref_base}
    content, media_type, ext = render_bank_file(rows, ctx, bank, file_type)
    name = f"salary_{method}_{period}" if bank == "generic" else f"salary_{bank}_{period}"
    return Response(
        content=content, media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{name}.{ext}"',
                 "X-Transfer-Count": str(len(rows)), "X-Transfer-Total": f"{total:.2f}",
                 "X-Bank-Format": bank, "X-Value-Date": vd,
                 "Access-Control-Expose-Headers": "X-Transfer-Count, X-Transfer-Total, X-Bank-Format, X-Value-Date"})


class BankFileSettingsRequest(BaseModel):
    debit_account_number: Optional[str] = ""
    bank_code: Optional[str] = ""
    value_date: Optional[str] = ""
    default_format: Optional[str] = "generic"


@router.get("/bank-file-settings")
async def get_bank_file_settings(current_user: dict = Depends(get_current_user)):
    """إعدادات ملفات تحويل الرواتب للبنوك + الصيغ المتاحة."""
    if not _salary_ok(current_user):
        raise HTTPException(status_code=403, detail="إعدادات ملف البنك لمن له صلاحية الاطلاع على الرواتب فقط")
    return {"settings": await _bank_file_settings(current_user["company_id"]),
            "formats": bank_file_formats_public(), "disclaimer": BANK_FILE_DISCLAIMER}


@router.put("/bank-file-settings")
async def update_bank_file_settings(request: BankFileSettingsRequest,
                                    current_user: dict = Depends(get_current_user)):
    from api.data_protection import has_pii_clearance
    if not (_salary_ok(current_user) and has_pii_clearance(current_user)):
        raise HTTPException(status_code=403, detail="تعديل إعدادات ملف البنك لمدير الموارد البشرية أو المدير المالي أو الإدارة العليا فقط")
    acct = "".join(str(request.debit_account_number or "").split()).upper()
    if acct and not (acct.isalnum() and 6 <= len(acct) <= 34):
        raise HTTPException(status_code=400, detail="رقم حساب الخصم: أرقام/حروف فقط من 6 إلى 34 خانة (رقم حساب أو IBAN)")
    code = str(request.bank_code or "").strip()
    if len(code) > 20:
        raise HTTPException(status_code=400, detail="كود البنك / الفرع لا يزيد عن 20 خانة")
    vd = str(request.value_date or "").strip()
    if vd:
        try:
            datetime.strptime(vd, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="تاريخ القيمة بصيغة YYYY-MM-DD")
    fmt = request.default_format or "generic"
    if fmt not in BANK_FILE_FORMATS:
        raise HTTPException(status_code=400, detail="صيغة البنك غير معروفة")
    company_id = current_user["company_id"]
    await db.payroll_bank_file_settings.update_one(
        {"company_id": company_id},
        {"$set": {"company_id": company_id, "debit_account_number": acct, "bank_code": code,
                  "value_date": vd, "default_format": fmt, "updated_at": datetime.utcnow(),
                  "updated_by": current_user.get("user_id")}},
        upsert=True)
    return {"message": "تم حفظ إعدادات ملف البنك", "settings": await _bank_file_settings(company_id)}


@router.get("/runs/{run_id}/export/excel")
async def export_payroll_excel(
    run_id: str,
    current_user: dict = Depends(get_current_user)
):
    """تصدير كشف الرواتب بصيغة Excel (.xlsx) مع تنسيق عربي"""
    await _require_payroll_access(current_user)
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
    salary_ok = _salary_ok(current_user)
    if salary_ok:
        await _note_payroll_view(current_user, run_id, "excel", ["salary"])
    for row, emp in enumerate(_masked_run_rows(run, current_user), 1):
        ws.write(row, 0, row, txt)
        ws.write(row, 1, emp.get("employee_name", ""), txt)
        ws.write(row, 2, emp.get("job_title") or emp.get("position", ""), txt)
        ws.write(row, 3, emp.get("department", ""), txt)
        ws.write(row, 4, emp.get("basic_salary", 0), num)
        ws.write(row, 5, emp.get("total_allowances", 0), num)
        ws.write(row, 6, emp.get("total_deductions", 0), num)
        ws.write(row, 7, emp.get("social_insurance", 0), num)
        ws.write(row, 8, emp.get("income_tax", 0), num)
        ws.write(row, 9, emp.get("net_salary", 0), num)
        for k in keys:
            totals[k] += emp.get(k) or 0

    last = len(run.get("employees", [])) + 1
    ws.write(last, 0, "الإجمالي", tot)
    ws.write(last, 1, run.get("total_employees", ""), tot)
    ws.write(last, 2, "", tot)
    ws.write(last, 3, "", tot)
    for c, k in enumerate(keys[:3] + ["social_insurance", "income_tax", "net_salary"], 4):
        ws.write(last, c, totals[k] if salary_ok else None, tot)
    wb.close()

    month_str = _run_period(run)
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
    sal_pay_id,  sal_pay_code,  sal_pay_name  = acct("salaries_payable_account_id",      "253")
    bank_id,     bank_code,     bank_name      = acct("bank_account_id",                  "162")
    si_pay_id,   si_pay_code,   si_pay_name    = acct("social_insurance_payable_account_id","255")
    tax_id,      tax_code,      tax_name       = acct("income_tax_payable_account_id",    "266")
    emg_pay_id,  emg_pay_code,  emg_pay_name   = acct(None,                               "258")
    mrt_pay_id,  mrt_pay_code,  mrt_pay_name   = acct(None,                               "259")
    uhi_pay_id,  uhi_pay_code,  uhi_pay_name   = acct(None,                               "262")
    
    # month is stored as "YYYY-MM"; prefixing the year again printed "2026/2026-09"
    _m = str(run.get('month', ''))
    payroll_month = _m if "-" in _m else f"{run.get('year', '')}/{_m}"
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
            created_by=current_user["user_id"]
        )
        je_a = await service.create_journal_entry(entry_a)
        await service.post_journal_entry(je_a["id"], current_user["user_id"])
    
    # ══ القيد ب: سداد الالتزامات الحكومية ═══════════
    # من حـ/ مذكورين → إلى حـ/ البنك
    # ════════════════════════════════════════════════════
    lines_b = []
    company_si = run.get("total_company_social_insurance")
    if company_si is None:                       # runs made before the per-employee share was kept
        company_si = run.get("total_basic_salary", 0) * (settings.get("company_social_insurance_rate", 18.75) / 100)
    company_si = round(company_si, 2)
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
            created_by=current_user["user_id"]
        )
        je_b = await service.create_journal_entry(entry_b)
        await service.post_journal_entry(je_b["id"], current_user["user_id"])
    
    # تحديث حالة الصرف
    await db.payroll_runs.update_one(
        {"id": run_id},
        {"$set": {
            "disbursed": True,
            "disbursed_at": datetime.utcnow().isoformat(),
            "disbursed_by": current_user["user_id"],
            "status": "paid"
        }}
    )
    
    # Audit log
    await db.activity_logs.insert_one({
        "company_id": company_id,
        "user_id": current_user["user_id"],
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
