from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
import os
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import secrets
import string
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv(Path(__file__).parent.parent / '.env')

router = APIRouter(prefix="/api/coupons", tags=["coupons"])

# Configuration from environment
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://datalifeaccount.com")

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# SMTP Configuration
SMTP_CONFIG = {
    "host": os.environ.get('SMTP_HOST', ''),
    "port": int(os.environ.get('SMTP_PORT', 465)),
    "email": os.environ.get('SMTP_EMAIL', ''),
    "password": os.environ.get('SMTP_PASSWORD', ''),
    "use_ssl": os.environ.get('SMTP_USE_SSL', 'true').lower() == 'true'
}


class CouponCreate(BaseModel):
    code: Optional[str] = Field(None, description="Coupon code (auto-generated if not provided)")
    name_ar: str = Field(..., description="Coupon name in Arabic")
    name_en: str = Field(..., description="Coupon name in English")
    discount_type: str = Field(..., description="percentage or fixed")
    discount_value: float = Field(..., description="Discount value (percentage 0-100 or fixed amount)")
    min_amount: Optional[float] = Field(0, description="Minimum order amount to apply coupon")
    max_discount: Optional[float] = Field(None, description="Maximum discount for percentage coupons")
    expiry_date: Optional[str] = Field(None, description="Expiry date ISO format")
    usage_limit: Optional[int] = Field(None, description="Maximum times coupon can be used")
    applicable_plans: Optional[List[str]] = Field(None, description="List of applicable plan IDs, null for all")
    is_active: bool = Field(True, description="Whether coupon is active")


class CouponUpdate(BaseModel):
    name_ar: Optional[str] = None
    name_en: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    min_amount: Optional[float] = None
    max_discount: Optional[float] = None
    expiry_date: Optional[str] = None
    usage_limit: Optional[int] = None
    applicable_plans: Optional[List[str]] = None
    is_active: Optional[bool] = None


class CouponValidate(BaseModel):
    code: str
    package_id: str
    amount_usd: float


