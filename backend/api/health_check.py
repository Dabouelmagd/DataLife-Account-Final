"""
Health Check & Route Monitor API
فحص صحة النظام ومراقبة المسارات - يعمل دورياً وعند الطلب
"""

import os
import time
import httpx
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/health", tags=["health"])

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

BASE_URL = "http://localhost:8001"


async def get_admin_token():
    """Get admin token for authenticated route testing"""
    try:
        admin = await db.users.find_one({"role": "Super Admin"})
        if not admin:
            return None
        import jwt
        SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
        payload = {
            "user_id": admin.get("id"),
            "email": admin.get("email"),
            "role": "Super Admin",
            "company_id": admin.get("company_id")
        }
        return jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    except Exception as e:
        logger.error(f"Token generation error: {e}")
        return None


@router.get("")
async def health_check():
    """Basic health check - fast"""
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat(), "service": "DataLife Account API"}


@router.get("/detailed")
async def detailed_health_check():
    """Detailed system health check"""
    results = {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat(), "checks": {}, "summary": {"total": 0, "passed": 0, "failed": 0, "warn": 0}}

    # 1. Database
    try:
        start = time.time()
        await db.command("ping")
        results["checks"]["database"] = {"status": "ok", "latency_ms": round((time.time() - start) * 1000, 1)}
    except Exception as e:
        results["checks"]["database"] = {"status": "fail", "error": str(e)}

    # 2. Collections
    try:
        collections = await db.list_collection_names()
        required = ["users", "companies", "subscriptions"]
        missing = [c for c in required if c not in collections]
        results["checks"]["collections"] = {"status": "ok" if not missing else "warn", "total": len(collections), "missing": missing}
    except Exception as e:
        results["checks"]["collections"] = {"status": "fail", "error": str(e)}

    # 3. Users & Admins
    try:
        user_count = await db.users.count_documents({})
        admin_count = await db.users.count_documents({"role": "Super Admin"})
        results["checks"]["users"] = {"status": "ok" if admin_count > 0 else "warn", "total": user_count, "admins": admin_count}
    except Exception as e:
        results["checks"]["users"] = {"status": "fail", "error": str(e)}

    # 4. Auth Service
    try:
        from services.auth_service import verify_token
        results["checks"]["auth_service"] = {"status": "ok"}
    except Exception as e:
        results["checks"]["auth_service"] = {"status": "fail", "error": str(e)}

    # 5. Email
    try:
        smtp_host = os.environ.get('SMTP_HOST')
        results["checks"]["email"] = {"status": "ok" if smtp_host else "warn", "configured": bool(smtp_host)}
    except Exception as e:
        results["checks"]["email"] = {"status": "fail", "error": str(e)}

    # 6. Push
    try:
        vapid = os.environ.get('VAPID_PUBLIC_KEY')
        results["checks"]["push"] = {"status": "ok" if vapid else "warn", "configured": bool(vapid)}
    except Exception as e:
        results["checks"]["push"] = {"status": "fail", "error": str(e)}

    # 7. Subscriptions
    try:
        active = await db.subscriptions.count_documents({"status": "active"})
        companies = await db.companies.count_documents({})
        results["checks"]["subscriptions"] = {"status": "ok", "active": active, "companies": companies}
    except Exception as e:
        results["checks"]["subscriptions"] = {"status": "fail", "error": str(e)}

    # Summary
    for check in results["checks"].values():
        results["summary"]["total"] += 1
        s = check["status"]
        if s == "ok": results["summary"]["passed"] += 1
        elif s == "warn": results["summary"]["warn"] += 1
        else: results["summary"]["failed"] += 1

    results["status"] = "fail" if results["summary"]["failed"] > 0 else ("warn" if results["summary"]["warn"] > 0 else "ok")

    await db.health_checks.insert_one({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "type": "detailed",
        "status": results["status"],
        "summary": results["summary"]
    })

    return results


