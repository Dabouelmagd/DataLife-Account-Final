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
from datetime import datetime, timedelta, timezone
import uuid
import secrets
import string
from dependencies import get_current_user

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
        "monthly": 30,
        "3_months": 90,
        "quarterly": 90,
        "6_months": 180,
        "9_months": 270,
        "12_months": 365,
        "yearly": 365,
        "annual": 365,        # PaymentModal sends billingCycle = 'annual'
        "month": 30,
        "gift": 365,          # matches admin_subscriptions
        "lifetime": 36500,    # 100 years
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
    """Kept for any caller that only needs a quick role test — platform roles only."""
    return user.get("role") == "Super Admin" or user.get("is_platform_admin") is True


async def is_platform_admin(user: dict) -> bool:
    """Platform (DataLife) administrator. ADMIN_ROLES lists COMPANY roles (General
    Manager, CEO...) and "admin": any customer's manager could create activation
    codes, grant subscriptions (/admin/grant) and list every company's codes.
    is_platform_admin is not in the JWT, so it is read from the user record."""
    if user.get("role") == "Super Admin":
        return True
    rec = await db.users.find_one({"id": user.get("user_id")}, {"_id": 0, "is_platform_admin": 1, "role": 1})
    return bool(rec and (rec.get("is_platform_admin") is True or rec.get("role") == "Super Admin"))

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
            {"$inc": {"current_uses": 1, "used_count": 1}}
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
    if not await is_platform_admin(current_user):
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
    if not await is_platform_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    codes = await db.activation_codes.find({}, {"_id": 0}).to_list(100)
    return codes

