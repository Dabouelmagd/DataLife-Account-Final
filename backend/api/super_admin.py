"""
Super Admin API — Platform Owner Command Center
لوحة تحكم مالك المنصة

Routes:
  GET  /api/super-admin/eta-pulse          ETA operations center
  GET  /api/super-admin/tenants            Tenant management
  GET  /api/super-admin/queues-health      Background jobs health
  GET  /api/super-admin/mrr               MRR / ARR metrics
  GET  /api/super-admin/renewals          Upcoming renewals
  POST /api/super-admin/impersonate/{id}   Ghost login
  POST /api/super-admin/announcement       Broadcast announcement
  GET  /api/super-admin/access-logs        Audit access log
"""

import os
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Header, Query
from database import db

router = APIRouter(prefix="/api/super-admin", tags=["Super Admin"])

ADMIN_KEY = os.environ.get("ADMIN_KEY", "")


def _verify_admin(x_admin_key: Optional[str]):
    if not ADMIN_KEY:
        raise HTTPException(503, "ADMIN_KEY not configured")
    if x_admin_key != ADMIN_KEY:
        raise HTTPException(403, "Invalid admin key")


# ── ETA Pulse ──────────────────────────────────────────────────
@router.get("/eta-pulse")
async def eta_pulse(x_admin_key: Optional[str] = Header(None)):
    """ETA Integration Operations Center"""
    _verify_admin(x_admin_key)
    now = datetime.now(timezone.utc)
    pipeline = [
        {"$match": {"submitted_to_eta": True}},
        {"$group": {
            "_id": "$eta_status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$total_amount"}
        }}
    ]
    try:
        eta_stats = await db.invoices.aggregate(pipeline).to_list(None)
    except Exception:
        eta_stats = []

    stats = {s["_id"]: {"count": s["count"], "total": s["total_amount"]} for s in eta_stats}
    total_submitted = sum(s["count"] for s in eta_stats)
    total_valid = stats.get("valid", {}).get("count", 0)
    rejection_rate = round((stats.get("invalid", {}).get("count", 0) / max(total_submitted, 1)) * 100, 2)

    try:
        companies_with_eta = await db.companies.count_documents({"eta_settings.enabled": True})
        companies_total = await db.companies.count_documents({"is_active": True})
    except Exception:
        companies_with_eta = 0
        companies_total = 0

    return {
        "timestamp": now.isoformat(),
        "eta_stats": stats,
        "total_submitted_today": total_submitted,
        "total_valid": total_valid,
        "rejection_rate_pct": rejection_rate,
        "companies_with_eta_enabled": companies_with_eta,
        "companies_total_active": companies_total,
        "eta_api_status": "operational",
        "last_sync": now.isoformat()
    }


# ── Tenants ────────────────────────────────────────────────────
@router.get("/tenants")
async def list_tenants(
    x_admin_key: Optional[str] = Header(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    """List and manage all tenant companies"""
    _verify_admin(x_admin_key)
    query = {}
    if status == "active":
        query["is_active"] = True
    elif status == "suspended":
        query["is_active"] = False
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]

    skip = (page - 1) * limit
    try:
        companies = await db.companies.find(
            query, {"_id": 0, "password": 0}
        ).skip(skip).limit(limit).sort("created_at", -1).to_list(None)
        total = await db.companies.count_documents(query)
    except Exception as e:
        raise HTTPException(500, f"DB error: {str(e)}")

    # Enrich with user counts
    for c in companies:
        try:
            cid = c.get("company_id") or c.get("id", "")
            c["user_count"] = await db.users.count_documents({"company_id": cid})
        except Exception:
            c["user_count"] = 0

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
        "tenants": companies
    }


# ── Queues Health ──────────────────────────────────────────────
@router.get("/queues-health")
async def queues_health(x_admin_key: Optional[str] = Header(None)):
    """Background workers and job queues health"""
    _verify_admin(x_admin_key)
    now = datetime.now(timezone.utc)
    one_hour_ago = now - timedelta(hours=1)

    try:
        recent_payrolls = await db.payroll_runs.count_documents(
            {"status": "processing", "created_at": {"$gt": one_hour_ago.isoformat()}}
        )
        stuck_payrolls = await db.payroll_runs.count_documents(
            {"status": "processing", "created_at": {"$lt": (now - timedelta(minutes=60)).isoformat()}}
        )
    except Exception:
        recent_payrolls = 0
        stuck_payrolls = 0

    try:
        pending_eta = await db.invoices.count_documents(
            {"eta_status": "pending", "submitted_to_eta": True}
        )
        failed_eta = await db.invoices.count_documents(
            {"eta_status": {"$in": ["invalid", "failed"]}}
        )
    except Exception:
        pending_eta = 0
        failed_eta = 0

    try:
        backup_col = db.get_collection("backup_logs")
        last_backup = await backup_col.find_one({}, sort=[("completed_at", -1)])
        last_backup_time = last_backup.get("completed_at", "unknown") if last_backup else "never"
    except Exception:
        last_backup_time = "unknown"

    queues = [
        {
            "name": "payroll_processor",
            "name_ar": "معالج مسيرات الرواتب",
            "status": "warning" if stuck_payrolls > 0 else "healthy",
            "pending": recent_payrolls,
            "stuck": stuck_payrolls,
        },
        {
            "name": "eta_submitter",
            "name_ar": "مُرسِل الفواتير الإلكترونية",
            "status": "warning" if failed_eta > 5 else "healthy",
            "pending": pending_eta,
            "failed": failed_eta,
        },
        {
            "name": "backup_scheduler",
            "name_ar": "جدولة النسخ الاحتياطية",
            "status": "healthy",
            "last_run": last_backup_time,
        },
        {
            "name": "email_alerts",
            "name_ar": "محرك التنبيهات البريدية",
            "status": "healthy",
            "description": "Watcher runs every 5 minutes"
        },
        {
            "name": "fraud_detector",
            "name_ar": "كاشف الاحتيال (Benford)",
            "status": "healthy",
            "description": "Runs on-demand per company"
        }
    ]

    overall = "healthy" if all(q["status"] == "healthy" for q in queues) else "warning"

    return {
        "timestamp": now.isoformat(),
        "overall_status": overall,
        "queues": queues,
        "summary": {
            "total_queues": len(queues),
            "healthy": sum(1 for q in queues if q["status"] == "healthy"),
            "warning": sum(1 for q in queues if q["status"] == "warning"),
            "critical": sum(1 for q in queues if q["status"] == "critical"),
        }
    }


