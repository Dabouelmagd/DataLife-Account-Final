from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
import uuid

class Company(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    name_ar: Optional[str] = None  # Arabic name
    industry: Optional[str] = "Technology"  # Made optional with default
    size: Optional[str] = "Small"  # Made optional with default - Small (1-50), Medium (51-200), Large (201+)
    contact_email: Optional[str] = None  # Made optional
    phone: Optional[str] = None  # Made optional
    address: Optional[str] = None
    logo_url: Optional[str] = None  # Company logo URL
    trial_id: Optional[str] = None  # Link to trial if converted from trial
    subscription_status: str = "active"  # trial, active, expired
    subscription_code: Optional[str] = None  # Subscription code
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class CompanyCreate(BaseModel):
    name: str
    industry: Optional[str] = "Technology"
    size: Optional[str] = "Small"
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    trial_id: Optional[str] = None
    referral_code: Optional[str] = None  # Referral code used during registration

class CompanyResponse(BaseModel):
    id: str
    name: str
    name_ar: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None
    contact_email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    logo_url: Optional[str] = None
    subscription_status: str = "active"
    subscription_code: Optional[str] = None
    created_at: str