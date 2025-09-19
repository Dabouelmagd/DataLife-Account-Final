from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum
import uuid

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

class PaymentMethod(str, Enum):
    CARD = "card"
    FAWRY = "fawry"
    BANK = "bank"
    WALLET = "wallet"

class NotificationStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"

class PaymentCreate(BaseModel):
    plan_id: str
    plan_name: str
    billing_cycle: str  # "monthly" or "annual"
    amount: float
    currency: str = "EGP"
    payment_method: PaymentMethod
    customer_email: EmailStr
    customer_phone: str
    company_name: str
    vat_number: Optional[str] = None
    payment_details: Dict[str, Any] = {}

class Payment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    transaction_id: str = Field(default_factory=lambda: f"TXN-{int(datetime.utcnow().timestamp())}")
    plan_id: str
    plan_name: str
    billing_cycle: str
    amount: float
    currency: str
    payment_method: PaymentMethod
    status: PaymentStatus = PaymentStatus.PENDING
    customer_email: EmailStr
    customer_phone: str
    company_name: str
    vat_number: Optional[str] = None
    payment_details: Dict[str, Any] = {}
    gateway_response: Dict[str, Any] = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None

class NotificationCreate(BaseModel):
    payment_id: str
    type: str  # "email", "sms", "admin_alert"
    recipient: str
    subject: Optional[str] = None
    message: str
    template_data: Dict[str, Any] = {}

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    payment_id: str
    type: str
    recipient: str
    subject: Optional[str] = None
    message: str
    template_data: Dict[str, Any] = {}
    status: NotificationStatus = NotificationStatus.PENDING
    sent_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    retry_count: int = 0
    error_message: Optional[str] = None

class SubscriptionCreate(BaseModel):
    payment_id: str
    customer_email: EmailStr
    plan_id: str
    plan_name: str
    billing_cycle: str
    status: str = "active"
    
class Subscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    payment_id: str
    customer_email: EmailStr
    plan_id: str
    plan_name: str
    billing_cycle: str
    status: str = "active"
    starts_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)