"""
Ads Management API — نظام الإعلانات
مساحات إعلانية في صفحة الويب + حجز + دفع + AdSense
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid
from database import db

router = APIRouter(prefix="/api/ads", tags=["ads"])

# ═══════════════════════════════════════════
# مساحات الإعلانات المتاحة
# ═══════════════════════════════════════════
AD_SPACES = [
    {
        "id": "hero_banner",
        "name_ar": "البانر الرئيسي",
        "name_en": "Hero Banner",
        "location_ar": "أعلى الصفحة الرئيسية",
        "location_en": "Top of landing page",
        "size": "1200x200",
        "format": "image",
        "daily_price_egp": 500,
        "weekly_price_egp": 2500,
        "monthly_price_egp": 8000,
        "max_advertisers": 1,
        "description_ar": "أعلى مستوى رؤية — يظهر فوق كل شيء",
        "is_active": True,
        "thumbnail": "hero",
    },
    {
        "id": "sidebar_right",
        "name_ar": "الشريط الجانبي الأيمن",
        "name_en": "Right Sidebar",
        "location_ar": "الشريط الجانبي في صفحة الميزات",
        "location_en": "Features page sidebar",
        "size": "300x600",
        "format": "image",
        "daily_price_egp": 200,
        "weekly_price_egp": 1000,
        "monthly_price_egp": 3000,
        "max_advertisers": 2,
        "description_ar": "ظهور بجانب محتوى الميزات",
        "is_active": True,
        "thumbnail": "sidebar",
    },
    {
        "id": "pricing_banner",
        "name_ar": "بانر خطط الأسعار",
        "name_en": "Pricing Banner",
        "location_ar": "فوق جدول الأسعار",
        "location_en": "Above pricing table",
        "size": "970x90",
        "format": "image",
        "daily_price_egp": 300,
        "weekly_price_egp": 1500,
        "monthly_price_egp": 5000,
        "max_advertisers": 1,
        "description_ar": "يراه العملاء عند مقارنة الأسعار",
        "is_active": True,
        "thumbnail": "pricing",
    },
    {
        "id": "blog_inline",
        "name_ar": "إعلان داخل المحتوى",
        "name_en": "In-Content Ad",
        "location_ar": "داخل صفحات المدونة والدليل",
        "location_en": "Inside blog and guide pages",
        "size": "728x90",
        "format": "image",
        "daily_price_egp": 150,
        "weekly_price_egp": 800,
        "monthly_price_egp": 2500,
        "max_advertisers": 3,
        "description_ar": "بين فقرات المحتوى — نسبة نقر عالية",
        "is_active": True,
        "thumbnail": "inline",
    },
    {
        "id": "footer_banner",
        "name_ar": "بانر التذييل",
        "name_en": "Footer Banner",
        "location_ar": "أسفل كل صفحة",
        "location_en": "Bottom of every page",
        "size": "1200x100",
        "format": "image",
        "daily_price_egp": 100,
        "weekly_price_egp": 500,
        "monthly_price_egp": 1500,
        "max_advertisers": 2,
        "description_ar": "يظهر في نهاية كل صفحة في الموقع",
        "is_active": True,
        "thumbnail": "footer",
    },
    {
        "id": "popup_ad",
        "name_ar": "إعلان منبثق",
        "name_en": "Popup Ad",
        "location_ar": "نافذة منبثقة عند الدخول أو الخروج",
        "location_en": "Popup on entry or exit intent",
        "size": "600x400",
        "format": "image",
        "daily_price_egp": 400,
        "weekly_price_egp": 2000,
        "monthly_price_egp": 6000,
        "max_advertisers": 1,
        "description_ar": "أعلى معدل تحويل — مرة واحدة لكل زيارة",
        "is_active": True,
        "thumbnail": "popup",
    },
]

ADSENSE_CONFIG = {
    "client_id": "ca-pub-0000000000000000",  # يتم تحديثه من الإعدادات
    "enabled": False,
    "slots": {
        "hero_banner":    "1234567890",
        "sidebar_right":  "0987654321",
        "pricing_banner": "1122334455",
        "blog_inline":    "5544332211",
        "footer_banner":  "9988776655",
    }
}


@router.get("/spaces")
async def get_ad_spaces():
    """جلب كل المساحات الإعلانية المتاحة مع أسعارها وحالتها"""
    spaces = []
    for space in AD_SPACES:
        if not space["is_active"]: continue
        # Check availability
        now = datetime.now(timezone.utc)
        active_bookings = await db.ad_bookings.count_documents({
            "space_id": space["id"],
            "status": "active",
            "end_date": {"$gte": now.isoformat()}
        })
        space_copy = {**space}
        space_copy["available_slots"] = space["max_advertisers"] - active_bookings
        space_copy["is_available"] = space_copy["available_slots"] > 0
        spaces.append(space_copy)
    return {"spaces": spaces}


@router.get("/spaces/{space_id}")
async def get_ad_space(space_id: str):
    """تفاصيل مساحة إعلانية"""
    space = next((s for s in AD_SPACES if s["id"] == space_id), None)
    if not space:
        raise HTTPException(status_code=404, detail="Ad space not found")

    # Get active bookings
    bookings = await db.ad_bookings.find(
        {"space_id": space_id, "status": "active"},
        {"_id": 0, "advertiser_name": 1, "start_date": 1, "end_date": 1}
    ).to_list(length=10)

    return {**space, "active_bookings": bookings}


@router.post("/book")
async def book_ad_space(data: dict, authorization: Optional[str] = Header(None)):
    """حجز مساحة إعلانية"""
    space_id   = data.get("space_id")
    duration   = data.get("duration", "monthly")  # daily | weekly | monthly | custom
    start_date = data.get("start_date", datetime.now(timezone.utc).date().isoformat())
    advertiser_name  = data.get("advertiser_name", "")
    advertiser_email = data.get("advertiser_email", "")
    advertiser_phone = data.get("advertiser_phone", "")
    ad_url     = data.get("ad_url", "")
    ad_title   = data.get("ad_title", "")
    notes      = data.get("notes", "")

    space = next((s for s in AD_SPACES if s["id"] == space_id), None)
    if not space:
        raise HTTPException(status_code=404, detail="Ad space not found")

    # Calculate price + end date
    duration_days = {"daily": 1, "weekly": 7, "monthly": 30, "custom": data.get("days", 30)}.get(duration, 30)
    price_key = {"daily": "daily_price_egp", "weekly": "weekly_price_egp"}.get(duration, "monthly_price_egp")
    price = space.get(price_key, space["monthly_price_egp"])

    start = datetime.fromisoformat(start_date)
    end   = start + timedelta(days=duration_days)

    booking = {
        "id": str(uuid.uuid4()),
        "space_id": space_id,
        "space_name_ar": space["name_ar"],
        "space_name_en": space["name_en"],
        "advertiser_name": advertiser_name,
        "advertiser_email": advertiser_email,
        "advertiser_phone": advertiser_phone,
        "ad_url": ad_url,
        "ad_title": ad_title,
        "ad_image_url": data.get("ad_image_url", ""),
        "duration": duration,
        "duration_days": duration_days,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "price_egp": price,
        "payment_method": data.get("payment_method", "bank_transfer"),
        "payment_reference": data.get("payment_reference", ""),
        "status": "pending",  # pending → active → expired
        "notes": notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.ad_bookings.insert_one(booking)
    booking.pop("_id", None)

    return {
        "message": "تم استلام طلب الحجز — سيتم التأكيد خلال 24 ساعة بعد تأكيد الدفع",
        "booking_id": booking["id"],
        "total_price_egp": price,
        "booking": booking,
    }


@router.get("/bookings")
async def get_bookings(authorization: Optional[str] = Header(None)):
    """Super Admin: كل الحجوزات"""
    bookings = await db.ad_bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    total_revenue = sum(b.get("price_egp", 0) for b in bookings if b.get("status") == "active")
    pending = [b for b in bookings if b.get("status") == "pending"]
    active  = [b for b in bookings if b.get("status") == "active"]
    return {
        "bookings": bookings,
        "total": len(bookings),
        "pending": len(pending),
        "active": len(active),
        "total_revenue_egp": total_revenue,
    }


@router.patch("/bookings/{booking_id}")
async def update_booking(booking_id: str, data: dict, authorization: Optional[str] = Header(None)):
    """تحديث حالة الحجز (Super Admin)"""
    status = data.get("status")
    update = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}
    if data.get("notes"): update["admin_notes"] = data["notes"]
    await db.ad_bookings.update_one({"id": booking_id}, {"$set": update})
    return {"message": f"Booking updated to {status}"}


@router.get("/adsense/config")
async def get_adsense_config():
    """جلب إعدادات AdSense"""
    config = await db.ads_config.find_one({"type": "adsense"}, {"_id": 0})
    return config or ADSENSE_CONFIG


@router.put("/adsense/config")
async def update_adsense_config(data: dict, authorization: Optional[str] = Header(None)):
    """تحديث إعدادات AdSense (Super Admin)"""
    await db.ads_config.replace_one(
        {"type": "adsense"},
        {"type": "adsense", **data, "updated_at": datetime.now(timezone.utc).isoformat()},
        upsert=True
    )
    return {"message": "AdSense config updated"}


@router.get("/active/{space_id}")
async def get_active_ad(space_id: str):
    """جلب الإعلان النشط لمساحة معينة (Frontend display)"""
    now = datetime.now(timezone.utc).isoformat()

    # 1. Check manual booking
    booking = await db.ad_bookings.find_one(
        {"space_id": space_id, "status": "active", "end_date": {"$gte": now}},
        {"_id": 0},
        sort=[("start_date", -1)]
    )
    if booking:
        return {"type": "custom", "booking": booking}

    # 2. Fallback to AdSense
    config = await db.ads_config.find_one({"type": "adsense"}, {"_id": 0})
    cfg = config or ADSENSE_CONFIG
    if cfg.get("enabled"):
        return {
            "type": "adsense",
            "client": cfg.get("client_id"),
            "slot": cfg.get("slots", {}).get(space_id),
        }

    return {"type": "none"}
