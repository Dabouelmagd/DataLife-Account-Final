"""
Bank Management API
إدارة الحسابات البنكية والحركات مع الربط بالقيود المحاسبية
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import logging

from api.users import get_current_user
from database import db
from services.accounting_service import AccountingService
from models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus

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
    # الحسابات المحاسبية للقيد التلقائي
    counter_account_code: Optional[str] = Field(None, description="كود الحساب المقابل (للقيد المحاسبي)")
    auto_create_journal: bool = Field(default=True, description="إنشاء قيد محاسبي تلقائياً")


class BankSettings(BaseModel):
    """إعدادات البنك للشركة"""
    auto_post_journal: bool = Field(default=False, description="ترحيل القيود تلقائياً")
    default_deposit_account: str = Field(default="161", description="حساب الإيداع الافتراضي")
    default_withdrawal_account: str = Field(default="331", description="حساب السحب الافتراضي")
    default_check_deposit_account: str = Field(default="131", description="حساب الشيكات الواردة الافتراضي")
    default_check_issued_account: str = Field(default="251", description="حساب الشيكات الصادرة الافتراضي")
    require_approval_above: Optional[float] = Field(None, description="مبلغ يتطلب موافقة فوقه")
    notify_on_large_transaction: bool = Field(default=False, description="إشعار عند معاملة كبيرة")
    large_transaction_threshold: float = Field(default=100000, description="حد المعاملة الكبيرة")

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
    """إنشاء حركة بنكية جديدة مع قيد محاسبي تلقائي"""
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
    
    # إنشاء القيد المحاسبي تلقائياً
    journal_entry_id = None
    journal_entry_number = None
    
    if transaction.auto_create_journal:
        try:
            journal_result = await create_auto_journal_entry(
                company_id=company_id,
                user_id=current_user["user_id"],
                transaction_type=transaction.transaction_type,
                amount=transaction.amount,
                description=transaction.description,
                reference=txn_number,
                bank_account_code=bank_account.get("linked_account_code", "162"),
                counter_account_code=transaction.counter_account_code,
                transaction_date=txn_dict["transaction_date"]
            )
            if journal_result:
                journal_entry_id = journal_result.get("id")
                journal_entry_number = journal_result.get("entry_number")
                
                # ربط القيد بالحركة البنكية
                await db.bank_transactions.update_one(
                    {"_id": result.inserted_id},
                    {"$set": {
                        "journal_entry_id": journal_entry_id,
                        "journal_entry_number": journal_entry_number
                    }}
                )
        except Exception as e:
            logger.warning(f"فشل إنشاء القيد المحاسبي التلقائي: {e}")
    
    return {
        "message": "تم إنشاء الحركة بنجاح",
        "id": str(result.inserted_id),
        "transaction_number": txn_number,
        "journal_entry_id": journal_entry_id,
        "journal_entry_number": journal_entry_number
    }


async def create_auto_journal_entry(
    company_id: str,
    user_id: str,
    transaction_type: str,
    amount: float,
    description: str,
    reference: str,
    bank_account_code: str,
    counter_account_code: Optional[str],
    transaction_date: str
) -> Optional[dict]:
    """
    إنشاء قيد محاسبي تلقائي للحركة البنكية
    
    أنواع القيود:
    - deposit (إيداع): من حساب مقابل إلى البنك
    - withdrawal (سحب): من البنك إلى حساب مقابل
    - check_deposit (شيك وارد): من العملاء إلى البنك
    - check_issued (شيك صادر): من البنك إلى الموردون/المصروفات
    - transfer_in (تحويل وارد): من بنك آخر إلى البنك
    - transfer_out (تحويل صادر): من البنك إلى بنك آخر
    """
    service = AccountingService(db)
    
    # جلب إعدادات البنك للشركة
    bank_settings = await get_company_bank_settings(company_id)
    auto_post = bank_settings.get("auto_post_journal", False)
    
    # الحصول على حساب البنك من دليل الحسابات
    bank_account = await service.get_account_by_code(company_id, bank_account_code)
    if not bank_account:
        # استخدم حساب البنوك الافتراضي (162)
        bank_account = await service.get_account_by_code(company_id, "162")
    
    if not bank_account:
        logger.error(f"حساب البنك غير موجود: {bank_account_code}")
        return None
    
    # تحديد الحساب المقابل بناءً على نوع العملية أو من الإعدادات
    if not counter_account_code:
        # استخدم الحساب الافتراضي من الإعدادات
        counter_account_code = get_default_counter_account_from_settings(transaction_type, bank_settings)
    
    counter_account = await service.get_account_by_code(company_id, counter_account_code)
    if not counter_account:
        logger.error(f"الحساب المقابل غير موجود: {counter_account_code}")
        return None
    
    # بناء سطور القيد بناءً على نوع العملية
    lines = []
    
    if transaction_type in ["deposit", "check_deposit", "transfer_in"]:
        # إيداع: البنك مدين، الحساب المقابل دائن
        lines = [
            JournalEntryLine(
                account_id=bank_account.get("id"),
                account_code=bank_account.get("account_code"),
                account_name=bank_account.get("account_name"),
                debit=amount,
                credit=0,
                description=f"إيداع: {description}"
            ),
            JournalEntryLine(
                account_id=counter_account.get("id"),
                account_code=counter_account.get("account_code"),
                account_name=counter_account.get("account_name"),
                debit=0,
                credit=amount,
                description=f"إيداع: {description}"
            )
        ]
    elif transaction_type in ["withdrawal", "check_issued", "transfer_out"]:
        # سحب: الحساب المقابل مدين، البنك دائن
        lines = [
            JournalEntryLine(
                account_id=counter_account.get("id"),
                account_code=counter_account.get("account_code"),
                account_name=counter_account.get("account_name"),
                debit=amount,
                credit=0,
                description=f"سحب: {description}"
            ),
            JournalEntryLine(
                account_id=bank_account.get("id"),
                account_code=bank_account.get("account_code"),
                account_name=bank_account.get("account_name"),
                debit=0,
                credit=amount,
                description=f"سحب: {description}"
            )
        ]
    else:
        logger.warning(f"نوع عملية غير معروف: {transaction_type}")
        return None
    
    # إنشاء القيد اليومي
    # تحديد حالة القيد بناءً على إعدادات الترحيل التلقائي
    entry_status = JournalEntryStatus.POSTED if auto_post else JournalEntryStatus.DRAFT
    
    entry = JournalEntry(
        company_id=company_id,
        entry_number=0,  # سيتم تحديده تلقائياً
        entry_date=transaction_date,
        reference=reference,
        description=f"قيد تلقائي - {get_transaction_type_label(transaction_type)}: {description}",
        lines=lines,
        created_by=user_id,
        status=entry_status
    )
    
    try:
        result = await service.create_journal_entry(entry)
        status_label = "مرحّل" if auto_post else "مسودة"
        logger.info(f"تم إنشاء قيد محاسبي تلقائي رقم {result.get('entry_number')} ({status_label}) للحركة البنكية {reference}")
        
        # إذا كان الترحيل تلقائي، قم بترحيل القيد
        if auto_post:
            try:
                await service.post_journal_entry(result.get('id'), user_id)
                result['status'] = 'posted'
                result['auto_posted'] = True
            except Exception as post_error:
                logger.warning(f"فشل ترحيل القيد تلقائياً: {post_error}")
                result['auto_posted'] = False
        
        return result
    except Exception as e:
        logger.error(f"فشل إنشاء القيد المحاسبي: {e}")
        return None


def get_default_counter_account(transaction_type: str) -> str:
    """
    الحصول على الحساب المقابل الافتراضي بناءً على نوع العملية
    """
    defaults = {
        "deposit": "161",         # النقدية بالصندوق (تحويل من الخزينة للبنك)
        "withdrawal": "331",      # رواتب وأجور إدارية (افتراضي)
        "check_deposit": "131",   # العملاء (شيك وارد من عميل)
        "check_issued": "251",    # الموردون (شيك صادر لمورد)
        "transfer_in": "162",     # حساب بنك آخر
        "transfer_out": "162",    # حساب بنك آخر
    }
    return defaults.get(transaction_type, "161")


def get_default_counter_account_from_settings(transaction_type: str, settings: dict) -> str:
    """
    الحصول على الحساب المقابل الافتراضي من إعدادات الشركة
    """
    if transaction_type == "deposit":
        return settings.get("default_deposit_account", "161")
    elif transaction_type == "withdrawal":
        return settings.get("default_withdrawal_account", "331")
    elif transaction_type == "check_deposit":
        return settings.get("default_check_deposit_account", "131")
    elif transaction_type == "check_issued":
        return settings.get("default_check_issued_account", "251")
    else:
        return "161"


def get_transaction_type_label(transaction_type: str) -> str:
    """
    الحصول على اسم نوع العملية بالعربية
    """
    labels = {
        "deposit": "إيداع",
        "withdrawal": "سحب",
        "check_deposit": "شيك وارد",
        "check_issued": "شيك صادر",
        "transfer_in": "تحويل وارد",
        "transfer_out": "تحويل صادر",
    }
    return labels.get(transaction_type, transaction_type)

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



# ==========================================
# Counter Accounts APIs - الحسابات المقابلة
# ==========================================

@router.get("/bank-counter-accounts")
async def get_counter_accounts(
    transaction_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    جلب الحسابات المقابلة المتاحة للحركات البنكية
    يُستخدم لتحديد الحساب المقابل عند إنشاء حركة بنكية
    """
    company_id = current_user["company_id"]
    service = AccountingService(db)
    
    # تهيئة دليل الحسابات إذا لم يكن موجوداً
    await service.initialize_chart_of_accounts(company_id)
    
    # جلب الحسابات الفرعية فقط (التي تقبل حركات)
    accounts = await service.get_all_accounts(company_id, active_only=True)
    
    # فلترة الحسابات الرئيسية (headers)
    sub_accounts = [
        acc for acc in accounts 
        if not acc.get("is_header", False)
    ]
    
    # الحسابات الموصى بها لكل نوع عملية
    recommended_accounts = {
        "deposit": {
            "description": "إيداع نقدي للبنك",
            "recommended_codes": ["161", "131", "411", "412", "422"],  # نقدية، عملاء، إيرادات
            "journal_logic": "البنك (مدين) ← الحساب المقابل (دائن)"
        },
        "withdrawal": {
            "description": "سحب نقدي من البنك",
            "recommended_codes": ["161", "331", "332", "334", "341"],  # نقدية، مصروفات
            "journal_logic": "الحساب المقابل (مدين) ← البنك (دائن)"
        },
        "check_deposit": {
            "description": "إيداع شيك وارد",
            "recommended_codes": ["131", "132", "411"],  # عملاء، أوراق قبض
            "journal_logic": "البنك (مدين) ← الحساب المقابل (دائن)"
        },
        "check_issued": {
            "description": "صرف شيك",
            "recommended_codes": ["251", "252", "253", "331"],  # موردون، أوراق دفع، مصروفات
            "journal_logic": "الحساب المقابل (مدين) ← البنك (دائن)"
        },
        "transfer_in": {
            "description": "تحويل وارد من بنك آخر",
            "recommended_codes": ["162"],  # بنك آخر
            "journal_logic": "البنك المستلم (مدين) ← البنك المرسل (دائن)"
        },
        "transfer_out": {
            "description": "تحويل صادر لبنك آخر",
            "recommended_codes": ["162"],  # بنك آخر
            "journal_logic": "البنك المستلم (مدين) ← البنك المرسل (دائن)"
        }
    }
    
    result = {
        "accounts": sub_accounts,
        "total": len(sub_accounts),
        "transaction_types": recommended_accounts
    }
    
    if transaction_type and transaction_type in recommended_accounts:
        # فلترة الحسابات الموصى بها لنوع العملية المحدد
        rec_codes = recommended_accounts[transaction_type]["recommended_codes"]
        recommended = [
            acc for acc in sub_accounts 
            if acc.get("account_code") in rec_codes
        ]
        result["recommended_for_type"] = {
            "type": transaction_type,
            "info": recommended_accounts[transaction_type],
            "accounts": recommended
        }
    
    return result


