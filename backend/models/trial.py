from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import uuid

class TrialStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CONVERTED = "converted"
    CANCELLED = "cancelled"
    EXTENDED = "extended"

class TrialPlan(str, Enum):
    PROFESSIONAL_TRIAL = "professional_trial"

class TrialCreate(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    company_name: str
    phone: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    intended_use: Optional[str] = None
    how_heard: Optional[str] = None

class Trial(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    first_name: str
    last_name: str
    company_name: str
    phone: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    intended_use: Optional[str] = None
    how_heard: Optional[str] = None
    
    # Trial Configuration
    plan: TrialPlan = TrialPlan.PROFESSIONAL_TRIAL
    status: TrialStatus = TrialStatus.ACTIVE
    duration_days: int = 14
    
    # Usage Limits
    max_employees: int = 25
    max_transactions: int = 500
    max_storage_mb: int = 1024  # 1GB
    max_reports: int = 50
    
    # Current Usage
    current_employees: int = 0
    current_transactions: int = 0
    current_storage_mb: int = 0
    current_reports: int = 0
    
    # Trial Dates
    started_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime = Field(default_factory=lambda: datetime.utcnow() + timedelta(days=14))
    last_login: Optional[datetime] = None
    
    # Onboarding Progress
    onboarding_completed: bool = False
    sample_data_created: bool = False
    first_employee_added: bool = False
    first_transaction_recorded: bool = False
    first_report_generated: bool = False
    
    # Conversion Tracking
    upgrade_prompts_shown: int = 0
    last_upgrade_prompt: Optional[datetime] = None
    conversion_email_sent: bool = False
    expiration_warning_sent: bool = False
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None

class TrialUsage(BaseModel):
    trial_id: str
    action: str  # "employee_added", "transaction_created", "report_generated", etc.
    details: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TrialProgress(BaseModel):
    trial_id: str
    days_remaining: int
    usage_percentage: Dict[str, float]
    onboarding_progress: Dict[str, bool]
    suggested_next_steps: list[str]
    upgrade_benefits: list[str]

class TrialExtension(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trial_id: str
    reason: str
    additional_days: int
    extended_by: str  # admin user who extended
    extended_at: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None