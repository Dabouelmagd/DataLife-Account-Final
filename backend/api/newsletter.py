"""
Newsletter & Email Broadcast API
نظام النشرة الإخبارية والإيميلات الدورية للعملاء
"""

from fastapi import APIRouter, Header, BackgroundTasks
from typing import Optional
from datetime import datetime, timezone
import uuid
from database import db

router = APIRouter(prefix="/api/newsletter", tags=["newsletter"])


# ══════════════════════════════════════════
# Helper
# ══════════════════════════════════════════
async def verify_admin(authorization: str):
    from services.auth_service import verify_token
    user = await verify_token(authorization)
    is_admin = user.get("is_platform_admin") or user.get("role") == "Super Admin"
    if not is_admin:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Super Admin only")
    return user


async def get_company_emails(
    target: str = "all",         # all | active | trial | plan:professional | plan:enterprise
    company_ids: list = None
) -> list:
    """جمع إيميلات الشركات حسب الفلتر"""
    query = {}

    if company_ids:
        query["id"] = {"$in": company_ids}
    elif target == "active":
        query["is_active"] = True
    elif target == "trial":
        subs = await db.subscriptions.find({"plan": "trial"}, {"company_id": 1}).to_list(length=None)
        ids = [s["company_id"] for s in subs]
        query["id"] = {"$in": ids}
    elif target.startswith("plan:"):
        plan = target.split(":")[1]
        subs = await db.subscriptions.find({"plan": plan, "status": "active"}, {"company_id": 1}).to_list(length=None)
        ids = [s["company_id"] for s in subs]
        query["id"] = {"$in": ids}

    companies = await db.companies.find(query, {"_id": 0, "name": 1, "email": 1, "id": 1}).to_list(length=None)
    return [c for c in companies if c.get("email")]


