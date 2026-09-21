from services.audit_helper import log_financial_action
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import secrets
import string

router = APIRouter(prefix="/api/purchases", tags=["purchases"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


def generate_id(prefix=""):
    """Generate unique ID"""
    random_part = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    return f"{prefix}{random_part}"


def generate_po_number():
    """Generate purchase order number"""
    date_part = datetime.now().strftime("%Y%m")
    random_part = ''.join(secrets.choice(string.digits) for _ in range(6))
    return f"PO-{date_part}-{random_part}"


async def verify_token(authorization: str):
    """Verify token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    from services.auth_service import verify_token as vt
    token = authorization.split(" ")[1]
    data = vt(token)
    
    if not data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return data


# ============ PURCHASE ORDERS ============

@router.post("/orders")
async def create_purchase_order(
    order_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Create a new purchase order"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    items = order_data.get("items", [])
    
    # Calculate totals
    subtotal = 0
    items_with_totals = []
    
    for item in items:
        item_total = item.get("quantity", 0) * item.get("unit_price", 0)
        items_with_totals.append({
            **item,
            "total": item_total
        })
        subtotal += item_total
    
    tax_rate = order_data.get("tax_rate", 14)
    tax_amount = subtotal * (tax_rate / 100)
    grand_total = subtotal + tax_amount
    
    purchase_order = {
        "po_number": generate_po_number(),
        "company_id": company_id,
        "supplier_id": order_data.get("supplier_id"),
        "supplier_name": order_data.get("supplier_name"),
        "items": items_with_totals,
        "subtotal": subtotal,
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "grand_total": grand_total,
        "currency": order_data.get("currency", "EGP"),
        "status": "draft",  # draft, pending_approval, approved, ordered, received, cancelled
        "payment_status": "unpaid",  # unpaid, partial, paid
        "payment_terms": order_data.get("payment_terms", ""),
        "delivery_date": order_data.get("delivery_date"),
        "notes": order_data.get("notes", ""),
        "created_by": user_data.get("user_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.purchase_orders.insert_one(purchase_order)
    if "_id" in purchase_order:
        del purchase_order["_id"]
    
    return purchase_order


@router.get("/orders")
async def get_purchase_orders(
    status: Optional[str] = None,
    supplier_id: Optional[str] = None,
    page: int = 1,
    limit: int = 25,
    authorization: Optional[str] = Header(None)
):
    """Get all purchase orders"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    query = {"company_id": company_id}
    if status:
        query["status"] = status
    if supplier_id:
        query["supplier_id"] = supplier_id
    
    orders = await db.purchase_orders.find(query, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(length=None)
    
    return orders


@router.get("/orders/{po_number}")
async def get_purchase_order(
    po_number: str,
    authorization: Optional[str] = Header(None)
):
    """Get single purchase order"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    order = await db.purchase_orders.find_one(
        {"po_number": po_number, "company_id": company_id},
        {"_id": 0}
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    return order


@router.put("/orders/{po_number}")
async def update_purchase_order(
    po_number: str,
    update_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update purchase order"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    order = await db.purchase_orders.find_one(
        {"po_number": po_number, "company_id": company_id}
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    if order.get("status") in ["received", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot edit completed/cancelled order")
    
    allowed_fields = ["supplier_id", "supplier_name", "items", "tax_rate", 
                      "payment_terms", "delivery_date", "notes"]
    
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    # Recalculate if items changed
    if "items" in update_fields:
        items = update_fields["items"]
        subtotal = sum(item.get("quantity", 0) * item.get("unit_price", 0) for item in items)
        tax_rate = update_fields.get("tax_rate", order.get("tax_rate", 14))
        tax_amount = subtotal * (tax_rate / 100)
        
        update_fields["subtotal"] = subtotal
        update_fields["tax_amount"] = tax_amount
        update_fields["grand_total"] = subtotal + tax_amount
    
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.purchase_orders.update_one(
        {"po_number": po_number},
        {"$set": update_fields}
    )
    
    return {"success": True}


@router.put("/orders/{po_number}/status")
async def update_order_status(
    po_number: str,
    status_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update purchase order status"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    new_status = status_data.get("status")
    valid_statuses = ["draft", "pending_approval", "approved", "ordered", "received", "cancelled"]
    
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    update_data = {
        "status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if new_status == "approved":
        update_data["approved_by"] = user_data.get("user_id")
        update_data["approved_at"] = datetime.now(timezone.utc).isoformat()
    elif new_status == "received":
        update_data["received_at"] = datetime.now(timezone.utc).isoformat()
        # Update inventory
        order = await db.purchase_orders.find_one({"po_number": po_number})
        if order:
            for item in order.get("items", []):
                await db.inventory_items.update_one(
                    {"id": item.get("product_id"), "company_id": company_id},
                    {"$inc": {"quantity": item.get("quantity", 0)}}
                )
    
    result = await db.purchase_orders.update_one(
        {"po_number": po_number, "company_id": company_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"success": True}


@router.delete("/orders/{po_number}")
async def delete_purchase_order(
    po_number: str,
    authorization: Optional[str] = Header(None)
):
    """Cancel purchase order"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    order = await db.purchase_orders.find_one(
        {"po_number": po_number, "company_id": company_id}
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("status") == "received":
        raise HTTPException(status_code=400, detail="Cannot cancel received order")
    
    await db.purchase_orders.update_one(
        {"po_number": po_number},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": user_data.get("user_id"),
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True}


# ============ SUPPLIER MANAGEMENT ============

@router.post("/suppliers")
async def create_supplier(
    supplier_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Create a new supplier"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    supplier = {
        "id": generate_id("sup_"),
        "company_id": company_id,
        "name": supplier_data.get("name"),
        "contact_person": supplier_data.get("contact_person"),
        "email": supplier_data.get("email"),
        "phone": supplier_data.get("phone"),
        "address": supplier_data.get("address"),
        "tax_id": supplier_data.get("tax_id"),
        "payment_terms": supplier_data.get("payment_terms", "Net 30"),
        "category": supplier_data.get("category"),
        "rating": supplier_data.get("rating", 0),
        "notes": supplier_data.get("notes", ""),
        "is_active": True,
        "total_orders": 0,
        "total_amount": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.suppliers_extended.insert_one(supplier)
    if "_id" in supplier:
        del supplier["_id"]
    
    return supplier


@router.get("/suppliers")
async def get_suppliers(
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    authorization: Optional[str] = Header(None)
):
    """Get all suppliers"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    query = {"company_id": company_id}
    if category:
        query["category"] = category
    if is_active is not None:
        query["is_active"] = is_active
    
    suppliers = await db.suppliers_extended.find(query, {"_id": 0}).sort("name", 1).to_list(length=None)
    
    return suppliers


# ============ SUPPLIER BALANCES, STATEMENT & PAYMENTS ============
# Balance-forward per supplier, derived from the LEDGER side of each
# document: an approved purchase invoice contributes the credit it put on
# 251 الموردون (grand total net of withholding), a payment the debit it put
# there. The supplier balance therefore always agrees with the ledger.

PAYABLES_CODE = "251"
PAY_FROM = {"cash": "161", "bank": "162"}


SUPPLIER_TYPES = ["supplier", "both"]


async def _find_supplier(company_id: str, supplier_id: str):
    """Suppliers live in `parties` — the store the invoice page picks from, so
    purchase invoices carry these ids as party_id. suppliers_extended (used by
    purchase orders) is still read so older records keep working."""
    sup = await db.parties.find_one(
        {"id": supplier_id, "company_id": company_id, "party_type": {"$in": SUPPLIER_TYPES}}, {"_id": 0})
    return sup or await db.suppliers_extended.find_one(
        {"id": supplier_id, "company_id": company_id}, {"_id": 0})


async def _supplier_movements(company_id: str, supplier_id: str):
    """Invoices (credit) and payments (debit) for one supplier, oldest first."""
    rows = []
    invoices = await db.invoices.find(
        {"company_id": company_id, "party_id": supplier_id,
         "document_type": "purchase_invoice",
         "status": {"$in": ["approved", "paid", "partially_paid"]}},
        {"_id": 0}).to_list(length=None)
    je_ids = [i["journal_entry_id"] for i in invoices if i.get("journal_entry_id")]
    je_map = {je["id"]: je async for je in db.journal_entries.find(
        {"id": {"$in": je_ids}, "status": {"$in": ["posted", "reversed"]}}, {"_id": 0})}
    for inv in invoices:
        je = je_map.get(inv.get("journal_entry_id"))
        if not je or je.get("status") == "reversed":
            continue   # not in the ledger (or cancelled) — not owed
        owed = sum(float(l.get("credit", 0) or 0) - float(l.get("debit", 0) or 0)
                   for l in je.get("lines", []) if l.get("account_code") == PAYABLES_CODE)
        rows.append({"date": inv.get("document_date") or je.get("entry_date"), "type": "invoice",
                     "reference": inv.get("document_number"), "description": "فاتورة شراء",
                     "credit": round(owed, 2), "debit": 0.0, "journal_entry_id": je["id"]})
    # payments recorded on the invoice page (they post Dr 251 / Cr 161)
    inv_ids = [i["id"] for i in invoices]
    async for pay in db.payments.find({"invoice_id": {"$in": inv_ids}, "journal_entry_id": {"$ne": None}}, {"_id": 0}):
        rows.append({"date": (pay.get("payment_date") or "")[:10], "type": "payment",
                     "reference": pay.get("reference") or pay.get("id"), "description": "سداد من صفحة الفواتير",
                     "credit": 0.0, "debit": float(pay.get("amount", 0)), "journal_entry_id": pay.get("journal_entry_id")})
    async for pay in db.supplier_payments.find(
            {"company_id": company_id, "supplier_id": supplier_id, "status": "posted"}, {"_id": 0}):
        rows.append({"date": pay["date"], "type": "payment", "reference": pay.get("reference") or pay["id"],
                     "description": pay.get("notes") or ("سداد نقدي" if pay["method"] == "cash" else "سداد بنكي"),
                     "credit": 0.0, "debit": pay["amount"], "journal_entry_id": pay.get("journal_entry_id")})
    # Cheques issued to the supplier: issuing posts Dr 251 / Cr 252 (notes
    # payable), so the supplier is paid from the ledger's point of view on
    # the issue date — whether or not the cheque has cleared the bank yet.
    async for chq in db.cheques.find(
            {"company_id": company_id, "supplier_id": supplier_id, "direction": "outgoing",
             "status": {"$in": ["issued", "cleared"]}}, {"_id": 0}):
        rows.append({"date": chq.get("issue_date"), "type": "cheque",
                     "reference": chq.get("cheque_number"),
                     "description": f"شيك صادر رقم {chq.get('cheque_number', '')}"
                                    + (" — تم صرفه" if chq.get("status") == "cleared" else " — لم يُصرف بعد"),
                     "credit": 0.0, "debit": float(chq.get("amount", 0)), "journal_entry_id": chq.get("issue_je_id")})
    rows.sort(key=lambda r: (r["date"] or "", 0 if r["type"] == "invoice" else 1))
    return rows


@router.get("/suppliers-balances")
async def get_suppliers_with_balances(authorization: Optional[str] = Header(None)):
    """All suppliers with what the company currently owes each."""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    suppliers = await db.parties.find(
        {"company_id": company_id, "party_type": {"$in": SUPPLIER_TYPES}}, {"_id": 0}).to_list(length=None)
    seen = {x["id"] for x in suppliers}
    suppliers += [x for x in await db.suppliers_extended.find({"company_id": company_id}, {"_id": 0}).to_list(length=None)
                  if x["id"] not in seen]
    suppliers.sort(key=lambda x: x.get("name") or "")
    for sup in suppliers:
        rows = await _supplier_movements(company_id, sup["id"])
        sup["balance"] = round(sum(r["credit"] - r["debit"] for r in rows), 2)
        sup["invoice_count"] = sum(1 for r in rows if r["type"] == "invoice")
    return {"suppliers": suppliers,
            "total_payable": round(sum(s["balance"] for s in suppliers), 2)}


@router.get("/suppliers/{supplier_id}/statement")
async def get_supplier_statement(supplier_id: str, authorization: Optional[str] = Header(None)):
    """كشف حساب مورد — invoices, payments and a running balance."""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    sup = await _find_supplier(company_id, supplier_id)
    if not sup:
        raise HTTPException(status_code=404, detail="Supplier not found")
    running = 0.0
    rows = await _supplier_movements(company_id, supplier_id)
    for r in rows:
        running = round(running + r["credit"] - r["debit"], 2)
        r["balance"] = running
    return {"supplier": sup, "entries": rows, "balance": running,
            "total_invoiced": round(sum(r["credit"] for r in rows), 2),
            "total_paid": round(sum(r["debit"] for r in rows), 2)}


class SupplierPaymentIn(BaseModel):
    amount: float
    date: str
    method: str = "bank"          # cash | bank
    reference: Optional[str] = None
    notes: Optional[str] = None


@router.post("/suppliers/{supplier_id}/payments")
async def pay_supplier(supplier_id: str, data: SupplierPaymentIn,
                       authorization: Optional[str] = Header(None)):
    """Record a payment to a supplier and post it:
    من ح/ الموردون (251)  ←  إلى ح/ الخزينة (161) أو البنك (162)"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    user_id = user_data.get("user_id")

    sup = await _find_supplier(company_id, supplier_id)
    if not sup:
        raise HTTPException(status_code=404, detail="Supplier not found")
    if data.method not in PAY_FROM:
        raise HTTPException(status_code=400, detail="طريقة السداد يجب أن تكون نقدي أو بنكي")
    amount = round(float(data.amount or 0), 2)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="مبلغ السداد يجب أن يكون أكبر من صفر")
    balance = round(sum(r["credit"] - r["debit"] for r in await _supplier_movements(company_id, supplier_id)), 2)
    if amount > balance + 0.005:
        raise HTTPException(status_code=400, detail=(
            f"مبلغ السداد ({amount:,.2f}) أكبر من المستحق للمورد ({balance:,.2f})"))

    from services.accounting_service import AccountingService
    from models.accounting import JournalEntry, JournalEntryLine
    svc = AccountingService(db)
    accs = {a["account_code"]: a async for a in db.chart_of_accounts.find(
        {"company_id": company_id, "account_code": {"$in": [PAYABLES_CODE, PAY_FROM[data.method]]}}, {"_id": 0})}
    payable, source = accs.get(PAYABLES_CODE), accs.get(PAY_FROM[data.method])
    if not payable or not source:
        raise HTTPException(status_code=400, detail="حسابات الموردين أو الخزينة/البنك غير موجودة في شجرة الحسابات")

    payment_id = generate_id("spay_")
    desc = f"سداد للمورد {sup.get('name', '')}" + (f" — {data.reference}" if data.reference else "")
    entry = JournalEntry(
        company_id=company_id, entry_date=data.date, reference=data.reference or payment_id,
        description=desc, created_by=user_id or "system",
        source_document_type="supplier_payment", source_document_id=payment_id,
        lines=[
            JournalEntryLine(account_id=payable["id"], account_code=payable["account_code"],
                             account_name=payable["account_name"], debit=amount, credit=0, description=desc),
            JournalEntryLine(account_id=source["id"], account_code=source["account_code"],
                             account_name=source["account_name"], debit=0, credit=amount, description=desc),
        ])
    je = await svc.create_journal_entry(entry)
    await svc.post_journal_entry(je["id"], user_id or "system")   # payment exists only once it is in the ledger

    payment = {"id": payment_id, "company_id": company_id, "supplier_id": supplier_id,
               "supplier_name": sup.get("name"), "amount": amount, "date": data.date,
               "method": data.method, "reference": data.reference, "notes": data.notes,
               "journal_entry_id": je["id"], "status": "posted", "created_by": user_id,
               "created_at": datetime.now(timezone.utc).isoformat()}
    await db.supplier_payments.insert_one(dict(payment))
    # mark the supplier's purchase invoices paid, oldest first (no further entry)
    from services.invoice_service import InvoiceService
    applied, _ = await InvoiceService(db).apply_external_payment(
        company_id, supplier_id, "purchase_invoice", amount, "supplier_payment", payment_id, data.date)
    await db.supplier_payments.update_one({"id": payment_id}, {"$set": {"allocations": applied}})
    payment["allocations"] = applied
    return {"payment": payment, "balance": round(balance - amount, 2)}


@router.get("/suppliers/{supplier_id}")
async def get_supplier(
    supplier_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get single supplier with order history"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    supplier = await db.suppliers_extended.find_one(
        {"id": supplier_id, "company_id": company_id},
        {"_id": 0}
    )
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Get order history
    orders = await db.purchase_orders.find(
        {"supplier_id": supplier_id, "company_id": company_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(length=None)
    
    supplier["recent_orders"] = orders
    
    return supplier


@router.put("/suppliers/{supplier_id}")
async def update_supplier(
    supplier_id: str,
    update_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update supplier"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    allowed_fields = ["name", "contact_person", "email", "phone", "address",
                      "tax_id", "payment_terms", "category", "rating", "notes", "is_active"]
    
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.suppliers_extended.update_one(
        {"id": supplier_id, "company_id": company_id},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    return {"success": True}


# ============ PRICE COMPARISON ============

@router.post("/compare-prices")
async def compare_supplier_prices(
    comparison_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Compare prices from different suppliers for products"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    product_ids = comparison_data.get("product_ids", [])
    
    if not product_ids:
        raise HTTPException(status_code=400, detail="Product IDs required")
    
    # Get supplier quotes
    quotes = await db.supplier_quotes.find(
        {
            "company_id": company_id,
            "product_id": {"$in": product_ids},
            "is_active": True
        },
        {"_id": 0}
    ).to_list(length=None)
    
    # Group by product
    comparison = {}
    for quote in quotes:
        product_id = quote.get("product_id")
        if product_id not in comparison:
            comparison[product_id] = {
                "product_id": product_id,
                "product_name": quote.get("product_name"),
                "quotes": []
            }
        comparison[product_id]["quotes"].append({
            "supplier_id": quote.get("supplier_id"),
            "supplier_name": quote.get("supplier_name"),
            "unit_price": quote.get("unit_price"),
            "min_quantity": quote.get("min_quantity"),
            "delivery_days": quote.get("delivery_days"),
            "valid_until": quote.get("valid_until")
        })
    
    # Sort quotes by price
    for product_id in comparison:
        comparison[product_id]["quotes"].sort(key=lambda x: x.get("unit_price", 0))
        if comparison[product_id]["quotes"]:
            comparison[product_id]["best_price"] = comparison[product_id]["quotes"][0]
    
    return list(comparison.values())


@router.post("/quotes")
async def add_supplier_quote(
    quote_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Add supplier quote for a product"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    quote = {
        "id": generate_id("quote_"),
        "company_id": company_id,
        "supplier_id": quote_data.get("supplier_id"),
        "supplier_name": quote_data.get("supplier_name"),
        "product_id": quote_data.get("product_id"),
        "product_name": quote_data.get("product_name"),
        "unit_price": quote_data.get("unit_price"),
        "min_quantity": quote_data.get("min_quantity", 1),
        "delivery_days": quote_data.get("delivery_days"),
        "valid_until": quote_data.get("valid_until"),
        "notes": quote_data.get("notes", ""),
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.supplier_quotes.insert_one(quote)
    if "_id" in quote:
        del quote["_id"]
    
    return quote


# ============ STATISTICS ============

@router.get("/stats")
async def get_purchase_stats(authorization: Optional[str] = Header(None)):
    """Get purchase statistics"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    orders = await db.purchase_orders.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(length=None)
    
    total_orders = len(orders)
    total_amount = sum(o.get("grand_total", 0) for o in orders)
    pending_orders = len([o for o in orders if o.get("status") in ["draft", "pending_approval", "approved", "ordered"]])
    
    # By status
    by_status = {}
    for order in orders:
        status = order.get("status", "unknown")
        if status not in by_status:
            by_status[status] = {"count": 0, "amount": 0}
        by_status[status]["count"] += 1
        by_status[status]["amount"] += order.get("grand_total", 0)
    
    # Top suppliers
    supplier_totals = {}
    for order in orders:
        supplier = order.get("supplier_name", "Unknown")
        if supplier not in supplier_totals:
            supplier_totals[supplier] = 0
        supplier_totals[supplier] += order.get("grand_total", 0)
    
    top_suppliers = sorted(
        [{"name": k, "total": v} for k, v in supplier_totals.items()],
        key=lambda x: x["total"],
        reverse=True
    )[:5]
    
    return {
        "total_orders": total_orders,
        "total_amount": total_amount,
        "pending_orders": pending_orders,
        "by_status": by_status,
        "top_suppliers": top_suppliers
    }
