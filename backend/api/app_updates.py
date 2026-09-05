"""
App Updates API — نظام إشعارات التحديثات
Super Admin ينشر تحديث → يرسل إيميل لكل الشركات النشطة
→ يظهر banner داخل التطبيق → العميل يضغط "تحديث" (reload فقط)
→ البيانات لا تُمس أبداً
"""

from fastapi import APIRouter, Depends, HTTPException
from services.auth_service import verify_token
from fastapi import Header
from typing import Optional, List
from database import db
from datetime import datetime, timezone
import uuid
import asyncio
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/updates", tags=["app-updates"])


async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await verify_token(authorization)


def _build_update_email(update: dict, lang: str = "ar") -> tuple[str, str]:
    """بناء إيميل إشعار التحديث"""
    title = update.get("title_ar") if lang == "ar" else update.get("title_en")
    desc  = update.get("description_ar") if lang == "ar" else update.get("description_en")
    ver   = update.get("version", "")
    feats = update.get("features", [])
    critical = update.get("is_critical", False)

    feat_html = ""
    if feats:
        items = "".join(f'<li style="margin:4px 0;color:#374151">✓ {f}</li>' for f in feats)
        feat_html = f"""
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-top:14px">
          <p style="font-weight:700;color:#166534;margin:0 0 8px">{'المميزات الجديدة' if lang=='ar' else 'New Features'}:</p>
          <ul style="margin:0;padding-right:18px;list-style:none">{items}</ul>
        </div>"""

    badge_color = "#dc2626" if critical else "#1e3a8a"
    badge_text  = ("تحديث عاجل" if lang == "ar" else "Critical Update") if critical else \
                  ("تحديث جديد" if lang == "ar" else "New Update")

    subject = f"DataLife Account — {badge_text}" + (f" v{ver}" if ver else "")

    body = f"""
    <div dir="{'rtl' if lang=='ar' else 'ltr'}" style="font-family:Cairo,sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:24px">
      <div style="background:linear-gradient(135deg,{badge_color},{badge_color}cc);border-radius:12px 12px 0 0;padding:20px 24px">
        <p style="color:rgba(255,255,255,.8);margin:0;font-size:12px">DataLife Account</p>
        <h2 style="color:#fff;margin:6px 0 0;font-size:20px">{title}</h2>
        {f'<span style="background:rgba(255,255,255,.2);color:#fff;font-size:11px;padding:2px 10px;border-radius:100px">v{ver}</span>' if ver else ''}
      </div>
      <div style="background:#fff;border-radius:0 0 12px 12px;padding:24px;border:1px solid #e5e7eb;border-top:none">
        <p style="color:#374151;line-height:1.7;margin:0">{desc}</p>
        {feat_html}
        <div style="margin-top:20px;padding:14px;background:#eff6ff;border-radius:8px;border:1px solid #bfdbfe">
          <p style="color:#1e40af;font-size:13px;margin:0">
            {'⚡ لتفعيل التحديث: افتح التطبيق واضغط <strong>«تحديث الآن»</strong> التي ستظهر تلقائياً.' if lang=='ar'
             else '⚡ To apply the update: open the app and click <strong>"Update Now"</strong> that will appear automatically.'}
          </p>
        </div>
        <div style="margin-top:20px;text-align:center">
          <a href="https://datalifeaccount.com" style="display:inline-block;padding:10px 28px;background:{badge_color};color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
            {'فتح التطبيق' if lang=='ar' else 'Open App'}
          </a>
        </div>
        <p style="color:#9ca3af;font-size:11px;margin-top:20px;text-align:center">
          {'بياناتك آمنة 100% — التحديث لا يؤثر على بياناتك' if lang=='ar'
           else 'Your data is 100% safe — the update does not affect your data'}
        </p>
      </div>
    </div>"""

    return subject, body


