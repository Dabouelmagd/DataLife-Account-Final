"""
Bank Management API
إدارة الحسابات البنكية والحركات
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import logging

from api.users import get_current_user
from database import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

# ==========================================
# Models
# ==========================================

class BankAccountCreate(BaseModel):
    """نموذج إنشاء حساب بنكي"""
    bank_name: str = Field(..., description="اسم البنك")
    bank_name_en: Optional[str] = Field(None, description="اسم البنك بالإنجليزية")
    account_number: str = Field(..., description="رقم الحساب")
    iban: Optional[str] = Field(None, description="رقم الآيبان")
    swift_code: Optional[str] = Field(None, description="كود السويفت")
    branch_name: Optional[str] = Field(None, description="اسم الفرع")
    currency: str = Field(default="EGP", description="العملة")
    opening_balance: float = Field(default=0, description="الرصيد الافتتاحي")
    account_type: str = Field(default="current", description="نوع الحساب (جاري/توفير)")
    linked_account_code: Optional[str] = Field(default="162", description="كود الحساب المحاسبي المرتبط")
    is_active: bool = Field(default=True, description="نشط")

class BankAccountUpdate(BaseModel):
    """نموذج تحديث حساب بنكي"""
    bank_name: Optional[str] = None
    bank_name_en: Optional[str] = None
    account_number: Optional[str] = None
    iban: Optional[str] = None
    swift_code: Optional[str] = None
    branch_name: Optional[str] = None
    currency: Optional[str] = None
    account_type: Optional[str] = None
    linked_account_code: Optional[str] = None
    is_active: Optional[bool] = None

class BankTransactionCreate(BaseModel):
    """نموذج إنشاء حركة بنكية"""
    bank_account_id: str = Field(..., description="معرف الحساب البنكي")
    transaction_type: str = Field(..., description="نوع الحركة: deposit, withdrawal, transfer, check_deposit, check_issued")
    amount: float = Field(..., gt=0, description="المبلغ")
    description: str = Field(..., description="الوصف")
    reference: Optional[str] = Field(None, description="المرجع")
    check_number: Optional[str] = Field(None, description="رقم الشيك")
    check_date: Optional[str] = Field(None, description="تاريخ الشيك")
    check_bank: Optional[str] = Field(None, description="بنك الشيك")
    beneficiary: Optional[str] = Field(None, description="المستفيد")
    transaction_date: Optional[str] = Field(None, description="تاريخ الحركة")

# ==========================================
# Bank Accounts APIs
# ==========================================

@router.get("/bank-accounts")
async def get_bank_accounts(current_user: dict = Depends(get_current_user)):
    """جلب جميع الحسابات البنكية للشركة"""
    company_id = current_user["company_id"]
    
    accounts = await db.bank_accounts.find(
        {"company_id": company_id}
    ).sort("created_at", -1).to_list(length=None)
    
    # Calculate current balance for each account
    for acc in accounts:
        acc["id"] = str(acc["_id"])
        del acc["_id"]
        
        # Get sum of transactions
        pipeline = [
            {"$match": {"company_id": company_id, "bank_account_id": acc["id"]}},
            {"$group": {
                "_id": None,
                "total_deposits": {"$sum": {"$cond": [{"$in": ["$transaction_type", ["deposit", "check_deposit", "transfer_in"]]}, "$amount", 0]}},
                "total_withdrawals": {"$sum": {"$cond": [{"$in": ["$transaction_type", ["withdrawal", "check_issued", "transfer_out"]]}, "$amount", 0]}}
            }}
        ]
        
        result = await db.bank_transactions.aggregate(pipeline).to_list(length=1)
        if result:
            acc["total_deposits"] = result[0].get("total_deposits", 0)
            acc["total_withdrawals"] = result[0].get("total_withdrawals", 0)
            acc["current_balance"] = acc.get("opening_balance", 0) + acc["total_deposits"] - acc["total_withdrawals"]
        else:
            acc["total_deposits"] = 0
            acc["total_withdrawals"] = 0
            acc["current_balance"] = acc.get("opening_balance", 0)
    
    # Calculate totals
    total_balance = sum(acc.get("current_balance", 0) for acc in accounts)
    total_deposits = sum(acc.get("total_deposits", 0) for acc in accounts)
    total_withdrawals = sum(acc.get("total_withdrawals", 0) for acc in accounts)
    
    return {
        "accounts": accounts,
        "total": len(accounts),
        "summary": {
            "total_balance": total_balance,
            "total_deposits": total_deposits,
            "total_withdrawals": total_withdrawals
        }
    }

@router.post("/bank-accounts")
async def create_bank_account(
    account: BankAccountCreate,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء حساب بنكي جديد"""
    company_id = current_user["company_id"]
    
    # Check if account number already exists
    existing = await db.bank_accounts.find_one({
        "company_id": company_id,
        "account_number": account.account_number
    })
    if existing:
        raise HTTPException(status_code=400, detail="رقم الحساب موجود بالفعل")
    
    account_dict = account.dict()
    account_dict["company_id"] = company_id
    account_dict["created_at"] = datetime.now(timezone.utc)
    account_dict["created_by"] = current_user["user_id"]
    
    result = await db.bank_accounts.insert_one(account_dict)
    
    return {
        "message": "تم إنشاء الحساب البنكي بنجاح",
        "id": str(result.inserted_id)
    }

