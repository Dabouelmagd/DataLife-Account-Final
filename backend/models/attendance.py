"""
Attendance Models - نماذج الحضور والانصراف
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date, time
from enum import Enum
import uuid


class AttendanceStatus(str, Enum):
    """حالة الحضور"""
    PRESENT = "present"           # حاضر
    ABSENT = "absent"             # غائب
    LATE = "late"                 # متأخر
    EARLY_LEAVE = "early_leave"   # انصراف مبكر
    HALF_DAY = "half_day"         # نصف يوم
    ON_LEAVE = "on_leave"         # في إجازة
    HOLIDAY = "holiday"           # عطلة رسمية
    WEEKEND = "weekend"           # عطلة أسبوعية


class OvertimeType(str, Enum):
    """نوع الإضافي"""
    REGULAR = "regular"           # إضافي عادي
    HOLIDAY = "holiday"           # إضافي عطلة
    NIGHT = "night"               # إضافي ليلي


class AttendanceRecord(BaseModel):
    """سجل حضور وانصراف"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    employee_id: str
    employee_name: str
    employee_code: Optional[str] = None
    department: Optional[str] = None
    
    # التاريخ والوردية
    date: str                              # YYYY-MM-DD
    shift_id: Optional[str] = None
    shift_name: Optional[str] = None
    
    # أوقات الوردية المتوقعة
    expected_check_in: Optional[str] = None    # HH:MM
    expected_check_out: Optional[str] = None   # HH:MM
    expected_working_hours: float = 8.0
    
    # أوقات البصمة الفعلية
    check_in: Optional[str] = None             # HH:MM:SS
    check_out: Optional[str] = None            # HH:MM:SS
    check_in_device: Optional[str] = None      # جهاز البصمة
    check_out_device: Optional[str] = None
    
    # الحسابات
    actual_working_hours: float = 0.0          # ساعات العمل الفعلية
    late_minutes: int = 0                      # دقائق التأخير
    early_leave_minutes: int = 0               # دقائق الانصراف المبكر
    overtime_hours: float = 0.0                # ساعات الإضافي
    
    # تفاصيل الإضافي
    regular_overtime: float = 0.0              # إضافي عادي
    holiday_overtime: float = 0.0              # إضافي عطلة
    night_overtime: float = 0.0                # إضافي ليلي
    
    # الحالة
    status: AttendanceStatus = AttendanceStatus.PRESENT
    is_holiday: bool = False
    is_weekend: bool = False
    
    # الاستراحة
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    break_duration: int = 0                    # بالدقائق
    
    # ملاحظات
    notes: Optional[str] = None
    excuse_reason: Optional[str] = None        # سبب العذر
    is_excused: bool = False                   # معذور
    
    # الموافقات
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    
    # التدقيق
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None


class DailyAttendanceSummary(BaseModel):
    """ملخص الحضور اليومي"""
    date: str
    company_id: str
    
    total_employees: int = 0
    present_count: int = 0
    absent_count: int = 0
    late_count: int = 0
    on_leave_count: int = 0
    
    total_working_hours: float = 0.0
    total_overtime_hours: float = 0.0
    total_late_minutes: int = 0
    
    attendance_rate: float = 0.0               # نسبة الحضور


class MonthlyAttendanceSummary(BaseModel):
    """ملخص الحضور الشهري للموظف"""
    employee_id: str
    employee_name: str
    month: str                                 # YYYY-MM
    company_id: str
    
    working_days: int = 0                      # أيام العمل
    present_days: int = 0                      # أيام الحضور
    absent_days: int = 0                       # أيام الغياب
    late_days: int = 0                         # أيام التأخير
    leave_days: int = 0                        # أيام الإجازة
    
    total_working_hours: float = 0.0
    total_overtime_hours: float = 0.0
    total_late_minutes: int = 0
    total_early_leave_minutes: int = 0
    
    # المبالغ
    late_deduction: float = 0.0                # خصم التأخير
    absence_deduction: float = 0.0             # خصم الغياب
    overtime_amount: float = 0.0               # مبلغ الإضافي
    
    attendance_rate: float = 0.0


class FingerprintDevice(BaseModel):
    """جهاز البصمة"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    
    device_name: str
    device_code: str
    device_type: str = "fingerprint"           # fingerprint, face, card
    location: Optional[str] = None
    ip_address: Optional[str] = None
    
    is_active: bool = True
    last_sync: Optional[datetime] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class FingerprintLog(BaseModel):
    """سجل البصمة الخام"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    device_id: str
    device_name: Optional[str] = None
    
    employee_id: Optional[str] = None
    employee_code: Optional[str] = None
    employee_name: Optional[str] = None
    
    timestamp: datetime
    punch_type: str = "auto"                   # in, out, auto
    
    is_processed: bool = False
    attendance_record_id: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Holiday(BaseModel):
    """العطلات الرسمية"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    
    name: str
    name_en: Optional[str] = None
    date: str                                  # YYYY-MM-DD
    is_annual: bool = True                     # متكررة سنوياً
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AttendanceSettings(BaseModel):
    """إعدادات الحضور"""
    company_id: str
    
    # إعدادات التأخير
    grace_period_minutes: int = 15             # فترة السماح بالتأخير
    late_deduction_per_minute: float = 0.0     # خصم لكل دقيقة تأخير
    max_late_minutes_before_absence: int = 120 # أقصى تأخير قبل اعتباره غياب
    
    # إعدادات الانصراف المبكر
    early_leave_deduction_per_minute: float = 0.0
    
    # إعدادات الغياب
    absence_deduction_type: str = "day"        # day, percentage
    absence_deduction_days: float = 1.0        # عدد الأيام المخصومة
    
    # إعدادات الإضافي
    overtime_requires_approval: bool = True
    max_daily_overtime: float = 4.0            # أقصى إضافي يومي
    
    # أيام العطلة الأسبوعية
    weekend_days: List[str] = ["friday", "saturday"]
    
    # إعدادات البصمة
    require_both_punches: bool = True          # يتطلب بصمة حضور وانصراف
    auto_checkout_time: Optional[str] = None   # وقت الانصراف التلقائي
    
    updated_at: datetime = Field(default_factory=datetime.utcnow)
