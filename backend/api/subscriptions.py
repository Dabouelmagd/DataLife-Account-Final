from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from models.payment import Subscription
from services.subscription_service import SubscriptionService
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize service
subscription_service = SubscriptionService(db)

@router.get("/customer/{email}")
async def get_customer_subscription(email: str):
    """Get active subscription for customer"""
    subscription = await subscription_service.get_subscription_by_email(email)
    if not subscription:
        raise HTTPException(status_code=404, detail="No active subscription found")
    return subscription

@router.get("/customer/{email}/all")
async def get_all_customer_subscriptions(email: str):
    """Get all subscriptions for customer"""
    subscriptions = await subscription_service.get_all_subscriptions_by_email(email)
    return subscriptions

@router.get("/{subscription_id}", response_model=Subscription)
async def get_subscription(subscription_id: str):
    """Get subscription by ID"""
    subscription = await subscription_service.get_subscription_by_id(subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return subscription

@router.post("/{subscription_id}/cancel")
async def cancel_subscription(subscription_id: str):
    """Cancel subscription"""
    subscription = await subscription_service.get_subscription_by_id(subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    await subscription_service.update_subscription_status(subscription_id, "cancelled")
    return {"status": "success", "message": "Subscription cancelled successfully"}

@router.post("/{subscription_id}/reactivate")
async def reactivate_subscription(subscription_id: str):
    """Reactivate cancelled subscription"""
    subscription = await subscription_service.get_subscription_by_id(subscription_id)
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    if subscription.status != "cancelled":
        raise HTTPException(status_code=400, detail="Only cancelled subscriptions can be reactivated")
    
    await subscription_service.update_subscription_status(subscription_id, "active")
    return {"status": "success", "message": "Subscription reactivated successfully"}

@router.post("/check-expiry")
async def check_subscription_expiry():
    """Check and update expired subscriptions"""
    await subscription_service.check_subscription_expiry()
    return {"status": "success", "message": "Subscription expiry check completed"}