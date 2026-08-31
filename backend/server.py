from fastapi import FastAPI, APIRouter
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List
import uuid
from datetime import datetime
from api.payments import router as payments_router
from api.subscriptions import router as subscriptions_router
from api.trials import router as trials_router
from api.auth import router as auth_router
from api.companies import router as companies_router
from api.users import router as users_router
from api.hr_data import router as hr_data_router
from api.financial_data import router as financial_data_router
from api.inventory_data import router as inventory_data_router
from api.analytics import router as analytics_router
from api.webhook import router as webhook_router
from api.admin import router as admin_router
from api.notifications import router as notifications_router
from api.whatsapp import router as whatsapp_router
from api.invoices import router as invoices_router
from api.attendance import router as attendance_router
from api.tasks import router as tasks_router
from api.customer_portal import router as customer_portal_router
from api.purchases import router as purchases_router
from api.approvals import router as approvals_router
from api.attachments import router as attachments_router
from api.documents import router as documents_router
from api.chatbot import router as chatbot_router
from api.contact import router as contact_router
from api.permissions import router as permissions_router
from api.import_data import router as import_data_router
from api.accounting import router as accounting_router
from api.fixed_assets import router as fixed_assets_router
from api.treasury import router as treasury_router
from api.hr_engine import router as hr_engine_router
from api.tax_reports import router as tax_reports_router
from api.inventory_engine import router as inventory_engine_router
from api.financial_engine import router as financial_engine_router
from api.invoice import router as invoice_router
from api.inventory_pro import router as inventory_pro_router
from api.payroll import router as payroll_router
from api.employees_extended import router as employees_extended_router
from api.attendance_api import router as attendance_api_router
from api.eta_api import router as eta_router
from api.activity_log import router as activity_router
from api.hr_management import router as hr_management_router
from api.bank_management import router as bank_management_router
from api.email_notifications import router as email_notifications_router
from api.project_financials import router as project_financials_router
from api.coupons import router as coupons_router
from api.reports import router as reports_router
from api.audit_log import router as audit_router
from api.notification_events import router as notification_events_router
from api.admin_companies import router as admin_companies_router
from api.admin_users import router as admin_users_router
from api.admin_subscriptions import router as admin_subscriptions_router
from api.admin_payments import router as admin_payments_router
from api.push_notifications import router as push_notifications_router
from api.health_check import router as health_check_router
from api.app_updates import router as updates_router
from api.ads import router as ads_router
from api.newsletter import router as newsletter_router
from api.sales import router as sales_router
from api.enterprise_accounting import router as enterprise_router
from scheduler import start_scheduler, get_scheduler_status


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directories
os.makedirs("/app/uploads/photos", exist_ok=True)
os.makedirs("/app/uploads/logos", exist_ok=True)
os.makedirs("/app/backend/uploads/employees", exist_ok=True)

# Import database
from database import db, client

# Create the main app without a prefix
app = FastAPI()

# Mount static files for uploads - using /api/uploads for ingress compatibility
app.mount("/api/uploads", StaticFiles(directory="/app/uploads"), name="uploads")
app.mount("/api/uploads/employees", StaticFiles(directory="/app/backend/uploads/employees"), name="employee_uploads")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Include the router in the main app
app.include_router(api_router)
app.include_router(payments_router)
app.include_router(subscriptions_router)
app.include_router(trials_router)
app.include_router(auth_router)
app.include_router(companies_router)
app.include_router(users_router)
app.include_router(hr_data_router)
app.include_router(financial_data_router)
app.include_router(inventory_data_router)
app.include_router(analytics_router)
app.include_router(webhook_router)
app.include_router(admin_companies_router)
app.include_router(admin_users_router)
app.include_router(admin_subscriptions_router)
app.include_router(admin_payments_router)
app.include_router(admin_router)
app.include_router(notifications_router)
app.include_router(whatsapp_router)
app.include_router(invoices_router)
app.include_router(attendance_router)
app.include_router(tasks_router)
app.include_router(customer_portal_router)
app.include_router(purchases_router)
app.include_router(approvals_router)
app.include_router(attachments_router)
app.include_router(documents_router)
app.include_router(chatbot_router)
app.include_router(contact_router)
app.include_router(permissions_router)
app.include_router(import_data_router)
app.include_router(accounting_router)
app.include_router(fixed_assets_router)
app.include_router(treasury_router)
app.include_router(hr_engine_router)
app.include_router(tax_reports_router)
app.include_router(inventory_engine_router)
app.include_router(financial_engine_router)
app.include_router(invoice_router)
app.include_router(inventory_pro_router)
app.include_router(payroll_router)
app.include_router(employees_extended_router)
app.include_router(attendance_api_router)
app.include_router(eta_router)
app.include_router(activity_router)
app.include_router(hr_management_router)
app.include_router(bank_management_router)
app.include_router(email_notifications_router)
app.include_router(project_financials_router)
app.include_router(coupons_router)
app.include_router(reports_router)
app.include_router(audit_router)
app.include_router(notification_events_router)
app.include_router(push_notifications_router)
app.include_router(health_check_router)
app.include_router(updates_router)
app.include_router(ads_router)
app.include_router(newsletter_router)
app.include_router(sales_router)
app.include_router(enterprise_router)

# ── Simple Rate Limiting Middleware ──────────────────
from collections import defaultdict
from time import time

class RateLimitMiddleware:
    def __init__(self, app, calls_per_minute=120):
        self.app = app
        self.calls = defaultdict(list)
        self.limit = calls_per_minute

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            # Get IP from headers or connection
            headers = dict(scope.get("headers", []))
            ip = headers.get(b"x-real-ip", b"").decode() or                  headers.get(b"x-forwarded-for", b"").decode().split(",")[0].strip() or                  (scope.get("client") or ["unknown"])[0]

            # Auth endpoints: stricter limit (20/min)
            path = scope.get("path", "")
            limit = 20 if "/api/auth/login" in path else self.limit

            now = time()
            self.calls[ip] = [t for t in self.calls[ip] if now - t < 60]

            if len(self.calls[ip]) >= limit:
                from starlette.responses import JSONResponse
                response = JSONResponse(
                    {"detail": "Too many requests. Please wait a minute."},
                    status_code=429,
                    headers={"Retry-After": "60"}
                )
                await response(scope, receive, send)
                return

            self.calls[ip].append(now)
        await self.app(scope, receive, send)

app.add_middleware(RateLimitMiddleware, calls_per_minute=120)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup_event():
    """Start scheduler + ensure DB indexes on startup"""
    # ── 1. Start job scheduler ────────────────────────
    try:
        start_scheduler()
        logger.info("Scheduler started successfully")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")
    
    # ── 2. Ensure DB indexes exist (background, non-blocking) ──
    try:
        from scripts.create_indexes import INDEXES, UNIQUE_INDEXES
        import asyncio
        async def _ensure_indexes():
            # 1. Unique indexes — enforce data integrity
            for collection, idx in UNIQUE_INDEXES.items():
                try:
                    await db[collection].create_index(idx, unique=True, background=True)
                except Exception:
                    pass  # index may already exist
            # 2. Performance indexes
            for collection, indexes in INDEXES.items():
                col = db[collection]
                for idx in indexes:
                    try:
                        await col.create_index(idx, background=True)
                    except Exception:
                        pass
        asyncio.create_task(_ensure_indexes())
        logger.info("Database index creation scheduled (unique + performance)")
    except Exception as e:
        logger.warning(f"Index creation skipped: {e}")


@app.get("/api/scheduler/status")
async def scheduler_status():
    """Get scheduler status and upcoming jobs"""
    return get_scheduler_status()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