def generate_coupon_code(length=8):
    """Generate a random coupon code"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


@router.post("/create")
async def create_coupon(coupon: CouponCreate):
    """Create a new coupon (Admin only)"""
    
    # Generate code if not provided
    code = coupon.code or generate_coupon_code()
    code = code.upper().strip()
    
    # Check if code already exists
    existing = await db.coupons.find_one({"code": code})
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
    
    # Validate discount type and value
    if coupon.discount_type not in ["percentage", "fixed"]:
        raise HTTPException(status_code=400, detail="Invalid discount type. Use 'percentage' or 'fixed'")
    
    if coupon.discount_type == "percentage" and (coupon.discount_value <= 0 or coupon.discount_value > 100):
        raise HTTPException(status_code=400, detail="Percentage discount must be between 1 and 100")
    
    if coupon.discount_type == "fixed" and coupon.discount_value <= 0:
        raise HTTPException(status_code=400, detail="Fixed discount must be greater than 0")
    
    coupon_doc = {
        "code": code,
        "name_ar": coupon.name_ar,
        "name_en": coupon.name_en,
        "discount_type": coupon.discount_type,
        "discount_value": coupon.discount_value,
        "min_amount": coupon.min_amount or 0,
        "max_discount": coupon.max_discount,
        "expiry_date": coupon.expiry_date,
        "usage_limit": coupon.usage_limit,
        "usage_count": 0,
        "applicable_plans": coupon.applicable_plans,
        "is_active": coupon.is_active,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.coupons.insert_one(coupon_doc)
    
    # Remove _id for response
    coupon_doc.pop("_id", None)
    
    return {
        "message": "Coupon created successfully",
        "coupon": coupon_doc
    }


@router.get("/list")
async def list_coupons(include_inactive: bool = False):
    """List all coupons (Admin only)"""
    
    query = {} if include_inactive else {"is_active": True}
    coupons = await db.coupons.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"coupons": coupons, "total": len(coupons)}


@router.get("/expiring")
async def get_expiring_coupons(days: int = 7):
    """Get coupons expiring within specified days"""
    
    now = datetime.now(timezone.utc)
    future = now + timedelta(days=days)
    
    # Find coupons expiring soon
    coupons = await db.coupons.find({"is_active": True}, {"_id": 0}).to_list(1000)
    
    expiring = []
    expired = []
    
    for coupon in coupons:
        if coupon.get("expiry_date"):
            try:
                expiry = datetime.fromisoformat(coupon["expiry_date"].replace("Z", "+00:00"))
                days_left = (expiry - now).days
                
                if days_left < 0:
                    expired.append({**coupon, "days_left": days_left, "status": "expired"})
                elif days_left <= days:
                    expiring.append({**coupon, "days_left": days_left, "status": "expiring_soon"})
            except:
                pass
    
    # Sort by days left (most urgent first)
    expiring.sort(key=lambda x: x["days_left"])
    expired.sort(key=lambda x: x["days_left"], reverse=True)
    
    return {
        "expiring_soon": expiring,
        "expired": expired[:10],
        "total_expiring": len(expiring),
        "total_expired": len(expired)
    }


@router.get("/notifications")
async def get_coupon_notifications(unread_only: bool = True, limit: int = 20):
    """Get coupon-related notifications for admin"""
    
    query = {"type": {"$in": ["coupon_expiring", "coupon_expired", "coupon_renewed"]}}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(
        query, 
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {
        "notifications": notifications,
        "total": len(notifications),
        "unread": sum(1 for n in notifications if not n.get("read", False))
    }


@router.get("/{code}")
async def get_coupon(code: str):
    """Get coupon details by code"""
    
    coupon = await db.coupons.find_one({"code": code.upper()}, {"_id": 0})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    return coupon


@router.put("/{code}")
async def update_coupon(code: str, update: CouponUpdate):
    """Update coupon (Admin only)"""
    
    coupon = await db.coupons.find_one({"code": code.upper()})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.coupons.update_one(
        {"code": code.upper()},
        {"$set": update_data}
    )
    
    updated_coupon = await db.coupons.find_one({"code": code.upper()}, {"_id": 0})
    
    return {
        "message": "Coupon updated successfully",
        "coupon": updated_coupon
    }


@router.delete("/{code}")
async def delete_coupon(code: str):
    """Delete coupon (Admin only)"""
    
    result = await db.coupons.delete_one({"code": code.upper()})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    return {"message": "Coupon deleted successfully"}


@router.post("/validate")
async def validate_coupon(data: CouponValidate):
    """Validate a coupon code and calculate discount"""
    
    code = data.code.upper().strip()
    
    # Find coupon
    coupon = await db.coupons.find_one({"code": code})
    if not coupon:
        raise HTTPException(status_code=404, detail={
            "error": "invalid_code",
            "message_en": "Invalid coupon code",
            "message_ar": "كود الكوبون غير صحيح"
        })
    
    # Check if active
    if not coupon.get("is_active", True):
        raise HTTPException(status_code=400, detail={
            "error": "inactive",
            "message_en": "This coupon is no longer active",
            "message_ar": "هذا الكوبون غير نشط"
        })
    
    # Check expiry
    if coupon.get("expiry_date"):
        expiry = datetime.fromisoformat(coupon["expiry_date"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expiry:
            raise HTTPException(status_code=400, detail={
                "error": "expired",
                "message_en": "This coupon has expired",
                "message_ar": "انتهت صلاحية هذا الكوبون"
            })
    
    # Check usage limit
    if coupon.get("usage_limit") and coupon.get("usage_count", 0) >= coupon["usage_limit"]:
        raise HTTPException(status_code=400, detail={
            "error": "limit_reached",
            "message_en": "This coupon has reached its usage limit",
            "message_ar": "وصل هذا الكوبون للحد الأقصى للاستخدام"
        })
    
    # Check minimum amount
    if data.amount_usd < coupon.get("min_amount", 0):
        min_amount = coupon.get("min_amount", 0)
        raise HTTPException(status_code=400, detail={
            "error": "min_amount",
            "message_en": f"Minimum order amount is ${min_amount}",
            "message_ar": f"الحد الأدنى للطلب هو ${min_amount}"
        })
    
    # Check applicable plans
    applicable_plans = coupon.get("applicable_plans")
    if applicable_plans and data.package_id not in applicable_plans:
        raise HTTPException(status_code=400, detail={
            "error": "not_applicable",
            "message_en": "This coupon is not applicable to the selected plan",
            "message_ar": "هذا الكوبون غير قابل للتطبيق على الخطة المحددة"
        })
    
    # Calculate discount
    discount_type = coupon["discount_type"]
    discount_value = coupon["discount_value"]
    
    if discount_type == "percentage":
        discount_amount = data.amount_usd * (discount_value / 100)
        # Apply max discount cap if set
        if coupon.get("max_discount") and discount_amount > coupon["max_discount"]:
            discount_amount = coupon["max_discount"]
    else:  # fixed
        discount_amount = min(discount_value, data.amount_usd)
    
    final_amount = max(0, data.amount_usd - discount_amount)
    
    return {
        "valid": True,
        "coupon": {
            "code": coupon["code"],
            "name_en": coupon["name_en"],
            "name_ar": coupon["name_ar"],
            "discount_type": discount_type,
            "discount_value": discount_value
        },
        "original_amount": data.amount_usd,
        "discount_amount": round(discount_amount, 2),
        "final_amount": round(final_amount, 2),
        "message_en": f"Coupon applied! You save ${round(discount_amount, 2)}",
        "message_ar": f"تم تطبيق الكوبون! وفرت ${round(discount_amount, 2)}"
    }


@router.post("/use/{code}")
async def use_coupon(code: str):
    """Increment coupon usage count (called after successful payment)"""
    
    result = await db.coupons.update_one(
        {"code": code.upper()},
        {"$inc": {"usage_count": 1}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    return {"message": "Coupon usage recorded"}


# Seed some default coupons for testing
@router.post("/seed-defaults")
async def seed_default_coupons():
    """Seed default coupons for testing"""
    
    default_coupons = [
        {
            "code": "WELCOME10",
            "name_ar": "ترحيب 10%",
            "name_en": "Welcome 10%",
            "discount_type": "percentage",
            "discount_value": 10,
            "min_amount": 0,
            "max_discount": 50,
            "expiry_date": "2026-12-31T23:59:59Z",
            "usage_limit": 1000,
            "usage_count": 0,
            "applicable_plans": None,
            "is_active": True
        },
        {
            "code": "SAVE20",
            "name_ar": "وفر 20%",
            "name_en": "Save 20%",
            "discount_type": "percentage",
            "discount_value": 20,
            "min_amount": 50,
            "max_discount": 100,
            "expiry_date": "2026-06-30T23:59:59Z",
            "usage_limit": 500,
            "usage_count": 0,
            "applicable_plans": None,
            "is_active": True
        },
        {
            "code": "FLAT25",
            "name_ar": "خصم 25 دولار",
            "name_en": "$25 Off",
            "discount_type": "fixed",
            "discount_value": 25,
            "min_amount": 100,
            "max_discount": None,
            "expiry_date": "2026-12-31T23:59:59Z",
            "usage_limit": 200,
            "usage_count": 0,
            "applicable_plans": None,
            "is_active": True
        },
        {
            "code": "ENTERPRISE50",
            "name_ar": "المؤسسي 50%",
            "name_en": "Enterprise 50%",
            "discount_type": "percentage",
            "discount_value": 50,
            "min_amount": 200,
            "max_discount": 500,
            "expiry_date": "2026-12-31T23:59:59Z",
            "usage_limit": 50,
            "usage_count": 0,
            "applicable_plans": ["enterprise_3", "enterprise_6", "enterprise_9", "enterprise_12", "enterprise_lifetime"],
            "is_active": True
        }
    ]
    
    created = 0
    for coupon in default_coupons:
        existing = await db.coupons.find_one({"code": coupon["code"]})
        if not existing:
            coupon["created_at"] = datetime.now(timezone.utc).isoformat()
            coupon["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.coupons.insert_one(coupon)
            created += 1
    
    return {"message": f"Created {created} default coupons", "total_defaults": len(default_coupons)}



class SendCouponEmail(BaseModel):
    coupon_code: str
    recipient_email: str
    recipient_name: Optional[str] = None


@router.post("/send-email")
async def send_coupon_email(data: SendCouponEmail):
    """Send coupon code to a customer via email"""
    
    coupon = await db.coupons.find_one({"code": data.coupon_code.upper()}, {"_id": 0})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    # Check if coupon is active
    if not coupon.get("is_active", True):
        raise HTTPException(status_code=400, detail="Cannot send inactive coupon")
    
    # Format discount text
    if coupon["discount_type"] == "percentage":
        discount_text = f"{coupon['discount_value']}%"
    else:
        discount_text = f"${coupon['discount_value']}"
    
    # Build email content
    recipient_name = data.recipient_name or "Valued Customer"
    
    email_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #28376B 0%, #1e2a52 100%); padding: 30px; border-radius: 10px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">🎁 Special Discount for You!</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">هدية خاصة لك!</p>
        </div>
        
        <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #333;">
                Dear {recipient_name},<br><br>
                We're excited to offer you an exclusive discount on your next subscription!
            </p>
            
            <div style="background: white; border: 2px dashed #28376B; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0;">
                <p style="color: #666; margin: 0 0 10px; font-size: 14px;">Your Coupon Code:</p>
                <p style="font-size: 32px; font-weight: bold; color: #28376B; margin: 0; letter-spacing: 3px;">
                    {coupon['code']}
                </p>
                <p style="color: #28a745; font-size: 18px; margin: 15px 0 0; font-weight: bold;">
                    {discount_text} OFF
                </p>
            </div>
            
            <div style="background: #e8f4ea; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #155724; font-size: 14px;">
                    <strong>Coupon Details:</strong><br>
                    • Discount: {discount_text}<br>
                    {"• Min. Order: $" + str(coupon.get('min_amount', 0)) if coupon.get('min_amount') else "• No minimum order"}<br>
                    {"• Valid until: " + coupon.get('expiry_date', '')[:10] if coupon.get('expiry_date') else "• No expiry date"}
                </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <a href="{FRONTEND_URL}/payment" 
                   style="display: inline-block; background: #28376B; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                    Subscribe Now →
                </a>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666; text-align: center;">
                Thank you for choosing DataLife Account!<br>
                شكراً لاختيارك داتا لايف أكونت!
            </p>
        </div>
    </div>
    """
    
    # Try to send email using SMTP from environment
    try:
        if SMTP_CONFIG["host"] and SMTP_CONFIG["email"] and SMTP_CONFIG["password"]:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"🎁 Your Exclusive {discount_text} Discount Code - DataLife Account"
            msg['From'] = SMTP_CONFIG["email"]
            msg['To'] = data.recipient_email
            
            html_part = MIMEText(email_html, 'html', 'utf-8')
            msg.attach(html_part)
            
            # Use SSL for port 465
            if SMTP_CONFIG["use_ssl"] or SMTP_CONFIG["port"] == 465:
                import ssl
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(SMTP_CONFIG["host"], SMTP_CONFIG["port"], context=context) as server:
                    server.login(SMTP_CONFIG["email"], SMTP_CONFIG["password"])
                    server.send_message(msg)
            else:
                # Use TLS for port 587
                with smtplib.SMTP(SMTP_CONFIG["host"], SMTP_CONFIG["port"]) as server:
                    server.starttls()
                    server.login(SMTP_CONFIG["email"], SMTP_CONFIG["password"])
                    server.send_message(msg)
            
            # Log the email send
            await db.coupon_emails.insert_one({
                "coupon_code": coupon['code'],
                "recipient_email": data.recipient_email,
                "recipient_name": data.recipient_name,
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "status": "sent"
            })
            
            return {"message": "Coupon email sent successfully", "recipient": data.recipient_email, "status": "sent"}
        else:
            # Log as pending (no SMTP configured)
            await db.coupon_emails.insert_one({
                "coupon_code": coupon['code'],
                "recipient_email": data.recipient_email,
                "recipient_name": data.recipient_name,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "pending",
                "note": "SMTP not configured - email queued"
            })
            
            return {
                "message": "Coupon email queued (SMTP not configured)",
                "recipient": data.recipient_email,
                "coupon_code": coupon['code'],
                "email_preview": True
            }
            
    except Exception as e:
        # Log failed attempt
        await db.coupon_emails.insert_one({
            "coupon_code": coupon['code'],
            "recipient_email": data.recipient_email,
            "recipient_name": data.recipient_name,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "failed",
            "error": str(e)
        })
        
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


