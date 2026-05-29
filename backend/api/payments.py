from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, 
    CheckoutSessionResponse, 
    CheckoutStatusResponse, 
    CheckoutSessionRequest
)

# Ensure .env vars are loaded before reading MONGO_URL/DB_NAME
load_dotenv()

router = APIRouter(prefix="/api/payments", tags=["payments"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Fixed subscription packages (prices in EGP converted to USD for Stripe)
# Using approximate conversion rate 1 USD = 50 EGP
SUBSCRIPTION_PACKAGES = {
    "starter_3": {"plan": "starter", "duration": "3_months", "price_egp": 597, "price_usd": 11.94, "name_en": "Starter - 3 Months", "name_ar": "المبتدئ - 3 أشهر"},
    "starter_6": {"plan": "starter", "duration": "6_months", "price_egp": 1194, "price_usd": 23.88, "name_en": "Starter - 6 Months", "name_ar": "المبتدئ - 6 أشهر"},
    "starter_9": {"plan": "starter", "duration": "9_months", "price_egp": 1791, "price_usd": 35.82, "name_en": "Starter - 9 Months", "name_ar": "المبتدئ - 9 أشهر"},
    "starter_12": {"plan": "starter", "duration": "12_months", "price_egp": 2390, "price_usd": 47.80, "name_en": "Starter - 1 Year", "name_ar": "المبتدئ - سنة"},
    "starter_lifetime": {"plan": "starter", "duration": "lifetime", "price_egp": 10000, "price_usd": 200.00, "name_en": "Starter - Lifetime", "name_ar": "المبتدئ - مدى الحياة"},
    
    "professional_3": {"plan": "professional", "duration": "3_months", "price_egp": 1598, "price_usd": 31.96, "name_en": "Professional - 3 Months", "name_ar": "المحترف - 3 أشهر"},
    "professional_6": {"plan": "professional", "duration": "6_months", "price_egp": 3196, "price_usd": 63.92, "name_en": "Professional - 6 Months", "name_ar": "المحترف - 6 أشهر"},
    "professional_9": {"plan": "professional", "duration": "9_months", "price_egp": 4794, "price_usd": 95.88, "name_en": "Professional - 9 Months", "name_ar": "المحترف - 9 أشهر"},
    "professional_12": {"plan": "professional", "duration": "12_months", "price_egp": 6392, "price_usd": 127.84, "name_en": "Professional - 1 Year", "name_ar": "المحترف - سنة"},
    "professional_lifetime": {"plan": "professional", "duration": "lifetime", "price_egp": 25000, "price_usd": 500.00, "name_en": "Professional - Lifetime", "name_ar": "المحترف - مدى الحياة"},
    
    "enterprise_3": {"plan": "enterprise", "duration": "3_months", "price_egp": 2998, "price_usd": 59.96, "name_en": "Enterprise - 3 Months", "name_ar": "المؤسسي - 3 أشهر"},
    "enterprise_6": {"plan": "enterprise", "duration": "6_months", "price_egp": 5996, "price_usd": 119.92, "name_en": "Enterprise - 6 Months", "name_ar": "المؤسسي - 6 أشهر"},
    "enterprise_9": {"plan": "enterprise", "duration": "9_months", "price_egp": 8994, "price_usd": 179.88, "name_en": "Enterprise - 9 Months", "name_ar": "المؤسسي - 9 أشهر"},
    "enterprise_12": {"plan": "enterprise", "duration": "12_months", "price_egp": 11992, "price_usd": 239.84, "name_en": "Enterprise - 1 Year", "name_ar": "المؤسسي - سنة"},
    "enterprise_lifetime": {"plan": "enterprise", "duration": "lifetime", "price_egp": 50000, "price_usd": 1000.00, "name_en": "Enterprise - Lifetime", "name_ar": "المؤسسي - مدى الحياة"},
}


class CreateCheckoutRequest(BaseModel):
    package_id: str = Field(..., description="Package ID from SUBSCRIPTION_PACKAGES")
    origin_url: str = Field(..., description="Frontend origin URL")
    user_email: Optional[str] = Field(None, description="User email for reference")
    company_id: Optional[str] = Field(None, description="Company ID")


class CheckoutResponse(BaseModel):
    url: str
    session_id: str
    package: dict


@router.get("/packages")
async def get_packages():
    """Get all available subscription packages"""
    packages = []
    for pkg_id, pkg_data in SUBSCRIPTION_PACKAGES.items():
        packages.append({
            "id": pkg_id,
            "plan": pkg_data["plan"],
            "duration": pkg_data["duration"],
            "price_egp": pkg_data["price_egp"],
            "price_usd": pkg_data["price_usd"],
            "name_en": pkg_data["name_en"],
            "name_ar": pkg_data["name_ar"]
        })
    return packages


@router.post("/create-checkout")
async def create_checkout_session(request: CreateCheckoutRequest, http_request: Request):
    """Create a Stripe checkout session for subscription payment"""
    
    # Validate package exists
    if request.package_id not in SUBSCRIPTION_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package ID")
    
    package = SUBSCRIPTION_PACKAGES[request.package_id]
    
    # Get Stripe API key
    api_key = os.environ.get('STRIPE_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe API key not configured")
    
    # Setup webhook URL
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    # Initialize Stripe checkout
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    # Build success and cancel URLs from frontend origin
    origin_url = request.origin_url.rstrip('/')
    success_url = f"{origin_url}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin_url}/subscription"
    
    # Create metadata
    metadata = {
        "package_id": request.package_id,
        "plan": package["plan"],
        "duration": package["duration"],
        "price_egp": str(package["price_egp"]),
        "user_email": request.user_email or "",
        "company_id": request.company_id or ""
    }
    
    try:
        # Create checkout session with amount from backend (not from frontend)
        checkout_request = CheckoutSessionRequest(
            amount=float(package["price_usd"]),
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata
        )
        
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record BEFORE redirect
        transaction = {
            "session_id": session.session_id,
            "package_id": request.package_id,
            "plan": package["plan"],
            "duration": package["duration"],
            "amount_usd": package["price_usd"],
            "amount_egp": package["price_egp"],
            "currency": "usd",
            "user_email": request.user_email,
            "company_id": request.company_id,
            "payment_status": "pending",
            "status": "initiated",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.payment_transactions.insert_one(transaction)
        
        return {
            "url": session.url,
            "session_id": session.session_id,
            "package": {
                "id": request.package_id,
                "name_en": package["name_en"],
                "name_ar": package["name_ar"],
                "price_usd": package["price_usd"],
                "price_egp": package["price_egp"]
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")


@router.get("/status/{session_id}")
async def get_payment_status(session_id: str, http_request: Request):
    """Get payment status for a checkout session"""
    
    # Check if already processed
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # If already processed successfully, return cached status
    if transaction.get("payment_status") == "paid":
        return {
            "status": "complete",
            "payment_status": "paid",
            "package": {
                "plan": transaction.get("plan"),
                "duration": transaction.get("duration")
            },
            "message": "Payment already processed"
        }
    
    # Get Stripe API key
    api_key = os.environ.get('STRIPE_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe API key not configured")
    
    # Setup webhook URL
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    # Initialize Stripe checkout
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    try:
        # Get checkout status from Stripe
        checkout_status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction based on status
        update_data = {
            "payment_status": checkout_status.payment_status,
            "status": checkout_status.status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # If payment successful and not already processed, activate subscription
        if checkout_status.payment_status == "paid" and transaction.get("payment_status") != "paid":
            update_data["processed_at"] = datetime.now(timezone.utc).isoformat()
            
            # Activate subscription for the user/company
            if transaction.get("company_id"):
                await activate_subscription(
                    company_id=transaction.get("company_id"),
                    plan=transaction.get("plan"),
                    duration=transaction.get("duration"),
                    amount_paid=transaction.get("amount_egp")
                )
            
            # Send tax invoice (14% VAT inclusive) by email — replaces the old simple confirmation
            if transaction.get("user_email"):
                from services.tax_invoice_service import send_tax_invoice_email
                # Resolve customer & company name for the invoice
                company_doc = None
                if transaction.get("company_id"):
                    company_doc = await db.companies.find_one(
                        {"id": transaction.get("company_id")},
                        {"_id": 0, "name": 1}
                    )
                user_doc = await db.users.find_one(
                    {"email": transaction.get("user_email")},
                    {"_id": 0, "full_name": 1}
                )
                customer_name = (user_doc or {}).get("full_name") or transaction.get("user_email")
                company_name = (company_doc or {}).get("name")
                await send_tax_invoice_email(
                    customer_email=transaction.get("user_email"),
                    customer_name=customer_name,
                    company_name=company_name,
                    company_id=transaction.get("company_id"),
                    plan=transaction.get("plan"),
                    duration=transaction.get("duration"),
                    amount_inclusive_egp=transaction.get("amount_egp"),
                    db=db,
                )
        
        # Update transaction record
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": update_data}
        )
        
        return {
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "amount_total": checkout_status.amount_total,
            "currency": checkout_status.currency,
            "package": {
                "plan": transaction.get("plan"),
                "duration": transaction.get("duration")
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get payment status: {str(e)}")


async def activate_subscription(company_id: str, plan: str, duration: str, amount_paid: float):
    """Activate subscription for a company"""
    from datetime import timedelta
    
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


async def send_payment_confirmation_email(email: str, plan: str, duration: str, amount: float):
    """Send payment confirmation email to user"""
    try:
        import resend
        
        resend_api_key = os.environ.get('RESEND_API_KEY')
        sender_email = os.environ.get('SENDER_EMAIL', 'noreply@datalifeaccount.com')
        
        if not resend_api_key:
            return
        
        resend.api_key = resend_api_key
        
        # Plan names
        plan_names = {
            "starter": {"en": "Starter", "ar": "المبتدئ"},
            "professional": {"en": "Professional", "ar": "المحترف"},
            "enterprise": {"en": "Enterprise", "ar": "المؤسسي"}
        }
        
        # Duration names
        duration_names = {
            "3_months": {"en": "3 Months", "ar": "3 أشهر"},
            "6_months": {"en": "6 Months", "ar": "6 أشهر"},
            "9_months": {"en": "9 Months", "ar": "9 أشهر"},
            "12_months": {"en": "1 Year", "ar": "سنة"},
            "lifetime": {"en": "Lifetime", "ar": "مدى الحياة"}
        }
        
        plan_name_en = plan_names.get(plan, {}).get("en", plan)
        plan_name_ar = plan_names.get(plan, {}).get("ar", plan)
        duration_name_en = duration_names.get(duration, {}).get("en", duration)
        duration_name_ar = duration_names.get(duration, {}).get("ar", duration)
        
        html_content = f"""
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7fa; }}
                .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
                .header {{ background: linear-gradient(135deg, #28376B 0%, #4F46E5 100%); padding: 40px 20px; text-align: center; }}
                .header h1 {{ color: #ffffff; margin: 0; font-size: 28px; }}
                .header p {{ color: rgba(255,255,255,0.9); margin-top: 10px; font-size: 16px; }}
                .content {{ padding: 40px 30px; }}
                .success-icon {{ text-align: center; margin-bottom: 30px; }}
                .success-icon .circle {{ display: inline-block; width: 80px; height: 80px; background-color: #10B981; border-radius: 50%; line-height: 80px; }}
                .success-icon .circle span {{ color: white; font-size: 40px; }}
                .details {{ background-color: #f8fafc; border-radius: 8px; padding: 25px; margin: 20px 0; }}
                .detail-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }}
                .detail-row:last-child {{ border-bottom: none; }}
                .detail-label {{ color: #64748b; font-size: 14px; }}
                .detail-value {{ color: #1e293b; font-weight: 600; font-size: 14px; }}
                .footer {{ background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; }}
                .footer p {{ color: #64748b; font-size: 12px; margin: 5px 0; }}
                .btn {{ display: inline-block; background: linear-gradient(135deg, #28376B 0%, #4F46E5 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; margin-top: 20px; font-weight: 600; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>DataLife Account</h1>
                    <p>تم الدفع بنجاح! | Payment Successful!</p>
                </div>
                <div class="content">
                    <div class="success-icon">
                        <div class="circle"><span>✓</span></div>
                    </div>
                    <h2 style="text-align: center; color: #10B981; margin-bottom: 30px;">
                        شكراً لاشتراكك!<br/>Thank you for your subscription!
                    </h2>
                    <div class="details">
                        <div class="detail-row">
                            <span class="detail-label">الخطة | Plan</span>
                            <span class="detail-value">{plan_name_ar} | {plan_name_en}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">المدة | Duration</span>
                            <span class="detail-value">{duration_name_ar} | {duration_name_en}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">المبلغ | Amount</span>
                            <span class="detail-value">{amount:,.0f} جنيه مصري | {amount:,.0f} EGP</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">التاريخ | Date</span>
                            <span class="detail-value">{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}</span>
                        </div>
                    </div>
                    <div style="text-align: center;">
                        <a href="https://datalifeaccount.com/dashboard" class="btn">
                            الذهاب إلى لوحة التحكم | Go to Dashboard
                        </a>
                    </div>
                </div>
                <div class="footer">
                    <p>© 2024 DataLife Account. All rights reserved.</p>
                    <p>هذا البريد تم إرساله تلقائياً، الرجاء عدم الرد عليه</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        resend.Emails.send({
            "from": f"DataLife Account <{sender_email}>",
            "to": email,
            "subject": "تم تفعيل اشتراكك بنجاح! | Subscription Activated Successfully!",
            "html": html_content
        })
        
    except Exception:
        # Log error but don't fail the transaction
        pass


@router.get("/transactions")
async def get_transactions(company_id: Optional[str] = None):
    """Get payment transactions history"""
    query = {}
    if company_id:
        query["company_id"] = company_id
    
    transactions = await db.payment_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return transactions


@router.get("/tax-invoices")
async def list_tax_invoices(company_id: Optional[str] = None, email: Optional[str] = None):
    """List tax invoices for a given company or customer email."""
    query = {}
    if company_id:
        query["company_id"] = company_id
    if email:
        query["customer_email"] = email
    if not query:
        raise HTTPException(status_code=400, detail="company_id or email is required")
    invoices = await db.tax_invoices.find(query, {"_id": 0, "html": 0}).sort("issued_at", -1).to_list(200)
    return invoices


@router.get("/tax-invoices/{invoice_number}/html")
async def get_tax_invoice_html(invoice_number: str):
    """Return the HTML representation of a single tax invoice for re-download / print."""
    from fastapi.responses import HTMLResponse
    invoice = await db.tax_invoices.find_one({"invoice_number": invoice_number}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return HTMLResponse(content=invoice.get("html", ""), status_code=200)