@router.put("/bank-accounts/{account_id}")
async def update_bank_account(
    account_id: str,
    account: BankAccountUpdate,
    current_user: dict = Depends(get_current_user)
):
    """تحديث حساب بنكي"""
    company_id = current_user["company_id"]
    
    update_data = {k: v for k, v in account.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="لا توجد بيانات للتحديث")
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    result = await db.bank_accounts.update_one(
        {"_id": ObjectId(account_id), "company_id": company_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="الحساب غير موجود")
    
    return {"message": "تم تحديث الحساب بنجاح"}

@router.delete("/bank-accounts/{account_id}")
async def delete_bank_account(
    account_id: str,
    current_user: dict = Depends(get_current_user)
):
    """حذف حساب بنكي"""
    company_id = current_user["company_id"]
    
    # Check if there are transactions
    transactions_count = await db.bank_transactions.count_documents({
        "company_id": company_id,
        "bank_account_id": account_id
    })
    
    if transactions_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"لا يمكن حذف الحساب لوجود {transactions_count} حركة مرتبطة به"
        )
    
    result = await db.bank_accounts.delete_one({
        "_id": ObjectId(account_id),
        "company_id": company_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="الحساب غير موجود")
    
    return {"message": "تم حذف الحساب بنجاح"}

# ==========================================
# Bank Transactions APIs
# ==========================================

@router.get("/bank-transactions")
async def get_bank_transactions(
    bank_account_id: Optional[str] = None,
    transaction_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """جلب الحركات البنكية"""
    company_id = current_user["company_id"]
    
    query = {"company_id": company_id}
    
    if bank_account_id:
        query["bank_account_id"] = bank_account_id
    
    if transaction_type:
        query["transaction_type"] = transaction_type
    
    if start_date:
        query["transaction_date"] = {"$gte": start_date}
    
    if end_date:
        if "transaction_date" in query:
            query["transaction_date"]["$lte"] = end_date
        else:
            query["transaction_date"] = {"$lte": end_date}
    
    transactions = await db.bank_transactions.find(query).sort("transaction_date", -1).to_list(length=None)
    
    for txn in transactions:
        txn["id"] = str(txn["_id"])
        del txn["_id"]
    
    # Calculate summary
    deposits = sum(t["amount"] for t in transactions if t["transaction_type"] in ["deposit", "check_deposit", "transfer_in"])
    withdrawals = sum(t["amount"] for t in transactions if t["transaction_type"] in ["withdrawal", "check_issued", "transfer_out"])
    
    return {
        "transactions": transactions,
        "total": len(transactions),
        "summary": {
            "total_deposits": deposits,
            "total_withdrawals": withdrawals,
            "net_movement": deposits - withdrawals
        }
    }

@router.post("/bank-transactions")
async def create_bank_transaction(
    transaction: BankTransactionCreate,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء حركة بنكية جديدة"""
    company_id = current_user["company_id"]
    
    # Verify bank account exists
    bank_account = await db.bank_accounts.find_one({
        "_id": ObjectId(transaction.bank_account_id),
        "company_id": company_id
    })
    
    if not bank_account:
        raise HTTPException(status_code=404, detail="الحساب البنكي غير موجود")
    
    # Generate transaction number
    count = await db.bank_transactions.count_documents({"company_id": company_id})
    txn_number = f"BTX-{datetime.now().year}-{str(count + 1).zfill(5)}"
    
    txn_dict = transaction.dict()
    txn_dict["company_id"] = company_id
    txn_dict["transaction_number"] = txn_number
    txn_dict["bank_name"] = bank_account.get("bank_name")
    txn_dict["account_number"] = bank_account.get("account_number")
    txn_dict["transaction_date"] = transaction.transaction_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    txn_dict["created_at"] = datetime.now(timezone.utc)
    txn_dict["created_by"] = current_user["user_id"]
    txn_dict["status"] = "posted"
    
    result = await db.bank_transactions.insert_one(txn_dict)
    
    return {
        "message": "تم إنشاء الحركة بنجاح",
        "id": str(result.inserted_id),
        "transaction_number": txn_number
    }

@router.delete("/bank-transactions/{transaction_id}")
async def delete_bank_transaction(
    transaction_id: str,
    current_user: dict = Depends(get_current_user)
):
    """حذف حركة بنكية"""
    company_id = current_user["company_id"]
    
    result = await db.bank_transactions.delete_one({
        "_id": ObjectId(transaction_id),
        "company_id": company_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="الحركة غير موجودة")
    
    return {"message": "تم حذف الحركة بنجاح"}

# ==========================================
# Check Management APIs
# ==========================================

@router.get("/bank-checks")
async def get_checks(
    check_type: Optional[str] = None,  # incoming, outgoing
    status: Optional[str] = None,  # pending, deposited, cleared, bounced
    current_user: dict = Depends(get_current_user)
):
    """جلب الشيكات"""
    company_id = current_user["company_id"]
    
    query = {"company_id": company_id, "check_number": {"$exists": True, "$ne": None}}
    
    if check_type == "incoming":
        query["transaction_type"] = "check_deposit"
    elif check_type == "outgoing":
        query["transaction_type"] = "check_issued"
    
    if status:
        query["check_status"] = status
    
    checks = await db.bank_transactions.find(query).sort("check_date", -1).to_list(length=None)
    
    for check in checks:
        check["id"] = str(check["_id"])
        del check["_id"]
    
    # Summary
    incoming = [c for c in checks if c.get("transaction_type") == "check_deposit"]
    outgoing = [c for c in checks if c.get("transaction_type") == "check_issued"]
    
    return {
        "checks": checks,
        "total": len(checks),
        "summary": {
            "incoming_count": len(incoming),
            "incoming_total": sum(c["amount"] for c in incoming),
            "outgoing_count": len(outgoing),
            "outgoing_total": sum(c["amount"] for c in outgoing)
        }
    }

@router.put("/bank-checks/{check_id}/status")
async def update_check_status(
    check_id: str,
    status: str,
    current_user: dict = Depends(get_current_user)
):
    """تحديث حالة الشيك"""
    company_id = current_user["company_id"]
    
    valid_statuses = ["pending", "deposited", "cleared", "bounced", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"حالة غير صالحة. الحالات المتاحة: {', '.join(valid_statuses)}")
    
    result = await db.bank_transactions.update_one(
        {"_id": ObjectId(check_id), "company_id": company_id},
        {"$set": {"check_status": status, "updated_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="الشيك غير موجود")
    
    return {"message": "تم تحديث حالة الشيك بنجاح"}
