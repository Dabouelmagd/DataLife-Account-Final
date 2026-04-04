"""
Extended Employee Models
نماذج الموظفين المحسنة
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid


class DocumentType(str, Enum):
    """أنواع المستندات"""
    CONTRACT = "contract"                    # عقد العمل
    NATIONAL_ID = "national_id"              # البطاقة الشخصية
    PASSPORT = "passport"                    # جواز السفر
    CERTIFICATE = "certificate"              # شهادة
    INSURANCE_CARD = "insurance_card"        # كارنيه التأمين
    MEDICAL_REPORT = "medical_report"        # تقرير طبي
    OTHER = "other"                          # أخرى


class AllowanceCategory(str, Enum):
    """فئات البدلات"""
    HOUSING = "housing"                      # بدل سكن
    TRANSPORTATION = "transportation"        # بدل انتقال
    PHONE = "phone"                          # بدل هاتف
    MEAL = "meal"                            # بدل وجبات
    CLOTHING = "clothing"                    # بدل ملابس
    REPRESENTATION = "representation"        # بدل تمثيل
    NATURE_OF_WORK = "nature_of_work"        # بدل طبيعة عمل
    OTHER = "other"                          # أخرى


class DeductionCategory(str, Enum):
    """فئات الخصومات"""
    SOCIAL_INSURANCE = "social_insurance"    # تأمينات اجتماعية
    HEALTH_INSURANCE = "health_insurance"    # تأمين صحي
    MEDICAL = "medical"                      # علاج
    INCOME_TAX = "income_tax"                # ضريبة كسب العمل
    ABSENCE = "absence"                      # خصم غياب
    LATE = "late"                            # خصم تأخير
    PENALTY = "penalty"                      # جزاء
    ADVANCE = "advance"                      # سلفة
    OTHER = "other"                          # أخرى


class ShiftType(str, Enum):
    """أنواع الورديات"""
    MORNING = "morning"                      # صباحية
    EVENING = "evening"                      # مسائية
    NIGHT = "night"                          # ليلية
    SPLIT = "split"                          # منقسمة
    FLEXIBLE = "flexible"                    # مرنة


class EmployeeDocument(BaseModel):
    """مستند موظف"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    document_type: DocumentType
    name: str
    file_url: str
    file_name: str
    file_size: int = 0
    expiry_date: Optional[str] = None
    notes: Optional[str] = None
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    uploaded_by: Optional[str] = None


class EmployeeAllowance(BaseModel):
    """بدل موظف ثابت"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: AllowanceCategory
    name: str
    name_en: Optional[str] = None
    amount: float
    is_percentage: bool = False              # نسبة من الراتب الأساسي
    percentage: float = 0.0
    is_taxable: bool = True                  # خاضع للضريبة
    is_insurable: bool = False               # خاضع للتأمينات
    effective_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: bool = True


class EmployeeDeduction(BaseModel):
    """خصم موظف ثابت"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: DeductionCategory
    name: str
    name_en: Optional[str] = None
    amount: float
    is_percentage: bool = False
    percentage: float = 0.0
    effective_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: bool = True


