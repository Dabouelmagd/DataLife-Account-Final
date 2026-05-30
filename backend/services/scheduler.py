"""
Background scheduler — runs periodic jobs such as the monthly VAT report.
Uses APScheduler with AsyncIOScheduler to run async jobs alongside FastAPI.
"""
import os
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from motor.motor_asyncio import AsyncIOMotorClient

from services.tax_invoice_service import send_monthly_vat_report
from services.financial_reports_service import send_monthly_financial_report


async def _send_subscription_expiry_reminders():
    """
    Daily job that warns companies whose paid subscription is about to expire.
    Sends emails when:
      - 14 days before end_date (gentle reminder)
      - 7 days before  end_date (warning)
      - 3 days before  end_date (urgent)
      - 0 days remaining (final notice)
    Also pings trial accounts at 7 / 3 / 0 days remaining of their 14-day window.
    """
    from datetime import timedelta
    db = _get_db()
    now = datetime.now(timezone.utc)
    today = now.date()

    # ---- 1) Paid subscriptions tracked in `subscriptions` collection ----
    paid = await db.subscriptions.find(
        {"status": "active"}, {"_id": 0}
    ).to_list(length=5000)

    for sub in paid:
        end_raw = sub.get("end_date")
        if not end_raw:
            continue
        try:
            end_date = datetime.fromisoformat(end_raw).date()
        except Exception:
            continue
        days_left = (end_date - today).days
        if days_left not in (14, 7, 3, 0):
            continue
        company = await db.companies.find_one(
            {"id": sub.get("company_id")}, {"_id": 0, "name": 1, "contact_email": 1}
        )
        if not company or not company.get("contact_email"):
            continue
        await _send_expiry_email(
            recipient=company["contact_email"],
            company_name=company.get("name", ""),
            days_left=days_left,
            end_date=end_date.isoformat(),
            plan=sub.get("plan", ""),
            is_trial=False,
            db=db,
        )

    # ---- 2) Trial companies (14-day trial from created_at) ----
    trial_companies = await db.companies.find(
        {"subscription_plan": "trial"}, {"_id": 0, "id": 1, "name": 1, "contact_email": 1, "created_at": 1}
    ).to_list(length=5000)

    for co in trial_companies:
        created_raw = co.get("created_at")
        if not created_raw or not co.get("contact_email"):
            continue
        try:
            created = datetime.fromisoformat(created_raw)
        except Exception:
            continue
        end_date = (created + timedelta(days=14)).date()
        days_left = (end_date - today).days
        if days_left not in (7, 3, 0):
            continue
        await _send_expiry_email(
            recipient=co["contact_email"],
            company_name=co.get("name", ""),
            days_left=days_left,
            end_date=end_date.isoformat(),
            plan="trial",
            is_trial=True,
            db=db,
        )


