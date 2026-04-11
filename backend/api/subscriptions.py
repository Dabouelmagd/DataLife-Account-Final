from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from models.subscription import (
    Subscription, SubscriptionCreate, SubscriptionResponse,
    ActivationCode, ActivationCodeCreate,
    SubscriptionPlan, SubscriptionDuration, SubscriptionStatus,
    PLAN_PRICES
)
from api.users import get_current_user
import os
from datetime import datetime, timedelta
import secrets
import string

router = APIRouter(prefix="/api/subscriptions", tags=["Subscriptions"])

# Database connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

def generate_activation_code(prefix: str = "DL") -> str:
    """Generate a unique activation code"""
    chars = string.ascii_uppercase + string.digits
    code = ''.join(secrets.choice(chars) for _ in range(8))
    return f"{prefix}-{code[:4]}-{code[4:]}"

def calculate_end_date(start_date: datetime, duration: str) -> datetime:
    """Calculate subscription end date based on duration"""
    duration_days = {
        "3_months": 90,
        "6_months": 180,
        "9_months": 270,
        "12_months": 365,
        "lifetime": 36500  # 100 years
    }
    return start_date + timedelta(days=duration_days.get(duration, 30))

# Admin roles for access control
ADMIN_ROLES = [
    "Admin", "admin", "Super Admin", "مدير النظام",
    "General Manager", "مدير عام", 
    "CEO", "المدير التنفيذي",
    "رئيس مجلس الإدارة"
]

def is_admin(user: dict) -> bool:
    """Check if user has admin privileges"""
    role = user.get("role", "")
    is_platform = user.get("is_platform_admin", False)
    return role in ADMIN_ROLES or is_platform

@router.get("/plans")
async def get_subscription_plans():
    """Get all available subscription plans with prices"""
    plans = []
    for plan_id, durations in PLAN_PRICES.items():
        plan_data = {
            "id": plan_id,
            "name": plan_id.replace("-", " ").title(),
            "durations": []
        }
        for duration, price in durations.items():
            plan_data["durations"].append({
                "duration": duration,
                "price": price,
                "currency": "EGP"
            })
        plans.append(plan_data)
    return plans