# ============ ADVANCED STATISTICS ============

@router.get("/statistics/advanced")
async def get_advanced_statistics():
    """Get advanced coupon usage statistics"""
    
    # Get all coupons
    coupons = await db.coupons.find({}, {"_id": 0}).to_list(1000)
    
    # Get all coupon usage from payment transactions
    transactions = await db.payment_transactions.find(
        {"coupon_code": {"$ne": None}},
        {"_id": 0, "coupon_code": 1, "discount_amount_usd": 1, "amount_usd": 1, "created_at": 1, "payment_status": 1}
    ).to_list(10000)
    
    # Calculate total discounted revenue
    total_discounted = sum(t.get("discount_amount_usd", 0) for t in transactions if t.get("payment_status") == "paid")
    
    # Top 5 most used coupons
    coupon_usage = {}
    for t in transactions:
        code = t.get("coupon_code")
        if code:
            if code not in coupon_usage:
                coupon_usage[code] = {"count": 0, "total_discount": 0}
            coupon_usage[code]["count"] += 1
            coupon_usage[code]["total_discount"] += t.get("discount_amount_usd", 0)
    
    top_coupons = sorted(coupon_usage.items(), key=lambda x: x[1]["count"], reverse=True)[:5]
    top_coupons_list = [
        {"code": code, "usage_count": data["count"], "total_discount": round(data["total_discount"], 2)}
        for code, data in top_coupons
    ]
    
    # Monthly discount report (last 6 months)
    monthly_stats = {}
    for t in transactions:
        if t.get("payment_status") == "paid" and t.get("created_at"):
            try:
                date = datetime.fromisoformat(t["created_at"].replace("Z", "+00:00"))
                month_key = date.strftime("%Y-%m")
                if month_key not in monthly_stats:
                    monthly_stats[month_key] = {"count": 0, "total_discount": 0, "total_revenue": 0}
                monthly_stats[month_key]["count"] += 1
                monthly_stats[month_key]["total_discount"] += t.get("discount_amount_usd", 0)
                monthly_stats[month_key]["total_revenue"] += t.get("amount_usd", 0)
            except:
                pass
    
    # Sort by month and get last 6
    sorted_months = sorted(monthly_stats.items(), key=lambda x: x[0], reverse=True)[:6]
    monthly_report = [
        {
            "month": month,
            "transactions": data["count"],
            "total_discount": round(data["total_discount"], 2),
            "total_revenue": round(data["total_revenue"], 2)
        }
        for month, data in reversed(sorted_months)
    ]
    
    # Coupon type distribution
    percentage_count = sum(1 for c in coupons if c.get("discount_type") == "percentage")
    fixed_count = sum(1 for c in coupons if c.get("discount_type") == "fixed")
    
    # Active vs expired
    now = datetime.now(timezone.utc)
    active_count = 0
    expired_count = 0
    for c in coupons:
        if not c.get("is_active"):
            continue
        if c.get("expiry_date"):
            try:
                expiry = datetime.fromisoformat(c["expiry_date"].replace("Z", "+00:00"))
                if expiry < now:
                    expired_count += 1
                else:
                    active_count += 1
            except:
                active_count += 1
        else:
            active_count += 1
    
    # Email statistics
    email_stats = await db.coupon_emails.aggregate([
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]).to_list(10)
    email_by_status = {s["_id"]: s["count"] for s in email_stats}
    
    return {
        "summary": {
            "total_coupons": len(coupons),
            "active_coupons": active_count,
            "expired_coupons": expired_count,
            "total_usage": len(transactions),
            "total_discounted_amount": round(total_discounted, 2)
        },
        "top_coupons": top_coupons_list,
        "monthly_report": monthly_report,
        "type_distribution": {
            "percentage": percentage_count,
            "fixed": fixed_count
        },
        "email_statistics": {
            "sent": email_by_status.get("sent", 0),
            "pending": email_by_status.get("pending", 0),
            "failed": email_by_status.get("failed", 0)
        }
    }