async def send_campaign_now(campaign_id: str):
    """إرسال الحملة فعلياً في الخلفية"""
    campaign = await db.newsletter_campaigns.find_one({"id": campaign_id})
    if not campaign or campaign.get("status") in ("sent", "sending"):
        return

    await db.newsletter_campaigns.update_one(
        {"id": campaign_id},
        {"$set": {"status": "sending", "started_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Get recipients
    recipients = await get_company_emails(
        target=campaign.get("target", "all"),
        company_ids=campaign.get("company_ids")
    )

    import resend, os
    resend.api_key = os.environ.get("RESEND_API_KEY", "")

    sent = 0
    failed = 0
    logs = []

    for company in recipients:
        try:
            # Personalize
            html = campaign.get("html_content", "")
            html = html.replace("{{company_name}}", company.get("name", ""))
            html = html.replace("{{email}}", company.get("email", ""))

            resend.Emails.send({
                "from": f"DataLife Account <{campaign.get('from_email', 'noreply@datalifeaccount.com')}>",
                "to": [company["email"]],
                "subject": campaign.get("subject", ""),
                "html": html,
            })
            sent += 1
            logs.append({"email": company["email"], "status": "sent"})
        except Exception as e:
            failed += 1
            logs.append({"email": company["email"], "status": "failed", "error": str(e)[:100]})

    await db.newsletter_campaigns.update_one(
        {"id": campaign_id},
        {"$set": {
            "status": "sent",
            "sent_count": sent,
            "failed_count": failed,
            "total_recipients": len(recipients),
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "logs": logs[:50],  # Keep first 50 logs
        }}
    )


# ══════════════════════════════════════════
# CRUD Campaigns
# ══════════════════════════════════════════

@router.get("/campaigns")
async def get_campaigns(authorization: Optional[str] = Header(None)):
    """جلب كل الحملات"""
    await verify_admin(authorization)
    campaigns = await db.newsletter_campaigns.find(
        {}, {"_id": 0, "logs": 0}
    ).sort("created_at", -1).to_list(length=100)
    return {"campaigns": campaigns, "total": len(campaigns)}


@router.post("/campaigns")
async def create_campaign(
    data: dict,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None)
):
    """إنشاء حملة بريدية جديدة"""
    user = await verify_admin(authorization)

    campaign = {
        "id": str(uuid.uuid4()),
        "title":        data.get("title", ""),
        "subject":      data.get("subject", ""),
        "html_content": data.get("html_content", ""),
        "from_email":   data.get("from_email", "noreply@datalifeaccount.com"),
        "from_name":    data.get("from_name", "DataLife Account"),
        "target":       data.get("target", "all"),       # all|active|trial|plan:X
        "company_ids":  data.get("company_ids", []),     # specific companies
        "type":         data.get("type", "one_time"),    # one_time | scheduled | recurring
        "schedule_at":  data.get("schedule_at", None),   # ISO datetime or null
        "recurrence":   data.get("recurrence", None),    # weekly|monthly|quarterly
        "status":       "draft",                          # draft|scheduled|sending|sent|paused
        "sent_count":   0,
        "failed_count": 0,
        "total_recipients": 0,
        "created_by":   user.get("email"),
        "created_at":   datetime.now(timezone.utc).isoformat(),
        "updated_at":   datetime.now(timezone.utc).isoformat(),
    }

    await db.newsletter_campaigns.insert_one(campaign)
    campaign.pop("_id", None)

    # Send immediately if requested
    if data.get("send_now"):
        campaign["status"] = "scheduled"
        await db.newsletter_campaigns.update_one({"id": campaign["id"]}, {"$set": {"status": "scheduled"}})
        background_tasks.add_task(send_campaign_now, campaign["id"])

    return {"message": "تم إنشاء الحملة", "campaign": campaign}


@router.get("/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str, authorization: Optional[str] = Header(None)):
    await verify_admin(authorization)
    campaign = await db.newsletter_campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.patch("/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: str, data: dict,
    authorization: Optional[str] = Header(None)
):
    """تعديل حملة (فقط في حالة draft)"""
    await verify_admin(authorization)
    allowed = ["title","subject","html_content","from_email","from_name","target","company_ids","type","schedule_at","recurrence"]
    update = {k: v for k, v in data.items() if k in allowed}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.newsletter_campaigns.update_one({"id": campaign_id}, {"$set": update})
    return {"message": "تم تحديث الحملة"}


@router.post("/campaigns/{campaign_id}/send")
async def send_campaign(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None)
):
    """إرسال الحملة فوراً"""
    await verify_admin(authorization)
    campaign = await db.newsletter_campaigns.find_one({"id": campaign_id})
    if not campaign:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.get("status") == "sent":
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Campaign already sent")

    await db.newsletter_campaigns.update_one(
        {"id": campaign_id},
        {"$set": {"status": "scheduled", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    background_tasks.add_task(send_campaign_now, campaign_id)
    return {"message": "جاري إرسال الحملة في الخلفية"}


@router.post("/campaigns/{campaign_id}/duplicate")
async def duplicate_campaign(campaign_id: str, authorization: Optional[str] = Header(None)):
    """تكرار حملة"""
    user = await verify_admin(authorization)
    campaign = await db.newsletter_campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Campaign not found")

    new_campaign = {
        **campaign,
        "id": str(uuid.uuid4()),
        "title": f"نسخة من: {campaign.get('title', '')}",
        "status": "draft",
        "sent_count": 0, "failed_count": 0, "total_recipients": 0,
        "sent_at": None, "started_at": None, "logs": [],
        "created_by": user.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.newsletter_campaigns.insert_one(new_campaign)
    new_campaign.pop("_id", None)
    return {"message": "تم تكرار الحملة", "campaign": new_campaign}


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str, authorization: Optional[str] = Header(None)):
    """حذف حملة (فقط draft)"""
    await verify_admin(authorization)
    await db.newsletter_campaigns.delete_one({"id": campaign_id, "status": "draft"})
    return {"message": "تم حذف الحملة"}


@router.get("/preview-recipients")
async def preview_recipients(
    target: str = "all",
    authorization: Optional[str] = Header(None)
):
    """معاينة عدد المستقبلين قبل الإرسال"""
    await verify_admin(authorization)
    recipients = await get_company_emails(target=target)
    return {
        "count": len(recipients),
        "sample": [{"name": r.get("name"), "email": r.get("email")} for r in recipients[:10]],
        "target": target,
    }


@router.get("/templates")
async def get_templates(authorization: Optional[str] = Header(None)):
    """قوالب بريدية جاهزة"""
    await verify_admin(authorization)
    templates = [
        {
            "id": "welcome",
            "name_ar": "ترحيب بالعملاء الجدد",
            "name_en": "Welcome New Clients",
            "subject_ar": "مرحباً بكم في DataLife Account",
            "preview": "نشرة ترحيبية للعملاء الجدد",
        },
        {
            "id": "feature_update",
            "name_ar": "تحديث مميزات جديدة",
            "name_en": "New Feature Update",
            "subject_ar": "تحديثات جديدة في DataLife Account",
            "preview": "إعلان عن مميزات جديدة",
        },
        {
            "id": "renewal_reminder",
            "name_ar": "تذكير تجديد الاشتراك",
            "name_en": "Subscription Renewal Reminder",
            "subject_ar": "تذكير: تجديد اشتراكك في DataLife Account",
            "preview": "تذكير بانتهاء الاشتراك",
        },
        {
            "id": "monthly_tips",
            "name_ar": "نصائح شهرية",
            "name_en": "Monthly Tips",
            "subject_ar": "نصائح شهرية من DataLife Account",
            "preview": "نشرة نصائح وإرشادات",
        },
        {
            "id": "tax_season",
            "name_ar": "موسم الضرائب",
            "name_en": "Tax Season",
            "subject_ar": "استعد لموسم الضرائب مع DataLife Account",
            "preview": "نشرة موسم الضرائب",
        },
    ]
    return {"templates": templates}
