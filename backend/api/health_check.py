"""
Health Check & Route Monitor API
فحص صحة النظام ومراقبة المسارات
"""

import os
import time
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Header
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/health", tags=["health"])

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


@router.get("")
async def health_check():
    """Basic health check"""
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat(), "service": "DataLife Account API"}


@router.get("/detailed")
async def detailed_health_check(authorization: Optional[str] = Header(None)):
    """Detailed health check - tests all critical systems"""
    results = {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": {},
        "summary": {"total": 0, "passed": 0, "failed": 0}
    }

    # 1. Database connectivity
    try:
        start = time.time()
        await db.command("ping")
        latency = round((time.time() - start) * 1000, 1)
        results["checks"]["database"] = {"status": "ok", "latency_ms": latency}
    except Exception as e:
        results["checks"]["database"] = {"status": "fail", "error": str(e)}

    # 2. Collections exist
    try:
        collections = await db.list_collection_names()
        required = ["users", "companies", "subscriptions"]
        missing = [c for c in required if c not in collections]
        results["checks"]["collections"] = {
            "status": "ok" if not missing else "warn",
            "total": len(collections),
            "missing": missing
        }
    except Exception as e:
        results["checks"]["collections"] = {"status": "fail", "error": str(e)}

    # 3. Users count
    try:
        user_count = await db.users.count_documents({})
        admin_count = await db.users.count_documents({"role": "Super Admin"})
        results["checks"]["users"] = {
            "status": "ok" if admin_count > 0 else "warn",
            "total_users": user_count,
            "super_admins": admin_count
        }
    except Exception as e:
        results["checks"]["users"] = {"status": "fail", "error": str(e)}

    # 4. Auth service
    try:
        from services.auth_service import verify_token
        results["checks"]["auth_service"] = {"status": "ok"}
    except Exception as e:
        results["checks"]["auth_service"] = {"status": "fail", "error": str(e)}

    # 5. Email service
    try:
        smtp_host = os.environ.get('SMTP_HOST')
        smtp_email = os.environ.get('SMTP_EMAIL')
        results["checks"]["email_config"] = {
            "status": "ok" if smtp_host and smtp_email else "warn",
            "smtp_host": smtp_host or "NOT SET",
            "smtp_email": smtp_email or "NOT SET"
        }
    except Exception as e:
        results["checks"]["email_config"] = {"status": "fail", "error": str(e)}

    # 6. VAPID keys (Push notifications)
    try:
        vapid_pub = os.environ.get('VAPID_PUBLIC_KEY')
        vapid_priv = os.environ.get('VAPID_PRIVATE_KEY')
        results["checks"]["push_notifications"] = {
            "status": "ok" if vapid_pub and vapid_priv else "warn",
            "configured": bool(vapid_pub and vapid_priv)
        }
    except Exception as e:
        results["checks"]["push_notifications"] = {"status": "fail", "error": str(e)}

    # 7. Active subscriptions
    try:
        active_subs = await db.subscriptions.count_documents({"status": "active"})
        total_companies = await db.companies.count_documents({})
        results["checks"]["subscriptions"] = {
            "status": "ok",
            "active": active_subs,
            "total_companies": total_companies
        }
    except Exception as e:
        results["checks"]["subscriptions"] = {"status": "fail", "error": str(e)}

    # Calculate summary
    for name, check in results["checks"].items():
        results["summary"]["total"] += 1
        if check["status"] == "ok":
            results["summary"]["passed"] += 1
        else:
            results["summary"]["failed"] += 1

    results["status"] = "ok" if results["summary"]["failed"] == 0 else "degraded"

    # Log result
    await db.health_checks.insert_one({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": results["status"],
        "summary": results["summary"],
        "checks": {k: v["status"] for k, v in results["checks"].items()}
    })

    return results


@router.get("/routes")
async def check_all_routes():
    """List and verify all registered API routes"""
    from server import app

    routes = []
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            path = route.path
            methods = list(route.methods - {'HEAD', 'OPTIONS'}) if route.methods else []
            if path.startswith('/api/') and methods:
                routes.append({
                    "path": path,
                    "methods": methods,
                    "name": route.name or ""
                })

    routes.sort(key=lambda r: r["path"])

    categories = {}
    for r in routes:
        parts = r["path"].split("/")
        cat = parts[2] if len(parts) > 2 else "root"
        if cat not in categories:
            categories[cat] = 0
        categories[cat] += 1

    return {
        "total_routes": len(routes),
        "categories": categories,
        "routes": routes
    }


@router.get("/history")
async def get_health_history(limit: int = 50):
    """Get health check history"""
    history = await db.health_checks.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(length=limit)

    return {"history": history, "total": len(history)}