@router.get("/statistics/usage-chart")
async def get_usage_chart_data():
    """Get coupon usage data for chart visualization (last 30 days)"""
    
    # Get transactions from last 30 days
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    
    transactions = await db.payment_transactions.find(
        {
            "coupon_code": {"$ne": None},
            "payment_status": "paid"
        },
        {"_id": 0, "created_at": 1, "discount_amount_usd": 1}
    ).to_list(10000)
    
    # Group by day
    daily_data = {}
    for t in transactions:
        if t.get("created_at"):
            try:
                date = datetime.fromisoformat(t["created_at"].replace("Z", "+00:00"))
                if date >= thirty_days_ago:
                    day_key = date.strftime("%Y-%m-%d")
                    if day_key not in daily_data:
                        daily_data[day_key] = {"count": 0, "discount": 0}
                    daily_data[day_key]["count"] += 1
                    daily_data[day_key]["discount"] += t.get("discount_amount_usd", 0)
            except:
                pass
    
    # Fill in missing days
    chart_data = []
    current = thirty_days_ago
    while current <= datetime.now(timezone.utc):
        day_key = current.strftime("%Y-%m-%d")
        data = daily_data.get(day_key, {"count": 0, "discount": 0})
        chart_data.append({
            "date": day_key,
            "usage_count": data["count"],
            "discount_amount": round(data["discount"], 2)
        })
        current += timedelta(days=1)
    
    return {"chart_data": chart_data}


