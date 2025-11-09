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
    items = await db.inventory_items.find({"company_id": company_id}).to_list(length=None)
    
    return [InventoryItemResponse(**{**item, '_id': str(item['_id'])}) for item in items]


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
    result = await db.inventory_items.insert_one(item_dict)
    
    if result.inserted_id:
        return InventoryItemResponse(**item_dict)
    
    raise HTTPException(status_code=500, detail="Failed to create inventory item")


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
    item = await db.inventory_items.find_one({"id": item_id, "company_id": company_id})
    
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
    existing_item = await db.inventory_items.find_one({"id": item_id, "company_id": company_id})
    
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
        result = await db.inventory_items.update_one(
            {"id": item_id, "company_id": company_id},
            {"$set": update_data}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update inventory item")
    
    # Fetch and return updated item
    updated_item = await db.inventory_items.find_one({"id": item_id, "company_id": company_id})
    
    return InventoryItemResponse(**updated_item)


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
    result = await db.inventory_items.delete_one({"id": item_id, "company_id": company_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    return {"message": "Inventory item deleted successfully", "item_id": item_id}
