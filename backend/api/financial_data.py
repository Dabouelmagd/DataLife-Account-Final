from fastapi import APIRouter, HTTPException, Depends, Header, Query
from models.financial_data import JournalEntry, TreasuryTransaction, BankTransaction, Customer, Supplier
from services.auth_service import verify_token
from typing import Optional, List
from database import get_database

router = APIRouter(prefix="/api/financial", tags=["financial"])
db = get_database()

# Default pagination settings
DEFAULT_PAGE_SIZE = 100
MAX_PAGE_SIZE = 1000

async def get_current_user(authorization: Optional[str] = Header(None)):
    """Dependency to get current user from JWT token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return payload

# Journal Entries
@router.get("/journal-entries")
async def get_journal_entries(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
):
    """Get journal entries for the user's company with pagination"""
    company_id = current_user.get("company_id")
    skip = (page - 1) * limit
    
    total = await db.journal_entries.count_documents({"company_id": company_id})
    entries = await db.journal_entries.find(
        {"company_id": company_id},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "data": entries,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }

@router.post("/journal-entries")
async def create_journal_entry(entry: JournalEntry, current_user: dict = Depends(get_current_user)):
    """Create new journal entry"""
    allowed_roles = ["General Manager", "CEO", "Board Chairman", "Financial Manager", "Chief Accountant",
                     "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة", "المدير المالي", "رئيس الحسابات"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    entry.company_id = current_user.get("company_id")
    await db.journal_entries.insert_one(entry.dict())
    return {"message": "Journal entry created successfully", "id": entry.id}

# Treasury
@router.get("/treasury")
async def get_treasury_transactions(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
):
    """Get treasury transactions for the user's company with pagination"""
    company_id = current_user.get("company_id")
    skip = (page - 1) * limit
    
    total = await db.treasury_transactions.count_documents({"company_id": company_id})
    transactions = await db.treasury_transactions.find(
        {"company_id": company_id},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "data": transactions,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }

@router.post("/treasury")
async def create_treasury_transaction(transaction: TreasuryTransaction, current_user: dict = Depends(get_current_user)):
    """Create new treasury transaction"""
    allowed_roles = ["General Manager", "CEO", "Board Chairman", "Financial Manager", "Chief Accountant",
                     "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة", "المدير المالي", "رئيس الحسابات"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    transaction.company_id = current_user.get("company_id")
    await db.treasury_transactions.insert_one(transaction.dict())
    return {"message": "Treasury transaction created successfully", "id": transaction.id}

# Bank
@router.get("/bank")
async def get_bank_transactions(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
):
    """Get bank transactions for the user's company with pagination"""
    company_id = current_user.get("company_id")
    skip = (page - 1) * limit
    
    total = await db.bank_transactions.count_documents({"company_id": company_id})
    transactions = await db.bank_transactions.find(
        {"company_id": company_id},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "data": transactions,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }

@router.post("/bank")
async def create_bank_transaction(transaction: BankTransaction, current_user: dict = Depends(get_current_user)):
    """Create new bank transaction"""
    allowed_roles = ["General Manager", "CEO", "Board Chairman", "Financial Manager", "Chief Accountant",
                     "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة", "المدير المالي", "رئيس الحسابات"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    transaction.company_id = current_user.get("company_id")
    await db.bank_transactions.insert_one(transaction.dict())
    return {"message": "Bank transaction created successfully", "id": transaction.id}

# Customers
@router.get("/customers")
async def get_customers(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
):
    """Get customers for the user's company with pagination"""
    company_id = current_user.get("company_id")
    skip = (page - 1) * limit
    
    total = await db.customers.count_documents({"company_id": company_id})
    customers = await db.customers.find(
        {"company_id": company_id},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "data": customers,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }

@router.post("/customers")
async def create_customer(customer: Customer, current_user: dict = Depends(get_current_user)):
    """Create new customer"""
    allowed_roles = ["General Manager", "CEO", "Board Chairman", "Financial Manager", "Chief Accountant",
                     "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة", "المدير المالي", "رئيس الحسابات"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    customer.company_id = current_user.get("company_id")
    await db.customers.insert_one(customer.dict())
    return {"message": "Customer created successfully", "id": customer.id}

# Suppliers
@router.get("/suppliers")
async def get_suppliers(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
):
    """Get suppliers for the user's company with pagination"""
    company_id = current_user.get("company_id")
    skip = (page - 1) * limit
    
    total = await db.suppliers.count_documents({"company_id": company_id})
    suppliers = await db.suppliers.find(
        {"company_id": company_id},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "data": suppliers,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }

@router.post("/suppliers")
async def create_supplier(supplier: Supplier, current_user: dict = Depends(get_current_user)):
    """Create new supplier"""
    allowed_roles = ["General Manager", "CEO", "Board Chairman", "Financial Manager", "Chief Accountant",
                     "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة", "المدير المالي", "رئيس الحسابات"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    supplier.company_id = current_user.get("company_id")
    await db.suppliers.insert_one(supplier.dict())
    return {"message": "Supplier created successfully", "id": supplier.id}