class WorkShift(BaseModel):
    """وردية عمل"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    
    name: str                                # اسم الوردية
    name_en: Optional[str] = None
    shift_type: ShiftType = ShiftType.MORNING
    
    # أوقات العمل
    start_time: str                          # وقت البداية (HH:MM)
    end_time: str                            # وقت النهاية (HH:MM)
    break_start: Optional[str] = None        # بداية الاستراحة
    break_end: Optional[str] = None          # نهاية الاستراحة
    break_duration: int = 60                 # مدة الاستراحة بالدقائق
    
    # ساعات العمل
    working_hours: float = 8.0               # ساعات العمل اليومية
    overtime_starts_after: float = 8.0       # الإضافي يبدأ بعد
    
    # أيام العمل
    working_days: List[str] = ["sunday", "monday", "tuesday", "wednesday", "thursday"]
    
    # معدلات الإضافي
    overtime_rate: float = 1.5               # 150%
    holiday_rate: float = 2.0                # 200%
    night_rate: float = 1.25                 # 125%
    
    # إعدادات إضافية
    allow_late_minutes: int = 15             # السماح بالتأخير (دقائق)
    deduct_after_late: bool = True           # خصم بعد التأخير
    require_checkout: bool = True            # إلزامية الانصراف
    
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class EmployeeShiftAssignment(BaseModel):
    """تعيين وردية لموظف"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    employee_id: str
    shift_id: str
    
    effective_date: str                      # تاريخ السريان
    end_date: Optional[str] = None           # تاريخ الانتهاء
    
    is_current: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ExtendedEmployee(BaseModel):
    """نموذج الموظف المحسن"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    
    # المعلومات الشخصية
    name: str
    name_en: Optional[str] = None
    national_id: Optional[str] = None        # الرقم القومي
    birth_date: Optional[str] = None
    gender: Optional[str] = None             # male, female
    marital_status: Optional[str] = None     # single, married, divorced, widowed
    nationality: str = "Egyptian"
    
    # معلومات الاتصال
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    
    # الصورة الشخصية
    photo_url: Optional[str] = None
    
    # المعلومات الوظيفية
    employee_code: Optional[str] = None      # كود الموظف
    position: str
    department: Optional[str] = None
    branch: Optional[str] = None
    manager_id: Optional[str] = None         # المدير المباشر
    hire_date: str
    contract_type: str = "permanent"         # permanent, temporary, contract
    contract_end_date: Optional[str] = None
    probation_end_date: Optional[str] = None
    
    # الراتب والبدلات
    basic_salary: float = 0.0
    allowances: List[EmployeeAllowance] = []
    deductions: List[EmployeeDeduction] = []
    
    # التأمينات
    social_insurance_number: Optional[str] = None
    insurance_salary: Optional[float] = None  # الأجر التأميني
    insurance_start_date: Optional[str] = None
    
    # التأمين الصحي
    health_insurance_number: Optional[str] = None
    health_insurance_company: Optional[str] = None
    health_insurance_amount: float = 0.0
    health_insurance_type: str = "company"   # company, self, none
    
    # العلاج
    medical_allowance: float = 0.0           # بدل العلاج الشهري
    medical_balance: float = 0.0             # رصيد العلاج المتبقي
    medical_yearly_limit: float = 0.0        # الحد السنوي للعلاج
    
    # الورديات
    current_shift_id: Optional[str] = None
    
    # الإجازات
    annual_leave_balance: int = 21           # رصيد الإجازة السنوية
    sick_leave_balance: int = 0              # رصيد الإجازة المرضية
    casual_leave_balance: int = 6            # رصيد الإجازة العارضة
    
    # المستندات
    documents: List[EmployeeDocument] = []
    
    # البيانات البنكية
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    iban: Optional[str] = None
    
    # معلومات إضافية
    notes: Optional[str] = None
    is_active: bool = True
    termination_date: Optional[str] = None
    termination_reason: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class OvertimeRecord(BaseModel):
    """سجل العمل الإضافي"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    employee_id: str
    employee_name: str
    
    date: str
    shift_id: Optional[str] = None
    
    # الساعات
    regular_hours: float = 0.0               # ساعات العمل العادية
    overtime_hours: float = 0.0              # ساعات العمل الإضافي
    holiday_hours: float = 0.0               # ساعات العطلات
    night_hours: float = 0.0                 # ساعات الليل
    
    # الأسعار
    hourly_rate: float = 0.0                 # سعر الساعة العادية
    overtime_rate: float = 1.5
    holiday_rate: float = 2.0
    night_rate: float = 1.25
    
    # المبالغ
    regular_amount: float = 0.0
    overtime_amount: float = 0.0
    holiday_amount: float = 0.0
    night_amount: float = 0.0
    total_amount: float = 0.0
    
    # الحالة
    status: str = "pending"                  # pending, approved, rejected, paid
    month: str                               # الشهر (YYYY-MM)
    
    notes: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
