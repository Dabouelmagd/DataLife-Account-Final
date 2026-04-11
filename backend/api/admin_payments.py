"""
Admin Payments API
إدارة المدفوعات والاشتراكات
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional, List
from pydantic import BaseModel
import os
import secrets
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

from .admin_common import (
    db, verify_admin, log_admin_audit, get_current_timestamp
)

router = APIRouter(prefix="/api/admin/payments", tags=["admin-payments"])


# ===========================================
# Models
# ===========================================

class PaymentRecord(BaseModel):
    company_id: str
    amount: float
    payment_method: str  # cash, credit_card, bank_transfer, online
    payment_date: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class UpdatePaymentStatus(BaseModel):
    is_paid: bool
    payment_method: Optional[str] = None
    payment_date: Optional[str] = None
    reference_number: Optional[str] = None


# ===========================================
# Endpoints
# ===========================================

@router.get("/subscriptions")
async def get_all_subscriptions_with_payment_status(
    authorization: Optional[str] = Header(None),
    status: str = None,  # all, paid, unpaid
    search: str = None
):
    """Get all subscriptions with payment status"""
    await verify_admin(authorization)
    
    # Get all subscriptions
    subscriptions = await db.subscriptions.find({}, {"_id": 0}).to_list(length=None)
    
    result = []
    for sub in subscriptions:
        company_id = sub.get("company_id")
        
        # Get company info
        company = await db.companies.find_one(
            {"id": company_id},
            {"_id": 0, "name": 1, "email": 1, "company_code": 1, "phone": 1}
        )
        
        # Get payment record for this subscription
        payment = await db.subscription_payments.find_one(
            {"subscription_id": sub.get("id")},
            {"_id": 0}
        )
        
        subscription_data = {
            "id": sub.get("id"),
            "company_id": company_id,
            "company_name": company.get("name", "Unknown") if company else "Unknown",
            "company_email": company.get("email", "") if company else "",
            "company_code": company.get("company_code", "") if company else "",
            "company_phone": company.get("phone", "") if company else "",
            "plan": sub.get("plan", "basic"),
            "duration": sub.get("duration", "monthly"),
            "status": sub.get("status", "active"),
            "start_date": sub.get("start_date"),
            "end_date": sub.get("end_date"),
            "created_at": sub.get("created_at"),
            # Payment info
            "is_paid": payment.get("is_paid", False) if payment else False,
            "payment_method": payment.get("payment_method") if payment else None,
            "payment_date": payment.get("payment_date") if payment else None,
            "payment_amount": payment.get("amount") if payment else get_plan_price(sub.get("plan"), sub.get("duration")),
            "reference_number": payment.get("reference_number") if payment else None,
            "payment_notes": payment.get("notes") if payment else None
        }
        
        # Filter by status
        if status == "paid" and not subscription_data["is_paid"]:
            continue
        elif status == "unpaid" and subscription_data["is_paid"]:
            continue
        
        # Filter by search
        if search:
            search_lower = search.lower()
            if not (
                search_lower in subscription_data.get("company_name", "").lower() or
                search_lower in subscription_data.get("company_email", "").lower() or
                search_lower in subscription_data.get("company_code", "").lower()
            ):
                continue
        
        result.append(subscription_data)
    
    # Sort by created_at descending
    result.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    # Calculate totals
    total_paid = sum(1 for s in result if s["is_paid"])
    total_unpaid = sum(1 for s in result if not s["is_paid"])
    total_revenue = sum(s["payment_amount"] for s in result if s["is_paid"])
    pending_revenue = sum(s["payment_amount"] for s in result if not s["is_paid"])
    
    return {
        "subscriptions": result,
        "summary": {
            "total": len(result),
            "paid": total_paid,
            "unpaid": total_unpaid,
            "total_revenue": total_revenue,
            "pending_revenue": pending_revenue
        }
    }


@router.put("/subscriptions/{subscription_id}/payment")
async def update_subscription_payment(
    subscription_id: str,
    payment_data: UpdatePaymentStatus,
    authorization: Optional[str] = Header(None)
):
    """Update payment status for a subscription"""
    user = await verify_admin(authorization)
    
    # Find subscription
    subscription = await db.subscriptions.find_one({"id": subscription_id})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Get or create payment record
    existing_payment = await db.subscription_payments.find_one({"subscription_id": subscription_id})
    
    payment_record = {
        "subscription_id": subscription_id,
        "company_id": subscription.get("company_id"),
        "is_paid": payment_data.is_paid,
        "payment_method": payment_data.payment_method,
        "payment_date": payment_data.payment_date or get_current_timestamp(),
        "reference_number": payment_data.reference_number,
        "amount": get_plan_price(subscription.get("plan"), subscription.get("duration")),
        "updated_at": get_current_timestamp(),
        "updated_by": user.get("email")
    }
    
    if existing_payment:
        await db.subscription_payments.update_one(
            {"subscription_id": subscription_id},
            {"$set": payment_record}
        )
    else:
        payment_record["id"] = f"pay_{secrets.token_hex(8)}"
        payment_record["created_at"] = get_current_timestamp()
        await db.subscription_payments.insert_one(payment_record)
    
    # Log audit
    await log_admin_audit(
        action="payment_status_updated",
        entity_type="subscription_payment",
        user_data=user,
        subscription_id=subscription_id,
        is_paid=payment_data.is_paid,
        payment_method=payment_data.payment_method
    )
    
    return {
        "success": True,
        "message": "Payment status updated",
        "is_paid": payment_data.is_paid
    }


@router.post("/record")
async def record_payment(
    payment: PaymentRecord,
    authorization: Optional[str] = Header(None)
):
    """Record a new payment"""
    user = await verify_admin(authorization)
    
    # Find company
    company = await db.companies.find_one({"id": payment.company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Find active subscription
    subscription = await db.subscriptions.find_one({
        "company_id": payment.company_id,
        "status": "active"
    })
    
    if not subscription:
        raise HTTPException(status_code=404, detail="No active subscription found")
    
    # Create payment record
    payment_record = {
        "id": f"pay_{secrets.token_hex(8)}",
        "subscription_id": subscription.get("id"),
        "company_id": payment.company_id,
        "amount": payment.amount,
        "payment_method": payment.payment_method,
        "payment_date": payment.payment_date or get_current_timestamp(),
        "reference_number": payment.reference_number,
        "notes": payment.notes,
        "is_paid": True,
        "created_at": get_current_timestamp(),
        "created_by": user.get("email")
    }
    
    await db.subscription_payments.insert_one(payment_record)
    
    # Log audit
    await log_admin_audit(
        action="payment_recorded",
        entity_type="payment",
        user_data=user,
        company_id=payment.company_id,
        amount=payment.amount,
        payment_method=payment.payment_method
    )
    
    return {
        "success": True,
        "payment_id": payment_record["id"],
        "message": "Payment recorded successfully"
    }


@router.get("/methods")
async def get_payment_methods():
    """Get available payment methods"""
    return [
        {"id": "cash", "name": "Cash", "name_ar": "نقدي", "icon": "💵"},
        {"id": "credit_card", "name": "Credit Card", "name_ar": "بطاقة ائتمان", "icon": "💳"},
        {"id": "bank_transfer", "name": "Bank Transfer", "name_ar": "تحويل بنكي", "icon": "🏦"},
        {"id": "online", "name": "Online Payment", "name_ar": "دفع إلكتروني", "icon": "💻"},
        {"id": "check", "name": "Check", "name_ar": "شيك", "icon": "📝"},
        {"id": "instapay", "name": "InstaPay", "name_ar": "إنستاباي", "icon": "📱"},
        {"id": "vodafone_cash", "name": "Vodafone Cash", "name_ar": "فودافون كاش", "icon": "📲"},
        {"id": "activation_code", "name": "Activation Code", "name_ar": "كود تفعيل", "icon": "🔑"},
    ]


@router.get("/summary")
async def get_payments_summary(authorization: Optional[str] = Header(None)):
    """Get payments summary"""
    await verify_admin(authorization)
    
    # Get all payments
    payments = await db.subscription_payments.find({"is_paid": True}, {"_id": 0}).to_list(length=None)
    
    # Calculate by method
    by_method = {}
    for p in payments:
        method = p.get("payment_method", "unknown")
        if method not in by_method:
            by_method[method] = {"count": 0, "total": 0}
        by_method[method]["count"] += 1
        by_method[method]["total"] += p.get("amount", 0)
    
    # Calculate by month
    by_month = {}
    for p in payments:
        date_str = p.get("payment_date", "")
        if date_str:
            month = date_str[:7]  # YYYY-MM
            if month not in by_month:
                by_month[month] = {"count": 0, "total": 0}
            by_month[month]["count"] += 1
            by_month[month]["total"] += p.get("amount", 0)
    
    # Total unpaid
    unpaid_count = await db.subscription_payments.count_documents({"is_paid": False})
    subscriptions_without_payment = await db.subscriptions.count_documents({
        "id": {"$nin": [p.get("subscription_id") for p in payments]}
    })
    
    return {
        "total_payments": len(payments),
        "total_revenue": sum(p.get("amount", 0) for p in payments),
        "by_payment_method": by_method,
        "by_month": dict(sorted(by_month.items(), reverse=True)[:12]),
        "unpaid_subscriptions": unpaid_count + subscriptions_without_payment
    }


@router.get("/history/{company_id}")
async def get_company_payment_history(
    company_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get payment history for a company"""
    await verify_admin(authorization)
    
    payments = await db.subscription_payments.find(
        {"company_id": company_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=100)
    
    return payments


# ===========================================
# Helper Functions
# ===========================================

def get_plan_price(plan: str, duration: str) -> float:
    """Get price for a plan and duration"""
    prices = {
        "basic": {"monthly": 299, "3months": 799, "6months": 1499, "yearly": 2699, "lifetime": 9999},
        "professional": {"monthly": 599, "3months": 1599, "6months": 2999, "yearly": 5399, "lifetime": 19999},
        "enterprise": {"monthly": 999, "3months": 2699, "6months": 4999, "yearly": 8999, "lifetime": 49999}
    }
    
    plan_prices = prices.get(plan, prices["basic"])
    return plan_prices.get(duration, plan_prices["monthly"])
