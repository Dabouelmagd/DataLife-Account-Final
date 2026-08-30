"""
API للنظام المحاسبي
Accounting API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from models.accounting import (
    ChartOfAccount, JournalEntry, JournalEntryLine, JournalEntryStatus,
    AccountType, AccountCategory, FiscalYear
)
from services.accounting_service import AccountingService
from api.users import get_current_user
from services.audit_helper import log_financial_action

from database import db

router = APIRouter(prefix="/api/accounting", tags=["accounting"])


# ==========================================
# Request Models
# ==========================================

class CreateAccountRequest(BaseModel):
    account_code: str
    account_name: str
    account_name_en: Optional[str] = None
    account_type: AccountType
    account_category: AccountCategory
    parent_account_id: Optional[str] = None
    opening_balance: float = 0.0
    description: Optional[str] = None
    is_reconciliation: bool = False   # يحتاج تسوية (بنوك/عملاء/موردون)
    currency_id: str = "EGP"          # العملة
    allow_posting: bool = True         # يقبل قيوداً (False للحسابات التجميعية)


class UpdateAccountRequest(BaseModel):
    account_name: Optional[str] = None
    account_name_en: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class JournalLineRequest(BaseModel):
    account_id: str
    debit: float = 0.0
    credit: float = 0.0
    description: Optional[str] = None


class CreateJournalEntryRequest(BaseModel):
    entry_date: str
    reference: Optional[str] = None
    description: str
    lines: List[JournalLineRequest]


class CreateFiscalYearRequest(BaseModel):
    name: str
    start_date: str
    end_date: str


# ==========================================
# دليل الحسابات - Chart of Accounts
# ==========================================

@router.get("/accounts")
async def get_accounts(
    active_only: bool = Query(True, description="Only active accounts"),
    account_type: Optional[str] = Query(None, description="Filter by type"),
    is_reconciliation: Optional[bool] = Query(None),
    allow_posting: Optional[bool] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """الحصول على جميع الحسابات مع فلترة متقدمة"""
    service = AccountingService(db)
    await service.initialize_chart_of_accounts(current_user["company_id"])
    accounts = await service.get_all_accounts(current_user["company_id"], active_only)
    
    # Apply filters
    if account_type:
        accounts = [a for a in accounts if a.get("account_type") == account_type]
    if is_reconciliation is not None:
        accounts = [a for a in accounts if a.get("is_reconciliation") == is_reconciliation]
    if allow_posting is not None:
        accounts = [a for a in accounts if a.get("allow_posting", True) == allow_posting]
    
    return {"accounts": accounts, "total": len(accounts)}


@router.get("/accounts/tree")
async def get_accounts_tree(
    active_only: bool = Query(True),
    current_user: dict = Depends(get_current_user),
):
    """
    الحصول على دليل الحسابات كشجرة هرمية (Self-Referencing Tree)
    كل حساب يحمل: account_code, name, type, level, children[]
    """
    service = AccountingService(db)
    await service.initialize_chart_of_accounts(current_user["company_id"])
    accounts = await service.get_all_accounts(current_user["company_id"], active_only)
    
    # ── Build tree from flat list ─────────────────────────────────
    # Map by id for O(1) lookup
    acc_map = {a["id"]: {**a, "children": [], "level": 0} for a in accounts}
    roots   = []
    
    for a in acc_map.values():
        parent_id = a.get("parent_account_id")
        if parent_id and parent_id in acc_map:
            acc_map[parent_id]["children"].append(a)
        else:
            roots.append(a)  # root account (no parent)
    
    # ── Assign levels recursively ──────────────────────────────────
    def assign_levels(node, level=1):
        node["level"] = level
        # طبيعة الحساب (مدين/دائن) حسب النوع
        from models.accounting import AccountType, get_account_nature
        try:
            at = AccountType(node.get("account_type", "asset"))
            node["normal_balance"] = node.get("normal_balance") or get_account_nature(at)
        except Exception:
            node["normal_balance"] = "debit"
        # is_posting = no children means it accepts postings
        node["allow_posting"] = node.get("allow_posting", True)
        for child in node["children"]:
            assign_levels(child, level + 1)
    
    for root in roots:
        assign_levels(root, 1)
    
    # Sort by account_code at each level
    def sort_tree(nodes):
        nodes.sort(key=lambda x: x.get("account_code", ""))
        for node in nodes:
            sort_tree(node["children"])
    
    sort_tree(roots)
    
    total_leaf   = sum(1 for a in accounts if not any(
        b.get("parent_account_id") == a["id"] for b in accounts))
    reconcil_acc = [a for a in accounts if a.get("is_reconciliation")]
    
    return {
        "tree": roots,
        "summary": {
            "total_accounts": len(accounts),
            "root_accounts": len(roots),
            "leaf_accounts": total_leaf,
            "reconciliation_accounts": len(reconcil_acc),
            "reconciliation_codes": [a["account_code"] for a in reconcil_acc]
        }
    }


@router.get("/accounts/{account_id}")
async def get_account(
    account_id: str,
    current_user: dict = Depends(get_current_user),
    
):
    """الحصول على حساب محدد"""
    service = AccountingService(db)
    account = await service.get_account_by_id(account_id)
    
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    return account


@router.post("/accounts")
async def create_account(
    request: CreateAccountRequest,
    current_user: dict = Depends(get_current_user),
    
):
    """إنشاء حساب جديد"""
    service = AccountingService(db)
    
    account = ChartOfAccount(
        company_id=current_user["company_id"],
        **request.dict()
    )
    
    try:
        result = await service.create_account(account)
        return {"message": "تم إنشاء الحساب بنجاح", "account": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/accounts/{account_id}")
async def update_account(
    account_id: str,
    request: UpdateAccountRequest,
    current_user: dict = Depends(get_current_user),
    
):
    """تحديث حساب"""
    service = AccountingService(db)
    
    updates = {k: v for k, v in request.dict().items() if v is not None}
    result = await service.update_account(account_id, updates)
    
    if not result:
        raise HTTPException(status_code=404, detail="Account not found or is a system account")
    
    return {"message": "تم تحديث الحساب بنجاح", "account": result}


@router.delete("/accounts/{account_id}")
async def delete_account(
    account_id: str,
    current_user: dict = Depends(get_current_user),
    
):
    """حذف حساب"""
    service = AccountingService(db)
    
    try:
        success = await service.delete_account(account_id)
        if not success:
            raise HTTPException(status_code=404, detail="Account not found or is a system account")
        return {"message": "تم حذف الحساب بنجاح"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/accounts/reinitialize")
async def reinitialize_chart_of_accounts(
    current_user: dict = Depends(get_current_user),
):
    """
    إعادة تهيئة دليل الحسابات بالمعيار المصري
    تحذير: هذا سيحذف جميع الحسابات الموجودة ويستبدلها بالدليل المصري القياسي
    """
    service = AccountingService(db)
    
    # حذف الحسابات الحالية
    await db.chart_of_accounts.delete_many({"company_id": current_user["company_id"]})
    
    # إعادة التهيئة بالدليل المصري
    success = await service.initialize_chart_of_accounts(current_user["company_id"])
    
    if success:
        accounts = await service.get_all_accounts(current_user["company_id"], active_only=False)
        return {
            "message": "تم إعادة تهيئة دليل الحسابات بالمعيار المصري القياسي بنجاح",
            "accounts_count": len(accounts)
        }
    else:
        raise HTTPException(status_code=500, detail="حدث خطأ أثناء إعادة تهيئة دليل الحسابات")




# ==========================================
# القيود اليومية - Journal Entries
# ==========================================

@router.get("/journal-entries")
async def get_journal_entries(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    status: Optional[str] = Query(None, description="Entry status"),
    limit: int = Query(100, le=500),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user),
    
):
    """الحصول على القيود اليومية"""
    service = AccountingService(db)
    entries = await service.get_journal_entries(
        current_user["company_id"],
        start_date, end_date, status, limit, skip
    )
    return {"entries": entries, "total": len(entries)}


@router.get("/journal-entries/{entry_id}")
async def get_journal_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user),
    
):
    """الحصول على قيد يومي محدد"""
    service = AccountingService(db)
    entry = await service.get_journal_entry(entry_id)
    
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    
    return entry


@router.post("/journal-entries")
async def create_journal_entry(
    request: CreateJournalEntryRequest,
    current_user: dict = Depends(get_current_user),
    
):
    """إنشاء قيد يومي جديد"""
    service = AccountingService(db)
    
    # بناء سطور القيد مع معلومات الحساب
    lines = []
    for line_req in request.lines:
        account = await service.get_account_by_id(line_req.account_id)
        if not account:
            raise HTTPException(
                status_code=400, 
                detail=f"Account {line_req.account_id} not found"
            )
        
        lines.append(JournalEntryLine(
            account_id=line_req.account_id,
            account_code=account["account_code"],
            account_name=account["account_name"],
            debit=line_req.debit,
            credit=line_req.credit,
            description=line_req.description
        ))
    
    entry = JournalEntry(
        company_id=current_user["company_id"],
        entry_number=0,  # Will be set by service
        entry_date=request.entry_date,
        reference=request.reference,
        description=request.description,
        lines=lines,
        created_by=current_user["user_id"]
    )
    
    try:
        result = await service.create_journal_entry(entry)
        return {"message": "تم إنشاء القيد بنجاح", "entry": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/journal-entries/{entry_id}/post")
async def post_journal_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user),
    
):
    """ترحيل قيد يومي إلى دفتر الأستاذ"""
    service = AccountingService(db)
    
    try:
        await service.post_journal_entry(entry_id, current_user["user_id"])
        return {"message": "تم ترحيل القيد بنجاح"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/journal-entries/{entry_id}/approve")
async def approve_journal_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user),
):
    """اعتماد القيد من المسؤول المالي قبل الترحيل"""
    entry = await db.journal_entries.find_one(
        {"id": entry_id, "company_id": current_user["company_id"]}, {"_id": 0}
    )
    if not entry:
        raise HTTPException(status_code=404, detail="القيد غير موجود")
    if entry.get("status") == "posted":
        raise HTTPException(status_code=400, detail="القيد مرحّل — لا يمكن تعديل الاعتماد")
    if entry.get("status") == "canceled":
        raise HTTPException(status_code=400, detail="القيد ملغي")
    role = current_user.get("role", "")
    if role not in {"owner", "ceo", "general_manager", "accountant", "financial_manager"}:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية اعتماد القيود")
    from datetime import datetime as _dt, timezone as _tz
    await db.journal_entries.update_one(
        {"id": entry_id},
        {"$set": {
            "approved_by": current_user["user_id"],
            "approved_at": _dt.now(_tz.utc).isoformat(),
        }}
    )
    return {"message": "تم اعتماد القيد بنجاح", "approved_by": current_user.get("name")}


@router.put("/journal-entries/{entry_id}/cancel")
async def cancel_journal_entry(
    entry_id: str,
    reason: str = "إلغاء القيد",
    current_user: dict = Depends(get_current_user),
):
    """إلغاء قيد مسودة فقط — SQL: status='canceled'"""
    entry = await db.journal_entries.find_one(
        {"id": entry_id, "company_id": current_user["company_id"]}, {"_id": 0}
    )
    if not entry:
        raise HTTPException(status_code=404, detail="القيد غير موجود")
    if entry.get("status") == "posted":
        raise HTTPException(
            status_code=400,
            detail="لا يمكن إلغاء قيد مرحّل — أنشئ قيداً عكسياً بدلاً من ذلك"
        )
    if entry.get("status") == "canceled":
        raise HTTPException(status_code=400, detail="القيد ملغي بالفعل")
    from datetime import datetime as _dt, timezone as _tz
    await db.journal_entries.update_one(
        {"id": entry_id},
        {"$set": {
            "status":       "canceled",
            "cancel_reason": reason,
            "canceled_by":  current_user["user_id"],
            "canceled_at":  _dt.now(_tz.utc).isoformat(),
        }}
    )
    await db.audit_logs.insert_one({
        "company_id": current_user["company_id"],
        "user_id":    current_user["user_id"],
        "action":     "journal_entry.canceled",
        "entity_id":  entry_id,
        "details":    f"إلغاء القيد {entry.get('entry_number_str', entry_id)} — {reason}",
        "timestamp":  _dt.now(_tz.utc).isoformat(),
    })
    return {"message": "تم إلغاء القيد بنجاح"}


@router.put("/journal-entries/{entry_id}")
async def update_journal_entry(
    entry_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user),
):
    """تعديل قيد مسودة فقط — IMMUTABLE بعد الترحيل"""
    entry = await db.journal_entries.find_one(
        {"id": entry_id, "company_id": current_user["company_id"]}, {"_id": 0}
    )
    if not entry:
        raise HTTPException(status_code=404, detail="القيد غير موجود")
    if entry.get("status") == "posted":
        raise HTTPException(
            status_code=400,
            detail="IMMUTABILITY VIOLATION: القيد مرحّل — استخدم القيد العكسي لتصحيح الخطأ"
        )
    if entry.get("status") == "canceled":
        raise HTTPException(status_code=400, detail="القيد ملغي ولا يمكن تعديله")
    EDITABLE = {"description", "narration", "reference", "lines", "entry_date"}
    update = {k: v for k, v in data.items() if k in EDITABLE}
    if not update:
        raise HTTPException(status_code=400, detail="لا توجد حقول قابلة للتعديل")
    if "lines" in update:
        td = sum(float(l.get("debit",  0)) for l in update["lines"])
        tc = sum(float(l.get("credit", 0)) for l in update["lines"])
        if abs(td - tc) > 0.01:
            raise HTTPException(status_code=400,
                detail=f"القيد غير متوازن: مدين {td:.2f} ≠ دائن {tc:.2f}")
        update["total_debit"]  = round(td, 2)
        update["total_credit"] = round(tc, 2)
    from datetime import datetime as _dt, timezone as _tz
    update["updated_at"] = _dt.now(_tz.utc).isoformat()
    await db.journal_entries.update_one({"id": entry_id}, {"$set": update})
    return {"message": "تم تعديل القيد بنجاح"}


@router.post("/journal-entries/{entry_id}/reverse")
async def reverse_journal_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user),
    
):
    """عكس قيد يومي"""
    service = AccountingService(db)
    
    try:
        result = await service.reverse_journal_entry(entry_id, current_user["user_id"])
        return {"message": "تم عكس القيد بنجاح", "reversed_entry": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==========================================
# دفتر الأستاذ - General Ledger
# ==========================================

@router.get("/ledger")
async def get_ledger_entries(
    account_id: Optional[str] = Query(None, description="Account ID"),
    start_date: Optional[str] = Query(None, description="Start date"),
    end_date: Optional[str] = Query(None, description="End date"),
    current_user: dict = Depends(get_current_user),
    
):
    """الحصول على قيود دفتر الأستاذ"""
    service = AccountingService(db)
    entries = await service.get_ledger_entries(
        current_user["company_id"],
        account_id, start_date, end_date
    )
    return {"entries": entries, "total": len(entries)}


@router.get("/ledger/account-statement/{account_id}")
async def get_account_statement(
    account_id: str,
    date_from: Optional[str] = Query(None, alias="start_date"),
    date_to: Optional[str] = Query(None, alias="end_date"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
):
    """كشف حساب مع pagination — Account Statement"""
    service = AccountingService(db)
    try:
        statement = await service.get_account_statement(
            current_user["company_id"], account_id, date_from, date_to
        )
        transactions = statement.get("transactions", [])
        total = len(transactions)
        start = (page - 1) * limit
        statement["transactions"] = transactions[start:start + limit]
        statement["pagination"] = {
            "page": page, "limit": limit, "total": total,
            "pages": -(-total // limit)
        }
        return statement
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/financials/summary")
async def get_financial_summary(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """ملخص القوائم المالية — بشكل متوازٍ (asyncio.gather)"""
    import asyncio
    company_id = current_user["company_id"]
    match_base = {"company_id": company_id, "status": "posted"}

    async def agg(pattern, side):
        result = await db.journal_entries.aggregate([
            {"$match": match_base}, {"$unwind": "$lines"},
            {"$match": {"lines.account_code": {"$regex": f"^{pattern}"}}},
            {"$group": {"_id": None, "d": {"$sum": "$lines.debit"}, "c": {"$sum": "$lines.credit"}}}
        ]).to_list(1)
        if not result: return 0
        return result[0]["c"] if side == "credit" else result[0]["d"]

    async def net(pattern):
        result = await db.journal_entries.aggregate([
            {"$match": match_base}, {"$unwind": "$lines"},
            {"$match": {"lines.account_code": {"$regex": f"^{pattern}"}}},
            {"$group": {"_id": None, "d": {"$sum": "$lines.debit"}, "c": {"$sum": "$lines.credit"}}}
        ]).to_list(1)
        if not result: return 0
        return result[0]["d"] - result[0]["c"]

    # 4 queries in parallel
    revenue, expenses, ar, ap = await asyncio.gather(
        agg("4", "credit"),   # إيرادات
        agg("5", "debit"),    # مصروفات
        net("131"),           # عملاء (debit - credit)
        net("251"),           # موردون reversed
    )

    return {
        "revenue":             round(revenue, 2),
        "expenses":            round(expenses, 2),
        "net_income":          round(revenue - expenses, 2),
        "accounts_receivable": round(ar, 2),
        "accounts_payable":    round(-ap, 2),  # AP is credit-nature
        "period":              {"from": date_from, "to": date_to},
    }


@router.get("/reports/income-statement")
async def get_income_statement(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user),
    
):
    """قائمة الدخل"""
    service = AccountingService(db)
    report = await service.get_income_statement(
        current_user["company_id"],
        start_date, end_date
    )
    return report


@router.get("/reports/balance-sheet")
async def get_balance_sheet(
    as_of_date: Optional[str] = Query(None, description="As of date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user),
    
):
    """الميزانية العمومية"""
    service = AccountingService(db)
    report = await service.get_balance_sheet(current_user["company_id"], as_of_date)
    return report


# ==========================================
# السنة المالية - Fiscal Year
# ==========================================

@router.post("/fiscal-year")
async def create_fiscal_year(
    request: CreateFiscalYearRequest,
    current_user: dict = Depends(get_current_user),
    
):
    """إنشاء سنة مالية جديدة"""
    service = AccountingService(db)
    
    fiscal_year = FiscalYear(
        company_id=current_user["company_id"],
        name=request.name,
        start_date=request.start_date,
        end_date=request.end_date
    )
    
    result = await service.create_fiscal_year(fiscal_year)
    return {"message": "تم إنشاء السنة المالية بنجاح", "fiscal_year": result}


@router.get("/fiscal-year/current")
async def get_current_fiscal_year(
    current_user: dict = Depends(get_current_user),
    
):
    """الحصول على السنة المالية الحالية"""
    service = AccountingService(db)
    fiscal_year = await service.get_current_fiscal_year(current_user["company_id"])
    
    if not fiscal_year:
        return {"message": "لا توجد سنة مالية حالية", "fiscal_year": None}
    
    return fiscal_year


# ==========================================
# Quick Entry Helpers
# ==========================================

@router.post("/quick-entry/receipt")
async def create_receipt_entry(
    amount: float,
    from_account_id: str,  # Cash or Bank
    to_account_id: str,    # Revenue account
    description: str,
    reference: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    
):
    """قيد سريع - إيصال قبض"""
    service = AccountingService(db)
    
    from_account = await service.get_account_by_id(from_account_id)
    to_account = await service.get_account_by_id(to_account_id)
    
    if not from_account or not to_account:
        raise HTTPException(status_code=400, detail="Invalid accounts")
    
    lines = [
        JournalEntryLine(
            account_id=from_account_id,
            account_code=from_account["account_code"],
            account_name=from_account["account_name"],
            debit=amount,
            credit=0
        ),
        JournalEntryLine(
            account_id=to_account_id,
            account_code=to_account["account_code"],
            account_name=to_account["account_name"],
            debit=0,
            credit=amount
        )
    ]
    
    entry = JournalEntry(
        company_id=current_user["company_id"],
        entry_number=0,
        entry_date=datetime.utcnow().strftime("%Y-%m-%d"),
        reference=reference,
        description=description,
        lines=lines,
        created_by=current_user["user_id"]
    )
    
    result = await service.create_journal_entry(entry)
    return {"message": "تم إنشاء قيد القبض بنجاح", "entry": result}


@router.post("/quick-entry/payment")
async def create_payment_entry(
    amount: float,
    from_account_id: str,  # Cash or Bank
    to_account_id: str,    # Expense account
    description: str,
    reference: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    
):
    """قيد سريع - إيصال صرف"""
    service = AccountingService(db)
    
    from_account = await service.get_account_by_id(from_account_id)
    to_account = await service.get_account_by_id(to_account_id)
    
    if not from_account or not to_account:
        raise HTTPException(status_code=400, detail="Invalid accounts")
    
    lines = [
        JournalEntryLine(
            account_id=to_account_id,
            account_code=to_account["account_code"],
            account_name=to_account["account_name"],
            debit=amount,
            credit=0
        ),
        JournalEntryLine(
            account_id=from_account_id,
            account_code=from_account["account_code"],
            account_name=from_account["account_name"],
            debit=0,
            credit=amount
        )
    ]
    
    entry = JournalEntry(
        company_id=current_user["company_id"],
        entry_number=0,
        entry_date=datetime.utcnow().strftime("%Y-%m-%d"),
        reference=reference,
        description=description,
        lines=lines,
        created_by=current_user["user_id"]
    )
    
    result = await service.create_journal_entry(entry)
    return {"message": "تم إنشاء قيد الصرف بنجاح", "entry": result}



# ==========================================
# Export Reports
# ==========================================

from fastapi.responses import StreamingResponse
import io
import xlsxwriter

@router.get("/reports/trial-balance/export")
async def export_trial_balance(
    as_of_date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """تصدير ميزان المراجعة إلى Excel"""
    service = AccountingService(db)
    report = await service.get_trial_balance(current_user["company_id"], as_of_date)
    
    # Create Excel file
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    worksheet = workbook.add_worksheet('ميزان المراجعة')
    
    # Formats
    header_format = workbook.add_format({'bold': True, 'bg_color': '#28376B', 'font_color': 'white', 'align': 'center'})
    number_format = workbook.add_format({'num_format': '#,##0.00', 'align': 'right'})
    total_format = workbook.add_format({'bold': True, 'bg_color': '#f3f4f6', 'num_format': '#,##0.00'})
    
    # Set RTL
    worksheet.right_to_left()
    
    # Title
    worksheet.merge_range('A1:D1', 'ميزان المراجعة - Trial Balance', workbook.add_format({'bold': True, 'font_size': 16, 'align': 'center'}))
    worksheet.merge_range('A2:D2', f'التاريخ: {report.get("as_of_date", "")}', workbook.add_format({'align': 'center'}))
    
    # Headers
    headers = ['رقم الحساب', 'اسم الحساب', 'مدين', 'دائن']
    worksheet.set_column('A:A', 15)
    worksheet.set_column('B:B', 35)
    worksheet.set_column('C:D', 18)
    
    for col, header in enumerate(headers):
        worksheet.write(3, col, header, header_format)
    
    # Data
    row = 4
    for item in report.get('items', []):
        worksheet.write(row, 0, item['account_code'])
        worksheet.write(row, 1, item['account_name'])
        worksheet.write(row, 2, item['debit'] if item['debit'] > 0 else '', number_format)
        worksheet.write(row, 3, item['credit'] if item['credit'] > 0 else '', number_format)
        row += 1
    
    # Totals
    worksheet.write(row, 0, '', total_format)
    worksheet.write(row, 1, 'الإجمالي', total_format)
    worksheet.write(row, 2, report.get('total_debit', 0), total_format)
    worksheet.write(row, 3, report.get('total_credit', 0), total_format)
    
    workbook.close()
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename=trial_balance_{as_of_date or "latest"}.xlsx'}
    )


@router.get("/reports/income-statement/export")
async def export_income_statement(
    start_date: str = Query(...),
    end_date: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """تصدير قائمة الدخل إلى Excel"""
    service = AccountingService(db)
    report = await service.get_income_statement(current_user["company_id"], start_date, end_date)
    
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    worksheet = workbook.add_worksheet('قائمة الدخل')
    
    # Formats
    header_format = workbook.add_format({'bold': True, 'bg_color': '#28376B', 'font_color': 'white'})
    revenue_format = workbook.add_format({'num_format': '#,##0.00', 'font_color': 'green'})
    expense_format = workbook.add_format({'num_format': '#,##0.00', 'font_color': 'red'})
    total_format = workbook.add_format({'bold': True, 'bg_color': '#f3f4f6', 'num_format': '#,##0.00'})
    
    worksheet.right_to_left()
    worksheet.set_column('A:A', 35)
    worksheet.set_column('B:B', 18)
    
    # Title
    worksheet.merge_range('A1:B1', 'قائمة الدخل - Income Statement', workbook.add_format({'bold': True, 'font_size': 16, 'align': 'center'}))
    worksheet.merge_range('A2:B2', f'الفترة: {start_date} إلى {end_date}', workbook.add_format({'align': 'center'}))
    
    row = 4
    
    # Revenues
    worksheet.write(row, 0, 'الإيرادات', header_format)
    worksheet.write(row, 1, '', header_format)
    row += 1
    
    for item in report.get('revenues', []):
        worksheet.write(row, 0, item['account_name'])
        worksheet.write(row, 1, item['amount'], revenue_format)
        row += 1
    
    worksheet.write(row, 0, 'إجمالي الإيرادات', total_format)
    worksheet.write(row, 1, report.get('total_revenue', 0), total_format)
    row += 2
    
    # Expenses
    worksheet.write(row, 0, 'المصروفات', header_format)
    worksheet.write(row, 1, '', header_format)
    row += 1
    
    for item in report.get('expenses', []):
        worksheet.write(row, 0, item['account_name'])
        worksheet.write(row, 1, item['amount'], expense_format)
        row += 1
    
    worksheet.write(row, 0, 'إجمالي المصروفات', total_format)
    worksheet.write(row, 1, report.get('total_expenses', 0), total_format)
    row += 2
    
    # Net Income
    net_format = workbook.add_format({
        'bold': True, 
        'font_size': 14,
        'bg_color': '#dcfce7' if report.get('is_profit') else '#fee2e2',
        'num_format': '#,##0.00'
    })
    worksheet.write(row, 0, 'صافي الدخل' if report.get('is_profit') else 'صافي الخسارة', net_format)
    worksheet.write(row, 1, report.get('net_income', 0), net_format)
    
    workbook.close()
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename=income_statement_{start_date}_to_{end_date}.xlsx'}
    )


@router.get("/reports/balance-sheet/export")
async def export_balance_sheet(
    as_of_date: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """تصدير الميزانية العمومية إلى Excel"""
    service = AccountingService(db)
    report = await service.get_balance_sheet(current_user["company_id"], as_of_date)
    
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    worksheet = workbook.add_worksheet('الميزانية العمومية')
    
    # Formats
    header_format = workbook.add_format({'bold': True, 'bg_color': '#28376B', 'font_color': 'white'})
    subheader_format = workbook.add_format({'bold': True, 'bg_color': '#e5e7eb'})
    number_format = workbook.add_format({'num_format': '#,##0.00'})
    total_format = workbook.add_format({'bold': True, 'bg_color': '#f3f4f6', 'num_format': '#,##0.00'})
    
    worksheet.right_to_left()
    worksheet.set_column('A:A', 35)
    worksheet.set_column('B:B', 18)
    
    # Title
    worksheet.merge_range('A1:B1', 'الميزانية العمومية - Balance Sheet', workbook.add_format({'bold': True, 'font_size': 16, 'align': 'center'}))
    worksheet.merge_range('A2:B2', f'التاريخ: {report.get("as_of_date", "")}', workbook.add_format({'align': 'center'}))
    
    row = 4
    
    # Assets
    worksheet.write(row, 0, 'الأصول', header_format)
    worksheet.write(row, 1, '', header_format)
    row += 1
    
    if report.get('assets', {}).get('current'):
        worksheet.write(row, 0, 'الأصول المتداولة', subheader_format)
        worksheet.write(row, 1, '', subheader_format)
        row += 1
        for item in report['assets']['current']:
            worksheet.write(row, 0, item['account_name'])
            worksheet.write(row, 1, item['amount'], number_format)
            row += 1
    
    if report.get('assets', {}).get('fixed'):
        worksheet.write(row, 0, 'الأصول الثابتة', subheader_format)
        worksheet.write(row, 1, '', subheader_format)
        row += 1
        for item in report['assets']['fixed']:
            worksheet.write(row, 0, item['account_name'])
            worksheet.write(row, 1, item['amount'], number_format)
            row += 1
    
    worksheet.write(row, 0, 'إجمالي الأصول', total_format)
    worksheet.write(row, 1, report.get('assets', {}).get('total', 0), total_format)
    row += 2
    
    # Liabilities
    worksheet.write(row, 0, 'الخصوم', header_format)
    worksheet.write(row, 1, '', header_format)
    row += 1
    
    for item in report.get('liabilities', {}).get('current', []):
        worksheet.write(row, 0, item['account_name'])
        worksheet.write(row, 1, item['amount'], number_format)
        row += 1
    
    worksheet.write(row, 0, 'إجمالي الخصوم', total_format)
    worksheet.write(row, 1, report.get('liabilities', {}).get('total', 0), total_format)
    row += 2
    
    # Equity
    worksheet.write(row, 0, 'حقوق الملكية', header_format)
    worksheet.write(row, 1, '', header_format)
    row += 1
    
    for item in report.get('equity', {}).get('items', []):
        worksheet.write(row, 0, item['account_name'])
        worksheet.write(row, 1, item['amount'], number_format)
        row += 1
    
    worksheet.write(row, 0, 'إجمالي حقوق الملكية', total_format)
    worksheet.write(row, 1, report.get('equity', {}).get('total', 0), total_format)
    row += 2
    
    # Total Liabilities & Equity
    final_format = workbook.add_format({'bold': True, 'font_size': 12, 'bg_color': '#28376B', 'font_color': 'white', 'num_format': '#,##0.00'})
    worksheet.write(row, 0, 'إجمالي الخصوم وحقوق الملكية', final_format)
    worksheet.write(row, 1, report.get('total_liabilities_and_equity', 0), final_format)
    
    workbook.close()
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename=balance_sheet_{as_of_date or "latest"}.xlsx'}
    )
