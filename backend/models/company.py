from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
import uuid

class Company(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    industry: str
    size: str  # Small (1-50), Medium (51-200), Large (201+)
    contact_email: EmailStr
    phone: str
    address: Optional[str] = None
    logo_url: Optional[str] = None  # Company logo URL
    trial_id: Optional[str] = None  # Link to trial if converted from trial
    subscription_status: str = "trial"  # trial, active, expired
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: datetime = Field(default_factory=lambda: datetime.utcnow().isoformat())

class CompanyCreate(BaseModel):
    name: str
    industry: str
    size: str
    contact_email: EmailStr
    phone: str
    address: Optional[str] = None
    trial_id: Optional[str] = None

class CompanyResponse(BaseModel):
    id: str
    name: str
    industry: str
    size: str
    contact_email: EmailStr
    phone: str
    address: Optional[str]
    logo_url: Optional[str]
    subscription_status: str
    created_at: str