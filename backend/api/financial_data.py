from fastapi import APIRouter, HTTPException, Depends, Header
from models.financial_data import JournalEntry, TreasuryTransaction, BankTransaction, Customer, Supplier
from services.auth_service import verify_token
from typing import Optional, List
from database import get_database

router = APIRouter(prefix="/api/financial", tags=["financial"])
db = get_database()

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
@router.get("/journal-entries", response_model=List[JournalEntry])
async def get_journal_entries(current_user: dict = Depends(get_current_user)):
    """Get all journal entries for the user's company"""
    company_id = current_user.get("company_id")
    entries = await db.journal_entries.find({"company_id": company_id}).to_list(length=None)
    return [JournalEntry(**e) for e in entries]

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
@router.get("/treasury", response_model=List[TreasuryTransaction])
async def get_treasury_transactions(current_user: dict = Depends(get_current_user)):
    """Get all treasury transactions for the user's company"""
    company_id = current_user.get("company_id")
    transactions = await db.treasury_transactions.find({"company_id": company_id}).to_list(length=None)
    return [TreasuryTransaction(**t) for t in transactions]

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
@router.get("/bank", response_model=List[BankTransaction])
async def get_bank_transactions(current_user: dict = Depends(get_current_user)):
    """Get all bank transactions for the user's company"""
    company_id = current_user.get("company_id")
    transactions = await db.bank_transactions.find({"company_id": company_id}).to_list(length=None)
    return [BankTransaction(**t) for t in transactions]

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
@router.get("/customers", response_model=List[Customer])
async def get_customers(current_user: dict = Depends(get_current_user)):
    """Get all customers for the user's company"""
    company_id = current_user.get("company_id")
    customers = await db.customers.find({"company_id": company_id}).to_list(length=None)
    return [Customer(**c) for c in customers]

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
@router.get("/suppliers", response_model=List[Supplier])
async def get_suppliers(current_user: dict = Depends(get_current_user)):
    """Get all suppliers for the user's company"""
    company_id = current_user.get("company_id")
    suppliers = await db.suppliers.find({"company_id": company_id}).to_list(length=None)
    return [Supplier(**s) for s in suppliers]

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
