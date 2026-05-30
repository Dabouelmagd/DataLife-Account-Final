"""
Referral Program API.
- Each company gets a unique referral code (auto-generated on first request).
- A new company that signs up using a referral code gets +30 days free
  added to their trial (extends `created_at`-based trial end).
- The referrer earns a 20% discount credit, stored as a pending coupon
  that can be applied on their next paid checkout.

Endpoints:
  GET  /api/referrals/my-code            → returns the caller's referral code + stats
  POST /api/referrals/validate?code=...  → validates a code (public during signup/upgrade)
  POST /api/referrals/redeem             → records that a new company used a code
  GET  /api/referrals/credits            → list pending discount credits for the caller
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from dotenv import load_dotenv
import os
import uuid

from services.auth_service import verify_token

load_dotenv()

router = APIRouter(prefix="/api/referrals", tags=["referrals"])

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "multi_tenant_erp")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

REFERRER_DISCOUNT_PERCENT = 20  # 20% off next paid invoice
INVITEE_FREE_DAYS = 30          # 1 month free for the new company


async def _current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    token = authorization.replace("Bearer ", "")
    try:
        return verify_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def _generate_code(company_id: str) -> str:
    """Stable, short, human-friendly referral code based on the company id."""
    return f"REF-{company_id.replace('-', '')[:6].upper()}"


async def _ensure_company_referral(company_id: str) -> dict:
    """Return (and create if missing) the referral record for a company."""
    existing = await db.referral_codes.find_one({"company_id": company_id}, {"_id": 0})
    if existing:
        return existing
    code = _generate_code(company_id)
    doc = {
        "company_id": company_id,
        "code": code,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "uses_count": 0,
    }
    await db.referral_codes.insert_one(dict(doc))
    return doc


# ---------- Models ----------
class RedeemRequest(BaseModel):
    code: str
    new_company_id: str


# ---------- Endpoints ----------
@router.get("/my-code")
async def my_referral_code(current_user: dict = Depends(_current_user)):
    """Return the caller company's referral code + stats."""
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="User has no company")
    rec = await _ensure_company_referral(company_id)

    # Count successful referrals (companies that joined using this code)
    referred = await db.referrals.find(
        {"referrer_company_id": company_id}, {"_id": 0}
    ).to_list(length=500)

    # Pending discount credits
    credits = await db.referral_credits.find(
        {"company_id": company_id, "used": False}, {"_id": 0}
    ).to_list(length=200)

    return {
        "code": rec["code"],
        "share_url": f"https://datalifeaccount.com/register-company?ref={rec['code']}",
        "referrals_count": len(referred),
        "pending_credits": len(credits),
        "discount_percent": REFERRER_DISCOUNT_PERCENT,
        "invitee_free_days": INVITEE_FREE_DAYS,
        "referrals": [
            {
                "company_name": r.get("new_company_name"),
                "joined_at": r.get("created_at"),
                "status": r.get("status", "pending"),
            }
            for r in referred
        ],
    }


@router.post("/validate")
async def validate_referral(code: str):
    """Validate a referral code (public — used on signup / upgrade)."""
    code = (code or "").strip().upper()
    if not code:
        return {"valid": False, "message": "Code is required"}
    rec = await db.referral_codes.find_one({"code": code}, {"_id": 0})
    if not rec:
        return {"valid": False, "message": "Invalid referral code"}
    company = await db.companies.find_one(
        {"id": rec["company_id"]}, {"_id": 0, "name": 1}
    ) or {}
    return {
        "valid": True,
        "referrer_company": company.get("name") or "DataLife company",
        "free_days": INVITEE_FREE_DAYS,
    }


@router.post("/redeem")
async def redeem_referral(payload: RedeemRequest):
    """
    Record a redemption. Called by the signup flow when a new company
    submits a referral code.

    Effects:
      • Extends the new company's trial by INVITEE_FREE_DAYS.
      • Creates a pending discount credit for the referrer.
      • Prevents the same new_company_id from redeeming twice.
    """
    code = payload.code.strip().upper()
    rec = await db.referral_codes.find_one({"code": code}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid referral code")
    if rec["company_id"] == payload.new_company_id:
        raise HTTPException(status_code=400, detail="Cannot refer your own company")

    existing = await db.referrals.find_one(
        {"new_company_id": payload.new_company_id}, {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="This company already used a referral")

    new_company = await db.companies.find_one(
        {"id": payload.new_company_id}, {"_id": 0, "name": 1, "created_at": 1}
    )
    if not new_company:
        raise HTTPException(status_code=404, detail="New company not found")

    # 1) Record the referral
    referral_doc = {
        "id": str(uuid.uuid4()),
        "referrer_company_id": rec["company_id"],
        "new_company_id": payload.new_company_id,
        "new_company_name": new_company.get("name"),
        "code": code,
        "free_days_granted": INVITEE_FREE_DAYS,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.referrals.insert_one(dict(referral_doc))

    # 2) Mark the new company so its trial is extended
    await db.companies.update_one(
        {"id": payload.new_company_id},
        {"$set": {"trial_extension_days": INVITEE_FREE_DAYS,
                  "referred_by_code": code}}
    )

    # 3) Issue a pending discount credit for the referrer
    credit_doc = {
        "id": str(uuid.uuid4()),
        "company_id": rec["company_id"],
        "source": "referral",
        "referral_id": referral_doc["id"],
        "discount_percent": REFERRER_DISCOUNT_PERCENT,
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.referral_credits.insert_one(dict(credit_doc))

    # 4) Bump the uses count on the referral code
    await db.referral_codes.update_one(
        {"code": code}, {"$inc": {"uses_count": 1}}
    )

    return {
        "success": True,
        "free_days_granted": INVITEE_FREE_DAYS,
        "referrer_credit_percent": REFERRER_DISCOUNT_PERCENT,
    }


@router.get("/credits")
async def list_credits(current_user: dict = Depends(_current_user)):
    """List the caller company's unused referral credits."""
    company_id = current_user.get("company_id")
    credits = await db.referral_credits.find(
        {"company_id": company_id, "used": False}, {"_id": 0}
    ).to_list(length=200)
    return credits