async def _send_expiry_email(
    *, recipient: str, company_name: str, days_left: int, end_date: str,
    plan: str, is_trial: bool, db,
):
    """Send an expiry-reminder email and store a record so we don't double-send."""
    import resend
    import asyncio as _asyncio
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        return
    # Idempotency: skip if we already sent the same reminder today
    marker = await db.subscription_reminders.find_one({
        "recipient": recipient,
        "days_left": days_left,
        "for_date": datetime.now(timezone.utc).date().isoformat(),
    })
    if marker:
        return

    is_expired = days_left == 0
    if is_expired:
        title_ar, title_en = "انتهى اشتراكك", "Your subscription has ended"
        color1, color2 = "#dc2626", "#991b1b"
        cta_ar, cta_en = "تجديد الاشتراك الآن", "Renew now"
    elif days_left <= 3:
        title_ar = f"تنبيه عاجل: {days_left} أيام لانتهاء اشتراكك"
        title_en = f"Urgent: {days_left} days left in your subscription"
        color1, color2 = "#f97316", "#c2410c"
        cta_ar, cta_en = "تجديد قبل الانتهاء", "Renew before it ends"
    else:
        title_ar = f"تذكير: {days_left} يوماً متبقياً على اشتراكك"
        title_en = f"Reminder: {days_left} days left in your subscription"
        color1, color2 = "#6366f1", "#4338ca"
        cta_ar, cta_en = "ترقية أو تجديد", "Upgrade or Renew"

    badge = "(Free Trial)" if is_trial else f"({plan})"
    html = f"""
    <div style="font-family: Arial,sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; direction: rtl;">
        <div style="background: linear-gradient(135deg, {color1} 0%, {color2} 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color:#fff; margin: 0; text-align: center; font-size: 22px;">⏰ {title_ar}</h1>
            <p style="color: rgba(255,255,255,.9); text-align: center; margin: 8px 0 0; font-size: 14px;">{title_en}</p>
        </div>
        <div style="background: #fff; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
            <p style="color: #333; font-size: 15px;">مرحباً <strong>{company_name}</strong>،</p>
            <p style="color: #555; font-size: 14px; line-height: 1.7;">
                نود تذكيرك بأن اشتراكك <strong>{badge}</strong> سينتهي بتاريخ
                <strong style="color: {color1};">{end_date}</strong>
                ({days_left} يوماً متبقياً | {days_left} days left).
            </p>
            <p style="color: #555; font-size: 14px;">
                للحفاظ على وصولك لكل الميزات وعدم فقدان بياناتك، نرجو تجديد الاشتراك في أقرب وقت.
            </p>
            <div style="text-align: center; margin: 25px 0;">
                <a href="https://datalifeaccount.com/subscription"
                   style="display: inline-block; background: linear-gradient(135deg, {color1} 0%, {color2} 100%); color: #fff; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">
                    {cta_ar} | {cta_en}
                </a>
            </div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #999; font-size: 11px; text-align: center;">© DataLife Account — رسالة تلقائية، يرجى عدم الرد عليها.</p>
        </div>
    </div>
    """
    try:
        resend.api_key = api_key
        sender = os.environ.get("SENDER_EMAIL", "noreply@datalifeaccount.com")
        params = {
            "from": f"DataLife Account <{sender}>",
            "to": [recipient],
            "subject": f"⏰ {title_ar} | {title_en}",
            "html": html,
        }
        await _asyncio.to_thread(resend.Emails.send, params)
        await db.subscription_reminders.insert_one({
            "recipient": recipient,
            "company_name": company_name,
            "days_left": days_left,
            "end_date": end_date,
            "plan": plan,
            "is_trial": is_trial,
            "for_date": datetime.now(timezone.utc).date().isoformat(),
            "sent_at": datetime.now(timezone.utc).isoformat(),
        })
        # Also write an in-app notification
        try:
            company = await db.companies.find_one({"contact_email": recipient}, {"_id": 0, "id": 1})
            if company:
                await db.notifications.insert_one({
                    "id": __import__("uuid").uuid4().hex,
                    "company_id": company["id"],
                    "type": "subscription_expiry",
                    "title": title_ar,
                    "title_en": title_en,
                    "message": f"اشتراكك ينتهي في {end_date} — {days_left} يوماً متبقياً",
                    "severity": "error" if is_expired else ("warning" if days_left <= 3 else "info"),
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
        except Exception as err:
            print(f"[scheduler] in-app notification failed: {err}")
    except Exception as err:
        print(f"[scheduler] reminder email failed: {err}")


_scheduler: AsyncIOScheduler | None = None


def _get_db():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME", "multi_tenant_erp")
    client = AsyncIOMotorClient(mongo_url)
    return client[db_name]


async def _send_monthly_vat_reports_for_all_companies():
    """
    On the 1st of each month, build & email a VAT report for the *previous*
    month to every company that has at least one invoice in that month.
    """
    db = _get_db()
    now = datetime.now(timezone.utc)
    # Report covers the previous month
    if now.month == 1:
        prev_month, prev_year = 12, now.year - 1
    else:
        prev_month, prev_year = now.month - 1, now.year

    print(f"[scheduler] Running monthly VAT report for {prev_year}-{prev_month:02d}")

    # Find all distinct company_ids with invoices in that month
    start = datetime(prev_year, prev_month, 1).isoformat()
    if prev_month == 12:
        end = datetime(prev_year + 1, 1, 1).isoformat()
    else:
        end = datetime(prev_year, prev_month + 1, 1).isoformat()

    pipeline = [
        {"$match": {"issued_at": {"$gte": start, "$lt": end}}},
        {"$group": {"_id": "$company_id"}},
    ]
    company_ids = [doc["_id"] async for doc in db.tax_invoices.aggregate(pipeline)]

    for cid in company_ids:
        if not cid:
            continue
        company = await db.companies.find_one(
            {"id": cid}, {"_id": 0, "contact_email": 1, "name": 1}
        )
        recipient = (company or {}).get("contact_email")
        if not recipient:
            print(f"[scheduler] No contact_email for company {cid}, skipping")
            continue
        try:
            res = await send_monthly_vat_report(
                company_id=cid,
                recipient_email=recipient,
                month=prev_month,
                year=prev_year,
                db=db,
            )
            print(f"[scheduler] VAT report sent: {res}")
        except Exception as err:
            print(f"[scheduler] Failed to send VAT report for {cid}: {err}")


async def _send_monthly_financial_reports_for_all_companies():
    """
    On the 1st of each month, build & email a financial report (Trial
    Balance + General Ledger PDFs) for the *previous* month to every
    company that has at least one journal entry in that month.
    """
    db = _get_db()
    now = datetime.now(timezone.utc)
    if now.month == 1:
        prev_month, prev_year = 12, now.year - 1
    else:
        prev_month, prev_year = now.month - 1, now.year

    print(f"[scheduler] Running monthly financial reports for {prev_year}-{prev_month:02d}")
    start = f"{prev_year:04d}-{prev_month:02d}-01"
    if prev_month == 12:
        end = f"{prev_year+1:04d}-01-01"
    else:
        end = f"{prev_year:04d}-{prev_month+1:02d}-01"

    pipeline = [
        {"$match": {"date": {"$gte": start, "$lt": end}}},
        {"$group": {"_id": "$company_id"}},
    ]
    company_ids = [doc["_id"] async for doc in db.journal_entries.aggregate(pipeline)]
    for cid in company_ids:
        if not cid:
            continue
        company = await db.companies.find_one(
            {"id": cid}, {"_id": 0, "contact_email": 1, "name": 1}
        )
        recipient = (company or {}).get("contact_email")
        if not recipient:
            print(f"[scheduler] No contact_email for company {cid}, skipping financial report")
            continue
        try:
            res = await send_monthly_financial_report(
                company_id=cid, recipient_email=recipient,
                month=prev_month, year=prev_year, db=db,
            )
            print(f"[scheduler] Financial report sent: {res}")
        except Exception as err:
            print(f"[scheduler] Failed financial report for {cid}: {err}")


def start_scheduler():
    """Start the scheduler. Must be called once at app startup."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    _scheduler = AsyncIOScheduler(timezone="UTC")
    # Fire on the 1st of every month at 06:00 UTC (09:00 Cairo time)
    _scheduler.add_job(
        _send_monthly_vat_reports_for_all_companies,
        trigger=CronTrigger(day=1, hour=6, minute=0),
        id="monthly_vat_report",
        replace_existing=True,
    )
    # Monthly Trial Balance + General Ledger emails (1st of each month, 06:30 UTC)
    _scheduler.add_job(
        _send_monthly_financial_reports_for_all_companies,
        trigger=CronTrigger(day=1, hour=6, minute=30),
        id="monthly_financial_reports",
        replace_existing=True,
    )
    # Daily subscription expiry reminders at 08:00 UTC (11:00 Cairo time)
    _scheduler.add_job(
        _send_subscription_expiry_reminders,
        trigger=CronTrigger(hour=8, minute=0),
        id="subscription_expiry_reminders",
        replace_existing=True,
    )
    _scheduler.start()
    print("[scheduler] Started; monthly VAT report + subscription reminders registered")
    return _scheduler


def shutdown_scheduler():
    """Shut the scheduler down gracefully."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
