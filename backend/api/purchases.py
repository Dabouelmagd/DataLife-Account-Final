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
