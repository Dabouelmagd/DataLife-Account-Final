"""
Professional Inventory Management API
واجهة برمجة إدارة المخزون الاحترافية
"""

from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel
import uuid

from database import db
from api.users import get_current_user
from models.inventory import (
    Warehouse, Category, UnitOfMeasure, Product, ProductUnit,
    Stock, StockMovement, StockTransfer, TransferLine, TransferStatus,
    StockAdjustment, AdjustmentLine, AdjustmentReason,
    Batch, SerialNumber, InventoryCount, CountLine, CountStatus,
    MovementType, ValuationMethod, ProductType, TrackingType
)

router = APIRouter(prefix="/api/inventory", tags=["Inventory Management"])


# ==========================================
# Request Models
# ==========================================

class WarehouseRequest(BaseModel):
    code: str
    name: str
    name_en: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    manager_id: Optional[str] = None
    is_default: bool = False
    allow_negative: bool = False


class CategoryRequest(BaseModel):
    code: str
    name: str
    name_en: Optional[str] = None
    parent_id: Optional[str] = None
    description: Optional[str] = None


class UnitRequest(BaseModel):
    code: str
    name: str
    name_en: Optional[str] = None
    symbol: str
    is_base: bool = False
    base_unit_id: Optional[str] = None
    conversion_factor: float = 1.0


class ProductUnitRequest(BaseModel):
    unit_id: str
    conversion_factor: float = 1.0
    barcode: Optional[str] = None
    purchase_price: float = 0.0
    sale_price: float = 0.0
    is_default_purchase: bool = False
    is_default_sale: bool = False


class ProductRequest(BaseModel):
    code: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    name: str
    name_en: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    product_type: str = "inventory"
    tracking_type: str = "none"
    base_unit_id: str
    units: Optional[List[ProductUnitRequest]] = []
    cost_price: float = 0.0
    sale_price: float = 0.0
    min_sale_price: float = 0.0
    tax_rate: float = 14.0
    is_taxable: bool = True
    valuation_method: str = "average"
    reorder_level: float = 0.0
    reorder_qty: float = 0.0
    min_stock: float = 0.0
    max_stock: float = 0.0
    has_expiry: bool = False
    shelf_life_days: int = 0
    expiry_alert_days: int = 30
    eta_code: Optional[str] = None


class StockMovementRequest(BaseModel):
    movement_date: str
    movement_type: str
    product_id: str
    warehouse_id: str
    from_warehouse_id: Optional[str] = None
    to_warehouse_id: Optional[str] = None
    quantity: float
    unit_id: str
    unit_cost: float = 0.0
    batch_number: Optional[str] = None
    serial_numbers: Optional[List[str]] = []
    expiry_date: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class TransferRequest(BaseModel):
    transfer_date: str
    from_warehouse_id: str
    to_warehouse_id: str
    lines: List[dict]
    notes: Optional[str] = None


class AdjustmentRequest(BaseModel):
    adjustment_date: str
    warehouse_id: str
    adjustment_type: str
    lines: List[dict]
    notes: Optional[str] = None


class CountRequest(BaseModel):
    count_date: str
    warehouse_id: str
    count_type: str = "full"
    category_id: Optional[str] = None
    notes: Optional[str] = None


# ==========================================
# Helper Functions
# ==========================================

async def generate_number(company_id: str, prefix: str, collection: str) -> str:
    """توليد رقم تسلسلي"""
    year = datetime.now().year
    count = await db[collection].count_documents({
        "company_id": company_id,
        f"{prefix.lower()}_number": {"$regex": f"^{prefix}-{year}"}
    })
    return f"{prefix}-{year}-{str(count + 1).zfill(5)}"


async def get_product_with_unit(product_id: str, unit_id: str):
    """الحصول على المنتج مع معامل التحويل"""
    product = await db.products.find_one({"id": product_id})
    if not product:
        return None, 1.0
    
    conversion_factor = 1.0
    if unit_id != product.get("base_unit_id"):
        for unit in product.get("units", []):
            if unit.get("unit_id") == unit_id:
                conversion_factor = unit.get("conversion_factor", 1.0)
                break
    
    return product, conversion_factor


async def update_stock(
    company_id: str,
    product_id: str,
    warehouse_id: str,
    quantity_change: float,
    unit_cost: float = 0.0,
    valuation_method: str = "average"
):
    """تحديث رصيد المخزون"""
    stock = await db.stocks.find_one({
        "company_id": company_id,
        "product_id": product_id,
        "warehouse_id": warehouse_id
    })
    
    product = await db.products.find_one({"id": product_id})
    warehouse = await db.warehouses.find_one({"id": warehouse_id})
    
    if stock:
        new_qty = stock["quantity"] + quantity_change
        
        # حساب متوسط التكلفة
        if quantity_change > 0 and unit_cost > 0:
            if valuation_method == "average":
                total_value = (stock["quantity"] * stock["unit_cost"]) + (quantity_change * unit_cost)
                new_cost = total_value / new_qty if new_qty > 0 else unit_cost
            else:
                new_cost = unit_cost
        else:
            new_cost = stock["unit_cost"]
        
        await db.stocks.update_one(
            {"id": stock["id"]},
            {"$set": {
                "quantity": new_qty,
                "available_qty": new_qty - stock.get("reserved_qty", 0),
                "unit_cost": new_cost,
                "total_value": new_qty * new_cost,
                "last_movement_date": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }}
        )
        return new_qty
    else:
        # إنشاء رصيد جديد
        new_stock = Stock(
            company_id=company_id,
            product_id=product_id,
            product_code=product.get("code", ""),
            product_name=product.get("name", ""),
            warehouse_id=warehouse_id,
            warehouse_name=warehouse.get("name", "") if warehouse else "",
            quantity=quantity_change,
            available_qty=quantity_change,
            unit_cost=unit_cost,
            total_value=quantity_change * unit_cost,
            last_movement_date=datetime.utcnow()
        )
        await db.stocks.insert_one(new_stock.dict())
        return quantity_change


