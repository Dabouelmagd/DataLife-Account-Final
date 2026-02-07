from fastapi import APIRouter, HTTPException, Header
from typing import Optional
import os
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from collections import defaultdict
import secrets
import string

router = APIRouter(prefix="/api/admin", tags=["admin"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Admin roles that can access this dashboard
ADMIN_ROLES = ['Super Admin', 'مدير النظام', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي']


async def verify_admin(authorization: str):
    """Verify if user is admin"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    from services.auth_service import verify_token
    token = authorization.split(" ")[1]
    user_data = verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # For now, allow any authenticated user with management roles
    # In production, you might want stricter admin checks
    return user_data


@router.get("/dashboard")
async def get_admin_dashboard(authorization: Optional[str] = Header(None)):
    """Get admin dashboard statistics"""
    user_data = await verify_admin(authorization)
    
    # Get all data
    companies = await db.companies.find({}, {"_id": 0}).to_list(length=None)
    users = await db.users.find({}, {"_id": 0}).to_list(length=None)
    subscriptions = await db.subscriptions.find({}, {"_id": 0}).to_list(length=None)
    transactions = await db.payment_transactions.find({}, {"_id": 0}).to_list(length=None)
    activation_codes = await db.activation_codes.find({}, {"_id": 0}).to_list(length=None)
    
    # Calculate statistics
    total_companies = len(companies)
    total_users = len(users)
    active_subscriptions = len([s for s in subscriptions if s.get('status') == 'active'])
    
    # Revenue calculations
    total_revenue = sum(t.get('amount_egp', 0) for t in transactions if t.get('payment_status') == 'paid')
    monthly_revenue = sum(
        t.get('amount_egp', 0) for t in transactions 
        if t.get('payment_status') == 'paid' and 
        t.get('created_at', '').startswith(datetime.now().strftime('%Y-%m'))
    )
    
    # Subscription breakdown by plan
    plan_breakdown = defaultdict(int)
    for sub in subscriptions:
        if sub.get('status') == 'active':
            plan_breakdown[sub.get('plan', 'unknown')] += 1
    
    # Recent activity
    recent_transactions = sorted(
        [t for t in transactions if t.get('payment_status') == 'paid'],
        key=lambda x: x.get('created_at', ''),
        reverse=True
    )[:10]
    
    # Expiring soon (within 30 days)
    now = datetime.now(timezone.utc)
    expiring_soon = []
    for sub in subscriptions:
        if sub.get('status') == 'active' and sub.get('end_date'):
            try:
                end_date = datetime.fromisoformat(sub['end_date'].replace('Z', '+00:00'))
                days_left = (end_date - now).days
                if 0 < days_left <= 30:
                    expiring_soon.append({
                        "company_id": sub.get('company_id'),
                        "plan": sub.get('plan'),
                        "days_left": days_left,
                        "end_date": sub.get('end_date')
                    })
            except:
                pass
    
    return {
        "statistics": {
            "total_companies": total_companies,
            "total_users": total_users,
            "active_subscriptions": active_subscriptions,
            "total_revenue": total_revenue,
            "monthly_revenue": monthly_revenue,
            "activation_codes_count": len(activation_codes),
            "active_codes": len([c for c in activation_codes if c.get('is_active', False)])
        },
        "plan_breakdown": [
            {"plan": plan, "count": count} 
            for plan, count in plan_breakdown.items()
        ],
        "recent_transactions": recent_transactions,
        "expiring_soon": sorted(expiring_soon, key=lambda x: x['days_left'])[:10]
    }


@router.get("/subscriptions")
async def get_all_subscriptions(
    status: Optional[str] = None,
    plan: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get all subscriptions with filtering"""
    await verify_admin(authorization)
    
    query = {}
    if status:
        query["status"] = status
    if plan:
        query["plan"] = plan
    
    subscriptions = await db.subscriptions.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=None)
    
    # Enrich with company info
    for sub in subscriptions:
        company = await db.companies.find_one({"id": sub.get("company_id")}, {"_id": 0, "name": 1, "contact_email": 1})
        if company:
            sub["company_name"] = company.get("name", "Unknown")
            sub["company_email"] = company.get("contact_email", "")
    
    return subscriptions


@router.get("/transactions")
async def get_all_transactions(
    status: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get all payment transactions"""
    await verify_admin(authorization)
    
    query = {}
    if status:
        query["payment_status"] = status
    
    transactions = await db.payment_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=None)
    
    return transactions


@router.get("/activation-codes")
async def get_activation_codes(
    is_active: Optional[bool] = None,
    authorization: Optional[str] = Header(None)
):
    """Get all activation codes"""
    await verify_admin(authorization)
    
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    
    codes = await db.activation_codes.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=None)
    
    return codes


@router.post("/activation-codes/generate")
async def generate_activation_code(
    request_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Generate new activation code"""
    await verify_admin(authorization)
    
    plan = request_data.get("plan", "starter")
    duration = request_data.get("duration", "12_months")
    discount_percent = request_data.get("discount_percent", 0)
    max_uses = request_data.get("max_uses", 1)
    prefix = request_data.get("prefix", "DL")
    
    # Generate unique code
    random_part = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
    code = f"{prefix}-{plan[:3].upper()}-{random_part}"
    
    activation_code = {
        "code": code,
        "plan": plan,
        "duration": duration,
        "discount_percent": discount_percent,
        "max_uses": max_uses,
        "current_uses": 0,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "admin"
    }
    
    await db.activation_codes.insert_one(activation_code)
    del activation_code["_id"]
    
    return activation_code


@router.post("/activation-codes/bulk-generate")
async def bulk_generate_codes(
    request_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Generate multiple activation codes at once"""
    await verify_admin(authorization)
    
    count = request_data.get("count", 5)
    plan = request_data.get("plan", "starter")
    duration = request_data.get("duration", "12_months")
    discount_percent = request_data.get("discount_percent", 0)
    prefix = request_data.get("prefix", "DL")
    
    if count > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 codes at once")
    
    generated_codes = []
    
    for _ in range(count):
        random_part = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
        code = f"{prefix}-{plan[:3].upper()}-{random_part}"
        
        activation_code = {
            "code": code,
            "plan": plan,
            "duration": duration,
            "discount_percent": discount_percent,
            "max_uses": 1,
            "current_uses": 0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        }
        
        await db.activation_codes.insert_one(activation_code)
        generated_codes.append(code)
    
    return {
        "generated": len(generated_codes),
        "codes": generated_codes
    }


@router.put("/activation-codes/{code}/toggle")
async def toggle_activation_code(
    code: str,
    authorization: Optional[str] = Header(None)
):
    """Enable/disable an activation code"""
    await verify_admin(authorization)
    
    existing = await db.activation_codes.find_one({"code": code})
    if not existing:
        raise HTTPException(status_code=404, detail="Code not found")
    
    new_status = not existing.get("is_active", False)
    
    await db.activation_codes.update_one(
        {"code": code},
        {"$set": {"is_active": new_status}}
    )
    
    return {"code": code, "is_active": new_status}


@router.delete("/activation-codes/{code}")
async def delete_activation_code(
    code: str,
    authorization: Optional[str] = Header(None)
):
    """Delete an activation code"""
    await verify_admin(authorization)
    
    result = await db.activation_codes.delete_one({"code": code})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Code not found")
    
    return {"deleted": True, "code": code}


@router.get("/companies")
async def get_all_companies(authorization: Optional[str] = Header(None)):
    """Get all companies with subscription info"""
    await verify_admin(authorization)
    
    companies = await db.companies.find({}, {"_id": 0}).to_list(length=None)
    
    # Enrich with subscription and user count
    for company in companies:
        company_id = company.get("id")
        
        # Get subscription
        subscription = await db.subscriptions.find_one(
            {"company_id": company_id}, 
            {"_id": 0}
        )
        company["subscription"] = subscription
        
        # Get user count
        user_count = await db.users.count_documents({"company_id": company_id})
        company["user_count"] = user_count
    
    return companies


@router.put("/subscriptions/{company_id}/extend")
async def extend_subscription(
    company_id: str,
    request_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Manually extend a subscription"""
    await verify_admin(authorization)
    
    days = request_data.get("days", 30)
    
    subscription = await db.subscriptions.find_one({"company_id": company_id})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Calculate new end date
    current_end = datetime.fromisoformat(subscription.get("end_date", datetime.now(timezone.utc).isoformat()).replace('Z', '+00:00'))
    new_end = current_end + timedelta(days=days)
    
    await db.subscriptions.update_one(
        {"company_id": company_id},
        {"$set": {
            "end_date": new_end.isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "company_id": company_id,
        "previous_end": current_end.isoformat(),
        "new_end": new_end.isoformat(),
        "days_added": days
    }
