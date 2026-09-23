from fastapi import APIRouter, HTTPException, Depends, Header
from typing import List, Optional
from models.inventory_data import (
    InventoryItem, 
    InventoryItemCreate, 
    InventoryItemUpdate,
    InventoryItemResponse
)
from services.auth_service import verify_token
from database import db
from datetime import datetime
from services.item_store import as_legacy_item, from_legacy_item, stock_of


router = APIRouter(prefix="/api/inventory", tags=["inventory"])


def calculate_status(quantity: float, min_stock: float) -> str:
    """Calculate inventory status based on quantity and minimum stock"""
    return 'low-stock' if quantity <= min_stock else 'in-stock'


def calculate_total_value(quantity: float, unit_price: float) -> float:
    """Calculate total value"""
    return quantity * unit_price


@router.get("/items", response_model=List[InventoryItemResponse])
async def get_inventory_items(
    authorization: Optional[str] = Header(None)
):
    """
    Get all inventory items for the authenticated user's company
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    user_data = verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    company_id = user_data.get("company_id")
    
    # Fetch inventory items for this company
    # one catalogue: products (+ stocks for quantity), presented in this
    # screen's flat shape by services/item_store
    products = await db.products.find({"company_id": company_id}, {"_id": 0}).to_list(length=None)
    out = []
    for prod in products:
        qty, cost = await stock_of(db, company_id, prod["id"])
        out.append(InventoryItemResponse(**{**as_legacy_item(prod, qty, cost), "_id": prod["id"]}))
    return out


@router.post("/items", response_model=InventoryItemResponse)
async def create_inventory_item(
    item_data: InventoryItemCreate,
    authorization: Optional[str] = Header(None)
):
    """
    Create a new inventory item
    Allowed roles: General Manager, CEO, Board Chairman, Financial Manager
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    user_data = verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Check user role permissions
    user_role = user_data.get("role", "")
    allowed_roles = [
        "General Manager", "مدير عام",
        "CEO", "المدير التنفيذي", 
        "Board Chairman", "رئيس مجلس الإدارة",
        "Financial Manager", "المدير المالي"
    ]
    
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions to create inventory items")
    
    company_id = user_data.get("company_id")
    
    # Calculate total value and status
    total_value = calculate_total_value(item_data.quantity, item_data.unit_price)
    status = calculate_status(item_data.quantity, item_data.min_stock)
    
    # Create inventory item
    item = InventoryItem(
        company_id=company_id,
        name=item_data.name,
        category=item_data.category,
        quantity=item_data.quantity,
        unit=item_data.unit,
        unit_price=item_data.unit_price,
        total_value=total_value,
        min_stock=item_data.min_stock,
        status=status
    )
    
    item_dict = item.dict()
    product = from_legacy_item(item_dict, company_id, item_dict.get("id"))
    await db.products.insert_one(dict(product))
    qty = float(item_dict.get("quantity") or 0)
    if qty:                                  # opening quantity for this item
        await db.stocks.update_one(
            {"company_id": company_id, "product_id": product["id"], "warehouse_id": "main"},
            {"$set": {"quantity": qty, "unit_cost": float(item_dict.get("unit_price") or 0)}}, upsert=True)
    return InventoryItemResponse(**{**as_legacy_item(product, qty, float(item_dict.get("unit_price") or 0)),
                                    "_id": product["id"]})


@router.get("/items/{item_id}", response_model=InventoryItemResponse)
async def get_inventory_item(
    item_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Get a specific inventory item by ID
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    user_data = verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    company_id = user_data.get("company_id")
    
    # Fetch item and verify it belongs to user's company
    item = await db.products.find_one({"id": item_id, "company_id": company_id})
    
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    return InventoryItemResponse(**item)


@router.put("/items/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: str,
    item_data: InventoryItemUpdate,
    authorization: Optional[str] = Header(None)
):
    """
    Update an inventory item
    Allowed roles: General Manager, CEO, Board Chairman, Financial Manager
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    user_data = verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Check user role permissions
    user_role = user_data.get("role", "")
    allowed_roles = [
        "General Manager", "مدير عام",
        "CEO", "المدير التنفيذي", 
        "Board Chairman", "رئيس مجلس الإدارة",
        "Financial Manager", "المدير المالي"
    ]
    
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions to update inventory items")
    
    company_id = user_data.get("company_id")
    
    # Fetch existing item
    existing_item = await db.products.find_one({"id": item_id, "company_id": company_id})
    
    if not existing_item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    # Prepare update data
    update_data = item_data.dict(exclude_unset=True)
    
    if update_data:
        # Recalculate total_value and status if relevant fields changed
        quantity = update_data.get('quantity', existing_item['quantity'])
        unit_price = update_data.get('unit_price', existing_item['unit_price'])
        min_stock = update_data.get('min_stock', existing_item['min_stock'])
        
        update_data['total_value'] = calculate_total_value(quantity, unit_price)
        update_data['status'] = calculate_status(quantity, min_stock)
        update_data['updated_at'] = datetime.utcnow()
        
        # Update item
        prod_update = {k: v for k, v in from_legacy_item(
            {**{"name": existing_item.get("name"), "unit": existing_item.get("base_unit_symbol")}, **update_data},
            company_id, item_id).items() if k not in ("id", "company_id")}
        await db.products.update_one({"id": item_id, "company_id": company_id}, {"$set": prod_update})
        if "quantity" in update_data:
            await db.stocks.update_one(
                {"company_id": company_id, "product_id": item_id, "warehouse_id": "main"},
                {"$set": {"quantity": float(update_data["quantity"] or 0)}}, upsert=True)

    updated_item = await db.products.find_one({"id": item_id, "company_id": company_id}, {"_id": 0})
    qty, cost = await stock_of(db, company_id, item_id)
    return InventoryItemResponse(**{**as_legacy_item(updated_item, qty, cost), "_id": item_id})


@router.delete("/items/{item_id}")
async def delete_inventory_item(
    item_id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Delete an inventory item
    Allowed roles: General Manager, CEO, Board Chairman, Financial Manager
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    user_data = verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Check user role permissions
    user_role = user_data.get("role", "")
    allowed_roles = [
        "General Manager", "مدير عام",
        "CEO", "المدير التنفيذي", 
        "Board Chairman", "رئيس مجلس الإدارة",
        "Financial Manager", "المدير المالي"
    ]
    
    if user_role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions to delete inventory items")
    
    company_id = user_data.get("company_id")
    
    # Delete item
    result = await db.products.delete_one({"id": item_id, "company_id": company_id})
    await db.stocks.delete_many({"company_id": company_id, "product_id": item_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    return {"message": "Inventory item deleted successfully", "item_id": item_id}
