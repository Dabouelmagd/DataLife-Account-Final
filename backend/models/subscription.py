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
PLAN_PRICES = {
    "starter": {
        "3_months": 897,      # 299 * 3
        "6_months": 1614,     # 299 * 6 - 10%
        "9_months": 2153,     # 299 * 9 - 20%
        "12_months": 2390,    # Annual price with discount
        "lifetime": 7170      # 299 * 24
    },
    "professional": {
        "3_months": 2397,     # 799 * 3
        "6_months": 4314,     # 799 * 6 - 10%
        "9_months": 5753,     # 799 * 9 - 20%
        "12_months": 6392,    # Annual price with discount
        "lifetime": 19176     # 799 * 24
    },
    "enterprise": {
        "3_months": 4497,     # 1499 * 3
        "6_months": 8094,     # 1499 * 6 - 10%
        "9_months": 10793,    # 1499 * 9 - 20%
        "12_months": 11992,   # Annual price with discount
        "lifetime": 35976     # 1499 * 24
    },
    "hr-only": {
        "3_months": 597,
        "6_months": 1074,
        "9_months": 1432,
        "12_months": 1592,
        "lifetime": 4776
    },
    "financial-only": {
        "3_months": 747,
        "6_months": 1345,
        "9_months": 1793,
        "12_months": 1992,
        "lifetime": 5976
    },
    "inventory-only": {
        "3_months": 537,
        "6_months": 967,
        "9_months": 1289,
        "12_months": 1432,
        "lifetime": 4296
    },
    "lifetime": {
        "lifetime": 50000
    }
}
