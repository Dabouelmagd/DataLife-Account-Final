"""
Global Search API — searches across employees, customers/suppliers, invoices,
purchases, and journal entries for the current user's company.
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

from services.auth_service import verify_token

load_dotenv()

router = APIRouter(prefix="/api/search", tags=["search"])

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "multi_tenant_erp")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


async def _get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    token = authorization.replace("Bearer ", "")
    try:
        return verify_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def _re_safe(query: str) -> str:
    """Escape regex special chars so user input is treated literally."""
    import re
    return re.escape(query)


@router.get("/")
async def global_search(
    q: str,
    limit: int = 6,
    current_user: dict = Depends(_get_current_user),
):
    """
    Search across employees / financial / inventory / invoices / purchases
    for the current company. Returns at most `limit` items per category.
    """
    q = (q or "").strip()
    if len(q) < 1:
        return {"query": q, "results": {}}

    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="No company in token")

    regex = {"$regex": _re_safe(q), "$options": "i"}
    base_filter = {"company_id": company_id}

    async def _find(coll, projection, query_filter, sort_key="-created_at"):
        sort_field = sort_key.lstrip("-")
        sort_dir = -1 if sort_key.startswith("-") else 1
        try:
            cursor = db[coll].find({**base_filter, **query_filter}, projection)
            if sort_field:
                cursor = cursor.sort(sort_field, sort_dir)
            return await cursor.limit(limit).to_list(length=limit)
        except Exception:
            return []

    # ---------- Employees ----------
    employees = await _find(
        "employees",
        {"_id": 0, "id": 1, "name": 1, "full_name": 1, "email": 1, "position": 1, "department": 1, "phone": 1},
        {"$or": [
            {"name": regex}, {"full_name": regex}, {"email": regex},
            {"position": regex}, {"department": regex}, {"phone": regex},
        ]},
    )

    # ---------- Users (employees with login accounts) ----------
    users = await _find(
        "users",
        {"_id": 0, "id": 1, "full_name": 1, "email": 1, "role": 1},
        {"$or": [{"full_name": regex}, {"email": regex}, {"role": regex}]},
    )

    # ---------- Customers ----------
    customers = await _find(
        "customers",
        {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "balance": 1},
        {"$or": [{"name": regex}, {"email": regex}, {"phone": regex}]},
    )

    # ---------- Suppliers ----------
    suppliers = await _find(
        "suppliers",
        {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1, "balance": 1},
        {"$or": [{"name": regex}, {"email": regex}, {"phone": regex}]},
    )

    # ---------- Invoices ----------
    invoices = await _find(
        "invoices",
        {"_id": 0, "id": 1, "invoice_number": 1, "customer_name": 1, "total": 1, "status": 1, "issued_at": 1, "created_at": 1},
        {"$or": [
            {"invoice_number": regex}, {"customer_name": regex},
        ]},
    )

    # ---------- Purchases ----------
    purchases = await _find(
        "purchases",
        {"_id": 0, "id": 1, "purchase_number": 1, "supplier_name": 1, "total": 1, "status": 1, "created_at": 1},
        {"$or": [
            {"purchase_number": regex}, {"supplier_name": regex},
        ]},
    )

    # ---------- Inventory / Products ----------
    products = await _find(
        "products",
        {"_id": 0, "id": 1, "name": 1, "sku": 1, "category": 1, "quantity": 1, "price": 1},
        {"$or": [{"name": regex}, {"sku": regex}, {"category": regex}]},
    )

    # ---------- Bank accounts ----------
    banks = await _find(
        "banks",
        {"_id": 0, "id": 1, "name": 1, "account_number": 1, "balance": 1},
        {"$or": [{"name": regex}, {"account_number": regex}]},
    )

    results = {
        "employees": employees + users,
        "customers": customers,
        "suppliers": suppliers,
        "invoices": invoices,
        "purchases": purchases,
        "products": products,
        "banks": banks,
    }
    # Strip empty categories so the UI doesn't render empty sections
    results = {k: v for k, v in results.items() if v}
    total = sum(len(v) for v in results.values())

    return {"query": q, "total": total, "results": results}
