from fastapi import FastAPI, APIRouter
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


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import database
from database import db, client

# Create the main app without a prefix
app = FastAPI()

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