async def _send_update_emails(update: dict):
    """
    إرسال إيميلات لكل الشركات النشطة.
    المصدر الأول: contact_email في companies
    المصدر الثاني: email أول مستخدم (General Manager / CEO) في users
    """
    try:
        from api.email_notifications import send_email_async

        # ── جلب كل الشركات النشطة ──────────────────────
        companies = await db.companies.find(
            {"subscription_status": {"$nin": ["deleted", "banned"]}},
            {"id": 1, "contact_email": 1, "name": 1, "_id": 0}
        ).to_list(length=5000)

        # ── بناء map: company_id → contact_email ────────
        company_email_map = {}
        for c in companies:
            cid = c.get("id")
            email = c.get("contact_email")
            if cid and email:
                company_email_map[cid] = email

        # ── للشركات بدون contact_email: نجيب من users ──
        missing_ids = [c.get("id") for c in companies if not c.get("contact_email") and c.get("id")]
        if missing_ids:
            TOP_ROLES = [
                "General Manager", "CEO", "Chief Executive Officer",
                "Board Chairman", "مدير عام", "رئيس مجلس الإدارة"
            ]
            owner_users = await db.users.find(
                {
                    "company_id": {"$in": missing_ids},
                    "role": {"$in": TOP_ROLES},
                    "is_active": {"$ne": False}
                },
                {"company_id": 1, "email": 1, "_id": 0}
            ).to_list(length=5000)

            for u in owner_users:
                cid = u.get("company_id")
                email = u.get("email")
                if cid and email and cid not in company_email_map:
                    company_email_map[cid] = email

        # ── إرسال إيميل لكل شركة ───────────────────────
        subject, _ = _build_update_email(update, lang="ar")
        emails_sent = 0
        seen_emails = set()  # no duplicates

        for cid, email in company_email_map.items():
            if email in seen_emails:
                continue
            seen_emails.add(email)
            _, body = _build_update_email(update, lang="ar")
            try:
                result = await send_email_async(email, subject, body)
                if result.get("status") == "success":
                    emails_sent += 1
                else:
                    logger.warning(f"Email skipped/failed for {email}: {result}")
                await asyncio.sleep(0.05)  # throttle Resend API
            except Exception as e:
                logger.error(f"Failed to send update email to {email}: {e}")

        logger.info(f"Update emails sent: {emails_sent} / {len(company_email_map)}")
        return emails_sent

    except Exception as e:
        logger.error(f"_send_update_emails error: {e}")
        return 0


# ─────────────────────────────────────────────
# Super Admin: إضافة تحديث جديد
# ─────────────────────────────────────────────
@router.post("/")
async def create_update(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Super Admin ينشر تحديث جديد — يرسل إيميل لكل الشركات"""
    is_super = current_user.get("is_platform_admin") or current_user.get("role") == "Super Admin"
    if not is_super:
        raise HTTPException(status_code=403, detail="Super Admin only")

    update = {
        "id": str(uuid.uuid4()),
        "version": data.get("version", ""),
        "title_ar": data.get("title_ar", "تحديث جديد"),
        "title_en": data.get("title_en", "New Update"),
        "description_ar": data.get("description_ar", ""),
        "description_en": data.get("description_en", ""),
        "features": data.get("features", []),
        "is_critical": data.get("is_critical", False),
        "send_email": data.get("send_email", True),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("full_name", "Super Admin"),
        "seen_by": [],
        "updated_by": [],
        "emails_sent": 0,
    }

    await db.app_updates.insert_one(update)
    update.pop("_id", None)

    # إرسال إيميلات في الخلفية
    emails_sent = 0
    if update["send_email"]:
        try:
            emails_sent = await _send_update_emails(update)
            await db.app_updates.update_one(
                {"id": update["id"]},
                {"$set": {"emails_sent": emails_sent}}
            )
            update["emails_sent"] = emails_sent
        except Exception as e:
            logger.error(f"Email send failed: {e}")

    return {
        "message": "Update published",
        "emails_sent": emails_sent,
        "update": update
    }


# ─────────────────────────────────────────────
# الشركات: جلب التحديثات المعلقة
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
    """الشركة تضغط 'تم التحديث' أو 'تجاهل' — لا تعديل على البيانات"""
    company_id = current_user.get("company_id")
    action = data.get("action", "seen")   # "seen" | "updated"

    update_fields = {"$addToSet": {"seen_by": company_id}}
    if action == "updated":
        update_fields["$addToSet"]["updated_by"] = company_id

    result = await db.app_updates.update_one(
        {"id": update_id},
        update_fields
    )

    if result.matched_count == 0:
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


# ─────────────────────────────────────────────
# إعادة إرسال إيميلات تحديث معين
# ─────────────────────────────────────────────
@router.post("/{update_id}/resend-emails")
async def resend_update_emails(
    update_id: str,
    current_user: dict = Depends(get_current_user)
):
    is_super = current_user.get("is_platform_admin") or current_user.get("role") == "Super Admin"
    if not is_super:
        raise HTTPException(status_code=403, detail="Super Admin only")

    update = await db.app_updates.find_one({"id": update_id}, {"_id": 0})
    if not update:
        raise HTTPException(status_code=404, detail="Update not found")

    emails_sent = await _send_update_emails(update)
    await db.app_updates.update_one(
        {"id": update_id},
        {"$inc": {"emails_sent": emails_sent}}
    )

    return {"message": f"Emails sent: {emails_sent}", "emails_sent": emails_sent}
