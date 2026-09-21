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

    total = await db.sales_customers.count_documents(q)
    skip  = (page - 1) * limit
    customers = await db.sales_customers.find(q, {"_id": 0}).skip(skip).limit(limit).sort("created_at", -1).to_list(length=limit)

    # Aggregate totals per customer
    for c in customers:
        inv_agg = await db.sales_invoices.find_one(
            {"company_id": company_id, "customer_id": c["id"]},
            {"_id": 0}
        )
        c["has_invoices"] = inv_agg is not None

    return {"customers": customers, "total": total, "page": page, "pages": -(-total // limit)}


@router.post("/customers")
async def create_customer(data: dict, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")

    # Auto-generate customer code
    count = await db.sales_customers.count_documents({"company_id": company_id})
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
    await db.sales_customers.insert_one(customer)
    customer.pop("_id", None)
    return {"message": "تم إضافة العميل بنجاح", "customer": customer}


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    customer = await db.sales_customers.find_one({"id": customer_id, "company_id": company_id}, {"_id": 0})
    if not customer: raise HTTPException(404, "Customer not found")

    # Get invoices
    invoices = await db.sales_invoices.find(
        {"company_id": company_id, "customer_id": customer_id},
        {"_id": 0, "invoice_number": 1, "date": 1, "total": 1, "status": 1}
    ).sort("date", -1).limit(10).to_list(length=10)

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
    await db.sales_customers.update_one({"id": customer_id, "company_id": company_id}, {"$set": update})
    return {"message": "تم تحديث العميل"}


@router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    # Check no invoices
    inv_count = await db.sales_invoices.count_documents({"company_id": company_id, "customer_id": customer_id})
    if inv_count > 0:
        raise HTTPException(400, "لا يمكن حذف عميل لديه فواتير")
    await db.sales_customers.delete_one({"id": customer_id, "company_id": company_id})
    return {"message": "تم حذف العميل"}


@router.get("/customers/stats/summary")
async def customer_stats(authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    total = await db.sales_customers.count_documents({"company_id": company_id})
    active = await db.sales_customers.count_documents({"company_id": company_id, "status": "active"})
    leads  = await db.sales_customers.count_documents({"company_id": company_id, "stage": "lead"})
    vip    = await db.sales_customers.count_documents({"company_id": company_id, "stage": "vip"})
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
    """تحويل عرض السعر لفاتورة مبيعات"""
    user = await get_user(authorization)
    company_id = user.get("company_id")
    q = await db.sales_quotations.find_one({"id": quote_id, "company_id": company_id})
    if not q: raise HTTPException(404, "Quotation not found")
    if q.get("status") == "converted":
        raise HTTPException(400, "عرض السعر محوّل بالفعل لفاتورة")

    # Create invoice from quote
    inv_count = await db.sales_invoices.count_documents({"company_id": company_id})
    invoice_number = f"INV-{datetime.now().year}-{inv_count+1:04d}"

    invoice = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "invoice_number": invoice_number,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "due_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
        "customer_id": q.get("customer_id"),
        "customer_name": q.get("customer_name"),
        "customer_tax_number": q.get("customer_tax_number"),
        "customer_address": q.get("customer_address"),
        "items": q.get("items", []),
        "subtotal": q.get("subtotal"),
        "discount_percent": q.get("discount_percent"),
        "discount_amount": q.get("discount_amount"),
        "after_discount": q.get("after_discount"),
        "vat_percent": q.get("vat_percent"),
        "vat_amount": q.get("vat_amount"),
        "total": q.get("total"),
        "paid_amount": 0,
        "balance": q.get("total"),
        "currency": q.get("currency", "EGP"),
        "status": "draft",         # draft | sent | partial | paid | overdue | cancelled
        "payment_status": "unpaid",
        "notes": q.get("notes"),
        "terms": q.get("terms"),
        "sales_rep": q.get("sales_rep"),
        "from_quote": quote_id,
        "quote_number": q.get("quote_number"),
        "payments": [],
        "created_by": user.get("user_id"),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    invoice["journal_entry_id"] = await post_sales_invoice(invoice, user.get("user_id"))  # had no entry at all
    await db.sales_invoices.insert_one(invoice)
    invoice.pop("_id", None)
    await db.sales_quotations.update_one(
        {"id": quote_id},
        {"$set": {"status": "converted", "converted_invoice": invoice_number, "updated_at": now_iso()}}
    )
    invoice.pop("_id", None)
    return {"message": f"تم تحويل عرض السعر لفاتورة {invoice_number}", "invoice": invoice}


@router.delete("/quotations/{quote_id}")
async def delete_quotation(quote_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    await db.sales_quotations.delete_one({"id": quote_id, "company_id": company_id, "status": "draft"})
    return {"message": "تم حذف عرض السعر"}


# ══════════════════════════════════════════
# SALES INVOICES — فواتير المبيعات
# ══════════════════════════════════════════

@router.get("/invoices")
async def list_sales_invoices(
    search: str = "", status: str = "", payment_status: str = "",
    customer_id: str = "", date_from: str = "", date_to: str = "",
    page: int = 1, limit: int = 20,
    authorization: Optional[str] = Header(None)
):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    q = {"company_id": company_id}
    if search: q["$or"] = [
        {"invoice_number": {"$regex": search, "$options": "i"}},
        {"customer_name":  {"$regex": search, "$options": "i"}},
    ]
    if status:         q["status"] = status
    if payment_status: q["payment_status"] = payment_status
    if customer_id:    q["customer_id"] = customer_id
    if date_from:      q["date"] = {"$gte": date_from}
    if date_to:        q.setdefault("date", {})["$lte"] = date_to

    total = await db.sales_invoices.count_documents(q)
    skip  = (page - 1) * limit
    invoices = await db.sales_invoices.find(q, {"_id": 0, "items": 0}).skip(skip).limit(limit).sort("date", -1).to_list(length=limit)
    return {"invoices": invoices, "total": total, "page": page}


@router.post("/invoices")
async def create_sales_invoice(data: dict, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")

    count = await db.sales_invoices.count_documents({"company_id": company_id})
    invoice_number = data.get("invoice_number", f"INV-{datetime.now().year}-{count+1:04d}")

    items = data.get("items", [])
    subtotal = sum(i.get("quantity", 0) * i.get("unit_price", 0) for i in items)
    discount_percent = data.get("discount_percent", 0)
    discount_amount = data.get("discount_amount", subtotal * discount_percent / 100)
    after_discount = subtotal - discount_amount
    vat_percent = data.get("vat_percent", 14)
    vat_amount = after_discount * vat_percent / 100
    total = after_discount + vat_amount

    date_str = data.get("date", datetime.now().strftime("%Y-%m-%d"))
    payment_terms = data.get("payment_terms", 30)
    due_date = (datetime.fromisoformat(date_str) + timedelta(days=payment_terms)).strftime("%Y-%m-%d")

    invoice = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "invoice_number": invoice_number,
        "date": date_str,
        "due_date": data.get("due_date", due_date),
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
        "paid_amount": 0,
        "balance": round(total, 2),
        "currency": data.get("currency", "EGP"),
        "status": "draft",
        "payment_status": "unpaid",
        "notes": data.get("notes", ""),
        "terms": data.get("terms", ""),
        "sales_rep": data.get("sales_rep", user.get("full_name", "")),
        "from_quote": data.get("from_quote"),
        "payments": [],
        "created_by": user.get("user_id"),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }

    # post first; the invoice is saved only once its entry is in the ledger
    invoice["journal_entry_id"] = await post_sales_invoice(invoice, user.get("user_id"))
    await db.sales_invoices.insert_one(invoice)
    invoice.pop("_id", None)

    return {"message": f"تم إنشاء الفاتورة {invoice_number}", "invoice": invoice}


@router.get("/invoices/{invoice_id}")
async def get_sales_invoice(invoice_id: str, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    inv = await db.sales_invoices.find_one(
        {"$or": [{"id": invoice_id}, {"invoice_number": invoice_id}], "company_id": company_id},
        {"_id": 0}
    )
    if not inv: raise HTTPException(404, "Invoice not found")
    return inv


@router.put("/invoices/{invoice_id}")
async def update_sales_invoice(invoice_id: str, data: dict, authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    allowed = ["status","payment_status","notes","terms","due_date","items","discount_percent","vat_percent"]
    update = {k: v for k, v in data.items() if k in allowed}
    update["updated_at"] = now_iso()
    _cur = await db.sales_invoices.find_one({"$or": [{"id": invoice_id}, {"invoice_number": invoice_id}], "company_id": company_id}, {"_id": 0})
    _money = {"items", "subtotal", "discount_percent", "discount_amount", "after_discount", "vat_percent", "vat_amount", "total"}
    if _cur and _cur.get("journal_entry_id") and _money & set(data or {}):
        raise HTTPException(400, "لا يمكن تعديل مبالغ فاتورة مُرحّلة — أصدر إشعاراً دائناً أو فاتورة جديدة")
    await db.sales_invoices.update_one(
        {"$or": [{"id": invoice_id}, {"invoice_number": invoice_id}], "company_id": company_id},
        {"$set": update}
    )
    return {"message": "تم تحديث الفاتورة"}


@router.post("/invoices/{invoice_id}/payment")
async def record_payment(invoice_id: str, data: dict, authorization: Optional[str] = Header(None)):
    """تسجيل دفعة على فاتورة"""
    user = await get_user(authorization)
    company_id = user.get("company_id")
    inv = await db.sales_invoices.find_one(
        {"$or": [{"id": invoice_id}, {"invoice_number": invoice_id}], "company_id": company_id}
    )
    if not inv: raise HTTPException(404, "Invoice not found")

    amount = float(data.get("amount", 0))
    if amount <= 0: raise HTTPException(400, "المبلغ يجب أن يكون أكبر من صفر")

    payment = {
        "id": str(uuid.uuid4()),
        "date": data.get("date", datetime.now().strftime("%Y-%m-%d")),
        "amount": amount,
        "method": data.get("method", "cash"),
        "reference": data.get("reference", ""),
        "notes": data.get("notes", ""),
        "created_at": now_iso(),
    }

    outstanding = round((inv.get("total", 0) or 0) - (inv.get("paid_amount", 0) or 0), 2)
    if amount > outstanding + 0.005:
        raise HTTPException(400, f"المبلغ ({amount:,.2f}) أكبر من المتبقي على الفاتورة ({outstanding:,.2f})")
    # payments never reached the ledger: cash/bank and receivables stayed wrong
    payment["journal_entry_id"] = await post_customer_payment(inv, payment, user.get("user_id"))

    new_paid = round((inv.get("paid_amount", 0) or 0) + amount, 2)
    new_balance = round((inv.get("total", 0) or 0) - new_paid, 2)
    payment_status = "paid" if new_balance <= 0 else ("partial" if new_paid > 0 else "unpaid")

    await db.sales_invoices.update_one(
        {"id": inv["id"]},
        {"$push": {"payments": payment},
         "$set": {"paid_amount": new_paid, "balance": new_balance,
                  "payment_status": payment_status, "updated_at": now_iso()}}
    )
    return {"message": "تم تسجيل الدفعة", "paid_amount": new_paid, "balance": new_balance, "payment_status": payment_status}



# ══════════════════════════════════════════
# LEDGER POSTING — one path for every sales document
# ══════════════════════════════════════════
# Direct invoices used to create their entry with status=POSTED and then call
# post_journal_entry, which refuses an entry that is already posted; the error
# was swallowed (`except: pass`), so the entry said "posted" while the ledger
# had nothing. Invoices converted from quotations or generated from
# subscriptions, and customer payments, created no entry at all.

MONEY_ACCOUNT = {"cash": "161"}          # anything else (bank, transfer, card, cheque) -> 162


async def _ledger_accounts(company_id: str, codes):
    accs = {a["account_code"]: a async for a in db.chart_of_accounts.find(
        {"company_id": company_id, "account_code": {"$in": list(codes)}}, {"_id": 0})}
    missing = [c for c in codes if c not in accs]
    if missing:
        raise HTTPException(400, f"حسابات غير موجودة في شجرة الحسابات: {', '.join(missing)}")
    return accs


async def _post_entry(company_id, user_id, date, description, lines, source_id, source_type="sales_invoice"):
    from services.accounting_service import AccountingService
    from models.accounting import JournalEntry, JournalEntryLine
    svc = AccountingService(db)
    je = await svc.create_journal_entry(JournalEntry(
        company_id=company_id, entry_date=date, description=description,
        source_document_type=source_type, source_document_id=source_id,
        created_by=user_id or "system",
        lines=[JournalEntryLine(**l) for l in lines]))          # created as a DRAFT...
    await svc.post_journal_entry(je["id"], user_id or "system")  # ...then posted: rows reach the ledger
    return je["id"]


async def post_sales_invoice(invoice: dict, user_id: str) -> str:
    """من ح/ العملاء 131  ←  إلى ح/ المبيعات 411 + ضريبة المخرجات 260"""
    company_id = invoice["company_id"]
    total = round(float(invoice.get("total") or 0), 2)
    vat = round(float(invoice.get("vat_amount") or 0), 2)
    revenue = round(total - vat, 2)          # keeps the entry balanced to the cent
    if total <= 0:
        raise HTTPException(400, "إجمالي الفاتورة يجب أن يكون أكبر من صفر")
    accs = await _ledger_accounts(company_id, ["131", "411"] + (["260"] if vat > 0 else []))
    num = invoice.get("invoice_number", "")
    L = lambda c, d, cr, desc: {"account_id": accs[c]["id"], "account_code": c,
                                "account_name": accs[c]["account_name"], "debit": d, "credit": cr, "description": desc}
    lines = [L("131", total, 0, f"فاتورة مبيعات {num}"), L("411", 0, revenue, f"فاتورة {num}")]
    if vat > 0:
        lines.append(L("260", 0, vat, f"ضريبة فاتورة {num}"))
    return await _post_entry(company_id, user_id, invoice.get("date") or datetime.now().strftime("%Y-%m-%d"),
                             f"فاتورة مبيعات {num} — {invoice.get('customer_name', '')}", lines, invoice["id"])


async def post_customer_payment(inv: dict, payment: dict, user_id: str) -> str:
    """من ح/ الخزينة 161 أو البنك 162  ←  إلى ح/ العملاء 131"""
    money = MONEY_ACCOUNT.get(payment.get("method"), "162")
    accs = await _ledger_accounts(inv["company_id"], [money, "131"])
    amt = round(float(payment["amount"]), 2)
    desc = f"تحصيل فاتورة {inv.get('invoice_number', '')} — {inv.get('customer_name', '')}"
    lines = [{"account_id": accs[money]["id"], "account_code": money, "account_name": accs[money]["account_name"],
              "debit": amt, "credit": 0, "description": desc},
             {"account_id": accs["131"]["id"], "account_code": "131", "account_name": accs["131"]["account_name"],
              "debit": 0, "credit": amt, "description": desc}]
    return await _post_entry(inv["company_id"], user_id, payment["date"], desc, lines, payment["id"], "sales_invoice")


# ══════════════════════════════════════════
# CUSTOMER BALANCES, STATEMENT & RECEIPTS
# ══════════════════════════════════════════
# Mirrors what the ledger put on 131 العملاء for this customer:
#   + each posted sales invoice (its total)
#   - each posted payment against those invoices
#   - each incoming cheque when received (Dr 132 / Cr 131)
#   + the same cheque again if it bounced  (Dr 131)
# The `balance` stored on the customer record was never updated; it is not used.

async def _customer_movements(company_id: str, customer_id: str):
    rows = []
    invs = await db.sales_invoices.find(
        {"company_id": company_id, "customer_id": customer_id,
         "status": {"$nin": ["cancelled", "void", "voided"]}, "journal_entry_id": {"$exists": True, "$ne": None}},
        {"_id": 0}).to_list(length=None)
    for inv in invs:
        rows.append({"date": inv.get("date"), "type": "invoice", "reference": inv.get("invoice_number"),
                     "description": "فاتورة مبيعات", "debit": round(float(inv.get("total") or 0), 2), "credit": 0.0,
                     "due_date": inv.get("due_date"), "invoice_id": inv["id"]})
        for pay in inv.get("payments") or []:
            if pay.get("journal_entry_id"):
                rows.append({"date": pay.get("date"), "type": "payment", "reference": inv.get("invoice_number"),
                             "description": "تحصيل نقدي" if pay.get("method") == "cash" else "تحصيل بنكي",
                             "debit": 0.0, "credit": round(float(pay.get("amount") or 0), 2)})
    async for chq in db.cheques.find({"company_id": company_id, "customer_id": customer_id,
                                      "direction": "incoming"}, {"_id": 0}):
        amt = round(float(chq.get("amount") or 0), 2)
        rows.append({"date": chq.get("receive_date"), "type": "cheque", "reference": chq.get("cheque_number"),
                     "description": f"شيك وارد رقم {chq.get('cheque_number', '')}", "debit": 0.0, "credit": amt})
        if chq.get("status") == "bounced":
            rows.append({"date": chq.get("bounce_date"), "type": "bounce", "reference": chq.get("cheque_number"),
                         "description": f"ارتداد الشيك رقم {chq.get('cheque_number', '')}", "debit": amt, "credit": 0.0})
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


@router.get("/customers-balances")
async def customers_with_balances(authorization: Optional[str] = Header(None)):
    user = await get_user(authorization)
    company_id = user.get("company_id")
    today = datetime.now().strftime("%Y-%m-%d")
    customers = await db.sales_customers.find({"company_id": company_id}, {"_id": 0}).sort("name", 1).to_list(length=None)
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
    cust = await db.sales_customers.find_one({"id": customer_id, "company_id": company_id}, {"_id": 0})
    if not cust:
        raise HTTPException(404, "Customer not found")
    rows = await _customer_movements(company_id, customer_id)
    running = 0.0
    for r in rows:
        running = round(running + r["debit"] - r["credit"], 2)
        r["balance"] = running
    open_invoices = await db.sales_invoices.find(
        {"company_id": company_id, "customer_id": customer_id, "journal_entry_id": {"$exists": True, "$ne": None},
         "status": {"$nin": ["cancelled", "void", "voided"]}, "balance": {"$gt": 0.004}},
        {"_id": 0, "id": 1, "invoice_number": 1, "date": 1, "due_date": 1, "total": 1, "balance": 1}).sort("date", 1).to_list(None)
    return {"customer": cust, "entries": rows, "balance": running,
            "overdue": _overdue(rows, datetime.now().strftime("%Y-%m-%d")), "open_invoices": open_invoices}


@router.post("/customers/{customer_id}/receipts")
async def receive_from_customer(customer_id: str, data: dict, authorization: Optional[str] = Header(None)):
    """Collect from a customer: the amount is applied to the oldest open
    invoices first, each part through record_payment, so every invoice's
    payment status is right and every part posts its own entry."""
    user = await get_user(authorization)
    company_id = user.get("company_id")
    cust = await db.sales_customers.find_one({"id": customer_id, "company_id": company_id}, {"_id": 0})
    if not cust:
        raise HTTPException(404, "Customer not found")
    amount = round(float(data.get("amount") or 0), 2)
    if amount <= 0:
        raise HTTPException(400, "المبلغ يجب أن يكون أكبر من صفر")
    open_invs = await db.sales_invoices.find(
        {"company_id": company_id, "customer_id": customer_id, "journal_entry_id": {"$exists": True, "$ne": None},
         "status": {"$nin": ["cancelled", "void", "voided"]}, "balance": {"$gt": 0.004}},
        {"_id": 0}).sort("date", 1).to_list(None)
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

    total_invoices  = await db.sales_invoices.count_documents({"company_id": company_id})
    total_quotes    = await db.sales_quotations.count_documents({"company_id": company_id})
    total_customers = await db.sales_customers.count_documents({"company_id": company_id})
    unpaid          = await db.sales_invoices.count_documents({"company_id": company_id, "payment_status": "unpaid"})
    overdue         = await db.sales_invoices.count_documents({"company_id": company_id, "status": "overdue"})

    # Monthly revenue
    month_invoices = await db.sales_invoices.find(
        {"company_id": company_id, "date": {"$gte": month_start[:7]}, "payment_status": {"$in": ["paid","partial"]}},
        {"_id": 0, "paid_amount": 1}
    ).to_list(length=None)
    monthly_revenue = sum(i.get("paid_amount", 0) for i in month_invoices)

    # Outstanding balance
    all_invoices = await db.sales_invoices.find(
        {"company_id": company_id, "payment_status": {"$in": ["unpaid","partial"]}},
        {"_id": 0, "balance": 1}
    ).to_list(length=None)
    outstanding = sum(i.get("balance", 0) for i in all_invoices)

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
    count = await db.sales_invoices.count_documents({"company_id": company_id})
    invoice_number = f"INV-{datetime.now().year}-{count+1:04d}"
    amount = sub.get("amount", 0)
    vat = round(amount * 0.14, 2)
    total = round(amount + vat, 2)

    invoice = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "invoice_number": invoice_number,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "due_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
        "customer_id": sub.get("customer_id"), "customer_name": sub.get("customer_name"),
        "items": [{"description": sub.get("service_name"), "quantity": 1,
                   "unit_price": amount, "total": amount}],
        "subtotal": amount, "discount_percent": 0, "discount_amount": 0,
        "after_discount": amount, "vat_percent": 14, "vat_amount": vat,
        "total": total, "paid_amount": 0, "balance": total,
        "currency": sub.get("currency", "EGP"), "status": "draft", "payment_status": "unpaid",
        "from_subscription": sub_id, "payments": [],
        "created_by": user.get("user_id"), "created_at": now_iso(), "updated_at": now_iso(),
    }
    invoice["journal_entry_id"] = await post_sales_invoice(invoice, user.get("user_id"))  # had no entry at all
    await db.sales_invoices.insert_one(invoice)
    invoice.pop("_id", None)

    # Update subscription next billing date
    cycle_days = {"monthly": 30, "quarterly": 90, "semi-annual": 180, "annual": 365}.get(sub.get("billing_cycle","monthly"), 30)
    next_billing = (datetime.now() + timedelta(days=cycle_days)).strftime("%Y-%m-%d")
    await db.customer_subscriptions.update_one(
        {"id": sub_id},
        {"$set": {"next_billing_date": next_billing, "invoices_generated": sub.get("invoices_generated",0)+1}}
    )
    invoice.pop("_id", None)
    return {"message": f"تم توليد الفاتورة {invoice_number}", "invoice": invoice}


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