@router.post("/check-and-notify")
async def check_expiring_and_notify(admin_email: str = "info@datalifeai.com"):
    """Check for expiring coupons and send notifications"""
    
    now = datetime.now(timezone.utc)
    
    # Get expiring coupons (within 7 days)
    coupons = await db.coupons.find({"is_active": True}, {"_id": 0}).to_list(1000)
    
    expiring_coupons = []
    for coupon in coupons:
        if coupon.get("expiry_date"):
            try:
                expiry = datetime.fromisoformat(coupon["expiry_date"].replace("Z", "+00:00"))
                days_left = (expiry - now).days
                if 0 <= days_left <= 7:
                    expiring_coupons.append({**coupon, "days_left": days_left})
            except:
                pass
    
    if not expiring_coupons:
        return {"message": "No expiring coupons found", "notifications_sent": 0}
    
    # Check which ones we haven't notified yet
    notifications_to_send = []
    for coupon in expiring_coupons:
        existing = await db.coupon_notifications.find_one({
            "coupon_code": coupon["code"],
            "notification_type": "expiring_soon",
            "sent_at": {"$gte": (now - timedelta(days=1)).isoformat()}
        })
        
        if not existing:
            notifications_to_send.append(coupon)
    
    if not notifications_to_send:
        return {"message": "All notifications already sent", "notifications_sent": 0}
    
    # Build email content
    coupon_rows = ""
    for coupon in notifications_to_send:
        days_text = f"{coupon['days_left']} days" if coupon['days_left'] > 0 else "Today!"
        discount_text = f"{coupon['discount_value']}%" if coupon['discount_type'] == 'percentage' else f"${coupon['discount_value']}"
        coupon_rows += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #eee;"><code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px;">{coupon['code']}</code></td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">{coupon['name_en']}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee;">{discount_text}</td>
            <td style="padding: 12px; border-bottom: 1px solid #eee; color: {'#dc3545' if coupon['days_left'] <= 1 else '#ffc107'}; font-weight: bold;">{days_text}</td>
        </tr>
        """
    
    email_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #ff9800 0%, #f44336 100%); padding: 25px; border-radius: 10px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px;">Coupon Expiration Alert</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">تنبيه انتهاء صلاحية الكوبونات</p>
        </div>
        
        <div style="padding: 25px; background: #fff; border: 1px solid #eee; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; color: #333;">The following coupons are expiring soon:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                    <tr style="background: #f8f9fa;">
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Code</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Name</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Discount</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Expires In</th>
                    </tr>
                </thead>
                <tbody>
                    {coupon_rows}
                </tbody>
            </table>
            
            <div style="text-align: center; margin-top: 25px;">
                <a href="{FRONTEND_URL}/admin/coupons" 
                   style="display: inline-block; background: #28376B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                    Manage Coupons
                </a>
            </div>
        </div>
    </div>
    """
    
    # Send email
    try:
        if SMTP_CONFIG["host"] and SMTP_CONFIG["email"] and SMTP_CONFIG["password"]:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = f"{len(notifications_to_send)} Coupons Expiring Soon - Action Required"
            msg['From'] = SMTP_CONFIG["email"]
            msg['To'] = admin_email
            
            html_part = MIMEText(email_html, 'html', 'utf-8')
            msg.attach(html_part)
            
            if SMTP_CONFIG["use_ssl"] or SMTP_CONFIG["port"] == 465:
                import ssl
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(SMTP_CONFIG["host"], SMTP_CONFIG["port"], context=context) as server:
                    server.login(SMTP_CONFIG["email"], SMTP_CONFIG["password"])
                    server.send_message(msg)
            else:
                with smtplib.SMTP(SMTP_CONFIG["host"], SMTP_CONFIG["port"]) as server:
                    server.starttls()
                    server.login(SMTP_CONFIG["email"], SMTP_CONFIG["password"])
                    server.send_message(msg)
            
            # Log notifications
            for coupon in notifications_to_send:
                await db.coupon_notifications.insert_one({
                    "coupon_code": coupon["code"],
                    "notification_type": "expiring_soon",
                    "days_left": coupon["days_left"],
                    "admin_email": admin_email,
                    "sent_at": now.isoformat(),
                    "status": "sent"
                })
                
                # Create in-app notification
                await db.notifications.insert_one({
                    "type": "coupon_expiring",
                    "title_en": f"Coupon {coupon['code']} expiring in {coupon['days_left']} days",
                    "title_ar": f"الكوبون {coupon['code']} ينتهي خلال {coupon['days_left']} يوم",
                    "coupon_code": coupon["code"],
                    "priority": "high" if coupon["days_left"] <= 1 else "medium",
                    "read": False,
                    "created_at": now.isoformat()
                })
            
            return {
                "message": "Expiration notifications sent successfully",
                "notifications_sent": len(notifications_to_send),
                "coupons_notified": [c["code"] for c in notifications_to_send]
            }
        else:
            return {"message": "SMTP not configured", "notifications_sent": 0}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send notifications: {str(e)}")


