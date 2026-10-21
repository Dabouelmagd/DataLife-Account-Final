from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class SubscriptionPlan(str, Enum):
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"
    HR_ONLY = "hr-only"
    FINANCIAL_ONLY = "financial-only"
    INVENTORY_ONLY = "inventory-only"
    LIFETIME = "lifetime"

class SubscriptionDuration(str, Enum):
    MONTHLY_3 = "3_months"
    MONTHLY_6 = "6_months"
    MONTHLY_9 = "9_months"
    YEARLY = "12_months"
    LIFETIME = "lifetime"

class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    PENDING = "pending"
    TRIAL = "trial"

class ActivationCode(BaseModel):
    id: str = Field(default_factory=lambda: str(__import__('uuid').uuid4()))
    code: str
    plan: SubscriptionPlan
    duration: SubscriptionDuration
    discount_percent: int = 0
    max_uses: int = 1
    current_uses: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    created_by: str = "admin"

class Subscription(BaseModel):
    id: str = Field(default_factory=lambda: str(__import__('uuid').uuid4()))
    user_id: str
    company_id: str
    plan: SubscriptionPlan
    duration: SubscriptionDuration
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE
    start_date: datetime = Field(default_factory=datetime.utcnow)
    end_date: Optional[datetime] = None
    amount_paid: float = 0
    currency: str = "EGP"
    payment_method: str = "manual"  # manual, stripe, activation_code
    activation_code_used: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    auto_renew: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class SubscriptionCreate(BaseModel):
    plan: SubscriptionPlan
    duration: SubscriptionDuration
    payment_method: str = "manual"
    activation_code: Optional[str] = None

class ActivationCodeCreate(BaseModel):
    plan: SubscriptionPlan
    duration: SubscriptionDuration
    discount_percent: int = 0
    max_uses: int = 1
    expires_days: Optional[int] = None

class SubscriptionResponse(BaseModel):
    id: str
    plan: str
    duration: str
    status: str
    start_date: str
    end_date: Optional[str]
    days_remaining: int
    is_active: bool

# Pricing configuration
# derived from the one price list (api/payments._MONTHLY): 3 months = 2.7,
# 6 months = 5, 9 months = 7, a year = 8 months' price, lifetime = 24
_M = {"starter": 449, "professional": 1099, "enterprise": 1999,
      "hr-only": 249, "financial-only": 299, "inventory-only": 229}
PLAN_PRICES = {k: {"3_months": int(round(v * 2.7)), "6_months": v * 5, "9_months": v * 7,
                   "12_months": v * 8, "lifetime": v * 24} for k, v in _M.items()}
PLAN_PRICES["lifetime"] = {"lifetime": 59970}
