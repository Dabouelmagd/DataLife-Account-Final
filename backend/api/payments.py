"""
Payments API — نظام المدفوعات
يدعم: Stripe, PayPal, InstaPay, فودافون كاش, تحويل بنكي, كود تفعيل
"""

from fastapi import APIRouter, HTTPException, Header, UploadFile, File
from typing import Optional
from datetime import datetime, timezone
import secrets, os
from database import db

router = APIRouter(prefix="/api/payments", tags=["payments"])

# ═══════════════════════════════════════════
# خطط الاشتراك بالجنيه المصري
# ═══════════════════════════════════════════
# سعر الصرف التقريبي للعرض بالدولار فقط — الفاتورة دايماً بالجنيه
EGP_TO_USD_RATE = 54

# monthly base prices (EGP, VAT included). 3 months = 2.7 months' price,
# a year = 8 months' price. The single-module plans cover one module only.
_MONTHLY = {
    "starter":        (449,  "المبتدئ",           "Starter",        10),
    "professional":   (1099, "المحترف",           "Professional",   100),
    "enterprise":     (1999, "المؤسسي",           "Enterprise",     -1),
    "hr-only":        (249,  "الموارد البشرية فقط", "HR only",        -1),
    "financial-only": (299,  "المالية فقط",        "Finance only",   -1),
    "inventory-only": (229,  "المخزون فقط",        "Inventory only", -1),
}
_PERIODS = {"monthly": (1, "شهري", "Monthly"), "3months": (2.7, "3 أشهر", "3 Months"), "yearly": (8, "سنوي", "Yearly")}


def _build_plans():
    out = {}
    for plan, (m, ar, en, emp) in _MONTHLY.items():
        for d, (f, dar, den) in _PERIODS.items():
            egp = int(round(m * f))
            out[f"{plan}_{d}"] = {"plan": plan, "duration": d, "price_egp": egp,
                                  "price_usd": int(round(egp / EGP_TO_USD_RATE)), "employees": emp,
                                  "name_ar": f"{ar} — {dar}", "name_en": f"{en} — {den}"}
    out["enterprise_lifetime"] = {"plan": "enterprise", "duration": "lifetime", "price_egp": 1999 * 30,
                                  "price_usd": int(round(1999 * 30 / EGP_TO_USD_RATE)), "employees": -1,
                                  "name_ar": "المؤسسي — مدى الحياة", "name_en": "Enterprise — Lifetime"}
    return out


PLANS = _build_plans()

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
async def get_packages(country: str = "EG"):
    """الخطط المتاحة للاشتراك — بالجنيه المصري لمصر، بالدولار لخارج مصر"""
    is_egypt = country.upper() == "EG"
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
            # Currency for display
            "display_currency": "EGP" if is_egypt else "USD",
            "display_price": pkg["price_egp"] if is_egypt else pkg["price_usd"],
            "egp_to_usd_rate": EGP_TO_USD_RATE,
        })
    return result


@router.get("/catalog")
async def pricing_catalog():
    """الباقات والمجالات والمدد بأسعار السيرفر — صفحة الأسعار تعرض منها."""
    from services.pricing import catalog
    return catalog()


@router.post("/quote")
async def pricing_quote(data: dict):
    """الإجمالي والفاتورة المبدئية: باقة أساسية + مجالات + مدة + تجديد تلقائي."""
    from services.pricing import quote
    try:
        return quote((data or {}).get("plan") or "", (data or {}).get("duration") or "monthly",
                     (data or {}).get("packs") or [], bool((data or {}).get("auto_renew")))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e) or "الباقة غير متاحة")


