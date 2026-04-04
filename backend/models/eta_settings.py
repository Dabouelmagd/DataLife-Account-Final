"""
ETA (Egyptian Tax Authority) Settings Models
إعدادات مصلحة الضرائب المصرية لكل شركة
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid


class ETAEnvironment(str, Enum):
    """بيئة ETA"""
    PREPROD = "preprod"      # بيئة الاختبار
    PRODUCTION = "production" # بيئة الإنتاج


class ETADocumentStatus(str, Enum):
    """حالة المستند في ETA"""
    PENDING = "pending"           # في انتظار الإرسال
    SUBMITTED = "submitted"       # تم الإرسال
    VALID = "valid"               # صالح
    INVALID = "invalid"           # غير صالح
    CANCELLED = "cancelled"       # ملغي
    REJECTED = "rejected"         # مرفوض


class CompanyETASettings(BaseModel):
    """إعدادات ETA لكل شركة"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    
    # ==========================================
    # بيانات التسجيل الضريبي
    # ==========================================
    tax_registration_number: str = Field(
        default="",
        description="رقم التسجيل الضريبي"
    )
    branch_id: str = Field(
        default="0",
        description="رقم الفرع (0 للمقر الرئيسي)"
    )
    activity_code: str = Field(
        default="",
        description="كود النشاط"
    )
    
    # ==========================================
    # بيانات API
    # ==========================================
    client_id: str = Field(
        default="",
        description="Client ID من ETA"
    )
    client_secret: str = Field(
        default="",
        description="Client Secret من ETA"
    )
    
    # ==========================================
    # البيئة
    # ==========================================
    environment: ETAEnvironment = Field(
        default=ETAEnvironment.PREPROD,
        description="بيئة ETA (اختبار/إنتاج)"
    )
    
    # ==========================================
    # الحالة
    # ==========================================
    is_active: bool = Field(
        default=False,
        description="هل التكامل مفعل؟"
    )
    last_connection_test: Optional[datetime] = None
    connection_status: Optional[str] = None
    
    # ==========================================
    # إعدادات إضافية
    # ==========================================
    auto_submit_invoices: bool = Field(
        default=False,
        description="إرسال الفواتير تلقائياً عند الاعتماد"
    )
    
    # التدقيق
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    @property
    def base_url(self) -> str:
        """رابط API حسب البيئة"""
        if self.environment == ETAEnvironment.PREPROD:
            return "https://api.preprod.invoicing.eta.gov.eg"
        return "https://api.invoicing.eta.gov.eg"
    
    @property
    def identity_url(self) -> str:
        """رابط خدمة الهوية حسب البيئة"""
        if self.environment == ETAEnvironment.PREPROD:
            return "https://id.preprod.eta.gov.eg"
        return "https://id.eta.gov.eg"


class ETASubmission(BaseModel):
    """سجل إرسال فاتورة إلى ETA"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    
    # بيانات الفاتورة المحلية
    invoice_id: str
    invoice_number: str
    invoice_type: str = "sales"  # sales, credit_note, debit_note
    
    # بيانات ETA
    submission_uuid: Optional[str] = None
    document_uuid: Optional[str] = None
    long_id: Optional[str] = None
    
    # الحالة
    status: ETADocumentStatus = ETADocumentStatus.PENDING
    eta_status: Optional[str] = None
    
    # الأخطاء
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    validation_errors: List[dict] = Field(default_factory=list)
    
    # التوقيتات
    submitted_at: Optional[datetime] = None
    validated_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ETATokenCache(BaseModel):
    """كاش توكن ETA"""
    company_id: str
    access_token: str
    token_type: str = "Bearer"
    expires_at: datetime
    created_at: datetime = Field(default_factory=datetime.utcnow)
