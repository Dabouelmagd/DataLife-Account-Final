from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import secrets
import string
from services.auth_service import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/customer-portal", tags=["customer-portal"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


def generate_id(prefix=""):
    """Generate unique ID"""
    random_part = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    return f"{prefix}{random_part}"


def generate_password():
    """Generate random password"""
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))


async def verify_customer_token(authorization: str):
    """Verify customer portal token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    from services.auth_service import verify_token
    token = authorization.split(" ")[1]
    data = verify_token(token)
    
    if not data or data.get("type") != "customer":
        raise HTTPException(status_code=401, detail="Invalid customer token")
    
    return data


async def verify_company_token(authorization: str):
    """Verify company user token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    from services.auth_service import verify_token
    token = authorization.split(" ")[1]
    data = verify_token(token)
    
    if not data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return data


# ============ CUSTOMER AUTHENTICATION ============

@router.post("/register")
async def register_customer(customer_data: dict):
    """Register a new customer for portal access"""
    email = customer_data.get("email")
    password = customer_data.get("password")
    name = customer_data.get("name")
    phone = customer_data.get("phone")
    company_code = customer_data.get("company_code")  # To link to a company
    
    if not email or not password or not company_code:
        raise HTTPException(status_code=400, detail="Email, password and company code required")
    
    # Find company by code
    company = await db.companies.find_one({"portal_code": company_code})
    if not company:
        raise HTTPException(status_code=404, detail="Invalid company code")
    
    # Check if email already exists
    existing = await db.customer_accounts.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    customer_account = {
        "id": generate_id("cust_"),
        "email": email,
        "password_hash": hash_password(password),
        "name": name,
        "phone": phone,
        "company_id": company.get("id"),
        "company_name": company.get("name"),
        "is_active": True,
        "is_verified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.customer_accounts.insert_one(customer_account)
    
    return {"success": True, "message": "Registration successful. Please login."}


@router.post("/login")
async def customer_login(login_data: dict):
    """Customer portal login"""
    email = login_data.get("email")
    password = login_data.get("password")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    
    customer = await db.customer_accounts.find_one({"email": email})
    
    if not customer:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(password, customer.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not customer.get("is_active"):
        raise HTTPException(status_code=401, detail="Account is deactivated")
    
    # Create token with customer type
    token_data = {
        "customer_id": customer.get("id"),
        "email": customer.get("email"),
        "name": customer.get("name"),
        "company_id": customer.get("company_id"),
        "type": "customer"
    }
    
    token = create_access_token(token_data)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "customer": {
            "id": customer.get("id"),
            "email": customer.get("email"),
            "name": customer.get("name"),
            "company_name": customer.get("company_name")
        }
    }


# ============ CUSTOMER DASHBOARD ============

@router.get("/dashboard")
async def get_customer_dashboard(authorization: Optional[str] = Header(None)):
    """Get customer dashboard data"""
    customer_data = await verify_customer_token(authorization)
    customer_id = customer_data.get("customer_id")
    company_id = customer_data.get("company_id")
    
    # Get customer's invoices
    invoices = await db.invoices.find(
        {"customer_id": customer_id, "company_id": company_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=None)
    
    # Calculate totals
    total_invoices = len(invoices)
    total_amount = sum(i.get("grand_total", 0) for i in invoices)
    paid_amount = sum(i.get("paid_amount", 0) for i in invoices)
    pending_amount = total_amount - paid_amount
    
    # Recent invoices
    recent_invoices = invoices[:5]
    
    # Pending invoices
    pending_invoices = [i for i in invoices if i.get("status") not in ["paid", "cancelled"]]
    
    return {
        "summary": {
            "total_invoices": total_invoices,
            "total_amount": total_amount,
            "paid_amount": paid_amount,
            "pending_amount": pending_amount,
            "pending_invoices_count": len(pending_invoices)
        },
        "recent_invoices": recent_invoices,
        "pending_invoices": pending_invoices[:10]
    }


# ============ CUSTOMER INVOICES ============

@router.get("/invoices")
async def get_customer_invoices(
    status: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get all invoices for logged in customer"""
    customer_data = await verify_customer_token(authorization)
    customer_id = customer_data.get("customer_id")
    company_id = customer_data.get("company_id")
    
    query = {"customer_id": customer_id, "company_id": company_id}
    if status:
        query["status"] = status
    
    invoices = await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=None)
    
    return invoices


@router.get("/invoices/{invoice_number}")
async def get_customer_invoice(
    invoice_number: str,
    authorization: Optional[str] = Header(None)
):
    """Get single invoice details"""
    customer_data = await verify_customer_token(authorization)
    customer_id = customer_data.get("customer_id")
    
    invoice = await db.invoices.find_one(
        {"invoice_number": invoice_number, "customer_id": customer_id},
        {"_id": 0}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get payments for this invoice
    payments = await db.invoice_payments.find(
        {"invoice_number": invoice_number},
        {"_id": 0}
    ).sort("date", -1).to_list(length=None)
    
    invoice["payments"] = payments
    
    return invoice


# ============ CUSTOMER PAYMENTS ============

@router.post("/invoices/{invoice_number}/pay")
async def initiate_payment(
    invoice_number: str,
    payment_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Initiate payment for an invoice"""
    customer_data = await verify_customer_token(authorization)
    customer_id = customer_data.get("customer_id")
    
    invoice = await db.invoices.find_one(
        {"invoice_number": invoice_number, "customer_id": customer_id}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Invoice already paid")
    
    remaining = invoice.get("grand_total", 0) - invoice.get("paid_amount", 0)
    amount = payment_data.get("amount", remaining)
    payment_method = payment_data.get("method", "stripe")
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    
    if payment_method == "stripe":
        # Create Stripe checkout session
        from api.payments import SUBSCRIPTION_PACKAGES
        from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
        
        api_key = os.environ.get('STRIPE_API_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="Payment not configured")
        
        stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
        
        success_url = f"https://datalifeaccount.com/customer-portal/payment-success?invoice={invoice_number}"
        cancel_url = f"https://datalifeaccount.com/customer-portal/invoices/{invoice_number}"
        
        checkout_request = CheckoutSessionRequest(
            amount=amount / 50,  # Convert EGP to USD
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "invoice_number": invoice_number,
                "customer_id": customer_id,
                "type": "invoice_payment"
            }
        )
        
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        return {
            "payment_url": session.url,
            "session_id": session.session_id
        }
    
    return {"error": "Payment method not supported"}


@router.get("/payments")
async def get_customer_payments(authorization: Optional[str] = Header(None)):
    """Get all payments made by customer"""
    customer_data = await verify_customer_token(authorization)
    customer_id = customer_data.get("customer_id")
    
    # Get all invoice numbers for this customer
    invoices = await db.invoices.find(
        {"customer_id": customer_id},
        {"invoice_number": 1}
    ).to_list(length=None)
    
    invoice_numbers = [i.get("invoice_number") for i in invoices]
    
    # Get payments
    payments = await db.invoice_payments.find(
        {"invoice_number": {"$in": invoice_numbers}},
        {"_id": 0}
    ).sort("date", -1).to_list(length=None)
    
    return payments


# ============ CUSTOMER PROFILE ============

@router.get("/profile")
async def get_customer_profile(authorization: Optional[str] = Header(None)):
    """Get customer profile"""
    customer_data = await verify_customer_token(authorization)
    customer_id = customer_data.get("customer_id")
    
    customer = await db.customer_accounts.find_one(
        {"id": customer_id},
        {"_id": 0, "password_hash": 0}
    )
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    return customer


@router.put("/profile")
async def update_customer_profile(
    profile_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update customer profile"""
    customer_data = await verify_customer_token(authorization)
    customer_id = customer_data.get("customer_id")
    
    allowed_fields = ["name", "phone", "address"]
    update_fields = {k: v for k, v in profile_data.items() if k in allowed_fields}
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.customer_accounts.update_one(
        {"id": customer_id},
        {"$set": update_fields}
    )
    
    return {"success": True}


@router.put("/change-password")
async def change_customer_password(
    password_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Change customer password"""
    customer_data = await verify_customer_token(authorization)
    customer_id = customer_data.get("customer_id")
    
    current_password = password_data.get("current_password")
    new_password = password_data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current and new password required")
    
    customer = await db.customer_accounts.find_one({"id": customer_id})
    
    if not verify_password(current_password, customer.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    await db.customer_accounts.update_one(
        {"id": customer_id},
        {"$set": {
            "password_hash": hash_password(new_password),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True}


# ============ COMPANY MANAGEMENT OF CUSTOMERS ============

@router.post("/customers/invite")
async def invite_customer(
    invite_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Invite a customer to the portal (company side)"""
    user_data = await verify_company_token(authorization)
    company_id = user_data.get("company_id")
    
    email = invite_data.get("email")
    name = invite_data.get("name")
    customer_id = invite_data.get("customer_id")  # Link to existing customer record
    
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    # Check if already registered
    existing = await db.customer_accounts.find_one({"email": email, "company_id": company_id})
    if existing:
        raise HTTPException(status_code=400, detail="Customer already has portal access")
    
    # Generate temporary password
    temp_password = generate_password()
    
    customer_account = {
        "id": generate_id("cust_"),
        "email": email,
        "password_hash": hash_password(temp_password),
        "name": name,
        "customer_id": customer_id,
        "company_id": company_id,
        "is_active": True,
        "is_verified": False,
        "invited_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.customer_accounts.insert_one(customer_account)
    
    # Send invitation email
    try:
        import resend
        resend_api_key = os.environ.get('RESEND_API_KEY')
        sender_email = os.environ.get('SENDER_EMAIL', 'noreply@datalifeaccount.com')
        
        if resend_api_key:
            resend.api_key = resend_api_key
            
            # Get company name
            company = await db.companies.find_one({"id": company_id})
            company_name = company.get("name", "DataLife Account") if company else "DataLife Account"
            
            resend.Emails.send({
                "from": f"DataLife Account <{sender_email}>",
                "to": email,
                "subject": f"دعوة للوصول إلى بوابة العملاء - {company_name}",
                "html": f"""
                <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>مرحباً {name}!</h2>
                    <p>تمت دعوتك للوصول إلى بوابة العملاء الخاصة بـ {company_name}.</p>
                    <p>يمكنك تسجيل الدخول باستخدام:</p>
                    <ul>
                        <li><strong>البريد الإلكتروني:</strong> {email}</li>
                        <li><strong>كلمة المرور المؤقتة:</strong> {temp_password}</li>
                    </ul>
                    <p>يرجى تغيير كلمة المرور بعد تسجيل الدخول.</p>
                    <a href="https://datalifeaccount.com/customer-portal" style="display: inline-block; background: #28376B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px;">تسجيل الدخول</a>
                </div>
                """
            })
    except:
        pass
    
    return {
        "success": True,
        "customer_id": customer_account["id"],
        "temp_password": temp_password  # Return for manual sharing if email fails
    }


@router.get("/customers")
async def get_portal_customers(authorization: Optional[str] = Header(None)):
    """Get all customers with portal access (company side)"""
    user_data = await verify_company_token(authorization)
    company_id = user_data.get("company_id")
    
    customers = await db.customer_accounts.find(
        {"company_id": company_id},
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).to_list(length=None)
    
    return customers


@router.put("/customers/{customer_id}/toggle")
async def toggle_customer_access(
    customer_id: str,
    authorization: Optional[str] = Header(None)
):
    """Enable/disable customer portal access (company side)"""
    user_data = await verify_company_token(authorization)
    company_id = user_data.get("company_id")
    
    customer = await db.customer_accounts.find_one(
        {"id": customer_id, "company_id": company_id}
    )
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    new_status = not customer.get("is_active", True)
    
    await db.customer_accounts.update_one(
        {"id": customer_id},
        {"$set": {"is_active": new_status}}
    )
    
    return {"success": True, "is_active": new_status}


@router.post("/setup-portal")
async def setup_customer_portal(authorization: Optional[str] = Header(None)):
    """Setup customer portal for company (generate portal code)"""
    user_data = await verify_company_token(authorization)
    company_id = user_data.get("company_id")
    
    # Generate unique portal code
    portal_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
    
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "portal_code": portal_code,
            "portal_enabled": True,
            "portal_setup_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "portal_code": portal_code,
        "portal_url": f"https://datalifeaccount.com/customer-portal?company={portal_code}"
    }
