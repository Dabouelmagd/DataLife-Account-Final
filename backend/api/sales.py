"""
Sales Management API — نظام المبيعات الشامل
عروض أسعار | فواتير مبيعات | CRM | الاشتراكات | العملاء
"""

from fastapi import APIRouter, HTTPException, Header, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
from services.audit_helper import log_financial_action

from database import db
from services.party_store import party_query, normalise, add_type
from models.invoice import Invoice, InvoiceLine, DocumentType
import os

router = APIRouter(prefix="/api/sales", tags=["sales"])


# ══════════════════════════════════════════
# Auth Helper
# ══════════════════════════════════════════
async def get_user(authorization: str):
    from services.auth_service import verify_token
    return verify_token((authorization or '').replace('Bearer ',''))


def gen_id(prefix=""):
    return f"{prefix}{str(uuid.uuid4()).replace('-','')[:12].upper()}"


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ══════════════════════════════════════════
# CUSTOMERS (CRM)
# ══════════════════════════════════════════

@router.get("/customers")
async def list_customers(
    search: str = "", status: str = "", type: str = "",
    page: int = 1, limit: int = 20,
    authorization: Optional[str] = Header(None)
):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    q = {"company_id": company_id}
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"code": {"$regex": search, "$options": "i"}},
        ]
    if status: q["status"] = status
    if type:   q["type"] = type

    total = await db.parties.count_documents({**q, **party_query(company_id, "customer")})
    skip  = (page - 1) * limit
    customers = await db.parties.find({**q, **party_query(company_id, "customer")}, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)

    # Aggregate totals per customer
    for c in customers:
        inv_agg = await db.invoices.find_one(
            {**sales_query(company_id), "party_id": c["id"]}, {"_id": 0, "id": 1})
        c["has_invoices"] = inv_agg is not None

    return {"customers": customers, "total": total, "page": page, "pages": -(-total // limit)}


@router.post("/customers")
async def create_customer(data: dict, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")

    # Auto-generate customer code
    count = await db.parties.count_documents(party_query(company_id, "customer"))
    code = f"CUS-{count + 1:04d}"

    customer = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "code": data.get("code", code),
        "name": data.get("name", ""),
        "name_en": data.get("name_en", ""),
        "type": data.get("type", "individual"),   # individual | company | government
        "status": data.get("status", "active"),   # active | inactive | blocked
        "phone": data.get("phone", ""),
        "phone2": data.get("phone2", ""),
        "email": data.get("email", ""),
        "address": data.get("address", ""),
        "city": data.get("city", ""),
        "country": data.get("country", "مصر"),
        "tax_number": data.get("tax_number", ""),
        "commercial_reg": data.get("commercial_reg", ""),
        "credit_limit": data.get("credit_limit", 0),
        "payment_terms": data.get("payment_terms", 30),  # days
        "discount_percent": data.get("discount_percent", 0),
        "price_list": data.get("price_list", "default"),
        "sales_rep": data.get("sales_rep", ""),
        "notes": data.get("notes", ""),
        "tags": data.get("tags", []),
        # CRM fields
        "source": data.get("source", ""),         # website | referral | cold_call | ...
        "stage": data.get("stage", "customer"),   # lead | prospect | customer | vip
        "total_purchases": 0,
        "total_paid": 0,
        "balance": 0,
        "last_purchase_date": None,
        "created_by": user.get("user_id"),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.parties.insert_one(normalise(add_type(customer, "customer")))
    customer.pop("_id", None)
    return {"message": "تم إضافة العميل بنجاح", "customer": customer}


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    customer = await db.parties.find_one({"id": customer_id, **party_query(company_id, "customer")}, {"_id": 0})
    if not customer: raise HTTPException(404, "Customer not found")

    # Get invoices
    invoices = [as_sales_invoice(r) for r in await db.invoices.find(
        {**sales_query(company_id), "party_id": customer_id},
        {"_id": 0, "document_number": 1, "document_date": 1, "grand_total": 1,
         "settle_amount": 1, "amount_paid": 1, "status": 1, "party_id": 1, "party_name": 1}
    ).sort("document_date", -1).limit(10).to_list(length=10)]

    # Get quotes
    quotes = await db.sales_quotations.find(
        {"company_id": company_id, "customer_id": customer_id},
        {"_id": 0, "quote_number": 1, "date": 1, "total": 1, "status": 1}
    ).sort("date", -1).limit(5).to_list(length=5)

    return {**customer, "recent_invoices": invoices, "recent_quotes": quotes}


@router.put("/customers/{customer_id}")
async def update_customer(customer_id: str, data: dict, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    allowed = ["name","name_en","type","status","phone","phone2","email","address","city",
               "country","tax_number","commercial_reg","credit_limit","payment_terms",
               "discount_percent","price_list","sales_rep","notes","tags","source","stage"]
    update = {k: v for k, v in data.items() if k in allowed}
    update["updated_at"] = now_iso()
    await db.parties.update_one({"id": customer_id, **party_query(company_id, "customer")}, {"$set": normalise(update, "customer")})
    return {"message": "تم تحديث العميل"}


@router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    # Check no invoices
    inv_count = await db.invoices.count_documents({**sales_query(company_id), "party_id": customer_id})
    if inv_count > 0:
        raise HTTPException(400, "لا يمكن حذف عميل لديه فواتير")
    await db.parties.delete_one({"id": customer_id, **party_query(company_id, "customer")})
    return {"message": "تم حذف العميل"}


@router.get("/customers/stats/summary")
async def customer_stats(authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    total = await db.parties.count_documents(party_query(company_id, "customer"))
    active = await db.parties.count_documents({**party_query(company_id, "customer"), "status": "active"})
    leads  = await db.parties.count_documents({**party_query(company_id, "customer"), "stage": "lead"})
    vip    = await db.parties.count_documents({**party_query(company_id, "customer"), "stage": "vip"})
    return {"total": total, "active": active, "leads": leads, "vip": vip}


# ══════════════════════════════════════════
# QUOTATIONS — عروض الأسعار
# ══════════════════════════════════════════

@router.get("/quotations")
async def list_quotations(
    search: str = "", status: str = "", customer_id: str = "",
    page: int = 1, limit: int = 20,
    authorization: Optional[str] = Header(None)
):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    q = {"company_id": company_id}
    if search: q["$or"] = [
        {"quote_number": {"$regex": search, "$options": "i"}},
        {"customer_name": {"$regex": search, "$options": "i"}},
    ]
    if status:      q["status"] = status
    if customer_id: q["customer_id"] = customer_id

    total = await db.sales_quotations.count_documents(q)
    skip  = (page - 1) * limit
    quotes = await db.sales_quotations.find(q, {"_id": 0}).skip(skip).limit(limit).sort("date", -1).to_list(length=limit)
    return {"quotations": quotes, "total": total, "page": page}


@router.post("/quotations")
async def create_quotation(data: dict, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")

    count = await db.sales_quotations.count_documents({"company_id": company_id})
    quote_number = data.get("quote_number", f"QUO-{datetime.now().year}-{count+1:04d}")

    # Calculate totals
    items = data.get("items", [])
    subtotal = sum(i.get("quantity", 0) * i.get("unit_price", 0) for i in items)
    discount_amount = data.get("discount_amount", 0)
    discount_percent = data.get("discount_percent", 0)
    if discount_percent: discount_amount = subtotal * discount_percent / 100
    after_discount = subtotal - discount_amount
    vat_percent = data.get("vat_percent", 14)
    vat_amount = after_discount * vat_percent / 100
    total = after_discount + vat_amount

    # Expiry
    validity_days = data.get("validity_days", 30)
    date_str = data.get("date", datetime.now().strftime("%Y-%m-%d"))
    expiry_date = (datetime.fromisoformat(date_str) + timedelta(days=validity_days)).strftime("%Y-%m-%d")

    quotation = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "quote_number": quote_number,
        "date": date_str,
        "expiry_date": expiry_date,
        "validity_days": validity_days,
        "customer_id": data.get("customer_id", ""),
        "customer_name": data.get("customer_name", ""),
        "customer_tax_number": data.get("customer_tax_number", ""),
        "customer_address": data.get("customer_address", ""),
        "items": items,
        "subtotal": round(subtotal, 2),
        "discount_percent": discount_percent,
        "discount_amount": round(discount_amount, 2),
        "after_discount": round(after_discount, 2),
        "vat_percent": vat_percent,
        "vat_amount": round(vat_amount, 2),
        "total": round(total, 2),
        "currency": data.get("currency", "EGP"),
        "status": "draft",          # draft | sent | accepted | rejected | expired | converted
        "notes": data.get("notes", ""),
        "terms": data.get("terms", ""),
        "sales_rep": data.get("sales_rep", user.get("full_name", "")),
        "converted_invoice": None,
        "created_by": user.get("user_id"),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    await db.sales_quotations.insert_one(quotation)
    quotation.pop("_id", None)
    return {"message": "تم إنشاء عرض السعر", "quotation": quotation}


@router.get("/quotations/{quote_id}")
async def get_quotation(quote_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    q = await db.sales_quotations.find_one(
        {"$or": [{"id": quote_id}, {"quote_number": quote_id}], "company_id": company_id},
        {"_id": 0}
    )
    if not q: raise HTTPException(404, "Quotation not found")
    return q


@router.put("/quotations/{quote_id}")
async def update_quotation(quote_id: str, data: dict, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    allowed = ["status","items","notes","terms","discount_amount","discount_percent","vat_percent",
               "validity_days","expiry_date","customer_name","customer_address","customer_tax_number"]
    update = {k: v for k, v in data.items() if k in allowed}
    # Recalculate if items changed
    if "items" in update or "discount_percent" in update:
        q = await db.sales_quotations.find_one({"id": quote_id, "company_id": company_id})
        if q:
            items = update.get("items", q.get("items", []))
            subtotal = sum(i.get("quantity", 0) * i.get("unit_price", 0) for i in items)
            dp = update.get("discount_percent", q.get("discount_percent", 0))
            da = subtotal * dp / 100
            ad = subtotal - da
            vp = update.get("vat_percent", q.get("vat_percent", 14))
            va = ad * vp / 100
            update.update({"subtotal": round(subtotal,2), "discount_amount": round(da,2),
                           "after_discount": round(ad,2), "vat_amount": round(va,2),
                           "total": round(ad+va,2)})
    update["updated_at"] = now_iso()
    await db.sales_quotations.update_one({"id": quote_id, "company_id": company_id}, {"$set": update})
    return {"message": "تم تحديث عرض السعر"}


@router.post("/quotations/{quote_id}/convert")
async def convert_quotation_to_invoice(quote_id: str, authorization: Optional[str] = Header(None)):
    """تحويل عرض سعر إلى فاتورة — through the same shared path as any sales invoice."""
    user = await get_user(authorization)
    company_id = user.get("company_id")
    q = await db.sales_quotations.find_one({"id": quote_id, "company_id": company_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "عرض السعر غير موجود")
    if q.get("converted_invoice_id"):
        raise HTTPException(400, "تم تحويل هذا العرض من قبل")

    created = await create_sales_invoice({
        "customer_id": q.get("customer_id"), "items": q.get("items", []),
        "discount_percent": q.get("discount_percent", 0), "vat_percent": q.get("vat_percent", 14),
        "notes": q.get("notes"), "date": datetime.now().strftime("%Y-%m-%d"),
    }, authorization)
    invoice = created["invoice"]
    await db.sales_quotations.update_one({"id": quote_id, "company_id": company_id},
                                         {"$set": {"status": "converted", "converted_invoice_id": invoice["id"],
                                                   "converted_at": now_iso()}})
    return {"message": f"تم تحويل العرض إلى الفاتورة {invoice['document_number']}", "invoice": invoice}

@router.delete("/quotations/{quote_id}")
async def delete_quotation(quote_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    await db.sales_quotations.delete_one({"id": quote_id, "company_id": company_id, "status": "draft"})
    return {"message": "تم حذف عرض السعر"}


# ══════════════════════════════════════════
# SALES INVOICES — فواتير المبيعات
# ══════════════════════════════════════════


# ══════════════════════════════════════════
# SALES INVOICES LIVE IN THE SHARED `invoices` STORE
# ══════════════════════════════════════════
# They used to be their own collection, invisible to e-invoicing (mandatory
# for B2B sales in Egypt), to credit notes and to the shared party store.
# Storage is unified; these helpers translate to the field names the Sales
# screen already uses, so the UI is unchanged.

SALES_DOC = {"document_type": DocumentType.SALES_INVOICE.value}
# the Sales screen's payment words -> the shared model's values
PAYMENT_METHODS = {"bank": "bank_transfer", "transfer": "bank_transfer", "bank_transfer": "bank_transfer",
                   "cheque": "check", "check": "check", "card": "credit_card", "credit_card": "credit_card",
                   "wallet": "mobile_wallet", "mobile_wallet": "mobile_wallet", "instapay": "mobile_wallet",
                   "vodafone_cash": "mobile_wallet", "cash": "cash"}
LIVE_STATUSES = ["approved", "partially_paid", "paid"]


def sales_query(company_id: str, **extra) -> dict:
    return {"company_id": company_id, **SALES_DOC, **extra}


def as_sales_invoice(inv: dict) -> dict:
    """Shared invoice document -> the shape the Sales screen reads."""
    if not inv:
        return inv
    base = float(inv.get("settle_amount") or inv.get("grand_total") or 0)
    paid = float(inv.get("amount_paid") or 0)
    status = inv.get("status", "")
    return {**inv,
            "invoice_number": inv.get("document_number"),
            "date": inv.get("document_date"),
            "customer_id": inv.get("party_id"),
            "customer_name": inv.get("party_name"),
            "customer_tax_number": inv.get("party_tax_id"),
            "items": inv.get("lines", []),
            "subtotal": inv.get("subtotal", 0),
            "vat_amount": inv.get("total_tax", 0),
            "total": round(base, 2),
            "paid_amount": round(paid, 2),
            "balance": round(base - paid, 2),
            "payment_status": ("paid" if status == "paid" else
                               "partial" if status == "partially_paid" else "unpaid")}

@router.get("/invoices")
async def list_sales_invoices(
    search: str = "", status: str = "", payment_status: str = "",
    customer_id: str = "", date_from: str = "", date_to: str = "",
    page: int = 1, limit: int = 20,
    authorization: Optional[str] = Header(None)
):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    q = sales_query(company_id)
    if search: q["$or"] = [
        {"document_number": {"$regex": search, "$options": "i"}},
        {"party_name":      {"$regex": search, "$options": "i"}},
    ]
    if status:         q["status"] = status
    if payment_status: q["status"] = {"paid": "paid", "partial": "partially_paid",
                                      "unpaid": {"$in": ["approved", "draft"]}}.get(payment_status, status or None) or q.get("status")
    if customer_id:    q["party_id"] = customer_id
    if date_from:      q["document_date"] = {"$gte": date_from}
    if date_to:        q.setdefault("document_date", {})["$lte"] = date_to

    total = await db.invoices.count_documents(q)
    skip  = (page - 1) * limit
    rows = await db.invoices.find(q, {"_id": 0, "lines": 0}).skip(skip).limit(limit).sort("document_date", -1).to_list(length=limit)
    return {"invoices": [as_sales_invoice(r) for r in rows], "total": total, "page": page}


@router.post("/invoices")
async def create_sales_invoice(data: dict, authorization: Optional[str] = Header(None)):
    """إنشاء فاتورة مبيعات.

    Sales invoices are documents in the shared `invoices` store, not a
    collection of their own. They used to live in sales_invoices, which the
    e-invoicing module never reads — so no sales invoice could be submitted to
    the ETA, although that is mandatory for B2B sales in Egypt. Credit notes,
    the party store and the customer statement are on the same store too.

    The request shape is unchanged: the Sales screen keeps sending items,
    discount and VAT as before.
    """
    user = await get_user(authorization)
    company_id = user.get("company_id")
    customer_id = (data.get("customer_id") or "").strip()
    items = data.get("items") or []
    if not customer_id or not items:
        raise HTTPException(400, "العميل والأصناف مطلوبة")

    customer = await db.parties.find_one({"id": customer_id, **party_query(company_id, "customer")}, {"_id": 0})
    if not customer:
        raise HTTPException(404, "العميل غير موجود")

    date_str = data.get("date") or datetime.now().strftime("%Y-%m-%d")
    terms_days = int(data.get("payment_terms", 30) or 0)
    due_date = data.get("due_date") or (datetime.fromisoformat(date_str) + timedelta(days=terms_days)).strftime("%Y-%m-%d")
    vat_percent = float(data.get("vat_percent", 14) or 0)
    discount_percent = float(data.get("discount_percent", 0) or 0)

    lines = []
    for n, it in enumerate(items, 1):
        qty = float(it.get("quantity", 1) or 0)
        price = float(it.get("unit_price", 0) or 0)
        if qty <= 0 or price < 0:
            raise HTTPException(400, f"كمية أو سعر غير صحيح في السطر {n}")
        lines.append(InvoiceLine(
            line_number=n, product_id=it.get("product_id"), product_code=it.get("product_code"),
            description=(it.get("description") or it.get("name") or "صنف")[:300],
            unit=it.get("unit", "unit"), quantity=qty, unit_price=price,
            discount_percent=float(it.get("discount_percent", discount_percent) or 0),
            tax_rate=float(it.get("vat_percent", vat_percent) or 0)))

    invoice = Invoice(
        company_id=company_id, document_type=DocumentType.SALES_INVOICE,
        document_number=data.get("invoice_number") or "",       # the service numbers it
        document_date=date_str, due_date=due_date,
        party_id=customer_id, party_name=customer.get("name", ""),
        party_tax_id=customer.get("tax_number") or customer.get("tax_id"),
        party_address=customer.get("address"),
        lines=lines, notes=data.get("notes"), created_by=user.get("user_id"))

    from services.invoice_service import InvoiceService
    company = await db.companies.find_one({"id": company_id}, {"_id": 0, "name": 1}) or {}
    created = await InvoiceService(db).create_invoice(invoice, company.get("name", ""))
    return {"message": f"تم إنشاء الفاتورة {created['document_number']}", "invoice": created}

@router.get("/invoices/{invoice_id}")
async def get_sales_invoice(invoice_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    inv = await _find_sales_invoice(company_id, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    payments = await db.payments.find({"invoice_id": inv["id"], "company_id": company_id},
                                      {"_id": 0}).sort("payment_date", 1).to_list(100)
    return {**as_sales_invoice(inv), "payments": payments}


async def _find_sales_invoice(company_id: str, invoice_id: str):
    return await db.invoices.find_one(
        {"$or": [{"id": invoice_id}, {"document_number": invoice_id}], **sales_query(company_id)}, {"_id": 0})


@router.put("/invoices/{invoice_id}")
async def update_sales_invoice(invoice_id: str, data: dict, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    inv = await _find_sales_invoice(company_id, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    # amounts of an approved (posted) invoice are fixed — correct with a credit note
    money = {"items", "lines", "subtotal", "discount_percent", "discount_amount",
             "vat_percent", "vat_amount", "total", "grand_total"}
    if inv.get("journal_entry_id") and money & set(data or {}):
        raise HTTPException(400, "لا يمكن تعديل مبالغ فاتورة مُرحّلة — أصدر إشعاراً دائناً")
    allowed = {"notes", "terms", "due_date", "reference"}
    update = {k: v for k, v in (data or {}).items() if k in allowed}
    if not update:
        raise HTTPException(400, "لا توجد حقول قابلة للتعديل")
    update["updated_at"] = now_iso()
    await db.invoices.update_one({"id": inv["id"], "company_id": company_id}, {"$set": update})
    return {"message": "تم تحديث الفاتورة"}


@router.post("/invoices/{invoice_id}/approve")
async def approve_sales_invoice(invoice_id: str, authorization: Optional[str] = Header(None)):
    """اعتماد الفاتورة وترحيلها — the shared service posts the entry."""
    user = await get_user(authorization)
    company_id = user.get("company_id")
    inv = await _find_sales_invoice(company_id, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    from services.invoice_service import InvoiceService
    try:
        result = await InvoiceService(db).approve_invoice(inv["id"], user.get("user_id"))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"message": "تم اعتماد الفاتورة وترحيلها", "invoice": as_sales_invoice(result or inv)}


@router.post("/invoices/{invoice_id}/payment")
async def record_payment(invoice_id: str, data: dict, authorization: Optional[str] = Header(None)):
    """تسجيل تحصيل على فاتورة — through the shared service: one posting path."""
    user = await get_user(authorization)
    company_id = user.get("company_id")
    inv = await _find_sales_invoice(company_id, invoice_id)
    if not inv:
        raise HTTPException(404, "Invoice not found")
    amount = float(data.get("amount", 0) or 0)
    if amount <= 0:
        raise HTTPException(400, "المبلغ يجب أن يكون أكبر من صفر")
    from services.invoice_service import InvoiceService
    from models.invoice import Payment
    try:
        await InvoiceService(db).record_payment(Payment(
            company_id=company_id, invoice_id=inv["id"], amount=amount,
            payment_date=data.get("date") or datetime.now().strftime("%Y-%m-%d"),
            payment_method=PAYMENT_METHODS.get(str(data.get("method", "cash")).strip().lower(), "cash"),
            reference=data.get("reference", ""),
            notes=data.get("notes", ""), created_by=user.get("user_id")), user.get("user_id"))
    except ValueError as e:
        raise HTTPException(400, str(e))
    updated = await _find_sales_invoice(company_id, inv["id"]) or inv
    out = as_sales_invoice(updated)
    return {"message": "تم تسجيل التحصيل", "paid_amount": out["paid_amount"],
            "balance": out["balance"], "payment_status": out["payment_status"]}


async def _customer_movements(company_id: str, customer_id: str):
    """What the ledger put on 131 for this customer, from the shared store:
       + each approved sales invoice (net of withholding)
       - each recorded payment
       - each incoming cheque on receipt, + the same cheque again if it bounced
    """
    rows = []
    invs = await db.invoices.find(
        {**sales_query(company_id), "party_id": customer_id,
         "status": {"$in": LIVE_STATUSES + ["credited"]}, "journal_entry_id": {"$exists": True, "$ne": None}},
        {"_id": 0}).to_list(None)
    inv_ids = [i["id"] for i in invs]
    for inv in invs:
        rows.append({"date": inv.get("document_date"), "type": "invoice",
                     "reference": inv.get("document_number"), "description": "فاتورة مبيعات",
                     "debit": round(float(inv.get("settle_amount") or inv.get("grand_total") or 0), 2),
                     "credit": 0.0, "due_date": inv.get("due_date"), "invoice_id": inv["id"]})
    async for pay in db.payments.find({"company_id": company_id, "invoice_id": {"$in": inv_ids}}, {"_id": 0}):
        rows.append({"date": (pay.get("payment_date") or "")[:10], "type": "payment",
                     "reference": pay.get("reference") or "", "description": "تحصيل",
                     "debit": 0.0, "credit": round(float(pay.get("amount") or 0), 2)})
    async for chq in db.cheques.find({"company_id": company_id, "customer_id": customer_id,
                                      "direction": "incoming"}, {"_id": 0}):
        amt = round(float(chq.get("amount") or 0), 2)
        rows.append({"date": chq.get("receive_date"), "type": "cheque", "reference": chq.get("cheque_number"),
                     "description": f"شيك وارد رقم {chq.get('cheque_number', '')}", "debit": 0.0, "credit": amt})
        if chq.get("status") == "bounced":
            rows.append({"date": chq.get("bounce_date"), "type": "bounce", "reference": chq.get("cheque_number"),
                         "description": f"ارتداد الشيك رقم {chq.get('cheque_number', '')}", "debit": amt, "credit": 0.0})
    async for note in db.invoices.find(
            {"company_id": company_id, "document_type": DocumentType.CREDIT_NOTE.value,
             "party_id": customer_id, "journal_entry_id": {"$exists": True, "$ne": None}}, {"_id": 0}):
        rows.append({"date": note.get("document_date"), "type": "credit_note",
                     "reference": note.get("document_number"),
                     "description": f"إشعار دائن على الفاتورة {note.get('original_invoice_number', '')}",
                     "debit": 0.0, "credit": round(float(note.get("grand_total") or 0), 2)})
    rows.sort(key=lambda r: (r["date"] or "", {"invoice": 0, "bounce": 1}.get(r["type"], 2)))
    return rows


def _overdue(rows, today):
    """Invoice amount still open past its due date, oldest invoices settled first."""
    paid = sum(r["credit"] - (r["debit"] if r["type"] == "bounce" else 0) for r in rows)
    overdue = 0.0
    for r in (x for x in rows if x["type"] == "invoice"):
        open_amt = max(0.0, r["debit"] - max(0.0, paid))
        paid -= r["debit"]
        if open_amt > 0 and r.get("due_date") and r["due_date"] < today:
            overdue += open_amt
    return round(overdue, 2)


async def _open_sales_invoices(company_id: str, customer_id: str):
    rows = await db.invoices.find(
        {**sales_query(company_id), "party_id": customer_id, "status": {"$in": LIVE_STATUSES},
         "journal_entry_id": {"$exists": True, "$ne": None}, "amount_due": {"$gt": 0.004}},
        {"_id": 0}).sort("document_date", 1).to_list(None)
    return [{"id": r["id"], "invoice_number": r.get("document_number"), "date": r.get("document_date"),
             "due_date": r.get("due_date"), "total": round(float(r.get("settle_amount") or r.get("grand_total") or 0), 2),
             "balance": round(float(r.get("amount_due") or 0), 2)} for r in rows]

@router.get("/customers-balances")
async def customers_with_balances(authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    today = datetime.now().strftime("%Y-%m-%d")
    customers = await db.parties.find(party_query(company_id, "customer"), {"_id": 0}).sort("name", 1).to_list(length=None)
    for c in customers:
        rows = await _customer_movements(company_id, c["id"])
        c["balance"] = round(sum(r["debit"] - r["credit"] for r in rows), 2)
        c["overdue"] = _overdue(rows, today)
        c["invoice_count"] = sum(1 for r in rows if r["type"] == "invoice")
        limit = float(c.get("credit_limit") or 0)
        c["over_limit"] = bool(limit and c["balance"] > limit)
    return {"customers": customers,
            "total_receivable": round(sum(c["balance"] for c in customers), 2),
            "total_overdue": round(sum(c["overdue"] for c in customers), 2)}


@router.get("/customers/{customer_id}/statement")
async def customer_statement(customer_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    cust = await db.parties.find_one({"id": customer_id, **party_query(company_id, "customer")}, {"_id": 0})
    if not cust:
        raise HTTPException(404, "Customer not found")
    rows = await _customer_movements(company_id, customer_id)
    running = 0.0
    for r in rows:
        running = round(running + r["debit"] - r["credit"], 2)
        r["balance"] = running
    open_invoices = await _open_sales_invoices(company_id, customer_id)
    return {"customer": cust, "entries": rows, "balance": running,
            "overdue": _overdue(rows, datetime.now().strftime("%Y-%m-%d")), "open_invoices": open_invoices}


@router.post("/customers/{customer_id}/receipts")
async def receive_from_customer(customer_id: str, data: dict, authorization: Optional[str] = Header(None)):
    """Collect from a customer: the amount is applied to the oldest open
    invoices first, each part through record_payment, so every invoice's
    payment status is right and every part posts its own entry."""
    user = await get_user(authorization)
    company_id = user.get("company_id")
    cust = await db.parties.find_one({"id": customer_id, **party_query(company_id, "customer")}, {"_id": 0})
    if not cust:
        raise HTTPException(404, "Customer not found")
    amount = round(float(data.get("amount") or 0), 2)
    if amount <= 0:
        raise HTTPException(400, "المبلغ يجب أن يكون أكبر من صفر")
    open_invs = await _open_sales_invoices(company_id, customer_id)
    outstanding = round(sum(float(i.get("balance") or 0) for i in open_invs), 2)
    if amount > outstanding + 0.005:
        raise HTTPException(400, f"المبلغ ({amount:,.2f}) أكبر من المستحق على فواتير العميل ({outstanding:,.2f})")
    left, applied = amount, []
    for inv in open_invs:
        if left <= 0.004:
            break
        part = round(min(left, float(inv.get("balance") or 0)), 2)
        await record_payment(inv["id"], {"amount": part, "method": data.get("method", "bank"),
                                         "date": data.get("date") or datetime.now().strftime("%Y-%m-%d"),
                                         "reference": data.get("reference", ""), "notes": data.get("notes", "")},
                             authorization)
        applied.append({"invoice_number": inv.get("invoice_number"), "amount": part})
        left = round(left - part, 2)
    return {"applied": applied, "balance": round(outstanding - amount, 2)}

# ══════════════════════════════════════════
# SALES STATS
# ══════════════════════════════════════════

@router.get("/stats")
async def sales_stats(authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0).isoformat()

    total_invoices  = await db.invoices.count_documents(sales_query(company_id))
    total_quotes    = await db.sales_quotations.count_documents({"company_id": company_id})
    total_customers = await db.parties.count_documents(party_query(company_id, "customer"))
    unpaid          = await db.invoices.count_documents({**sales_query(company_id), "status": "approved"})
    today_str       = now.strftime("%Y-%m-%d")
    overdue         = await db.invoices.count_documents({**sales_query(company_id),
                                                         "status": {"$in": ["approved", "partially_paid"]},
                                                         "due_date": {"$lt": today_str}})

    # Monthly revenue
    month_invoices = await db.invoices.find(
        {**sales_query(company_id), "document_date": {"$gte": month_start[:7]}},
        {"_id": 0, "amount_paid": 1}
    ).to_list(length=None)
    monthly_revenue = sum(float(i.get("amount_paid") or 0) for i in month_invoices)

    # Outstanding balance
    all_invoices = await db.invoices.find(
        {**sales_query(company_id), "status": {"$in": ["approved", "partially_paid"]}},
        {"_id": 0, "amount_due": 1}
    ).to_list(length=None)
    outstanding = sum(float(i.get("amount_due") or 0) for i in all_invoices)

    # Quote conversion rate
    converted = await db.sales_quotations.count_documents({"company_id": company_id, "status": "converted"})
    conversion_rate = round(converted / total_quotes * 100, 1) if total_quotes > 0 else 0

    return {
        "total_invoices": total_invoices,
        "total_quotes": total_quotes,
        "total_customers": total_customers,
        "unpaid_invoices": unpaid,
        "overdue_invoices": overdue,
        "monthly_revenue": round(monthly_revenue, 2),
        "outstanding_balance": round(outstanding, 2),
        "quote_conversion_rate": conversion_rate,
    }


# ══════════════════════════════════════════
# SUBSCRIPTIONS — اشتراكات العملاء
# ══════════════════════════════════════════

@router.get("/subscriptions")
async def list_subscriptions(
    status: str = "", customer_id: str = "",
    page: int = 1, limit: int = 20,
    authorization: Optional[str] = Header(None)
):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    q = {"company_id": company_id}
    if status:      q["status"] = status
    if customer_id: q["customer_id"] = customer_id

    total = await db.customer_subscriptions.count_documents(q)
    skip  = (page - 1) * limit
    subs  = await db.customer_subscriptions.find(q, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)
    return {"subscriptions": subs, "total": total}


@router.post("/subscriptions")
async def create_subscription(data: dict, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")

    start_date = data.get("start_date", datetime.now().strftime("%Y-%m-%d"))
    billing_cycle = data.get("billing_cycle", "monthly")
    cycle_days = {"monthly": 30, "quarterly": 90, "semi-annual": 180, "annual": 365}.get(billing_cycle, 30)
    next_billing = (datetime.fromisoformat(start_date) + timedelta(days=cycle_days)).strftime("%Y-%m-%d")

    sub = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "customer_id": data.get("customer_id", ""),
        "customer_name": data.get("customer_name", ""),
        "service_name": data.get("service_name", ""),
        "description": data.get("description", ""),
        "billing_cycle": billing_cycle,
        "amount": data.get("amount", 0),
        "currency": data.get("currency", "EGP"),
        "start_date": start_date,
        "next_billing_date": next_billing,
        "end_date": data.get("end_date"),
        "status": "active",          # active | paused | cancelled | expired
        "auto_renew": data.get("auto_renew", True),
        "payment_method": data.get("payment_method", ""),
        "notes": data.get("notes", ""),
        "invoices_generated": 0,
        "created_by": user.get("user_id"),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    await db.customer_subscriptions.insert_one(sub)
    sub.pop("_id", None)
    return {"message": "تم إنشاء الاشتراك", "subscription": sub}


@router.patch("/subscriptions/{sub_id}")
async def update_subscription(sub_id: str, data: dict, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    allowed = ["status","amount","billing_cycle","auto_renew","next_billing_date","notes","end_date"]
    update = {k: v for k, v in data.items() if k in allowed}
    update["updated_at"] = now_iso()
    await db.customer_subscriptions.update_one({"id": sub_id, "company_id": company_id}, {"$set": update})
    return {"message": "تم تحديث الاشتراك"}


@router.post("/subscriptions/{sub_id}/generate-invoice")
async def generate_subscription_invoice(sub_id: str, authorization: Optional[str] = Header(None)):
    """توليد فاتورة من اشتراك"""
    user = await get_user(authorization)
    company_id = user.get("company_id")
    sub = await db.customer_subscriptions.find_one({"id": sub_id, "company_id": company_id})
    if not sub: raise HTTPException(404, "Subscription not found")

    # Create invoice
    amount = sub.get("amount", 0)
    vat = round(amount * 0.14, 2)
    total = round(amount + vat, 2)

    created = await create_sales_invoice({
        "customer_id": sub.get("customer_id"),
        "items": sub.get("items") or [{"description": sub.get("description") or "اشتراك",
                                       "quantity": 1, "unit_price": float(sub.get("amount", 0) or 0)}],
        "vat_percent": sub.get("vat_percent", 14), "notes": f"اشتراك: {sub.get('name', '')}",
    }, authorization)
    invoice = created["invoice"]

    # Update subscription next billing date
    cycle_days = {"monthly": 30, "quarterly": 90, "semi-annual": 180, "annual": 365}.get(sub.get("billing_cycle","monthly"), 30)
    next_billing = (datetime.now() + timedelta(days=cycle_days)).strftime("%Y-%m-%d")
    await db.customer_subscriptions.update_one(
        {"id": sub_id},
        {"$set": {"next_billing_date": next_billing, "invoices_generated": sub.get("invoices_generated",0)+1}}
    )
    return {"message": f"تم توليد الفاتورة {invoice['document_number']}", "invoice": invoice}


@router.post("/quotations/{quote_id}/send-email")
async def send_quotation_email(
    quote_id: str,
    data: dict = {},
    authorization: Optional[str] = Header(None)
):
    """Send quotation to customer by email"""
    user = await get_user(authorization)
    company_id = user.get("company_id")
    
    quote = await db.sales_quotations.find_one({"id": quote_id, "company_id": company_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    
    # Update status to sent
    await db.sales_quotations.update_one(
        {"id": quote_id},
        {"$set": {"status": "sent", "sent_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    customer_email = data.get("customer_email") or quote.get("customer_email", "")
    
    # Try to send email if configured
    try:
        import resend
        resend.api_key = os.environ.get("RESEND_API_KEY", "")
        if resend.api_key and customer_email:
            items_html = "".join([
                f"<tr><td>{i.get('description','')}</td><td>{i.get('quantity',0)}</td><td>{i.get('unit_price',0):,.2f}</td><td>{i.get('total',0):,.2f}</td></tr>"
                for i in quote.get("items", [])
            ])
            resend.Emails.send({
                "from": f"{company.get('name','DataLife')} <noreply@datalifeaccount.com>",
                "to": [customer_email],
                "subject": f"عرض سعر رقم {quote.get('quote_number','')} - {company.get('name','')}",
                "html": f"""
                <div dir="rtl" style="font-family:Arial;max-width:600px;margin:0 auto">
                <h2 style="color:#1e3a8a">عرض سعر - {company.get('name','')}</h2>
                <p>عزيزي {quote.get('customer_name','')},</p>
                <p>يسعدنا تقديم عرض السعر التالي لكم:</p>
                <table border="1" cellpadding="8" style="width:100%;border-collapse:collapse">
                <tr style="background:#1e3a8a;color:white"><th>الوصف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr>
                {items_html}
                </table>
                <p><strong>الإجمالي: {quote.get('total',0):,.2f} ج.م</strong></p>
                <p>صالح لمدة {quote.get('validity_days',30)} يوم</p>
                </div>"""
            })
    except Exception as e:
        print(f"Email send error: {e}")
    
    return {"success": True, "message": "تم إرسال عرض السعر بنجاح", "status": "sent"}

# ══════════════════════════════════════════
# CREDIT NOTES — the only way to correct a posted invoice
# ══════════════════════════════════════════
# Amounts on an approved invoice are fixed (its entry is in the ledger), so a
# correction is a new document that reverses part or all of it: Dr sales +
# Dr VAT output / Cr customer, plus the cost reversal and restock when goods
# come back. The type existed but nothing posted it — approving one produced
# no entry at all.

@router.post("/invoices/{invoice_id}/credit-note")
async def create_credit_note(invoice_id: str, data: dict, authorization: Optional[str] = Header(None)):
    """إصدار إشعار دائن على فاتورة مبيعات (كلي أو جزئي)."""
    user = await get_user(authorization)
    company_id = user.get("company_id")
    inv = await _find_sales_invoice(company_id, invoice_id)
    if not inv:
        raise HTTPException(404, "الفاتورة غير موجودة")
    if not inv.get("journal_entry_id") or inv.get("status") not in LIVE_STATUSES:
        raise HTTPException(400, "الإشعار الدائن يصدر على فاتورة معتمدة ومرحّلة فقط")

    settle = round(float(inv.get("settle_amount") or inv.get("grand_total") or 0), 2)
    already = round(float(inv.get("credited_amount") or 0), 2)
    remaining = round(settle - already, 2)
    if remaining <= 0:
        raise HTTPException(400, "تم رد قيمة هذه الفاتورة بالكامل")

    # lines: either the returned items, or a flat amount
    requested = data.get("items")
    lines, restock = [], bool(data.get("restock", True))
    if requested:
        for n, it in enumerate(requested, 1):
            qty = float(it.get("quantity", 0) or 0)
            price = float(it.get("unit_price", 0) or 0)
            if qty <= 0:
                continue
            original = next((l for l in inv.get("lines", [])
                             if l.get("description") == it.get("description")
                             or (it.get("product_id") and l.get("product_id") == it.get("product_id"))), {})
            max_qty = float(original.get("quantity", 0) or 0)
            if original and qty > max_qty + 0.001:
                raise HTTPException(400, f"الكمية المرتجعة ({qty}) أكبر من كمية الفاتورة ({max_qty}) للصنف {it.get('description', '')}")
            lines.append(InvoiceLine(
                line_number=n, product_id=it.get("product_id") or original.get("product_id"),
                description=(it.get("description") or original.get("description") or "مردود")[:300],
                unit=original.get("unit", "unit"), quantity=qty,
                unit_price=price or float(original.get("unit_price", 0) or 0),
                tax_rate=float(it.get("vat_percent", original.get("tax_rate", 14)) or 0)))
    else:
        amount = round(float(data.get("amount") or 0), 2)
        if amount <= 0:
            raise HTTPException(400, "حدد الأصناف المرتجعة أو مبلغ الإشعار")
        vat_rate = float(data.get("vat_percent", 14) or 0)
        net = round(amount / (1 + vat_rate / 100), 2) if vat_rate else amount
        restock = False                      # a plain amount returns no goods
        lines.append(InvoiceLine(line_number=1, description=data.get("reason") or "خصم/تسوية على الفاتورة",
                                 quantity=1, unit_price=net, tax_rate=vat_rate))

    if not lines:
        raise HTTPException(400, "لا توجد بنود في الإشعار")

    note = Invoice(
        company_id=company_id, document_type=DocumentType.CREDIT_NOTE,
        document_number="", document_date=data.get("date") or datetime.now().strftime("%Y-%m-%d"),
        party_id=inv["party_id"], party_name=inv.get("party_name", ""),
        party_tax_id=inv.get("party_tax_id"), lines=lines,
        original_invoice_id=inv["id"], original_invoice_number=inv.get("document_number"),
        credit_reason=data.get("reason"), restock=restock,
        notes=data.get("notes"), created_by=user.get("user_id"))

    from services.invoice_service import InvoiceService
    service = InvoiceService(db)
    company = await db.companies.find_one({"id": company_id}, {"_id": 0, "name": 1}) or {}
    created = await service.create_invoice(note, company.get("name", ""))

    total = round(float(created.get("grand_total") or 0), 2)
    if total > remaining + 0.005:
        await db.invoices.delete_one({"id": created["id"]})       # never leave a half-made note
        raise HTTPException(400, f"قيمة الإشعار ({total:,.2f}) أكبر من المتبقي على الفاتورة ({remaining:,.2f})")

    approved = await service.approve_invoice(created["id"], user.get("user_id"))
    # the invoice keeps the value it was posted with — the ledger has it that
    # way, and each note is its own entry. Only what is still collectable moves.
    new_credited = round(already + total, 2)
    await db.invoices.update_one({"id": inv["id"], "company_id": company_id}, {"$set": {
        "credited_amount": new_credited,
        "amount_due": round(max(settle - new_credited - float(inv.get("amount_paid") or 0), 0), 2),
        "status": "credited" if new_credited >= settle - 0.005 else inv.get("status"),
        "updated_at": now_iso()}})
    return {"message": f"تم إصدار الإشعار الدائن {created['document_number']} وترحيله",
            "credit_note": approved or created, "invoice_remaining": round(remaining - total, 2)}


@router.get("/invoices/{invoice_id}/credit-notes")
async def list_credit_notes(invoice_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    inv = await _find_sales_invoice(company_id, invoice_id)
    if not inv:
        raise HTTPException(404, "الفاتورة غير موجودة")
    notes = await db.invoices.find(
        {"company_id": company_id, "document_type": DocumentType.CREDIT_NOTE.value,
         "original_invoice_id": inv["id"]}, {"_id": 0}).sort("document_date", 1).to_list(100)
    settle = round(float(inv.get("settle_amount") or inv.get("grand_total") or 0), 2)
    return {"credit_notes": notes, "credited_amount": round(float(inv.get("credited_amount") or 0), 2),
            "invoice_remaining": settle}