@router.get("/test-routes")
async def test_all_routes():
    """
    Test ALL critical API routes by sending real HTTP requests.
    Returns pass/fail status for each route.
    يفحص كل المسارات الرئيسية بإرسال طلبات حقيقية
    """
    token = await get_admin_token()
    headers_auth = {"Authorization": f"Bearer {token}"} if token else {}
    
    # Define all critical routes to test
    route_tests = [
        # Auth
        {"method": "GET", "path": "/api/auth/check-super-admin", "auth": False, "category": "auth"},
        
        # Health
        {"method": "GET", "path": "/api/health", "auth": False, "category": "health"},
        
        # Admin - Dashboard
        {"method": "GET", "path": "/api/admin/dashboard", "auth": True, "category": "admin"},
        {"method": "GET", "path": "/api/admin/permissions", "auth": True, "category": "admin"},
        {"method": "GET", "path": "/api/admin/companies", "auth": True, "category": "admin"},
        {"method": "GET", "path": "/api/admin/all-users", "auth": True, "category": "admin"},
        {"method": "GET", "path": "/api/admin/subscriptions", "auth": True, "category": "admin"},
        {"method": "GET", "path": "/api/admin/activation-codes", "auth": True, "category": "admin"},
        {"method": "GET", "path": "/api/admin/roles", "auth": True, "category": "admin"},
        {"method": "GET", "path": "/api/admin/transactions", "auth": True, "category": "admin"},
        {"method": "GET", "path": "/api/admin/audit-logs", "auth": True, "category": "admin"},
        {"method": "GET", "path": "/api/admin/system-overview", "auth": True, "category": "admin"},
        
        # Payments
        {"method": "GET", "path": "/api/admin/payments/methods", "auth": False, "category": "payments"},
        {"method": "GET", "path": "/api/admin/payments/summary", "auth": True, "category": "payments"},
        {"method": "GET", "path": "/api/payments/payment-methods", "auth": False, "category": "payments"},
        
        # Push Notifications
        {"method": "GET", "path": "/api/push/vapid-key", "auth": False, "category": "push"},
        {"method": "GET", "path": "/api/push/notifications", "auth": True, "category": "push"},
        
        # HR
        {"method": "GET", "path": "/api/hr/employees", "auth": True, "category": "hr"},
        {"method": "GET", "path": "/api/hr/allowances", "auth": True, "category": "hr"},
        {"method": "GET", "path": "/api/hr/deductions", "auth": True, "category": "hr"},
        {"method": "GET", "path": "/api/hr/attendance", "auth": True, "category": "hr"},
        
        # Financial
        {"method": "GET", "path": "/api/accounting/journal-entries", "auth": True, "category": "financial"},
        {"method": "GET", "path": "/api/invoice/parties", "auth": True, "category": "financial"},
        
        # Invoices
        {"method": "GET", "path": "/api/invoices/", "auth": True, "category": "invoices"},
        
        # Projects
        {"method": "GET", "path": "/api/tasks/projects", "auth": True, "category": "projects"},
        
        # Inventory
        {"method": "GET", "path": "/api/inventory/products", "auth": True, "category": "inventory"},
        
        # Employees
        {"method": "GET", "path": "/api/employees", "auth": True, "category": "employees"},
        
        # Subscriptions
        {"method": "GET", "path": "/api/subscriptions/plans", "auth": False, "category": "subscriptions"},
        
        # Coupons
        {"method": "GET", "path": "/api/coupons/referral/my-link", "auth": True, "category": "coupons"},
        
        # Scheduler
        {"method": "GET", "path": "/api/scheduler/status", "auth": False, "category": "scheduler"},
    ]
    
    results = []
    passed = 0
    failed = 0
    categories_summary = {}
    
    async with httpx.AsyncClient(timeout=10.0) as client_http:
        for test in route_tests:
            cat = test["category"]
            if cat not in categories_summary:
                categories_summary[cat] = {"passed": 0, "failed": 0}
            
            try:
                start = time.time()
                headers = headers_auth if test["auth"] else {}
                
                if test["method"] == "GET":
                    resp = await client_http.get(f"{BASE_URL}{test['path']}", headers=headers)
                elif test["method"] == "POST":
                    resp = await client_http.post(f"{BASE_URL}{test['path']}", headers=headers, json={})
                
                latency = round((time.time() - start) * 1000, 1)
                ok = resp.status_code in [200, 201, 422]  # 422 = validation error (route exists)
                
                result = {
                    "path": test["path"],
                    "method": test["method"],
                    "category": cat,
                    "status_code": resp.status_code,
                    "latency_ms": latency,
                    "result": "pass" if ok else "fail"
                }
                
                if ok:
                    passed += 1
                    categories_summary[cat]["passed"] += 1
                else:
                    failed += 1
                    categories_summary[cat]["failed"] += 1
                    
            except Exception as e:
                result = {
                    "path": test["path"],
                    "method": test["method"],
                    "category": cat,
                    "status_code": 0,
                    "latency_ms": 0,
                    "result": "fail",
                    "error": str(e)
                }
                failed += 1
                categories_summary[cat]["failed"] += 1
            
            results.append(result)
    
    overall = "ok" if failed == 0 else ("degraded" if failed <= 3 else "critical")
    
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall_status": overall,
        "summary": {
            "total_tested": len(results),
            "passed": passed,
            "failed": failed,
            "pass_rate": f"{round(passed/len(results)*100, 1)}%"
        },
        "categories": categories_summary,
        "failed_routes": [r for r in results if r["result"] == "fail"],
        "all_routes": results
    }
    
    # Save report
    await db.health_checks.insert_one({
        "timestamp": report["timestamp"],
        "type": "route_test",
        "status": overall,
        "summary": report["summary"],
        "categories": categories_summary,
        "failed_routes": report["failed_routes"]
    })
    
    return report


@router.get("/routes")
async def list_all_routes():
    """List all registered API routes"""
    from server import app
    
    routes = []
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            methods = list(route.methods - {'HEAD', 'OPTIONS'}) if route.methods else []
            if route.path.startswith('/api/') and methods:
                routes.append({"path": route.path, "methods": methods, "name": route.name or ""})
    
    routes.sort(key=lambda r: r["path"])
    
    categories = {}
    for r in routes:
        cat = r["path"].split("/")[2] if len(r["path"].split("/")) > 2 else "root"
        categories[cat] = categories.get(cat, 0) + 1
    
    return {"total_routes": len(routes), "categories": categories, "routes": routes}


@router.get("/history")
async def get_health_history(limit: int = 50):
    """Get health check history"""
    history = await db.health_checks.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(length=limit)
    return {"history": history, "total": len(history)}


@router.post("/run-now")
async def run_health_now():
    """Trigger immediate full health check + route test"""
    detailed = await detailed_health_check()
    routes = await test_all_routes()
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "system_health": detailed,
        "route_test": routes
    }