@router.get("/payment-methods")
async def get_payment_methods():
    """طرق الدفع المتاحة"""
    return {
        "methods": [
            {"id": "activation_code", "name_ar": "كود تفعيل",      "name_en": "Activation Code",  "icon": "🔑", "available": True},
            {"id": "instapay",        "name_ar": "InstaPay",        "name_en": "InstaPay",         "icon": "📱", "available": True, "details": "00201006008552"},
            {"id": "vodafone_cash",   "name_ar": "فودافون كاش",    "name_en": "Vodafone Cash",    "icon": "📲", "available": True, "details": "00201012625529"},
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


@router.post("/upload-receipt")
async def upload_receipt(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None)
):
    """Upload a payment receipt so the admin can verify the transfer."""
    from services.auth_service import verify_token
    user = verify_token((authorization or '').replace('Bearer ', ''))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    allowed = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf"}
    ext = allowed.get(file.content_type)
    if not ext:
        raise HTTPException(status_code=400, detail="Receipt must be JPG, PNG, WEBP or PDF")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Receipt must be under 5 MB")

    folder = "/app/uploads/receipts"
    os.makedirs(folder, exist_ok=True)
    name = f"{user.get('company_id', 'x')}_{secrets.token_hex(8)}{ext}"
    with open(os.path.join(folder, name), "wb") as fh:
        fh.write(content)

    return {"url": f"/api/uploads/receipts/{name}"}


@router.post("/request")
async def submit_payment_request(
    data: dict,
    authorization: Optional[str] = Header(None)
):
    """العميل يرسل طلب دفع لتأكيده يدوياً من السوبر ادمن"""
    from services.auth_service import verify_token
    user = verify_token((authorization or '').replace('Bearer ',''))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    company_id = user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="Account is not linked to a company")

    # the JWT carries no company_name — look it up so the admin can tell who paid
    company = await db.companies.find_one({"id": company_id}, {"_id": 0, "name": 1}) or {}

    # the amount due is the server's quote — it used to be whatever the browser sent
    from services.pricing import quote as _quote
    method = data.get("payment_method")
    if method in ("card", "stripe", "paypal", "fawry"):
        raise HTTPException(status_code=400, detail=(
            "الدفع بالكارت قريباً — ادفع بإنستاباي أو فودافون كاش أو تحويل بنكي وارفع الإيصال"))
    duration = {"annual": "yearly", "year": "yearly", "quarterly": "3months"}.get(
        data.get("duration"), data.get("duration") or "monthly")
    try:
        q = _quote(data.get("plan") or "", duration, data.get("packs") or [], bool(data.get("auto_renew")))
    except (ValueError, KeyError) as e:
        raise HTTPException(status_code=400, detail=str(e) or "الباقة غير متاحة")

    request = {
        "id": f"preq_{secrets.token_hex(8)}",
        "company_id": company_id,
        "company_name": company.get("name", ""),
        "user_email": user.get("email"),
        "package_id": f"{q['plan']}_{q['duration']}",
        "plan": q["plan"],
        "duration": q["duration"],
        "packs": q["packs"],
        "auto_renew": q["auto_renew"],
        "quote": q,
        "amount_egp": q["total"],
        "payment_method": data.get("payment_method"),
        "reference_number": data.get("reference_number", ""),
        "receipt_url": data.get("receipt_url", ""),
        "notes": data.get("notes", ""),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_requests.insert_one(request)
    request.pop("_id", None)
    return {"message": "تم إرسال طلب الدفع — سيتم تأكيده خلال 24 ساعة", "request_id": request["id"],
            "amount_egp": q["total"], "quote": q}


@router.post("/requests/{request_id}/pay")
async def pay_request(request_id: str, data: dict, authorization: Optional[str] = Header(None)):
    """العميل يسجّل دفع فاتورة قائمة (مثل فاتورة التجديد) — رقم العملية والإيصال."""
    from services.auth_service import verify_token
    user = verify_token((authorization or '').replace('Bearer ', ''))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    req = await db.payment_requests.find_one(
        {"id": request_id, "company_id": user.get("company_id")}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    if req.get("status") not in ("awaiting_payment", "pending"):
        raise HTTPException(status_code=400, detail="الفاتورة دي اتراجعت بالفعل")
    method = (data or {}).get("payment_method")
    if method not in ("instapay", "vodafone_cash", "bank_transfer"):
        raise HTTPException(status_code=400, detail="اختار إنستاباي أو فودافون كاش أو تحويل بنكي — الكارت قريباً")
    ref = str((data or {}).get("reference_number") or "").strip()[:80]
    if not ref:
        raise HTTPException(status_code=400, detail="اكتب رقم العملية")
    await db.payment_requests.update_one({"id": request_id}, {"$set": {
        "payment_method": method, "reference_number": ref,
        "receipt_url": str((data or {}).get("receipt_url") or "")[:300],
        "status": "pending", "paid_reported_at": datetime.now(timezone.utc).isoformat(),
        "user_email": user.get("email")}})
    return {"message": "تم تسجيل الدفع — هيتأكد خلال 24 ساعة"}


@router.get("/my-transactions")
async def get_my_transactions(authorization: Optional[str] = Header(None)):
    """معاملات الشركة الحالية"""
    from services.auth_service import verify_token
    user = verify_token((authorization or '').replace('Bearer ',''))
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    company_id = user.get("company_id")

    transactions = await db.subscription_payments.find(
        {"company_id": company_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=50)

    requests = await db.payment_requests.find(
        {"company_id": company_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=50)

    return {"transactions": transactions, "requests": requests}
