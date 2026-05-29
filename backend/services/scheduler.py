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
    _scheduler.start()
    print("[scheduler] Started; monthly VAT report job registered (1st of month, 06:00 UTC)")
    return _scheduler


def shutdown_scheduler():
    """Shut the scheduler down gracefully."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
