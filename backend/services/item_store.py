"""
One catalogue for items: `products`, with quantities in `stocks`.

Items lived in two collections: products (the live inventory screen, with
units, categories, cost/sale prices and per-warehouse stock) and
inventory_items (a simpler list used by another screen, analytics, low-stock
alerts and goods receipt). The same item could exist twice, and a receipt
could raise the quantity on one while the screen showed the other.

`products` is the catalogue because the inventory screen, valuation and the
periodic count all use it. These helpers present a product plus its stock in
the flat shape the older screen expects, so that screen is unchanged.
"""
from typing import Optional

LOW = "low-stock"
OK = "in-stock"


async def stock_of(db, company_id: str, product_id: str) -> tuple:
    """(quantity, unit_cost) across warehouses."""
    qty = 0.0
    cost = 0.0
    async for s in db.stocks.find({"company_id": company_id, "product_id": product_id}, {"_id": 0}):
        q = float(s.get("quantity") or 0)
        qty += q
        cost = float(s.get("unit_cost") or cost or 0)
    return round(qty, 3), cost


def as_legacy_item(product: dict, quantity: float = 0.0, unit_cost: float = 0.0) -> dict:
    """Product (+ stock) -> the flat item shape the older screen reads."""
    if not product:
        return product
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    price = float(product.get("cost_price") or unit_cost or 0)
    min_stock = float(product.get("min_stock") or product.get("reorder_point") or 0)
    return {**product,
            "name": product.get("name"),
            "category": product.get("category_name") or product.get("category_id") or "",
            "quantity": quantity,
            "unit": product.get("base_unit_symbol") or product.get("base_unit_name") or "unit",
            "unit_price": price,
            "total_value": round(quantity * price, 2),
            "min_stock": min_stock,
            "status": LOW if min_stock and quantity <= min_stock else OK,
            # the older screen's model requires these
            "created_at": product.get("created_at") or now,
            "updated_at": product.get("updated_at") or now}


def from_legacy_item(data: dict, company_id: str, product_id: Optional[str] = None) -> dict:
    """The older screen's fields -> a product document."""
    import uuid
    from datetime import datetime, timezone
    name = (data.get("name") or "").strip()
    unit = (data.get("unit") or "unit").strip()
    return {
        "id": product_id or str(uuid.uuid4()),
        "company_id": company_id,
        "code": (data.get("code") or name[:20] or "ITEM").strip(),
        "name": name,
        "category_name": data.get("category"),
        "base_unit_id": unit, "base_unit_name": unit, "base_unit_symbol": unit,
        "cost_price": float(data.get("unit_price") or 0),
        "sale_price": float(data.get("sale_price") or data.get("unit_price") or 0),
        "min_stock": float(data.get("min_stock") or 0),
        "is_active": True,
        "created_at": data.get("created_at") or datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