@router.get("/bank-transactions/{transaction_id}/journal-entry")
async def get_transaction_journal_entry(
    transaction_id: str,
    current_user: dict = Depends(get_current_user)
):
    """جلب القيد المحاسبي المرتبط بحركة بنكية"""
    company_id = current_user["company_id"]
    
    # جلب الحركة البنكية
    transaction = await db.bank_transactions.find_one({
        "_id": ObjectId(transaction_id),
        "company_id": company_id
    })
    
    if not transaction:
        raise HTTPException(status_code=404, detail="الحركة البنكية غير موجودة")
    
    journal_entry_id = transaction.get("journal_entry_id")
    if not journal_entry_id:
        return {
            "has_journal_entry": False,
            "message": "لا يوجد قيد محاسبي مرتبط بهذه الحركة",
            "transaction_number": transaction.get("transaction_number")
        }
    
    # جلب القيد المحاسبي
    service = AccountingService(db)
    journal_entry = await service.get_journal_entry(journal_entry_id)
    
    if not journal_entry:
        return {
            "has_journal_entry": False,
            "message": "القيد المحاسبي غير موجود",
            "journal_entry_id": journal_entry_id
        }
    
    return {
        "has_journal_entry": True,
        "transaction_number": transaction.get("transaction_number"),
        "journal_entry": journal_entry
    }