# ==========================================
# Warehouse Endpoints (المخازن)
# ==========================================

@router.get("/warehouses")
async def get_warehouses(
    is_active: Optional[bool] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على قائمة المخازن"""
    query = {"company_id": current_user["company_id"]}
    if is_active is not None:
        query["is_active"] = is_active
    
    warehouses = await db.warehouses.find(query, {"_id": 0}).to_list(length=None)
    return {"warehouses": warehouses}


@router.post("/warehouses")
async def create_warehouse(
    request: WarehouseRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء مخزن جديد"""
    # التحقق من عدم تكرار الكود
    existing = await db.warehouses.find_one({
        "company_id": current_user["company_id"],
        "code": request.code
    })
    if existing:
        raise HTTPException(status_code=400, detail="كود المخزن موجود بالفعل")
    
    # إذا كان المخزن الافتراضي، إلغاء الافتراضي من الآخرين
    if request.is_default:
        await db.warehouses.update_many(
            {"company_id": current_user["company_id"]},
            {"$set": {"is_default": False}}
        )
    
    warehouse = Warehouse(
        company_id=current_user["company_id"],
        **request.dict()
    )
    
    await db.warehouses.insert_one(warehouse.dict())
    return {"message": "تم إنشاء المخزن بنجاح", "warehouse": warehouse.dict()}


@router.put("/warehouses/{warehouse_id}")
async def update_warehouse(
    warehouse_id: str,
    request: WarehouseRequest,
    current_user: dict = Depends(get_current_user)
):
    """تحديث مخزن"""
    warehouse = await db.warehouses.find_one({
        "id": warehouse_id,
        "company_id": current_user["company_id"]
    })
    if not warehouse:
        raise HTTPException(status_code=404, detail="المخزن غير موجود")
    
    if request.is_default:
        await db.warehouses.update_many(
            {"company_id": current_user["company_id"], "id": {"$ne": warehouse_id}},
            {"$set": {"is_default": False}}
        )
    
    update_data = request.dict()
    update_data["updated_at"] = datetime.utcnow()
    
    await db.warehouses.update_one(
        {"id": warehouse_id},
        {"$set": update_data}
    )
    
    return {"message": "تم تحديث المخزن بنجاح"}


@router.delete("/warehouses/{warehouse_id}")
async def delete_warehouse(
    warehouse_id: str,
    current_user: dict = Depends(get_current_user)
):
    """حذف مخزن"""
    # التحقق من عدم وجود أرصدة
    has_stock = await db.stocks.find_one({
        "warehouse_id": warehouse_id,
        "quantity": {"$ne": 0}
    })
    if has_stock:
        raise HTTPException(status_code=400, detail="لا يمكن حذف مخزن به أرصدة")
    
    result = await db.warehouses.delete_one({
        "id": warehouse_id,
        "company_id": current_user["company_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="المخزن غير موجود")
    
    return {"message": "تم حذف المخزن بنجاح"}


# ==========================================
# Category Endpoints (التصنيفات)
# ==========================================

@router.get("/categories")
async def get_categories(
    parent_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على التصنيفات"""
    query = {"company_id": current_user["company_id"]}
    if parent_id:
        query["parent_id"] = parent_id
    
    categories = await db.categories.find(query, {"_id": 0}).sort("sort_order", 1).to_list(length=None)
    return {"categories": categories}


@router.get("/categories/tree")
async def get_categories_tree(
    current_user: dict = Depends(get_current_user)
):
    """الحصول على شجرة التصنيفات"""
    categories = await db.categories.find(
        {"company_id": current_user["company_id"], "is_active": True},
        {"_id": 0}
    ).sort("sort_order", 1).to_list(length=None)
    
    def build_tree(parent_id=None):
        return [
            {**cat, "children": build_tree(cat["id"])}
            for cat in categories if cat.get("parent_id") == parent_id
        ]
    
    return {"categories": build_tree()}


@router.post("/categories")
async def create_category(
    request: CategoryRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء تصنيف جديد"""
    # حساب المستوى والمسار
    level = 1
    path = request.name
    
    if request.parent_id:
        parent = await db.categories.find_one({"id": request.parent_id})
        if parent:
            level = parent.get("level", 1) + 1
            path = f"{parent.get('path', '')} > {request.name}"
    
    category = Category(
        company_id=current_user["company_id"],
        level=level,
        path=path,
        **request.dict()
    )
    
    await db.categories.insert_one(category.dict())
    return {"message": "تم إنشاء التصنيف بنجاح", "category": category.dict()}


@router.put("/categories/{category_id}")
async def update_category(
    category_id: str,
    request: CategoryRequest,
    current_user: dict = Depends(get_current_user)
):
    """تحديث تصنيف"""
    update_data = request.dict()
    
    await db.categories.update_one(
        {"id": category_id, "company_id": current_user["company_id"]},
        {"$set": update_data}
    )
    
    return {"message": "تم تحديث التصنيف بنجاح"}


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: str,
    current_user: dict = Depends(get_current_user)
):
    """حذف تصنيف"""
    # التحقق من عدم وجود تصنيفات فرعية
    has_children = await db.categories.find_one({"parent_id": category_id})
    if has_children:
        raise HTTPException(status_code=400, detail="لا يمكن حذف تصنيف له تصنيفات فرعية")
    
    # التحقق من عدم وجود منتجات
    has_products = await db.products.find_one({"category_id": category_id})
    if has_products:
        raise HTTPException(status_code=400, detail="لا يمكن حذف تصنيف مرتبط بمنتجات")
    
    await db.categories.delete_one({
        "id": category_id,
        "company_id": current_user["company_id"]
    })
    
    return {"message": "تم حذف التصنيف بنجاح"}


# ==========================================
# Units Endpoints (الوحدات)
# ==========================================

@router.get("/units")
async def get_units(
    current_user: dict = Depends(get_current_user)
):
    """الحصول على وحدات القياس"""
    units = await db.units.find(
        {"company_id": current_user["company_id"], "is_active": True},
        {"_id": 0}
    ).to_list(length=None)
    
    # إضافة وحدات افتراضية إذا لم توجد
    if not units:
        default_units = [
            {"code": "PCS", "name": "قطعة", "name_en": "Piece", "symbol": "قطعة", "is_base": True},
            {"code": "KG", "name": "كيلوجرام", "name_en": "Kilogram", "symbol": "كجم", "is_base": True},
            {"code": "M", "name": "متر", "name_en": "Meter", "symbol": "م", "is_base": True},
            {"code": "L", "name": "لتر", "name_en": "Liter", "symbol": "لتر", "is_base": True},
            {"code": "BOX", "name": "كرتونة", "name_en": "Box", "symbol": "كرتونة", "is_base": False},
            {"code": "PACK", "name": "عبوة", "name_en": "Pack", "symbol": "عبوة", "is_base": False},
        ]
        for u in default_units:
            unit = UnitOfMeasure(company_id=current_user["company_id"], **u)
            await db.units.insert_one(unit.dict())
        units = await db.units.find({"company_id": current_user["company_id"]}, {"_id": 0}).to_list(length=None)
    
    return {"units": units}


@router.post("/units")
async def create_unit(
    request: UnitRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء وحدة قياس"""
    unit = UnitOfMeasure(
        company_id=current_user["company_id"],
        **request.dict()
    )
    await db.units.insert_one(unit.dict())
    return {"message": "تم إنشاء الوحدة بنجاح", "unit": unit.dict()}


# ==========================================
# Product Endpoints (المنتجات)
# ==========================================

@router.get("/products")
async def get_products(
    search: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    product_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    low_stock: Optional[bool] = Query(None),
    limit: int = Query(100, le=500),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على المنتجات"""
    query = {"company_id": current_user["company_id"]}
    
    if search:
        query["$or"] = [
            {"code": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}},
            {"barcode": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}}
        ]
    
    if category_id:
        query["category_id"] = category_id
    if product_type:
        query["product_type"] = product_type
    if is_active is not None:
        query["is_active"] = is_active
    
    products = await db.products.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(length=None)
    
    # إضافة معلومات المخزون
    for product in products:
        stocks = await db.stocks.find(
            {"product_id": product["id"]},
            {"_id": 0, "warehouse_name": 1, "quantity": 1, "available_qty": 1}
        ).to_list(length=None)
        product["stocks"] = stocks
        product["total_stock"] = sum(s.get("quantity", 0) for s in stocks)
        
        # التحقق من المخزون المنخفض
        if product.get("reorder_level", 0) > 0:
            product["is_low_stock"] = product["total_stock"] <= product["reorder_level"]
    
    if low_stock:
        products = [p for p in products if p.get("is_low_stock")]
    
    total = await db.products.count_documents(query)
    
    return {"products": products, "total": total}


@router.get("/products/{product_id}")
async def get_product(
    product_id: str,
    current_user: dict = Depends(get_current_user)
):
    """الحصول على منتج"""
    product = await db.products.find_one(
        {"id": product_id, "company_id": current_user["company_id"]},
        {"_id": 0}
    )
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    
    # إضافة الأرصدة
    stocks = await db.stocks.find({"product_id": product_id}, {"_id": 0}).to_list(length=None)
    product["stocks"] = stocks
    product["total_stock"] = sum(s.get("quantity", 0) for s in stocks)
    
    # إضافة آخر الحركات
    movements = await db.stock_movements.find(
        {"product_id": product_id}
    ).sort("created_at", -1).limit(10).to_list(length=None)
    product["recent_movements"] = [{k: v for k, v in m.items() if k != "_id"} for m in movements]
    
    return product


@router.post("/products")
async def create_product(
    request: ProductRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء منتج جديد"""
    # التحقق من عدم تكرار الكود
    existing = await db.products.find_one({
        "company_id": current_user["company_id"],
        "$or": [{"code": request.code}, {"barcode": request.barcode}] if request.barcode else [{"code": request.code}]
    })
    if existing:
        raise HTTPException(status_code=400, detail="كود المنتج أو الباركود موجود بالفعل")
    
    # الحصول على الوحدة الأساسية
    base_unit = await db.units.find_one({"id": request.base_unit_id})
    if not base_unit:
        raise HTTPException(status_code=400, detail="الوحدة الأساسية غير موجودة")
    
    # الحصول على التصنيف
    category_name = None
    category_path = None
    if request.category_id:
        category = await db.categories.find_one({"id": request.category_id})
        if category:
            category_name = category.get("name")
            category_path = category.get("path")
    
    # تحويل الوحدات
    units = []
    for unit_req in request.units or []:
        unit = await db.units.find_one({"id": unit_req.unit_id})
        if unit:
            units.append(ProductUnit(
                unit_id=unit_req.unit_id,
                unit_name=unit.get("name"),
                unit_symbol=unit.get("symbol"),
                conversion_factor=unit_req.conversion_factor,
                barcode=unit_req.barcode,
                purchase_price=unit_req.purchase_price,
                sale_price=unit_req.sale_price,
                is_default_purchase=unit_req.is_default_purchase,
                is_default_sale=unit_req.is_default_sale
            ))
    
    product = Product(
        company_id=current_user["company_id"],
        code=request.code,
        sku=request.sku,
        barcode=request.barcode,
        name=request.name,
        name_en=request.name_en,
        description=request.description,
        category_id=request.category_id,
        category_name=category_name,
        category_path=category_path,
        product_type=ProductType(request.product_type),
        tracking_type=TrackingType(request.tracking_type),
        base_unit_id=request.base_unit_id,
        base_unit_name=base_unit.get("name"),
        base_unit_symbol=base_unit.get("symbol"),
        units=[u.dict() for u in units],
        cost_price=request.cost_price,
        sale_price=request.sale_price,
        min_sale_price=request.min_sale_price,
        tax_rate=request.tax_rate,
        is_taxable=request.is_taxable,
        valuation_method=ValuationMethod(request.valuation_method),
        reorder_level=request.reorder_level,
        reorder_qty=request.reorder_qty,
        min_stock=request.min_stock,
        max_stock=request.max_stock,
        has_expiry=request.has_expiry,
        shelf_life_days=request.shelf_life_days,
        expiry_alert_days=request.expiry_alert_days,
        eta_code=request.eta_code,
        created_by=current_user["user_id"]
    )
    
    await db.products.insert_one(product.dict())
    return {"message": "تم إنشاء المنتج بنجاح", "product": product.dict()}


@router.put("/products/{product_id}")
async def update_product(
    product_id: str,
    request: ProductRequest,
    current_user: dict = Depends(get_current_user)
):
    """تحديث منتج"""
    product = await db.products.find_one({
        "id": product_id,
        "company_id": current_user["company_id"]
    })
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    
    # الحصول على الوحدة الأساسية
    base_unit = await db.units.find_one({"id": request.base_unit_id})
    
    # الحصول على التصنيف
    category_name = None
    category_path = None
    if request.category_id:
        category = await db.categories.find_one({"id": request.category_id})
        if category:
            category_name = category.get("name")
            category_path = category.get("path")
    
    # تحويل الوحدات
    units = []
    for unit_req in request.units or []:
        unit = await db.units.find_one({"id": unit_req.unit_id})
        if unit:
            units.append({
                "unit_id": unit_req.unit_id,
                "unit_name": unit.get("name"),
                "unit_symbol": unit.get("symbol"),
                "conversion_factor": unit_req.conversion_factor,
                "barcode": unit_req.barcode,
                "purchase_price": unit_req.purchase_price,
                "sale_price": unit_req.sale_price,
                "is_default_purchase": unit_req.is_default_purchase,
                "is_default_sale": unit_req.is_default_sale
            })
    
    update_data = {
        "code": request.code,
        "sku": request.sku,
        "barcode": request.barcode,
        "name": request.name,
        "name_en": request.name_en,
        "description": request.description,
        "category_id": request.category_id,
        "category_name": category_name,
        "category_path": category_path,
        "product_type": request.product_type,
        "tracking_type": request.tracking_type,
        "base_unit_id": request.base_unit_id,
        "base_unit_name": base_unit.get("name") if base_unit else None,
        "base_unit_symbol": base_unit.get("symbol") if base_unit else None,
        "units": units,
        "cost_price": request.cost_price,
        "sale_price": request.sale_price,
        "min_sale_price": request.min_sale_price,
        "tax_rate": request.tax_rate,
        "is_taxable": request.is_taxable,
        "valuation_method": request.valuation_method,
        "reorder_level": request.reorder_level,
        "reorder_qty": request.reorder_qty,
        "min_stock": request.min_stock,
        "max_stock": request.max_stock,
        "has_expiry": request.has_expiry,
        "shelf_life_days": request.shelf_life_days,
        "expiry_alert_days": request.expiry_alert_days,
        "eta_code": request.eta_code,
        "updated_at": datetime.utcnow()
    }
    
    await db.products.update_one({"id": product_id}, {"$set": update_data})
    return {"message": "تم تحديث المنتج بنجاح"}


@router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    current_user: dict = Depends(get_current_user)
):
    """حذف منتج"""
    # التحقق من عدم وجود أرصدة
    has_stock = await db.stocks.find_one({
        "product_id": product_id,
        "quantity": {"$ne": 0}
    })
    if has_stock:
        raise HTTPException(status_code=400, detail="لا يمكن حذف منتج له رصيد في المخزون")
    
    await db.products.delete_one({
        "id": product_id,
        "company_id": current_user["company_id"]
    })
    
    return {"message": "تم حذف المنتج بنجاح"}


# ==========================================
# Stock Endpoints (الأرصدة)
# ==========================================

@router.get("/stocks")
async def get_stocks(
    warehouse_id: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    low_stock: Optional[bool] = Query(None),
    zero_stock: Optional[bool] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على أرصدة المخزون"""
    pipeline = [
        {"$match": {"company_id": current_user["company_id"]}},
        {"$lookup": {
            "from": "products",
            "localField": "product_id",
            "foreignField": "id",
            "as": "product"
        }},
        {"$unwind": {"path": "$product", "preserveNullAndEmptyArrays": True}}
    ]
    
    match_stage = {}
    if warehouse_id:
        match_stage["warehouse_id"] = warehouse_id
    if category_id:
        match_stage["product.category_id"] = category_id
    if zero_stock:
        match_stage["quantity"] = 0
    
    if match_stage:
        pipeline.append({"$match": match_stage})
    
    pipeline.append({"$project": {"_id": 0, "product._id": 0}})
    
    stocks = await db.stocks.aggregate(pipeline).to_list(length=None)
    
    # فلترة المخزون المنخفض
    if low_stock:
        stocks = [
            s for s in stocks
            if s.get("product", {}).get("reorder_level", 0) > 0
            and s["quantity"] <= s["product"]["reorder_level"]
        ]
    
    return {"stocks": stocks}


@router.get("/stocks/summary")
async def get_stock_summary(
    current_user: dict = Depends(get_current_user)
):
    """ملخص المخزون"""
    company_id = current_user["company_id"]
    
    # إجمالي قيمة المخزون
    total_value_result = await db.stocks.aggregate([
        {"$match": {"company_id": company_id}},
        {"$group": {"_id": None, "total": {"$sum": "$total_value"}}}
    ]).to_list(length=1)
    total_value = total_value_result[0]["total"] if total_value_result else 0
    
    # عدد المنتجات
    total_products = await db.products.count_documents({"company_id": company_id, "is_active": True})
    
    # المنتجات منخفضة المخزون
    low_stock_products = await db.stocks.aggregate([
        {"$match": {"company_id": company_id}},
        {"$lookup": {
            "from": "products",
            "localField": "product_id",
            "foreignField": "id",
            "as": "product"
        }},
        {"$unwind": "$product"},
        {"$match": {"$expr": {"$lte": ["$quantity", "$product.reorder_level"]}}},
        {"$count": "count"}
    ]).to_list(length=1)
    low_stock_count = low_stock_products[0]["count"] if low_stock_products else 0
    
    # المنتجات منتهية الصلاحية قريباً
    from datetime import timedelta
    alert_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    expiring_soon = await db.batches.count_documents({
        "company_id": company_id,
        "expiry_date": {"$lte": alert_date},
        "current_qty": {"$gt": 0}
    })
    
    # عدد المخازن
    warehouses_count = await db.warehouses.count_documents({"company_id": company_id, "is_active": True})
    
    # قيمة المخزون حسب المخزن
    value_by_warehouse = await db.stocks.aggregate([
        {"$match": {"company_id": company_id}},
        {"$group": {
            "_id": "$warehouse_id",
            "warehouse_name": {"$first": "$warehouse_name"},
            "total_value": {"$sum": "$total_value"},
            "items_count": {"$sum": 1}
        }}
    ]).to_list(length=None)
    
    return {
        "total_value": total_value,
        "total_products": total_products,
        "low_stock_count": low_stock_count,
        "expiring_soon": expiring_soon,
        "warehouses_count": warehouses_count,
        "value_by_warehouse": value_by_warehouse
    }


# ==========================================
# Stock Movement Endpoints (حركات المخزون)
# ==========================================

@router.get("/movements")
async def get_movements(
    product_id: Optional[str] = Query(None),
    warehouse_id: Optional[str] = Query(None),
    movement_type: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على حركات المخزون"""
    query = {"company_id": current_user["company_id"]}
    
    if product_id:
        query["product_id"] = product_id
    if warehouse_id:
        query["warehouse_id"] = warehouse_id
    if movement_type:
        query["movement_type"] = movement_type
    if start_date:
        query["movement_date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("movement_date", {})["$lte"] = end_date
    
    movements = await db.stock_movements.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).skip(skip).limit(limit).to_list(length=None)
    
    total = await db.stock_movements.count_documents(query)
    
    return {"movements": movements, "total": total}


@router.post("/movements")
async def create_movement(
    request: StockMovementRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء حركة مخزون"""
    company_id = current_user["company_id"]
    
    # الحصول على المنتج والوحدة
    product, conversion_factor = await get_product_with_unit(request.product_id, request.unit_id)
    if not product:
        raise HTTPException(status_code=404, detail="المنتج غير موجود")
    
    # الحصول على المخزن
    warehouse = await db.warehouses.find_one({"id": request.warehouse_id})
    if not warehouse:
        raise HTTPException(status_code=404, detail="المخزن غير موجود")
    
    # الحصول على الوحدة
    unit = await db.units.find_one({"id": request.unit_id})
    
    # حساب الكمية بالوحدة الأساسية
    base_quantity = request.quantity * conversion_factor
    
    # تحديد اتجاه الحركة
    movement_type = MovementType(request.movement_type)
    inward_types = [
        MovementType.PURCHASE, MovementType.TRANSFER_IN, MovementType.ADJUSTMENT_IN,
        MovementType.RETURN_IN, MovementType.PRODUCTION_IN, MovementType.OPENING
    ]
    quantity_change = base_quantity if movement_type in inward_types else -base_quantity
    
    # الحصول على الرصيد الحالي
    current_stock = await db.stocks.find_one({
        "product_id": request.product_id,
        "warehouse_id": request.warehouse_id
    })
    balance_before = current_stock["quantity"] if current_stock else 0
    
    # التحقق من توفر الكمية للحركات الصادرة
    if quantity_change < 0 and not warehouse.get("allow_negative"):
        if balance_before + quantity_change < 0:
            raise HTTPException(
                status_code=400,
                detail=f"الكمية المتاحة ({balance_before}) غير كافية"
            )
    
    # إنشاء رقم الحركة
    movement_number = await generate_number(company_id, "MOV", "stock_movements")
    
    # تحديث الرصيد
    new_balance = await update_stock(
        company_id, request.product_id, request.warehouse_id,
        quantity_change, request.unit_cost, product.get("valuation_method", "average")
    )
    
    # إنشاء الحركة
    movement = StockMovement(
        company_id=company_id,
        movement_number=movement_number,
        movement_date=request.movement_date,
        movement_type=movement_type,
        product_id=request.product_id,
        product_code=product.get("code"),
        product_name=product.get("name"),
        warehouse_id=request.warehouse_id,
        warehouse_name=warehouse.get("name"),
        from_warehouse_id=request.from_warehouse_id,
        to_warehouse_id=request.to_warehouse_id,
        quantity=request.quantity,
        unit_id=request.unit_id,
        unit_name=unit.get("name") if unit else "",
        base_quantity=base_quantity,
        unit_cost=request.unit_cost,
        total_cost=request.quantity * request.unit_cost,
        balance_before=balance_before,
        balance_after=new_balance,
        batch_number=request.batch_number,
        serial_numbers=request.serial_numbers or [],
        expiry_date=request.expiry_date,
        reference_type=request.reference_type,
        reference_id=request.reference_id,
        reference_number=request.reference_number,
        notes=request.notes,
        created_by=current_user["user_id"],
        created_by_name=current_user.get("name")
    )
    
    await db.stock_movements.insert_one(movement.dict())
    
    return {"message": "تم تسجيل الحركة بنجاح", "movement": movement.dict()}


# ==========================================
# Stock Transfer Endpoints (التحويلات)
# ==========================================

@router.get("/transfers")
async def get_transfers(
    status: Optional[str] = Query(None),
    warehouse_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على التحويلات"""
    query = {"company_id": current_user["company_id"]}
    if status:
        query["status"] = status
    if warehouse_id:
        query["$or"] = [
            {"from_warehouse_id": warehouse_id},
            {"to_warehouse_id": warehouse_id}
        ]
    
    transfers = await db.stock_transfers.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).limit(limit).to_list(length=None)
    
    return {"transfers": transfers}


@router.post("/transfers")
async def create_transfer(
    request: TransferRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء تحويل مخزني"""
    company_id = current_user["company_id"]
    
    # التحقق من المخازن
    from_warehouse = await db.warehouses.find_one({"id": request.from_warehouse_id})
    to_warehouse = await db.warehouses.find_one({"id": request.to_warehouse_id})
    
    if not from_warehouse or not to_warehouse:
        raise HTTPException(status_code=404, detail="المخزن غير موجود")
    
    if request.from_warehouse_id == request.to_warehouse_id:
        raise HTTPException(status_code=400, detail="لا يمكن التحويل لنفس المخزن")
    
    # تحويل الأسطر
    lines = []
    for i, line_data in enumerate(request.lines):
        product = await db.products.find_one({"id": line_data["product_id"]})
        if not product:
            continue
        
        unit = await db.units.find_one({"id": line_data.get("unit_id", product["base_unit_id"])})
        
        lines.append(TransferLine(
            line_number=i + 1,
            product_id=line_data["product_id"],
            product_code=product.get("code"),
            product_name=product.get("name"),
            quantity=line_data["quantity"],
            unit_id=line_data.get("unit_id", product["base_unit_id"]),
            unit_name=unit.get("name") if unit else "",
            notes=line_data.get("notes")
        ))
    
    transfer_number = await generate_number(company_id, "TRF", "stock_transfers")
    
    transfer = StockTransfer(
        company_id=company_id,
        transfer_number=transfer_number,
        transfer_date=request.transfer_date,
        from_warehouse_id=request.from_warehouse_id,
        from_warehouse_name=from_warehouse.get("name"),
        to_warehouse_id=request.to_warehouse_id,
        to_warehouse_name=to_warehouse.get("name"),
        lines=[l.dict() for l in lines],
        notes=request.notes,
        created_by=current_user["user_id"]
    )
    
    await db.stock_transfers.insert_one(transfer.dict())
    
    return {"message": "تم إنشاء التحويل بنجاح", "transfer": transfer.dict()}


@router.post("/transfers/{transfer_id}/approve")
async def approve_transfer(
    transfer_id: str,
    current_user: dict = Depends(get_current_user)
):
    """اعتماد التحويل"""
    transfer = await db.stock_transfers.find_one({
        "id": transfer_id,
        "company_id": current_user["company_id"]
    })
    
    if not transfer:
        raise HTTPException(status_code=404, detail="التحويل غير موجود")
    
    if transfer["status"] != "draft":
        raise HTTPException(status_code=400, detail="لا يمكن اعتماد هذا التحويل")
    
    # التحقق من توفر الكميات وتنفيذ الحركات
    for line in transfer["lines"]:
        stock = await db.stocks.find_one({
            "product_id": line["product_id"],
            "warehouse_id": transfer["from_warehouse_id"]
        })
        
        current_qty = stock["quantity"] if stock else 0
        if current_qty < line["quantity"]:
            raise HTTPException(
                status_code=400,
                detail=f"الكمية غير كافية للمنتج {line['product_name']}"
            )
    
    # تنفيذ حركات الإخراج والإدخال
    for line in transfer["lines"]:
        # إخراج من المخزن المصدر
        await update_stock(
            transfer["company_id"],
            line["product_id"],
            transfer["from_warehouse_id"],
            -line["quantity"]
        )
        
        # إدخال للمخزن الوجهة
        await update_stock(
            transfer["company_id"],
            line["product_id"],
            transfer["to_warehouse_id"],
            line["quantity"]
        )
    
    await db.stock_transfers.update_one(
        {"id": transfer_id},
        {"$set": {
            "status": "completed",
            "approved_by": current_user["user_id"],
            "approved_at": datetime.utcnow()
        }}
    )
    
    return {"message": "تم اعتماد التحويل بنجاح"}


# ==========================================
# Stock Adjustment Endpoints (التسويات)
# ==========================================

@router.get("/adjustments")
async def get_adjustments(
    status: Optional[str] = Query(None),
    warehouse_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على التسويات"""
    query = {"company_id": current_user["company_id"]}
    if status:
        query["status"] = status
    if warehouse_id:
        query["warehouse_id"] = warehouse_id
    
    adjustments = await db.stock_adjustments.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).limit(limit).to_list(length=None)
    
    return {"adjustments": adjustments}


@router.post("/adjustments")
async def create_adjustment(
    request: AdjustmentRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء تسوية مخزنية"""
    company_id = current_user["company_id"]
    
    warehouse = await db.warehouses.find_one({"id": request.warehouse_id})
    if not warehouse:
        raise HTTPException(status_code=404, detail="المخزن غير موجود")
    
    lines = []
    total_increase = 0
    total_decrease = 0
    
    for i, line_data in enumerate(request.lines):
        product = await db.products.find_one({"id": line_data["product_id"]})
        if not product:
            continue
        
        stock = await db.stocks.find_one({
            "product_id": line_data["product_id"],
            "warehouse_id": request.warehouse_id
        })
        system_qty = stock["quantity"] if stock else 0
        actual_qty = line_data.get("actual_qty", 0)
        difference = actual_qty - system_qty
        unit_cost = stock["unit_cost"] if stock else product.get("cost_price", 0)
        total_cost = abs(difference) * unit_cost
        
        if difference > 0:
            total_increase += total_cost
        else:
            total_decrease += abs(total_cost)
        
        lines.append(AdjustmentLine(
            line_number=i + 1,
            product_id=line_data["product_id"],
            product_code=product.get("code"),
            product_name=product.get("name"),
            system_qty=system_qty,
            actual_qty=actual_qty,
            difference=difference,
            unit_cost=unit_cost,
            total_cost=total_cost,
            reason=AdjustmentReason(line_data.get("reason", "count")),
            notes=line_data.get("notes")
        ))
    
    adjustment_number = await generate_number(company_id, "ADJ", "stock_adjustments")
    
    adjustment = StockAdjustment(
        company_id=company_id,
        adjustment_number=adjustment_number,
        adjustment_date=request.adjustment_date,
        warehouse_id=request.warehouse_id,
        warehouse_name=warehouse.get("name"),
        adjustment_type=request.adjustment_type,
        lines=[l.dict() for l in lines],
        total_increase=total_increase,
        total_decrease=total_decrease,
        net_adjustment=total_increase - total_decrease,
        notes=request.notes,
        created_by=current_user["user_id"]
    )
    
    await db.stock_adjustments.insert_one(adjustment.dict())
    
    return {"message": "تم إنشاء التسوية بنجاح", "adjustment": adjustment.dict()}


@router.post("/adjustments/{adjustment_id}/approve")
async def approve_adjustment(
    adjustment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """اعتماد التسوية"""
    adjustment = await db.stock_adjustments.find_one({
        "id": adjustment_id,
        "company_id": current_user["company_id"]
    })
    
    if not adjustment:
        raise HTTPException(status_code=404, detail="التسوية غير موجودة")
    
    if adjustment["status"] != "draft":
        raise HTTPException(status_code=400, detail="لا يمكن اعتماد هذه التسوية")
    
    # تنفيذ التسويات
    for line in adjustment["lines"]:
        if line["difference"] != 0:
            await update_stock(
                adjustment["company_id"],
                line["product_id"],
                adjustment["warehouse_id"],
                line["difference"],
                line["unit_cost"]
            )
    
    await db.stock_adjustments.update_one(
        {"id": adjustment_id},
        {"$set": {
            "status": "approved",
            "approved_by": current_user["user_id"],
            "approved_at": datetime.utcnow()
        }}
    )
    
    return {"message": "تم اعتماد التسوية بنجاح"}


# ==========================================
# Reports Endpoints (التقارير)
# ==========================================

@router.get("/reports/stock-balance")
async def get_stock_balance_report(
    warehouse_id: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    as_of_date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """تقرير رصيد المخزون"""
    query = {"company_id": current_user["company_id"]}
    if warehouse_id:
        query["warehouse_id"] = warehouse_id
    
    stocks = await db.stocks.find(query, {"_id": 0}).to_list(length=None)
    
    # تجميع البيانات
    report_data = []
    for stock in stocks:
        product = await db.products.find_one({"id": stock["product_id"]}, {"_id": 0})
        if category_id and product.get("category_id") != category_id:
            continue
        
        report_data.append({
            "product_code": stock.get("product_code"),
            "product_name": stock.get("product_name"),
            "category": product.get("category_name") if product else "",
            "warehouse": stock.get("warehouse_name"),
            "quantity": stock.get("quantity", 0),
            "unit": product.get("base_unit_symbol") if product else "",
            "unit_cost": stock.get("unit_cost", 0),
            "total_value": stock.get("total_value", 0),
            "reorder_level": product.get("reorder_level", 0) if product else 0,
            "status": "low" if stock.get("quantity", 0) <= (product.get("reorder_level", 0) if product else 0) else "ok"
        })
    
    # الإجماليات
    totals = {
        "total_items": len(report_data),
        "total_value": sum(r["total_value"] for r in report_data),
        "low_stock_items": len([r for r in report_data if r["status"] == "low"])
    }
    
    return {"report": report_data, "totals": totals}


@router.get("/reports/movement-history")
async def get_movement_history_report(
    product_id: Optional[str] = Query(None),
    warehouse_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """تقرير حركة المخزون"""
    query = {"company_id": current_user["company_id"]}
    
    if product_id:
        query["product_id"] = product_id
    if warehouse_id:
        query["warehouse_id"] = warehouse_id
    if start_date:
        query["movement_date"] = {"$gte": start_date}
    if end_date:
        query.setdefault("movement_date", {})["$lte"] = end_date
    
    movements = await db.stock_movements.find(query, {"_id": 0}).sort(
        "movement_date", 1
    ).to_list(length=None)
    
    # تجميع حسب النوع
    summary = {}
    for mov in movements:
        mov_type = mov.get("movement_type")
        if mov_type not in summary:
            summary[mov_type] = {"count": 0, "quantity": 0, "value": 0}
        summary[mov_type]["count"] += 1
        summary[mov_type]["quantity"] += mov.get("base_quantity", 0)
        summary[mov_type]["value"] += mov.get("total_cost", 0)
    
    return {"movements": movements, "summary": summary}


@router.get("/reports/low-stock")
async def get_low_stock_report(
    warehouse_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """تقرير المنتجات منخفضة المخزون"""
    pipeline = [
        {"$match": {"company_id": current_user["company_id"]}},
        {"$lookup": {
            "from": "products",
            "localField": "product_id",
            "foreignField": "id",
            "as": "product"
        }},
        {"$unwind": "$product"},
        {"$match": {"$expr": {"$lte": ["$quantity", "$product.reorder_level"]}}},
        {"$project": {
            "_id": 0,
            "product_code": "$product.code",
            "product_name": "$product.name",
            "category": "$product.category_name",
            "warehouse_name": 1,
            "current_qty": "$quantity",
            "reorder_level": "$product.reorder_level",
            "reorder_qty": "$product.reorder_qty",
            "shortage": {"$subtract": ["$product.reorder_level", "$quantity"]}
        }}
    ]
    
    if warehouse_id:
        pipeline[0]["$match"]["warehouse_id"] = warehouse_id
    
    low_stock_items = await db.stocks.aggregate(pipeline).to_list(length=None)
    
    return {
        "items": low_stock_items,
        "total_items": len(low_stock_items)
    }


@router.get("/reports/valuation")
async def get_stock_valuation_report(
    warehouse_id: Optional[str] = Query(None),
    method: str = Query("average", enum=["average", "fifo", "lifo"]),
    current_user: dict = Depends(get_current_user)
):
    """تقرير تقييم المخزون"""
    query = {"company_id": current_user["company_id"]}
    if warehouse_id:
        query["warehouse_id"] = warehouse_id
    
    stocks = await db.stocks.find(query, {"_id": 0}).to_list(length=None)
    
    report_data = []
    total_value = 0
    
    for stock in stocks:
        product = await db.products.find_one({"id": stock["product_id"]})
        if not product:
            continue
        
        quantity = stock.get("quantity", 0)
        
        # حساب التكلفة حسب الطريقة
        if method == "average":
            unit_cost = stock.get("unit_cost", 0)
        elif method == "fifo":
            # FIFO - استخدام أقدم الدفعات
            batches = await db.batches.find({
                "product_id": stock["product_id"],
                "warehouse_id": stock["warehouse_id"],
                "current_qty": {"$gt": 0}
            }).sort("created_at", 1).to_list(length=None)
            
            if batches:
                total_cost = sum(b["current_qty"] * b["unit_cost"] for b in batches)
                total_qty = sum(b["current_qty"] for b in batches)
                unit_cost = total_cost / total_qty if total_qty > 0 else 0
            else:
                unit_cost = stock.get("unit_cost", 0)
        else:  # LIFO
            batches = await db.batches.find({
                "product_id": stock["product_id"],
                "warehouse_id": stock["warehouse_id"],
                "current_qty": {"$gt": 0}
            }).sort("created_at", -1).to_list(length=None)
            
            if batches:
                total_cost = sum(b["current_qty"] * b["unit_cost"] for b in batches)
                total_qty = sum(b["current_qty"] for b in batches)
                unit_cost = total_cost / total_qty if total_qty > 0 else 0
            else:
                unit_cost = stock.get("unit_cost", 0)
        
        value = quantity * unit_cost
        total_value += value
        
        report_data.append({
            "product_code": product.get("code"),
            "product_name": product.get("name"),
            "category": product.get("category_name"),
            "warehouse": stock.get("warehouse_name"),
            "quantity": quantity,
            "unit": product.get("base_unit_symbol"),
            "unit_cost": round(unit_cost, 2),
            "total_value": round(value, 2)
        })
    
    return {
        "report": report_data,
        "method": method,
        "total_value": round(total_value, 2),
        "items_count": len(report_data)
    }


@router.get("/reports/expiry")
async def get_expiry_report(
    days: int = Query(30, description="عدد الأيام"),
    warehouse_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """تقرير المنتجات قاربت على انتهاء الصلاحية"""
    from datetime import timedelta
    
    alert_date = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")
    
    query = {
        "company_id": current_user["company_id"],
        "expiry_date": {"$lte": alert_date},
        "current_qty": {"$gt": 0}
    }
    
    if warehouse_id:
        query["warehouse_id"] = warehouse_id
    
    batches = await db.batches.find(query, {"_id": 0}).to_list(length=None)
    
    report_data = []
    for batch in batches:
        product = await db.products.find_one({"id": batch["product_id"]})
        warehouse = await db.warehouses.find_one({"id": batch["warehouse_id"]})
        
        days_to_expiry = (datetime.strptime(batch["expiry_date"], "%Y-%m-%d") - datetime.now()).days
        
        report_data.append({
            "batch_number": batch.get("batch_number"),
            "product_name": product.get("name") if product else "",
            "warehouse": warehouse.get("name") if warehouse else "",
            "expiry_date": batch.get("expiry_date"),
            "days_to_expiry": days_to_expiry,
            "quantity": batch.get("current_qty"),
            "value": batch.get("current_qty", 0) * batch.get("unit_cost", 0),
            "status": "expired" if days_to_expiry < 0 else "expiring_soon"
        })
    
    # ترتيب حسب تاريخ الصلاحية
    report_data.sort(key=lambda x: x["days_to_expiry"])
    
    return {
        "items": report_data,
        "total_items": len(report_data),
        "expired_count": len([r for r in report_data if r["status"] == "expired"]),
        "expiring_soon_count": len([r for r in report_data if r["status"] == "expiring_soon"])
    }