@router.post("/create")
async def create_subscription(
    data: SubscriptionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new subscription"""
    user_id = current_user.get("user_id")
    company_id = current_user.get("company_id")
    
    # Check for existing active subscription
    existing = await db.subscriptions.find_one({
        "company_id": company_id,
        "status": "active"
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Company already has an active subscription")
    
    # Get price
    price = PLAN_PRICES.get(data.plan.value, {}).get(data.duration.value, 0)
    
    # Handle activation code
    discount = 0
    activation_code_id = None
    if data.activation_code:
        code = await db.activation_codes.find_one({
            "code": data.activation_code,
            "is_active": True
        })
        if not code:
            raise HTTPException(status_code=400, detail="Invalid activation code")
        if code.get("current_uses", 0) >= code.get("max_uses", 1):
            raise HTTPException(status_code=400, detail="Activation code has been fully used")
        if code.get("expires_at") and datetime.utcnow() > code["expires_at"]:
            raise HTTPException(status_code=400, detail="Activation code has expired")
        
        discount = code.get("discount_percent", 0)
        activation_code_id = code["id"]
        
        # Update code usage
        await db.activation_codes.update_one(
            {"id": code["id"]},
            {"$inc": {"current_uses": 1}}
        )
    
    # Calculate final price
    final_price = price * (1 - discount / 100)
    
    # Create subscription
    start_date = datetime.utcnow()
    subscription = Subscription(
        user_id=user_id,
        company_id=company_id,
        plan=data.plan,
        duration=data.duration,
        status=SubscriptionStatus.ACTIVE,
        start_date=start_date,
        end_date=calculate_end_date(start_date, data.duration.value),
        amount_paid=final_price,
        payment_method=data.payment_method,
        activation_code_used=activation_code_id
    )
    
    await db.subscriptions.insert_one(subscription.dict())
    
    # Update company subscription status
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "subscription_plan": data.plan.value,
            "subscription_status": "active",
            "subscription_end_date": subscription.end_date.isoformat()
        }}
    )
    
    return {
        "message": "Subscription created successfully",
        "subscription_id": subscription.id,
        "plan": subscription.plan.value,
        "end_date": subscription.end_date.isoformat(),
        "amount_paid": final_price
    }

@router.get("/current")
async def get_current_subscription(current_user: dict = Depends(get_current_user)):
    """Get current subscription for the user's company"""
    company_id = current_user.get("company_id")
    
    subscription = await db.subscriptions.find_one(
        {"company_id": company_id, "status": "active"},
        {"_id": 0}
    )
    
    if not subscription:
        return {"status": "no_subscription", "message": "No active subscription found"}
    
    end_date = subscription.get("end_date")
    if isinstance(end_date, str):
        end_date = datetime.fromisoformat(end_date)
    
    days_remaining = (end_date - datetime.utcnow()).days if end_date else 0
    
    return {
        "id": subscription["id"],
        "plan": subscription["plan"],
        "duration": subscription["duration"],
        "status": subscription["status"],
        "start_date": subscription["start_date"].isoformat() if isinstance(subscription["start_date"], datetime) else subscription["start_date"],
        "end_date": end_date.isoformat() if end_date else None,
        "days_remaining": max(0, days_remaining),
        "is_active": days_remaining > 0
    }

# ============ ADMIN ENDPOINTS ============

@router.post("/admin/activation-codes")
async def create_activation_code(
    data: ActivationCodeCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new activation code (Admin only)"""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    code = ActivationCode(
        code=generate_activation_code(),
        plan=data.plan,
        duration=data.duration,
        discount_percent=data.discount_percent,
        max_uses=data.max_uses,
        expires_at=datetime.utcnow() + timedelta(days=data.expires_days) if data.expires_days else None,
        created_by=current_user.get("user_id")
    )
    
    await db.activation_codes.insert_one(code.dict())
    
    return {
        "message": "Activation code created",
        "code": code.code,
        "plan": code.plan.value,
        "duration": code.duration.value,
        "discount": f"{code.discount_percent}%",
        "max_uses": code.max_uses
    }

@router.get("/admin/activation-codes")
async def list_activation_codes(current_user: dict = Depends(get_current_user)):
    """List all activation codes (Admin only)"""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    codes = await db.activation_codes.find({}, {"_id": 0}).to_list(100)
    return codes

@router.delete("/admin/activation-codes/{code_id}")
async def delete_activation_code(
    code_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Deactivate an activation code (Admin only)"""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.activation_codes.update_one(
        {"id": code_id},
        {"$set": {"is_active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Activation code not found")
    
    return {"message": "Activation code deactivated"}

@router.get("/admin/all")
async def list_all_subscriptions(current_user: dict = Depends(get_current_user)):
    """List all subscriptions (Admin only)"""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    subscriptions = await db.subscriptions.find({}, {"_id": 0}).to_list(500)
    return subscriptions

@router.post("/admin/grant")
async def grant_subscription(
    company_id: str,
    plan: str,
    duration: str,
    current_user: dict = Depends(get_current_user)
):
    """Grant subscription to a company (Admin only)"""
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify company exists
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    start_date = datetime.utcnow()
    subscription = Subscription(
        user_id=current_user.get("user_id", "admin"),
        company_id=company_id,
        plan=SubscriptionPlan(plan),
        duration=SubscriptionDuration(duration),
        status=SubscriptionStatus.ACTIVE,
        start_date=start_date,
        end_date=calculate_end_date(start_date, duration),
        amount_paid=PLAN_PRICES.get(plan, {}).get(duration, 0),
        payment_method="admin_grant"
    )
    
    # Deactivate any existing subscription
    await db.subscriptions.update_many(
        {"company_id": company_id, "status": "active"},
        {"$set": {"status": "cancelled"}}
    )
    
    await db.subscriptions.insert_one(subscription.dict())
    
    # Update company subscription status
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "subscription_plan": plan,
            "subscription_status": "active",
            "subscription_end_date": subscription.end_date.isoformat()
        }}
    )
    
    # Send notification email
    try:
        from api.audit_notifications import send_subscription_notification
        await send_subscription_notification(
            company_name=company.get("name", "Unknown"),
            company_email=company.get("email"),
            plan=plan,
            duration=duration,
            end_date=subscription.end_date.isoformat()
        )
    except Exception as e:
        print(f"Failed to send subscription notification: {e}")
    
    return {
        "message": "Subscription granted successfully",
        "subscription_id": subscription.id,
        "plan": plan,
        "duration": duration,
        "end_date": subscription.end_date.isoformat()
    }

@router.post("/validate-code")
async def validate_activation_code(code: str):
    """Validate an activation code without using it"""
    activation_code = await db.activation_codes.find_one(
        {"code": code, "is_active": True},
        {"_id": 0}
    )
    
    if not activation_code:
        return {"valid": False, "message": "Invalid activation code"}
    
    if activation_code.get("current_uses", 0) >= activation_code.get("max_uses", 1):
        return {"valid": False, "message": "Activation code fully used"}
    
    if activation_code.get("expires_at"):
        expires = activation_code["expires_at"]
        if isinstance(expires, str):
            expires = datetime.fromisoformat(expires)
        if datetime.utcnow() > expires:
            return {"valid": False, "message": "Activation code expired"}
    
    return {
        "valid": True,
        "plan": activation_code["plan"],
        "duration": activation_code["duration"],
        "discount": activation_code.get("discount_percent", 0)
    }



@router.post("/redeem-code")
async def redeem_activation_code(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Redeem an activation code - creates subscription with amount=0 (free gift)"""
    code_str = data.get("code", "").strip()
    if not code_str:
        raise HTTPException(status_code=400, detail="Activation code is required")
    
    user_id = current_user.get("user_id")
    company_id = current_user.get("company_id")
    
    if not company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")
    
    # Find and validate the activation code
    activation_code = await db.activation_codes.find_one(
        {"code": code_str, "is_active": True}
    )
    
    if not activation_code:
        raise HTTPException(status_code=400, detail={
            "message_en": "Invalid or inactive activation code",
            "message_ar": "كود التفعيل غير صالح أو غير نشط"
        })
    
    if activation_code.get("current_uses", 0) >= activation_code.get("max_uses", 1):
        raise HTTPException(status_code=400, detail={
            "message_en": "This activation code has been fully used",
            "message_ar": "تم استخدام كود التفعيل بالكامل"
        })
    
    if activation_code.get("expires_at"):
        expires = activation_code["expires_at"]
        if isinstance(expires, str):
            expires = datetime.fromisoformat(expires.replace('Z', '+00:00'))
        if datetime.utcnow() > expires.replace(tzinfo=None):
            raise HTTPException(status_code=400, detail={
                "message_en": "This activation code has expired",
                "message_ar": "كود التفعيل منتهي الصلاحية"
            })
    
    plan = activation_code.get("plan", "starter")
    duration = activation_code.get("duration", "12_months")
    
    # Deactivate existing subscriptions for this company
    await db.subscriptions.update_many(
        {"company_id": company_id, "status": "active"},
        {"$set": {"status": "replaced"}}
    )
    
    # Create new subscription with amount=0 (free gift)
    start_date = datetime.utcnow()
    end_date = calculate_end_date(start_date, duration)
    
    import uuid
    subscription_id = str(uuid.uuid4())
    subscription = {
        "id": subscription_id,
        "user_id": user_id,
        "company_id": company_id,
        "plan": plan,
        "duration": duration,
        "status": "active",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "amount_paid": 0,  # Free gift
        "payment_method": "activation_code",
        "activation_code_used": activation_code.get("code"),
        "created_at": start_date.isoformat()
    }
    
    await db.subscriptions.insert_one(subscription)
    
    # Update activation code usage
    await db.activation_codes.update_one(
        {"code": code_str},
        {"$inc": {"current_uses": 1}}
    )
    
    # If max uses reached, deactivate
    new_uses = activation_code.get("current_uses", 0) + 1
    if new_uses >= activation_code.get("max_uses", 1):
        await db.activation_codes.update_one(
            {"code": code_str},
            {"$set": {"is_active": False}}
        )
    
    # Update company subscription status
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "subscription_plan": plan,
            "subscription_status": "active",
            "subscription_end_date": end_date.isoformat(),
            "is_active": True
        }}
    )
    
    # Activate all users in the company
    await db.users.update_many(
        {"company_id": company_id},
        {"$set": {"is_active": True}}
    )
    
    # Record payment as 0 in subscription_payments
    await db.subscription_payments.insert_one({
        "id": f"pay_{secrets.token_hex(8)}",
        "subscription_id": subscription_id,
        "company_id": company_id,
        "amount": 0,
        "is_paid": True,
        "payment_method": "activation_code",
        "payment_date": start_date.isoformat(),
        "reference_number": code_str,
        "notes": "Free gift - Activation Code",
        "created_at": start_date.isoformat()
    })
    
    plan_names = {"starter": "المبتدئ", "professional": "المحترف", "enterprise": "المؤسسي"}
    
    return {
        "success": True,
        "message_en": f"Subscription activated successfully! Plan: {plan.title()}, Duration: {duration}",
        "message_ar": f"تم تفعيل الاشتراك بنجاح! الباقة: {plan_names.get(plan, plan)}",
        "subscription_id": subscription_id,
        "plan": plan,
        "duration": duration,
        "end_date": end_date.isoformat(),
        "amount": 0
    }