@router.delete("/admin/activation-codes/{code_id}")
async def delete_activation_code(
    code_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Deactivate an activation code (Admin only)"""
    if not await is_platform_admin(current_user):
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
    if not await is_platform_admin(current_user):
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
    if not await is_platform_admin(current_user):
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
    
    uses_so_far = max(activation_code.get("current_uses", 0), activation_code.get("used_count", 0))
    if uses_so_far >= activation_code.get("max_uses", 1):
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
    
    uses_so_far = max(activation_code.get("current_uses", 0), activation_code.get("used_count", 0))
    if uses_so_far >= activation_code.get("max_uses", 1):
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
        {"$inc": {"current_uses": 1, "used_count": 1}}
    )
    
    # If max uses reached, deactivate
    new_uses = uses_so_far + 1
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

# ══════════════════════════════════════════
# INDUSTRY PACKS — حسابات وشاشات حسب النشاط
# ══════════════════════════════════════════
# A pack's accounts are injected into the company's chart when it subscribes,
# and never removed automatically: an account that has been posted to must
# stay, or its entries would point at nothing.

@router.get("/industry-packs/public")
async def public_industry_packs():
    """الباقات المعروضة في الموقع — نفس مصدر التطبيق.

    The pricing page used to carry its own hard-coded list. It drifted: the
    site sold education, retail, logistics and advertising, none of which
    existed in the system — a customer could pay for a pack that injected
    nothing — while import, export, professional services and media existed
    and were never offered. One source now.
    """
    from services.industry_packs import list_packs
    return {"packs": list_packs()}


@router.get("/industry-packs")
async def list_industry_packs(current_user: dict = Depends(get_current_user)):
    """الباقات المتاحة، وأيها مفعّل لهذه الشركة."""
    from services.industry_packs import list_packs
    company_id = current_user.get("company_id")
    company = await db.companies.find_one({"id": company_id}, {"_id": 0, "industry_packs": 1}) or {}
    sub = await db.subscriptions.find_one(
        {"company_id": company_id, "status": "active"}, {"_id": 0, "plan": 1})

    active = set(company.get("industry_packs") or [])
    pending = {r["pack_key"]: r async for r in db.pack_subscriptions.find(
        {"company_id": company_id, "status": "pending_payment"}, {"_id": 0})}
    packs = []
    for p in list_packs():
        request = pending.get(p["key"])
        packs.append({**p, "active": p["key"] in active,
                      "pending_payment": bool(request),
                      "amount_due": (request or {}).get("total_amount")})
    return {"packs": packs, "active_count": len(active),
            "pending_count": len(pending), "included_in_plan": False,
            "plan": (sub or {}).get("plan")}


@router.get("/industry-packs/{pack_key}/accounts")
async def industry_pack_accounts(pack_key: str, current_user: dict = Depends(get_current_user)):
    """حسابات الباقة كما هي في شجرة الشركة — بأرصدتها."""
    from services.industry_packs import PACKS
    if pack_key not in PACKS:
        raise HTTPException(status_code=404, detail="الباقة غير موجودة")
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="الحساب غير مرتبط بشركة")

    codes = [c for c, *_ in PACKS[pack_key]["accounts"]]
    rows = await db.chart_of_accounts.find(
        {"company_id": company_id, "account_code": {"$in": codes}},
        {"_id": 0, "account_code": 1, "account_name": 1, "account_type": 1,
         "current_balance": 1}).sort("account_code", 1).to_list(200)
    return {"pack": pack_key, "name_ar": PACKS[pack_key]["name_ar"],
            "accounts": rows, "expected": len(codes), "present": len(rows)}


@router.post("/industry-packs/{pack_key}/request")
async def request_industry_pack(pack_key: str, data: dict = None,
                                current_user: dict = Depends(get_current_user)):
    """طلب الاشتراك في باقة نشاط — لا تُفعَّل قبل السداد.

    Activation used to happen on the spot and for free: the button injected
    the accounts and nothing was ever billed. A pack is a paid add-on, so the
    request is recorded, the company is told what to pay and how, and the
    accounts are injected only once the payment is confirmed.
    """
    from services.industry_packs import PACKS
    if pack_key not in PACKS:
        raise HTTPException(status_code=404, detail="الباقة غير موجودة")
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="الحساب غير مرتبط بشركة")

    pack = PACKS[pack_key]
    company = await db.companies.find_one({"id": company_id}, {"_id": 0, "industry_packs": 1}) or {}
    if pack_key in (company.get("industry_packs") or []):
        raise HTTPException(status_code=400, detail="الباقة مفعّلة بالفعل")

    existing = await db.pack_subscriptions.find_one(
        {"company_id": company_id, "pack_key": pack_key, "status": "pending_payment"}, {"_id": 0})
    if existing:
        return {"message": "لديك طلب قائم لهذه الباقة في انتظار تأكيد السداد",
                "request": existing, "already_requested": True}

    months = int((data or {}).get("months") or 1)
    if months not in (1, 3, 6, 12):
        raise HTTPException(status_code=400, detail="مدة الاشتراك يجب أن تكون 1 أو 3 أو 6 أو 12 شهراً")
    price = float(pack.get("price_egp") or 0)
    request = {
        "id": str(uuid.uuid4()), "company_id": company_id, "pack_key": pack_key,
        "pack_name": pack["name_ar"], "months": months,
        "monthly_price": price, "total_amount": round(price * months, 2),
        "status": "pending_payment",
        "requested_by": current_user.get("user_id"),
        "requested_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.pack_subscriptions.insert_one(dict(request))
    return {"message": f"تم تسجيل طلب {pack['name_ar']} — تُفعَّل بعد تأكيد السداد",
            "request": request,
            "amount_due": request["total_amount"],
            "next_step": "أرسل قيمة الاشتراك عبر إنستاباي أو فودافون كاش وارفع الإيصال من صفحة الاشتراك، "
                         "أو استخدم كود تفعيل إن كان لديك."}


@router.post("/industry-packs/{pack_key}/confirm-payment")
async def confirm_pack_payment(pack_key: str, data: dict = None,
                               current_user: dict = Depends(get_current_user)):
    """تأكيد سداد باقة وتفعيلها — للإدارة فقط بعد التحقق من التحويل."""
    from services.industry_packs import PACKS, pack_accounts
    if current_user.get("role") not in ("Super Admin", "مدير النظام"):
        raise HTTPException(status_code=403, detail="تأكيد السداد مقصور على إدارة المنصة")
    if pack_key not in PACKS:
        raise HTTPException(status_code=404, detail="الباقة غير موجودة")

    company_id = (data or {}).get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="حدد الشركة")
    request = await db.pack_subscriptions.find_one(
        {"company_id": company_id, "pack_key": pack_key, "status": "pending_payment"}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="لا يوجد طلب في انتظار السداد لهذه الشركة")

    existing = {a["account_code"] async for a in db.chart_of_accounts.find(
        {"company_id": company_id}, {"_id": 0, "account_code": 1})}
    to_add = [a for a in pack_accounts(pack_key, company_id) if a["account_code"] not in existing]
    if to_add:
        await db.chart_of_accounts.insert_many(to_add)

    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=30 * int(request.get("months", 1)))
    await db.pack_subscriptions.update_one({"id": request["id"]}, {"$set": {
        "status": "active", "activated_at": now.isoformat(), "expires_at": expires.isoformat(),
        "confirmed_by": current_user.get("user_id"),
        "payment_reference": (data or {}).get("payment_reference")}})
    await db.companies.update_one({"id": company_id}, {
        "$addToSet": {"industry_packs": pack_key},
        "$set": {f"industry_pack_dates.{pack_key}": now.isoformat()}})
    # A confirmed pack payment is a taxable supply like any other: the customer
    # is owed a tax invoice for it, not only for the base subscription.
    from services.subscription_invoices import issue_and_send
    invoice = await issue_and_send(db, {
        "id": request["id"], "company_id": company_id,
        "amount": request.get("total_amount"),
        "plan": f"industry_pack:{pack_key}",
        "period": f"{request.get('months', 1)} شهر",
        "description": f"اشتراك {PACKS[pack_key]['name_ar']} — {request.get('months', 1)} شهر",
        "payment_method": (data or {}).get("payment_method") or "تحويل",
    }, company_id)

    # the same payment on both sets of books: the customer's expense and the
    # platform's revenue, with VAT on the right side of each
    from services.subscription_posting import post_subscription_payment
    posting = await post_subscription_payment(
        db, customer_company_id=company_id, user_id=current_user.get("user_id"),
        net=invoice.get("net_amount"), vat=invoice.get("vat_amount"),
        description=f"{PACKS[pack_key]['name_ar']} — {request.get('months', 1)} شهر",
        invoice_number=invoice.get("invoice_number"))

    return {"message": f"تم تأكيد السداد وتفعيل {PACKS[pack_key]['name_ar']}",
            "accounts_added": len(to_add), "expires_at": expires.isoformat(),
            "invoice": invoice, "posting": posting}


@router.post("/industry-packs/{pack_key}/activate")
async def activate_industry_pack(pack_key: str, current_user: dict = Depends(get_current_user)):
    """تفعيل مباشر — لإدارة المنصة فقط (تجربة، أو تسوية يدوية بعد سداد مؤكَّد)."""
    from services.industry_packs import PACKS, pack_accounts
    # A sector pack is a paid add-on on top of the base plan, for every
    # customer — a full plan does not include it. Direct activation stays with
    # platform administration, for trials and for settling a confirmed payment.
    if current_user.get("role") not in ("Super Admin", "مدير النظام"):
        raise HTTPException(status_code=403, detail=(
            "الباقة تُفعَّل بعد سداد اشتراكها — استخدم «اشترك الآن» لتسجيل الطلب"))
    allowed_roles = ["رئيس مجلس الإدارة", "Board Chairman", "مدير عام", "General Manager", "CEO",
                     "المدير التنفيذي", "المدير المالي", "CFO", "رئيس الحسابات", "Chief Accountant",
                     "Super Admin"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="تفعيل الباقات مقصور على الإدارة والإدارة المالية")
    if pack_key not in PACKS:
        raise HTTPException(status_code=404, detail="الباقة غير موجودة")

    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="الحساب غير مرتبط بشركة")

    existing = {a["account_code"] async for a in db.chart_of_accounts.find(
        {"company_id": company_id}, {"_id": 0, "account_code": 1})}
    to_add = [a for a in pack_accounts(pack_key, company_id) if a["account_code"] not in existing]
    if to_add:
        await db.chart_of_accounts.insert_many(to_add)
    await db.companies.update_one({"id": company_id}, {
        "$addToSet": {"industry_packs": pack_key},
        "$set": {f"industry_pack_dates.{pack_key}": datetime.now(timezone.utc).isoformat()}})
    return {"message": f"تم تفعيل {PACKS[pack_key]['name_ar']}",
            "accounts_added": len(to_add),
            "accounts_already_present": len(PACKS[pack_key]["accounts"]) - len(to_add)}


@router.post("/industry-packs/{pack_key}/deactivate")
async def deactivate_industry_pack(pack_key: str, current_user: dict = Depends(get_current_user)):
    """إيقاف باقة: تختفي شاشاتها، وتبقى الحسابات التي تحرّكت عليها قيود."""
    from services.industry_packs import PACKS
    if current_user.get("role") not in ["رئيس مجلس الإدارة", "مدير عام", "المدير المالي",
                                        "Board Chairman", "General Manager", "CFO", "Super Admin"]:
        raise HTTPException(status_code=403, detail="إيقاف الباقات مقصور على الإدارة")
    if pack_key not in PACKS:
        raise HTTPException(status_code=404, detail="الباقة غير موجودة")
    company_id = current_user.get("company_id")

    codes = [c for c, *_ in PACKS[pack_key]["accounts"]]
    used = {a["account_code"] async for a in db.chart_of_accounts.find(
        {"company_id": company_id, "account_code": {"$in": codes},
         "current_balance": {"$ne": 0}}, {"_id": 0, "account_code": 1})}
    # unused accounts can go; anything with a balance stays, its entries need it
    removable = [c for c in codes if c not in used]
    if removable:
        await db.chart_of_accounts.delete_many(
            {"company_id": company_id, "account_code": {"$in": removable},
             "industry_pack": pack_key, "current_balance": 0})
    await db.companies.update_one({"id": company_id}, {"$pull": {"industry_packs": pack_key}})
    return {"message": f"تم إيقاف {PACKS[pack_key]['name_ar']}",
            "accounts_removed": len(removable),
            "accounts_kept": len(used),
            "note": "حسابات تحرّكت عليها قيود بقيت في الشجرة" if used else None}

# ══════════════════════════════════════════
# الفواتير الضريبية للاشتراك
# ══════════════════════════════════════════

@router.get("/invoices")
async def my_subscription_invoices(current_user: dict = Depends(get_current_user)):
    """فواتير اشتراك الشركة الضريبية."""
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=403, detail="الحساب غير مرتبط بشركة")
    rows = await db.subscription_invoices.find(
        {"company_id": company_id}, {"_id": 0}).sort("issued_at", -1).to_list(200)
    return {"invoices": rows, "total": len(rows),
            "total_paid": round(sum(float(r.get("total_amount") or 0) for r in rows), 2)}


@router.get("/invoices/{invoice_number}")
async def subscription_invoice_html(invoice_number: str,
                                    current_user: dict = Depends(get_current_user)):
    """الفاتورة جاهزة للطباعة أو الحفظ."""
    from fastapi.responses import HTMLResponse
    from services.subscription_invoices import render_html
    company_id = current_user.get("company_id")
    inv = await db.subscription_invoices.find_one(
        {"invoice_number": invoice_number, "company_id": company_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    return HTMLResponse(render_html(inv))


@router.post("/invoices/{invoice_number}/resend")
async def resend_subscription_invoice(invoice_number: str,
                                      current_user: dict = Depends(get_current_user)):
    """إعادة إرسال الفاتورة بالبريد — لا تصدر رقماً جديداً."""
    from services.subscription_invoices import email_invoice
    company_id = current_user.get("company_id")
    inv = await db.subscription_invoices.find_one(
        {"invoice_number": invoice_number, "company_id": company_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    sent = await email_invoice(inv)
    if not sent:
        raise HTTPException(status_code=400, detail="تعذّر إرسال البريد — راجع البريد المسجّل للشركة")
    return {"message": f"أُعيد إرسال الفاتورة {invoice_number} إلى {inv.get('buyer', {}).get('email')}"}
