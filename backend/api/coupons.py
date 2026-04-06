from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import secrets
import string

router = APIRouter(prefix="/api/coupons", tags=["coupons"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


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
