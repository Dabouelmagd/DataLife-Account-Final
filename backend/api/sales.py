"""
Sales Management API — نظام المبيعات الشامل
عروض أسعار | فواتير مبيعات | CRM | الاشتراكات | العملاء
"""

from fastapi import APIRouter, HTTPException, Header, Query
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
from database import db

router = APIRouter(prefix="/api/sales", tags=["sales"])


# ══════════════════════════════════════════
# Auth Helper
# ══════════════════════════════════════════
async def get_user(authorization: str):
    from services.auth_service import verify_token
    return await verify_token(authorization)


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

    await db.sales_invoices.insert_one(invoice)
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

    await db.sales_invoices.insert_one(invoice)
    invoice.pop("_id", None)

    # Post to General Ledger
    try:
        from services.accounting_service import AccountingService, JournalEntry, JournalEntryLine, JournalEntryStatus
        svc = AccountingService(db)
        # DR: Receivables (131) / CR: Revenue (411)
        recv_acc = await db.chart_of_accounts.find_one({"company_id": company_id, "account_code": "131"})
        rev_acc  = await db.chart_of_accounts.find_one({"company_id": company_id, "account_code": "411"})
        vat_acc  = await db.chart_of_accounts.find_one({"company_id": company_id, "account_code": "237"})
        lines = []
        if recv_acc:
            lines.append(JournalEntryLine(account_id=recv_acc["id"], account_code="131",
                account_name=recv_acc.get("account_name","ذمم مدينة"),
                debit=round(total,2), credit=0, description=f"فاتورة مبيعات {invoice_number}"))
        if rev_acc:
            lines.append(JournalEntryLine(account_id=rev_acc["id"], account_code="411",
                account_name=rev_acc.get("account_name","إيرادات المبيعات"),
                debit=0, credit=round(after_discount,2), description=f"فاتورة {invoice_number}"))
        if vat_acc and vat_amount > 0:
            lines.append(JournalEntryLine(account_id=vat_acc["id"], account_code="237",
                account_name=vat_acc.get("account_name","ضريبة القيمة المضافة"),
                debit=0, credit=round(vat_amount,2), description=f"ضريبة فاتورة {invoice_number}"))
        if lines:
            je = JournalEntry(company_id=company_id, entry_number=await svc.get_next_entry_number(company_id),
                entry_date=date_str, description=f"فاتورة مبيعات {invoice_number} — {data.get('customer_name','')}",
                lines=lines, total_debit=round(total,2), total_credit=round(total,2),
                status=JournalEntryStatus.POSTED, source_document_type="sales_invoice",
                source_document_id=invoice["id"], created_by=user.get("user_id","system"),
                fiscal_year=date_str[:4], period=date_str[:7])
            je_dict = await svc.create_journal_entry(je)
            await svc.post_journal_entry(je_dict["id"], user.get("user_id","system"))
    except Exception:
        pass

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
    await db.sales_invoices.insert_one(invoice)

    # Update subscription next billing date
    cycle_days = {"monthly": 30, "quarterly": 90, "semi-annual": 180, "annual": 365}.get(sub.get("billing_cycle","monthly"), 30)
    next_billing = (datetime.now() + timedelta(days=cycle_days)).strftime("%Y-%m-%d")
    await db.customer_subscriptions.update_one(
        {"id": sub_id},
        {"$set": {"next_billing_date": next_billing, "invoices_generated": sub.get("invoices_generated",0)+1}}
    )
    invoice.pop("_id", None)
    return {"message": f"تم توليد الفاتورة {invoice_number}", "invoice": invoice}