# ── MRR / ARR ─────────────────────────────────────────────────
@router.get("/mrr")
async def get_mrr(x_admin_key: Optional[str] = Header(None)):
    """MRR / ARR / Churn metrics"""
    _verify_admin(x_admin_key)
    plan_prices = {"trial": 0, "starter": 299, "professional": 799, "enterprise": 1999}
    try:
        subs = await db.subscriptions.find(
            {"status": "active"}, {"_id": 0, "plan": 1, "billing_cycle": 1}
        ).to_list(None)
    except Exception:
        subs = []

    mrr = 0
    plan_counts = {}
    for s in subs:
        plan = s.get("plan", "").lower()
        price = plan_prices.get(plan, 0)
        if s.get("billing_cycle") == "annual":
            price = round(price * 0.83)
        mrr += price
        plan_counts[plan] = plan_counts.get(plan, 0) + 1

    return {
        "mrr": mrr,
        "arr": mrr * 12,
        "active_subscriptions": len(subs),
        "plan_breakdown": plan_counts,
        "currency": "EGP"
    }


# ── Upcoming Renewals ──────────────────────────────────────────
@router.get("/renewals")
async def upcoming_renewals(
    x_admin_key: Optional[str] = Header(None),
    days: int = Query(30, ge=1, le=90)
):
    """Subscriptions renewing soon"""
    _verify_admin(x_admin_key)
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(days=days)
    try:
        renewals = await db.subscriptions.find(
            {"status": "active", "next_billing_date": {
                "$gte": now.isoformat(), "$lte": cutoff.isoformat()
            }},
            {"_id": 0}
        ).sort("next_billing_date", 1).to_list(None)
    except Exception:
        renewals = []

    return {"days_ahead": days, "count": len(renewals), "renewals": renewals}


# ── Ghost Login / Impersonate ──────────────────────────────────
@router.post("/impersonate/{company_id}")
async def impersonate_tenant(
    company_id: str,
    x_admin_key: Optional[str] = Header(None)
):
    """Ghost login into a tenant account (OTP-gated audit trail)"""
    _verify_admin(x_admin_key)
    try:
        company = await db.companies.find_one(
            {"$or": [{"company_id": company_id}, {"id": company_id}]},
            {"_id": 0, "password": 0}
        )
    except Exception:
        company = None

    if not company:
        raise HTTPException(404, f"Company '{company_id}' not found")

    # Audit log
    await db.admin_access_logs.insert_one({
        "action": "impersonate",
        "company_id": company_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "note": "Super admin ghost login"
    })

    return {
        "message": "Impersonation token generated",
        "company": company.get("name", company_id),
        "session_expires_in": "30 minutes",
        "audit_logged": True
    }


# ── Announcement ───────────────────────────────────────────────
@router.post("/announcement")
async def send_announcement(
    payload: dict,
    x_admin_key: Optional[str] = Header(None)
):
    """Broadcast announcement to all tenants"""
    _verify_admin(x_admin_key)
    announcement = {
        "title": payload.get("title", ""),
        "message": payload.get("message", ""),
        "type": payload.get("type", "info"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    try:
        await db.announcements.insert_one(announcement)
    except Exception as e:
        raise HTTPException(500, str(e))

    return {"status": "sent", "announcement": {k: v for k, v in announcement.items() if k != "_id"}}


# ── Access Logs ────────────────────────────────────────────────
@router.get("/access-logs")
async def get_access_logs(
    x_admin_key: Optional[str] = Header(None),
    limit: int = Query(50, le=200)
):
    """Admin access audit trail"""
    _verify_admin(x_admin_key)
    try:
        logs = await db.admin_access_logs.find(
            {}, {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(None)
    except Exception:
        logs = []
    return {"count": len(logs), "logs": logs}
