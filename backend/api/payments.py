"""
Payments API — نظام المدفوعات
يدعم: Stripe, PayPal, InstaPay, فودافون كاش, تحويل بنكي, كود تفعيل
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from datetime import datetime, timezone
import secrets, os
from database import db

router = APIRouter(prefix="/api/payments", tags=["payments"])

# ═══════════════════════════════════════════
# خطط الاشتراك بالجنيه المصري
# ═══════════════════════════════════════════
PLANS = {
    "starter_monthly":      {"plan": "starter",      "duration": "monthly",  "price_egp": 299,   "price_usd": 6,   "employees": 10,  "name_ar": "المبتدئ — شهري",       "name_en": "Starter — Monthly"},
    "starter_3months":      {"plan": "starter",      "duration": "3months",  "price_egp": 797,   "price_usd": 16,  "employees": 10,  "name_ar": "المبتدئ — 3 أشهر",      "name_en": "Starter — 3 Months"},
    "starter_yearly":       {"plan": "starter",      "duration": "yearly",   "price_egp": 2390,  "price_usd": 48,  "employees": 10,  "name_ar": "المبتدئ — سنوي",        "name_en": "Starter — Yearly"},
    "professional_monthly": {"plan": "professional", "duration": "monthly",  "price_egp": 799,   "price_usd": 16,  "employees": 100, "name_ar": "المحترف — شهري",        "name_en": "Professional — Monthly"},
    "professional_3months": {"plan": "professional", "duration": "3months",  "price_egp": 2157,  "price_usd": 43,  "employees": 100, "name_ar": "المحترف — 3 أشهر",      "name_en": "Professional — 3 Months"},
    "professional_yearly":  {"plan": "professional", "duration": "yearly",   "price_egp": 6392,  "price_usd": 128, "employees": 100, "name_ar": "المحترف — سنوي",        "name_en": "Professional — Yearly"},
    "enterprise_monthly":   {"plan": "enterprise",   "duration": "monthly",  "price_egp": 1499,  "price_usd": 30,  "employees": -1,  "name_ar": "المؤسسي — شهري",        "name_en": "Enterprise — Monthly"},
    "enterprise_3months":   {"plan": "enterprise",   "duration": "3months",  "price_egp": 4047,  "price_usd": 81,  "employees": -1,  "name_ar": "المؤسسي — 3 أشهر",      "name_en": "Enterprise — 3 Months"},
    "enterprise_yearly":    {"plan": "enterprise",   "duration": "yearly",   "price_egp": 11992, "price_usd": 240, "employees": -1,  "name_ar": "المؤسسي — سنوي",        "name_en": "Enterprise — Yearly"},
    "enterprise_lifetime":  {"plan": "enterprise",   "duration": "lifetime", "price_egp": 49999, "price_usd": 999, "employees": -1,  "name_ar": "المؤسسي — مدى الحياة",  "name_en": "Enterprise — Lifetime"},
}

PLAN_FEATURES = {
    "starter": {
        "features_ar": ["1-10 موظفين", "HR أساسي", "كشف مرتبات", "فواتير", "محاسبة 108 حساب", "تقارير أساسية"],
        "features_en": ["1-10 employees", "Basic HR", "Payroll", "Invoices", "108 accounts", "Basic reports"],
    },
    "professional": {
        "features_ar": ["11-100 موظف", "كل مميزات المبتدئ", "حضور GPS", "قسيمة راتب بريد", "فاتورة إلكترونية ETA", "مخزون", "بنوك", "موافقات", "مشاريع", "تحليلات متقدمة"],
        "features_en": ["11-100 employees", "All Starter features", "GPS attendance", "Email payslips", "ETA e-invoice", "Inventory", "Banks", "Approvals", "Projects", "Advanced analytics"],
    },
    "enterprise": {
        "features_ar": ["موظفون غير محدودون", "كل المميزات", "مستخلصات مقاولات", "قطاع طبي", "فروع متعددة", "مراكز تكلفة", "متعدد العملات", "مدير حساب", "دعم 24/7"],
        "features_en": ["Unlimited employees", "All features", "Progress claims", "Medical sector", "Multi-branch", "Cost centers", "Multi-currency", "Account manager", "24/7 support"],
    },
}


@router.get("/packages")
async def get_packages():
    """الخطط المتاحة للاشتراك"""
    result = []
    for pkg_id, pkg in PLANS.items():
        plan = pkg["plan"]
        result.append({
            "id": pkg_id,
            "plan": plan,
            "duration": pkg["duration"],
            "name_ar": pkg["name_ar"],
            "name_en": pkg["name_en"],
            "price_egp": pkg["price_egp"],
            "price_usd": pkg["price_usd"],
            "employees": pkg["employees"],
            "features_ar": PLAN_FEATURES[plan]["features_ar"],
            "features_en": PLAN_FEATURES[plan]["features_en"],
            "is_popular": plan == "professional" and pkg["duration"] == "monthly",
            "is_best_value": plan == "professional" and pkg["duration"] == "yearly",
            "discount_pct": 20 if pkg["duration"] == "yearly" else (10 if pkg["duration"] == "3months" else 0),
        })
    return result


@router.get("/payment-methods")
async def get_payment_methods():
    """طرق الدفع المتاحة"""
    return {
        "methods": [
            {"id": "activation_code", "name_ar": "كود تفعيل",      "name_en": "Activation Code",  "icon": "🔑", "available": True},
            {"id": "instapay",        "name_ar": "InstaPay",        "name_en": "InstaPay",         "icon": "📱", "available": True, "details": "00201006008552"},
            {"id": "vodafone_cash",   "name_ar": "Vodafون Cash",    "name_en": "Vodafone Cash",    "icon": "📲", "available": True, "details": "00201012625529"},
            {"id": "bank_transfer",   "name_ar": "تحويل بنكي",      "name_en": "Bank Transfer",    "icon": "🏦", "available": True},
            {"id": "stripe",          "name_ar": "بطاقة ائتمان",    "name_en": "Credit Card",      "icon": "💳", "available": False, "coming_soon": True},
            {"id": "paypal",          "name_ar": "PayPal",          "name_en": "PayPal",           "icon": "🅿️", "available": False, "coming_soon": True},
        ]
    }


@router.post("/create-checkout")
async def create_checkout(data: dict):
    """Stripe — قريباً"""
    raise HTTPException(status_code=503, detail={
        "message_ar": "بطاقة الائتمان قريباً — استخدم InstaPay أو فودافون كاش أو كود التفعيل",
        "message_en": "Credit card coming soon — use InstaPay, Vodafone Cash, or Activation Code"
    })


@router.post("/paypal/create-checkout")
async def paypal_checkout(data: dict):
    """PayPal — قريباً"""
    raise HTTPException(status_code=503, detail={
        "message_ar": "PayPal قريباً",
        "message_en": "PayPal coming soon"
    })


@router.post("/request")
async def submit_payment_request(
    data: dict,
    authorization: Optional[str] = Header(None)
):
    """العميل يرسل طلب دفع لتأكيده يدوياً من السوبر ادمن"""
    from services.auth_service import verify_token
    user = await verify_token(authorization)
    company_id = user.get("company_id")

    request = {
        "id": f"preq_{secrets.token_hex(8)}",
        "company_id": company_id,
        "company_name": user.get("company_name", ""),
        "user_email": user.get("email"),
        "package_id": data.get("package_id"),
        "plan": data.get("plan"),
        "duration": data.get("duration"),
        "amount_egp": data.get("amount_egp"),
        "payment_method": data.get("payment_method"),
        "reference_number": data.get("reference_number", ""),
        "notes": data.get("notes", ""),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_requests.insert_one(request)
    request.pop("_id", None)
    return {"message": "تم إرسال طلب الدفع — سيتم تأكيده خلال 24 ساعة", "request_id": request["id"]}


@router.get("/my-transactions")
async def get_my_transactions(authorization: Optional[str] = Header(None)):
    """معاملات الشركة الحالية"""
    from services.auth_service import verify_token
    user = await verify_token(authorization)
    company_id = user.get("company_id")

    transactions = await db.subscription_payments.find(
        {"company_id": company_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=50)

    requests = await db.payment_requests.find(
        {"company_id": company_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=50)

    return {"transactions": transactions, "requests": requests}