@router.post("/bank-transactions/{transaction_id}/create-journal")
async def create_journal_for_existing_transaction(
    transaction_id: str,
    counter_account_code: str,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء قيد محاسبي لحركة بنكية موجودة لم يُنشأ لها قيد سابقاً"""
    company_id = current_user["company_id"]
    
    # جلب الحركة البنكية
    transaction = await db.bank_transactions.find_one({
        "_id": ObjectId(transaction_id),
        "company_id": company_id
    })
    
    if not transaction:
        raise HTTPException(status_code=404, detail="الحركة البنكية غير موجودة")
    
    if transaction.get("journal_entry_id"):
        raise HTTPException(status_code=400, detail="يوجد قيد محاسبي مرتبط بهذه الحركة بالفعل")
    
    # جلب الحساب البنكي
    bank_account = await db.bank_accounts.find_one({
        "_id": ObjectId(transaction.get("bank_account_id")),
        "company_id": company_id
    })
    
    if not bank_account:
        raise HTTPException(status_code=404, detail="الحساب البنكي غير موجود")
    
    # إنشاء القيد
    journal_result = await create_auto_journal_entry(
        company_id=company_id,
        user_id=current_user["user_id"],
        transaction_type=transaction.get("transaction_type"),
        amount=transaction.get("amount"),
        description=transaction.get("description"),
        reference=transaction.get("transaction_number"),
        bank_account_code=bank_account.get("linked_account_code", "162"),
        counter_account_code=counter_account_code,
        transaction_date=transaction.get("transaction_date")
    )
    
    if not journal_result:
        raise HTTPException(status_code=500, detail="فشل إنشاء القيد المحاسبي")
    
    # تحديث الحركة البنكية بربط القيد
    await db.bank_transactions.update_one(
        {"_id": ObjectId(transaction_id)},
        {"$set": {
            "journal_entry_id": journal_result.get("id"),
            "journal_entry_number": journal_result.get("entry_number")
        }}
    )
    
    return {
        "message": "تم إنشاء القيد المحاسبي بنجاح",
        "transaction_number": transaction.get("transaction_number"),
        "journal_entry_id": journal_result.get("id"),
        "journal_entry_number": journal_result.get("entry_number")
    }



# ==========================================
# Bank Settings APIs - إعدادات البنك
# ==========================================

@router.get("/bank-settings")
async def get_bank_settings(current_user: dict = Depends(get_current_user)):
    """جلب إعدادات البنك للشركة"""
    company_id = current_user["company_id"]
    
    settings = await db.bank_settings.find_one({"company_id": company_id})
    
    if not settings:
        # إرجاع الإعدادات الافتراضية
        return {
            "auto_post_journal": False,
            "default_deposit_account": "161",
            "default_withdrawal_account": "331",
            "default_check_deposit_account": "131",
            "default_check_issued_account": "251",
            "require_approval_above": None,
            "notify_on_large_transaction": False,
            "large_transaction_threshold": 100000
        }
    
    return {
        "auto_post_journal": settings.get("auto_post_journal", False),
        "default_deposit_account": settings.get("default_deposit_account", "161"),
        "default_withdrawal_account": settings.get("default_withdrawal_account", "331"),
        "default_check_deposit_account": settings.get("default_check_deposit_account", "131"),
        "default_check_issued_account": settings.get("default_check_issued_account", "251"),
        "require_approval_above": settings.get("require_approval_above"),
        "notify_on_large_transaction": settings.get("notify_on_large_transaction", False),
        "large_transaction_threshold": settings.get("large_transaction_threshold", 100000)
    }


@router.put("/bank-settings")
async def update_bank_settings(
    settings: BankSettings,
    current_user: dict = Depends(get_current_user)
):
    """تحديث إعدادات البنك للشركة"""
    company_id = current_user["company_id"]
    
    settings_dict = settings.dict()
    settings_dict["company_id"] = company_id
    settings_dict["updated_at"] = datetime.now(timezone.utc)
    settings_dict["updated_by"] = current_user["user_id"]
    
    await db.bank_settings.update_one(
        {"company_id": company_id},
        {"$set": settings_dict},
        upsert=True
    )
    
    return {
        "message": "تم تحديث الإعدادات بنجاح",
        **settings_dict
    }


async def get_company_bank_settings(company_id: str) -> dict:
    """
    جلب إعدادات البنك للشركة (دالة داخلية)
    تُستخدم عند إنشاء الحركات البنكية
    """
    settings = await db.bank_settings.find_one({"company_id": company_id})
    
    if not settings:
        return {
            "auto_post_journal": False,
            "default_deposit_account": "161",
            "default_withdrawal_account": "331",
            "default_check_deposit_account": "131",
            "default_check_issued_account": "251"
        }
    
    return settings
