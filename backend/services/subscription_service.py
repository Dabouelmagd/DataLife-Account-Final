import logging
from typing import Optional
from datetime import datetime, timedelta
from models.payment import Payment, Subscription, SubscriptionCreate

logger = logging.getLogger(__name__)

class SubscriptionService:
    def __init__(self, db):
        self.db = db

    async def create_subscription(self, payment: Payment) -> Subscription:
        """Create a new subscription from successful payment"""
        try:
            # Calculate expiration date
            expires_at = None
            if payment.billing_cycle == "monthly":
                expires_at = datetime.utcnow() + timedelta(days=30)
            elif payment.billing_cycle == "annual":
                expires_at = datetime.utcnow() + timedelta(days=365)
            
            subscription_data = SubscriptionCreate(
                payment_id=payment.id,
                customer_email=payment.customer_email,
                plan_id=payment.plan_id,
                plan_name=payment.plan_name,
                billing_cycle=payment.billing_cycle
            )
            
            subscription = Subscription(**subscription_data.dict())
            subscription.expires_at = expires_at
            
            # Save to database
            await self.db.subscriptions.insert_one(subscription.dict())
            
            logger.info(f"Subscription created for {payment.customer_email}")
            return subscription
            
        except Exception as e:
            logger.error(f"Failed to create subscription: {str(e)}")
            raise

    async def get_subscription_by_email(self, email: str) -> Optional[Subscription]:
        """Get active subscription by customer email"""
        subscription_data = await self.db.subscriptions.find_one({
            "customer_email": email,
            "status": "active"
        })
        
        if subscription_data:
            return Subscription(**subscription_data)
        return None

    async def get_subscription_by_id(self, subscription_id: str) -> Optional[Subscription]:
        """Get subscription by ID"""
        subscription_data = await self.db.subscriptions.find_one({"id": subscription_id})
        
        if subscription_data:
            return Subscription(**subscription_data)
        return None

    async def update_subscription_status(self, subscription_id: str, status: str):
        """Update subscription status"""
        await self.db.subscriptions.update_one(
            {"id": subscription_id},
            {"$set": {"status": status, "updated_at": datetime.utcnow()}}
        )

    async def get_all_subscriptions_by_email(self, email: str) -> list[Subscription]:
        """Get all subscriptions for a customer"""
        subscriptions_data = await self.db.subscriptions.find(
            {"customer_email": email}
        ).to_list(100)
        
        return [Subscription(**sub) for sub in subscriptions_data]

    async def check_subscription_expiry(self):
        """Check and update expired subscriptions"""
        try:
            expired_subscriptions = await self.db.subscriptions.find({
                "status": "active",
                "expires_at": {"$lt": datetime.utcnow()}
            }).to_list(1000)
            
            for sub_data in expired_subscriptions:
                await self.update_subscription_status(sub_data["id"], "expired")
                logger.info(f"Subscription {sub_data['id']} marked as expired")
                
        except Exception as e:
            logger.error(f"Failed to check subscription expiry: {str(e)}")