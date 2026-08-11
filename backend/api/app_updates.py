"""
App Updates API — نظام إشعارات التحديثات
Super Admin يضيف تحديث → يظهر لكل الشركات → العميل يضغط "تحديث" → تختفي الرسالة
"""

from fastapi import APIRouter, Depends, HTTPException
from services.auth_service import verify_token
from fastapi import Header
from typing import Optional
from database import db
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/api/updates", tags=["app-updates"])

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await verify_token(authorization)


# ─────────────────────────────────────────────
# Super Admin: إضافة تحديث جديد
# ─────────────────────────────────────────────
@router.post("/")
async def create_update(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Super Admin ينشر تحديث جديد لكل الشركات"""
    is_super = current_user.get("is_platform_admin") or current_user.get("role") == "Super Admin"
    if not is_super:
        raise HTTPException(status_code=403, detail="Super Admin only")

    update = {
        "id": str(uuid.uuid4()),
        "version": data.get("version", ""),          # e.g. "2.1.0"
        "title_ar": data.get("title_ar", "تحديث جديد"),
        "title_en": data.get("title_en", "New Update"),
        "description_ar": data.get("description_ar", ""),
        "description_en": data.get("description_en", ""),
        "features": data.get("features", []),         # list of feature strings
        "is_critical": data.get("is_critical", False),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("full_name", "Super Admin"),
        "seen_by": [],       # list of company_ids that dismissed
        "updated_by": [],    # list of company_ids that clicked update
    }

    await db.app_updates.insert_one(update)
    update.pop("_id", None)
    return {"message": "Update published", "update": update}


# ─────────────────────────────────────────────
# الشركات: جلب التحديثات الجديدة
# ─────────────────────────────────────────────
@router.get("/pending")
async def get_pending_updates(
    current_user: dict = Depends(get_current_user)
):
    """جلب التحديثات التي لم تُغلقها الشركة بعد"""
    company_id = current_user.get("company_id")
    if not company_id:
        return {"updates": []}

    updates = await db.app_updates.find(
        {
            "is_active": True,
            "seen_by": {"$nin": [company_id]},
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=10)

    return {"updates": updates}


# ─────────────────────────────────────────────
# الشركة: تأكيد "رأيت التحديث / حدّثت"
# ─────────────────────────────────────────────
@router.post("/{update_id}/acknowledge")
async def acknowledge_update(
    update_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """الشركة تضغط 'تم التحديث' أو 'تجاهل'"""
    company_id = current_user.get("company_id")
    action = data.get("action", "seen")   # "seen" | "updated"

    update_fields = {"$addToSet": {"seen_by": company_id}}
    if action == "updated":
        update_fields["$addToSet"]["updated_by"] = company_id

    result = await db.app_updates.update_one(
        {"id": update_id},
        update_fields
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Update not found")

    return {"message": "Acknowledged"}


# ─────────────────────────────────────────────
# Super Admin: قائمة كل التحديثات
# ─────────────────────────────────────────────
@router.get("/all")
async def list_all_updates(
    current_user: dict = Depends(get_current_user)
):
    is_super = current_user.get("is_platform_admin") or current_user.get("role") == "Super Admin"
    if not is_super:
        raise HTTPException(status_code=403, detail="Super Admin only")

    updates = await db.app_updates.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=100)

    return {"updates": updates}


# ─────────────────────────────────────────────
# Super Admin: إيقاف تحديث
# ─────────────────────────────────────────────
@router.patch("/{update_id}/deactivate")
async def deactivate_update(
    update_id: str,
    current_user: dict = Depends(get_current_user)
):
    is_super = current_user.get("is_platform_admin") or current_user.get("role") == "Super Admin"
    if not is_super:
        raise HTTPException(status_code=403, detail="Super Admin only")

    await db.app_updates.update_one(
        {"id": update_id},
        {"$set": {"is_active": False}}
    )
    return {"message": "Update deactivated"}
