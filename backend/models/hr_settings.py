"""
HR Settings Models - إعدادات الموارد البشرية لكل شركة
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid


class LateDeductionMethod(str, Enum):
    """طريقة حساب خصم التأخير"""
    PER_MINUTE = "per_minute"       # خصم لكل دقيقة
    PER_HOUR = "per_hour"           # خصم لكل ساعة (تجاهل أقل من ساعة)
    BRACKETS = "brackets"           # شرائح التأخير
    NONE = "none"                   # بدون خصم


class AbsenceDeductionMethod(str, Enum):
    """طريقة حساب خصم الغياب"""
    FULL_DAY = "full_day"           # خصم يوم كامل
    DAY_PLUS_PENALTY = "day_plus_penalty"  # يوم + جزاء
    NONE = "none"                   # بدون خصم


class OvertimeCalculationMethod(str, Enum):
    """طريقة حساب الأوفرتايم"""
    HOURLY = "hourly"               # بالساعة
    DAILY = "daily"                 # بالمعدل اليومي
    NONE = "none"                   # بدون مكافأة


class LateBracket(BaseModel):
    """شريحة التأخير"""
    from_minutes: int
    to_minutes: int
    deduction_minutes: int          # عدد الدقائق المخصومة


class CompanyHRSettings(BaseModel):
    """إعدادات الموارد البشرية لكل شركة"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    
    # ==========================================
    # إعدادات التأخير
    # ==========================================
    late_deduction_enabled: bool = True
    late_deduction_method: LateDeductionMethod = LateDeductionMethod.PER_MINUTE
    
    # فترة السماح (بالدقائق) - تأخير بدون خصم
    grace_period_minutes: int = 15
    
    # خصم لكل دقيقة (إذا كانت الطريقة per_minute)
    late_deduction_per_minute_rate: float = 0.0  # معدل (الراتب اليومي / ساعات العمل / 60)
    
    # خصم لكل ساعة (إذا كانت الطريقة per_hour)
    late_deduction_per_hour_rate: float = 1.0   # معدل ساعة العمل
    
    # شرائح التأخير (إذا كانت الطريقة brackets)
    late_brackets: List[LateBracket] = []
    
    # أقصى تأخير قبل اعتباره غياب
    max_late_minutes_before_absence: int = 120
    
    # ==========================================
    # إعدادات الغياب
    # ==========================================
    absence_deduction_enabled: bool = True
    absence_deduction_method: AbsenceDeductionMethod = AbsenceDeductionMethod.FULL_DAY
    
    # خصم أيام الغياب
    absence_deduction_days: float = 1.0         # عدد الأيام المخصومة لكل يوم غياب
    
    # نسبة الجزاء الإضافي (إذا كانت الطريقة day_plus_penalty)
    absence_penalty_percentage: float = 0.0     # نسبة إضافية على اليوم
    
    # الغياب المعذور (بعذر)
    excused_absence_deduction: bool = False     # هل يخصم الغياب المعذور؟
    
    # ==========================================
    # إعدادات الأوفرتايم (العمل الإضافي)
    # ==========================================
    overtime_enabled: bool = True
    overtime_calculation_method: OvertimeCalculationMethod = OvertimeCalculationMethod.HOURLY
    
    # معدل الأوفرتايم (مضاعف أجر الساعة)
    overtime_rate: float = 1.5                  # 1.5x = ساعة ونصف
    
    # معدل الأوفرتايم في العطلات
    overtime_holiday_rate: float = 2.0          # 2x = ساعتين
    
    # معدل الأوفرتايم الليلي
    overtime_night_rate: float = 1.25           # 1.25x
    
    # الحد الأقصى للأوفرتايم الشهري (بالساعات)
    max_monthly_overtime_hours: float = 60.0
    
    # يتطلب موافقة مسبقة
    overtime_requires_approval: bool = False
    
    # ==========================================
    # إعدادات ساعات العمل
    # ==========================================
    standard_working_hours_per_day: float = 8.0
    standard_working_days_per_month: int = 22
    
    # ==========================================
    # إعدادات أخرى
    # ==========================================
    # أيام العطلة الأسبوعية
    weekend_days: List[str] = ["friday", "saturday"]
    
    # التقريب
    round_late_minutes_to: int = 1              # تقريب التأخير إلى أقرب X دقيقة
    round_overtime_minutes_to: int = 15         # تقريب الأوفرتايم إلى أقرب X دقيقة
    
    # التدقيق
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AttendancePayrollSummary(BaseModel):
    """ملخص الحضور للرواتب"""
    employee_id: str
    month: str
    
    # ملخص الحضور
    working_days: int = 0
    present_days: int = 0
    absent_days: int = 0              # غياب بدون عذر
    excused_absent_days: int = 0      # غياب بعذر
    late_days: int = 0
    
    # دقائق التأخير
    total_late_minutes: int = 0
    
    # ساعات الأوفرتايم
    total_overtime_hours: float = 0.0
    holiday_overtime_hours: float = 0.0
    night_overtime_hours: float = 0.0
    
    # المبالغ المحسوبة
    late_deduction_amount: float = 0.0
    absence_deduction_amount: float = 0.0
    overtime_bonus_amount: float = 0.0
    
    # صافي التعديلات
    net_attendance_adjustment: float = 0.0      # الأوفرتايم - الخصومات