@router.post("/renew/{code}")
async def renew_coupon(code: str, extend_months: int = 3):
    """Renew/extend a coupon's expiry date"""
    
    coupon = await db.coupons.find_one({"code": code.upper()})
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    now = datetime.now(timezone.utc)
    
    if coupon.get("expiry_date"):
        try:
            current_expiry = datetime.fromisoformat(coupon["expiry_date"].replace("Z", "+00:00"))
            base_date = max(current_expiry, now)
        except:
            base_date = now
    else:
        base_date = now
    
    # Add months
    new_expiry = base_date
    for _ in range(extend_months):
        if new_expiry.month == 12:
            new_expiry = new_expiry.replace(year=new_expiry.year + 1, month=1)
        else:
            new_expiry = new_expiry.replace(month=new_expiry.month + 1)
    
    await db.coupons.update_one(
        {"code": code.upper()},
        {"$set": {
            "expiry_date": new_expiry.isoformat(),
            "is_active": True,
            "updated_at": now.isoformat()
        }}
    )
    
    await db.coupon_renewals.insert_one({
        "coupon_code": code.upper(),
        "previous_expiry": coupon.get("expiry_date"),
        "new_expiry": new_expiry.isoformat(),
        "extended_months": extend_months,
        "renewed_at": now.isoformat()
    })
    
    updated = await db.coupons.find_one({"code": code.upper()}, {"_id": 0})
    
    return {
        "message": f"Coupon renewed for {extend_months} months",
        "coupon": updated,
        "new_expiry": new_expiry.isoformat()
    }


@router.post("/notifications/mark-read")
async def mark_notifications_read(notification_ids: List[str] = None, mark_all: bool = False):
    """Mark notifications as read"""
    
    if mark_all:
        result = await db.notifications.update_many(
            {"type": {"$in": ["coupon_expiring", "coupon_expired", "coupon_renewed"]}},
            {"$set": {"read": True}}
        )
        return {"message": "All notifications marked as read", "updated": result.modified_count}
    elif notification_ids:
        result = await db.notifications.update_many(
            {"notification_id": {"$in": notification_ids}},
            {"$set": {"read": True}}
        )
        return {"message": "Notifications marked as read", "updated": result.modified_count}
    
    return {"message": "No notifications to update", "updated": 0}


