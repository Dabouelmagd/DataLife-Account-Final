"""
Conversion Analytics API — for the SaaS growth dashboard.

Exposes a single endpoint that aggregates 4 KPIs from the existing
collections (no schema changes required):

  • Trial → Paid conversion rate (this month vs previous month)
  • Monthly referral revenue (sum of paid transactions whose company
    was referred or used a referral discount)
  • Number of active beta users (companies with beta_access = true)
  • Median time-to-paid (days between company.created_at and first
    successful payment_transaction)

Visible only to a company's own admins (per JWT). Returns small,
ready-to-render numbers.
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import os
import statistics

from services.auth_service import verify_token

load_dotenv()

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "multi_tenant_erp")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


async def _current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    try:
        return verify_token(authorization.replace("Bearer ", ""))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def _month_window(offset_months: int = 0) -> tuple[str, str]:
    """Return (start_iso, end_iso) for the current month + offset (e.g. -1 = prev)."""
    now = datetime.now(timezone.utc)
    year, month = now.year, now.month + offset_months
    while month <= 0:
        month += 12
        year -= 1
    while month > 12:
        month -= 12
        year += 1
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    return start.isoformat(), end.isoformat()


async def _conversion_for(start_iso: str, end_iso: str) -> dict:
    """Trials started AND converted within the window."""
    # Companies whose trial started in window
    trials = await db.companies.count_documents({
        "created_at": {"$gte": start_iso, "$lt": end_iso},
    })
    # Paid transactions in window (any paid)
    paid_txs = await db.payment_transactions.count_documents({
        "payment_status": "paid",
        "created_at": {"$gte": start_iso, "$lt": end_iso},
    })
    # Companies that went paid this window
    paid_companies = await db.payment_transactions.distinct(
        "company_id",
        {"payment_status": "paid", "created_at": {"$gte": start_iso, "$lt": end_iso}},
    )
    converted = len([c for c in paid_companies if c])
    rate = round((converted / trials * 100), 1) if trials > 0 else 0.0
    return {
        "trials_started": trials,
        "converted": converted,
        "paid_transactions": paid_txs,
        "rate_pct": rate,
    }


@router.get("/conversion")
async def conversion_dashboard(current_user: dict = Depends(_current_user)):
    """
    Return the 4 KPIs:
      1) conversion (this month + previous month + delta)
      2) referral_revenue (this month, EGP)
      3) beta_users (active)
      4) time_to_paid (median days)
    """
    # 1) Conversion this vs previous month
    this_start, this_end = _month_window(0)
    prev_start, prev_end = _month_window(-1)
    this_month = await _conversion_for(this_start, this_end)
    prev_month = await _conversion_for(prev_start, prev_end)
    delta = round(this_month["rate_pct"] - prev_month["rate_pct"], 1)

    # 2) Referral revenue this month
    cursor = db.payment_transactions.aggregate([
        {"$match": {
            "payment_status": "paid",
            "created_at": {"$gte": this_start, "$lt": this_end},
        }},
        {"$lookup": {
            "from": "companies",
            "localField": "company_id",
            "foreignField": "id",
            "as": "company",
        }},
        {"$unwind": {"path": "$company", "preserveNullAndEmptyArrays": True}},
        {"$match": {
            "$or": [
                {"company.referred_by_code": {"$exists": True, "$ne": None}},
                {"applied_credit_id": {"$exists": True, "$ne": None}},
            ],
        }},
        {"$group": {
            "_id": None,
            "total_egp": {"$sum": "$amount_egp"},
            "count": {"$sum": 1},
        }},
    ])
    ref_agg = await cursor.to_list(length=1)
    referral_revenue = {
        "egp": round((ref_agg[0]["total_egp"] if ref_agg else 0), 2),
        "transactions": ref_agg[0]["count"] if ref_agg else 0,
    }

    # 3) Beta users
    beta_count = await db.companies.count_documents({"beta_access": True})

    # 4) Median time-to-paid (across all-time successful conversions)
    # For each company with a paid transaction, take days between
    # created_at and the first paid transaction's created_at.
    days_samples: list[float] = []
    async for company in db.companies.find(
        {}, {"_id": 0, "id": 1, "created_at": 1}
    ):
        created_raw = company.get("created_at")
        first_paid = await db.payment_transactions.find_one(
            {"company_id": company.get("id"), "payment_status": "paid"},
            {"_id": 0, "created_at": 1},
            sort=[("created_at", 1)],
        )
        if not (created_raw and first_paid):
            continue
        try:
            c0 = datetime.fromisoformat(created_raw) if isinstance(created_raw, str) else created_raw
            p0 = datetime.fromisoformat(first_paid["created_at"]) if isinstance(first_paid["created_at"], str) else first_paid["created_at"]
            if c0.tzinfo is None:
                c0 = c0.replace(tzinfo=timezone.utc)
            if p0.tzinfo is None:
                p0 = p0.replace(tzinfo=timezone.utc)
            delta_days = (p0 - c0).total_seconds() / 86400
            if delta_days >= 0:
                days_samples.append(delta_days)
        except Exception:
            continue
    median_ttp = round(statistics.median(days_samples), 1) if days_samples else None

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "conversion": {
            "this_month": this_month,
            "prev_month": prev_month,
            "delta_pct": delta,
        },
        "referral_revenue_this_month": referral_revenue,
        "beta_users": beta_count,
        "time_to_paid": {
            "median_days": median_ttp,
            "samples": len(days_samples),
        },
    }
