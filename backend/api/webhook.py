from fastapi import APIRouter, Request, HTTPException
import os
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from emergentintegrations.payments.stripe.checkout import StripeCheckout

router = APIRouter(prefix="/api/webhook", tags=["webhook"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


@router.post("/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    
    # Get raw body
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    if not signature:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")
    
    # Get Stripe API key
    api_key = os.environ.get('STRIPE_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe API key not configured")
    
    # Initialize Stripe checkout
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    try:
        # Handle webhook
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Process the event
        event_type = webhook_response.event_type
        session_id = webhook_response.session_id
        payment_status = webhook_response.payment_status
        metadata = webhook_response.metadata
        
        # Update transaction in database
        if session_id:
            update_data = {
                "webhook_event_type": event_type,
                "payment_status": payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Get existing transaction
            transaction = await db.payment_transactions.find_one({"session_id": session_id})
            
            # If payment successful and not already processed
            if payment_status == "paid" and transaction and transaction.get("payment_status") != "paid":
                update_data["processed_at"] = datetime.now(timezone.utc).isoformat()
                
                # Activate subscription
                if transaction.get("company_id"):
                    await activate_subscription(
                        company_id=transaction.get("company_id"),
                        plan=transaction.get("plan"),
                        duration=transaction.get("duration"),
                        amount_paid=transaction.get("amount_egp", 0)
                    )
            
            # Update transaction
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": update_data}
            )
        
        return {"status": "success", "event_type": event_type}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")


async def activate_subscription(company_id: str, plan: str, duration: str, amount_paid: float):
    """Activate subscription for a company"""
    
    # Calculate subscription end date based on duration
    duration_days = {
        "3_months": 90,
        "6_months": 180,
        "9_months": 270,
        "12_months": 365,
        "lifetime": 36500  # 100 years
    }
    
    days = duration_days.get(duration, 365)
    start_date = datetime.now(timezone.utc)
    end_date = start_date + timedelta(days=days)
    
    # Create or update subscription
    subscription = {
        "company_id": company_id,
        "plan": plan,
        "duration": duration,
        "status": "active",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "amount_paid": amount_paid,
        "payment_method": "stripe",
        "created_at": start_date.isoformat(),
        "updated_at": start_date.isoformat()
    }
    
    # Upsert subscription
    await db.subscriptions.update_one(
        {"company_id": company_id},
        {"$set": subscription},
        upsert=True
    )
    
    # Update company with subscription info
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "subscription_plan": plan,
            "subscription_status": "active",
            "subscription_end_date": end_date.isoformat()
        }}
    )
