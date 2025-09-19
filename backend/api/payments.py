from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from models.payment import PaymentCreate, Payment, PaymentStatus
from services.payment_service import PaymentService
from services.notification_service import NotificationService
from services.subscription_service import SubscriptionService
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

router = APIRouter(prefix="/api/payments", tags=["payments"])

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Initialize services
notification_service = NotificationService(db)
subscription_service = SubscriptionService(db)
payment_service = PaymentService(db, notification_service, subscription_service)

@router.post("/", response_model=Payment)
async def create_payment(payment_data: PaymentCreate):
    """Create and process a new payment"""
    try:
        payment = await payment_service.process_payment(payment_data)
        return payment
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{payment_id}", response_model=Payment)
async def get_payment(payment_id: str):
    """Get payment by ID"""
    payment = await payment_service.get_payment_by_id(payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

@router.get("/customer/{email}")
async def get_customer_payments(email: str):
    """Get all payments for a customer"""
    payments = await payment_service.get_payments_by_email(email)
    return payments

@router.post("/{payment_id}/webhook")
async def payment_webhook(payment_id: str, webhook_data: dict):
    """Handle payment gateway webhooks"""
    try:
        payment = await payment_service.get_payment_by_id(payment_id)
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        # Process webhook based on gateway
        gateway = webhook_data.get('gateway', '')
        status = webhook_data.get('status', '')
        
        if gateway == 'stripe':
            await _handle_stripe_webhook(payment_id, webhook_data)
        elif gateway == 'paymob':
            await _handle_paymob_webhook(payment_id, webhook_data)
        elif gateway == 'fawry':
            await _handle_fawry_webhook(payment_id, webhook_data)
        
        return {"status": "success"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/simulate-success/{payment_id}")
async def simulate_payment_success(payment_id: str):
    """Simulate successful payment (for testing)"""
    try:
        payment = await payment_service.get_payment_by_id(payment_id)
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        
        # Update payment status to completed
        gateway_response = {
            'success': True,
            'gateway': 'simulation',
            'message': 'Payment simulated successfully'
        }
        
        await payment_service.update_payment_status(
            payment_id, 
            PaymentStatus.COMPLETED, 
            gateway_response
        )
        
        # Create subscription
        await subscription_service.create_subscription(payment)
        
        # Send notifications
        await notification_service.send_payment_confirmation_email(payment)
        await notification_service.send_payment_confirmation_sms(payment)
        await notification_service.send_admin_payment_alert(payment)
        
        return {"status": "success", "message": "Payment simulated successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

async def _handle_stripe_webhook(payment_id: str, webhook_data: dict):
    """Handle Stripe webhook"""
    event_type = webhook_data.get('type', '')
    
    if event_type == 'payment_intent.succeeded':
        await payment_service.update_payment_status(
            payment_id, 
            PaymentStatus.COMPLETED,
            webhook_data
        )
    elif event_type == 'payment_intent.payment_failed':
        await payment_service.update_payment_status(
            payment_id,
            PaymentStatus.FAILED,
            webhook_data
        )

async def _handle_paymob_webhook(payment_id: str, webhook_data: dict):
    """Handle Paymob webhook"""
    success = webhook_data.get('success', False)
    
    if success:
        await payment_service.update_payment_status(
            payment_id,
            PaymentStatus.COMPLETED,
            webhook_data
        )
    else:
        await payment_service.update_payment_status(
            payment_id,
            PaymentStatus.FAILED,
            webhook_data
        )

async def _handle_fawry_webhook(payment_id: str, webhook_data: dict):
    """Handle Fawry webhook"""
    status = webhook_data.get('payment_status', '')
    
    if status == 'PAID':
        await payment_service.update_payment_status(
            payment_id,
            PaymentStatus.COMPLETED,
            webhook_data
        )
    elif status == 'FAILED':
        await payment_service.update_payment_status(
            payment_id,
            PaymentStatus.FAILED,
            webhook_data
        )