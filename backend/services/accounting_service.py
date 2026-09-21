"""
خدمات النظام المحاسبي
Accounting Services
"""

from motor.motor_asyncio import AsyncIOMotorClient
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from models.accounting import (
    ChartOfAccount, JournalEntry, JournalEntryLine, JournalEntryStatus,
    LedgerEntry, AccountType, AccountCategory, FiscalYear, FiscalPeriod,
    DEFAULT_ACCOUNTS, get_account_nature
)
import logging
import uuid

logger = logging.getLogger(__name__)


class AccountingService:
    """خدمات المحاسبة"""
    
    def __init__(self, db: AsyncIOMotorClient):
        self.db = db
    
    # ==========================================
    # دليل الحسابات - Chart of Accounts
    # ==========================================
    
    async def initialize_chart_of_accounts(self, company_id: str) -> bool:
        """إنشاء دليل الحسابات الافتراضي للشركة - Egyptian Standard Chart of Accounts"""
        try:
            # التحقق من وجود حسابات للشركة
            existing = await self.db.chart_of_accounts.count_documents({"company_id": company_id})
            if existing > 0:
                return True
            
            # إنشاء الحسابات الافتراضية
            # حسابات تحتاج تسوية دورية (بنوك / عملاء / موردون / ضرائب)
            RECONCILIATION_CODES = {
                "162","163","164",          # بنوك، شيكات، درج الكاشير (were 112-114: buildings, vehicles, machinery)
                "131","132","133","134",    # ذمم مدينة
                "161",                      # الخزينة
                "212","251","252","253",    # موردون وأرصدة دائنة
                "220","221",               # أجور مستحقة
                "260","261","262",         # ضرائب مستحقة
                "264",                     # أمانات
            }
            # حسابات تجميعية لا تقبل قيوداً مباشرة
            HEADER_CODES = {"1","11","12","13","14","15","2","21","22","3","4","41","42","5","51","52"}
            
            accounts = []
            for acc in DEFAULT_ACCOUNTS:
                code = acc["code"]
                acc_type = acc["type"]
                # طبيعة الحساب (مدين/دائن)
                debit_types = {AccountType.ASSET, AccountType.EXPENSE,
                               AccountType.CONTRA_LIABILITY, AccountType.CONTRA_EQUITY}
                normal_bal = "debit" if acc_type in debit_types else "credit"
                
                account = ChartOfAccount(
                    company_id=company_id,
                    account_code=code,
                    account_name=acc["name"],
                    account_name_en=acc.get("name_en"),
                    account_type=acc_type,
                    account_category=acc["category"],
                    is_system=acc.get("is_system", False),
                    is_reconciliation=code in RECONCILIATION_CODES,
                    allow_posting=code not in HEADER_CODES,
                    normal_balance=normal_bal,
                    description=f"{'حساب رئيسي تجميعي' if acc.get('is_header') else 'حساب فرعي يقبل حركات'}"
                )
                account_dict = account.dict()
                # Add extra fields for hierarchy
                account_dict["is_header"] = acc.get("is_header", False)
                account_dict["parent_code"] = acc.get("parent_code")
                accounts.append(account_dict)
            
            await self.db.chart_of_accounts.insert_many(accounts)
            logger.info(f"Created Egyptian standard chart of accounts for company {company_id} with {len(accounts)} accounts")
            return True
        except Exception as e:
            logger.error(f"Error initializing chart of accounts: {e}")
            return False
    
    async def get_all_accounts(self, company_id: str, active_only: bool = True) -> List[Dict]:
        """الحصول على جميع الحسابات"""
        query = {"company_id": company_id}
        if active_only:
            query["is_active"] = True
        
        accounts = await self.db.chart_of_accounts.find(
            query, {"_id": 0}
        ).sort("account_code", 1).to_list(length=1000)
        return accounts
    
    async def get_account_by_id(self, account_id: str, company_id: Optional[str] = None) -> Optional[Dict]:
        """الحصول على حساب بمعرفه — pass company_id wherever the id comes from a
        request, so one company can never read or post to another's account."""
        q = {"id": account_id}
        if company_id:
            q["company_id"] = company_id
        return await self.db.chart_of_accounts.find_one(q, {"_id": 0})
    
    async def get_account_by_code(self, company_id: str, account_code: str) -> Optional[Dict]:
        """الحصول على حساب برقمه"""
        return await self.db.chart_of_accounts.find_one(
            {"company_id": company_id, "account_code": account_code}, {"_id": 0}
        )
    
    async def create_account(self, account: ChartOfAccount) -> Dict:
        """إنشاء حساب جديد"""
        # التحقق من عدم تكرار رقم الحساب
        existing = await self.get_account_by_code(account.company_id, account.account_code)
        if existing:
            raise ValueError(f"Account code {account.account_code} already exists")
        
        account_dict = account.dict()
        await self.db.chart_of_accounts.insert_one(account_dict)
        account_dict.pop("_id", None)  # Remove MongoDB _id
        return account_dict
    
    async def update_account(self, account_id: str, updates: Dict) -> Optional[Dict]:
        """تحديث حساب"""
        updates["updated_at"] = datetime.utcnow().isoformat()
        result = await self.db.chart_of_accounts.find_one_and_update(
            {"id": account_id, "is_system": False},
            {"$set": updates},
            return_document=True
        )
        if result:
            result.pop("_id", None)
        return result
    
    async def delete_account(self, account_id: str) -> bool:
        """حذف حساب (soft delete)"""
        # التحقق من عدم وجود حركات على الحساب
        ledger_count = await self.db.general_ledger.count_documents({"account_id": account_id})
        if ledger_count > 0:
            raise ValueError("Cannot delete account with existing transactions")
        
        result = await self.db.chart_of_accounts.update_one(
            {"id": account_id, "is_system": False},
            {"$set": {"is_active": False, "updated_at": datetime.utcnow().isoformat()}}
        )
        return result.modified_count > 0
    
    async def update_account_balance(self, account_id: str, debit: float, credit: float):
        """تحديث رصيد الحساب"""
        account = await self.get_account_by_id(account_id)
        if not account:
            return
        
        # حساب التغيير في الرصيد بناءً على طبيعة الحساب
        account_type = AccountType(account["account_type"])
        nature = get_account_nature(account_type)
        
        if nature == "debit":
            balance_change = debit - credit
        else:
            balance_change = credit - debit
        
        await self.db.chart_of_accounts.update_one(
            {"id": account_id},
            {
                "$inc": {"current_balance": balance_change},
                "$set": {"updated_at": datetime.utcnow().isoformat()}
            }
        )
    
    # ==========================================
    # القيود اليومية - Journal Entries
    # ==========================================
    
    async def get_next_entry_number(self, company_id: str) -> int:
        """
        الحصول على رقم القيد التالي — ATOMIC (no race condition)
        Uses MongoDB findOneAndUpdate with $inc for thread-safe auto-increment
        equivalent to SQL AUTO_INCREMENT
        """
        counter = await self.db.journal_counters.find_one_and_update(
            {"company_id": company_id},
            {"$inc": {"last_number": 1}},
            upsert=True,
            return_document=True  # return AFTER update
        )
        return counter["last_number"]
    
    async def create_journal_entry(self, entry: JournalEntry) -> Dict:
        """إنشاء قيد يومي جديد"""
        # التحقق من توازن القيد
        total_debit = sum(line.debit for line in entry.lines)
        total_credit = sum(line.credit for line in entry.lines)
        
        if abs(total_debit - total_credit) > 0.01:
            raise ValueError(f"Journal entry is not balanced. Debit: {total_debit}, Credit: {total_credit}")
        
        # التحقق من أن كل سطر له مدين أو دائن (وليس كلاهما)
        for line in entry.lines:
            if line.debit > 0 and line.credit > 0:
                raise ValueError("A journal line cannot have both debit and credit")
            if line.debit == 0 and line.credit == 0:
                raise ValueError("A journal line must have either debit or credit")
        
        # تحديث إجمالي المدين والدائن
        entry.total_debit = total_debit
        entry.total_credit = total_credit
        
        # الحصول على رقم القيد — ATOMIC (thread-safe)
        entry.entry_number = await self.get_next_entry_number(entry.company_id)
        # VARCHAR format: JE-2026-000001
        from datetime import datetime as _dt2
        entry_date = entry.entry_date or _dt2.utcnow().strftime("%Y-%m-%d")
        entry.entry_number_str = f"JE-{entry_date[:4]}-{entry.entry_number:06d}"
        entry.fiscal_year = entry_date[:4]
        entry.period = entry_date[:7]
        
        # Validate source_document_type
        VALID_SOURCE_TYPES = {
            "manual","payroll","invoice","claim","medical_service",
            "subcontractor_claim","doctor_payment","construction",
            "payroll_disbursement","payroll_government","cogs_entry",
            "adjustment",   # correcting / reclassification entries
            # used by modules but previously rewritten to "manual", which hid
            # where an entry came from in audits and reports
            "petty_cash", "letter_of_credit", "equity", "sales_invoice",
            "project_expense", "project_revenue", "supplier_payment",
        }
        if entry.source_document_type not in VALID_SOURCE_TYPES:
            entry.source_document_type = "manual"
        
        # Populate entry_id on each line (FK equivalent)
        for line in entry.lines:
            line.entry_id = entry.id
        
        entry_dict = entry.dict()
        await self.db.journal_entries.insert_one(entry_dict)
        entry_dict.pop("_id", None)

        # Audit log — every journal entry creation is logged
        try:
            await self.db.audit_logs.insert_one({
                "id": str(uuid.uuid4()),
                "company_id": entry.company_id,
                "action": "journal_entry.created",
                "entity_type": "journal_entry",
                "entity_id": entry.id,
                "entry_number": entry.entry_number,
                "total_debit": entry.total_debit,
                "total_credit": entry.total_credit,
                "source_document_type": getattr(entry, "source_document_type", "manual"),
                "created_by": entry.created_by,
                "timestamp": datetime.utcnow().isoformat(),
                "ip_address": None,
            })
        except Exception:
            pass  # Non-critical

        return entry_dict
    
    async def get_journal_entry(self, entry_id: str) -> Optional[Dict]:
        """الحصول على قيد يومي"""
        entry = await self.db.journal_entries.find_one({"id": entry_id}, {"_id": 0})
        return entry
    
    async def get_journal_entries(
        self, 
        company_id: str, 
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict]:
        """الحصول على القيود اليومية"""
        query = {"company_id": company_id}
        
        if start_date and end_date:
            query["entry_date"] = {"$gte": start_date, "$lte": end_date}
        elif start_date:
            query["entry_date"] = {"$gte": start_date}
        elif end_date:
            query["entry_date"] = {"$lte": end_date}
        
        if status:
            query["status"] = status
        
        entries = await self.db.journal_entries.find(
            query, {"_id": 0}
        ).sort("entry_number", -1).skip(skip).limit(limit).to_list(length=limit)
        
        return entries
    
    async def post_simple_journal_entry(self, entry: dict, user_id: str) -> bool:
        """ترحيل قيد بسيط (debit_account_code / credit_account_code) إلى الأرصدة"""
        company_id = entry.get("company_id")
        amount = float(entry.get("amount", 0))
        if not company_id or amount <= 0:
            return False

        debit_code  = entry.get("debit_account_code")
        credit_code = entry.get("credit_account_code")

        # Resolve both accounts first. Previously an unknown code was skipped
        # silently and the entry was still marked posted, and no ledger rows
        # were ever written — so these entries never reached any report.
        debit_acc = await self.db.chart_of_accounts.find_one(
            {"company_id": company_id, "account_code": debit_code}, {"_id": 0}) if debit_code else None
        credit_acc = await self.db.chart_of_accounts.find_one(
            {"company_id": company_id, "account_code": credit_code}, {"_id": 0}) if credit_code else None
        if not debit_acc or not credit_acc:
            raise ValueError(
                f"Account code not found in chart of accounts: "
                f"{debit_code if not debit_acc else ''} {credit_code if not credit_acc else ''}".strip())

        entry_date = entry.get("entry_date") or entry.get("date") or datetime.utcnow().strftime("%Y-%m-%d")
        for acc, dr, cr in ((debit_acc, amount, 0.0), (credit_acc, 0.0, amount)):
            nature = get_account_nature(AccountType(acc["account_type"]))
            cur = acc.get("current_balance", 0) or 0
            new_balance = cur + (dr - cr if nature == "debit" else cr - dr)
            await self.db.general_ledger.insert_one(LedgerEntry(
                company_id=company_id,
                account_id=acc["id"],
                journal_entry_id=entry.get("id"),
                entry_date=entry_date,
                description=entry.get("description", ""),
                debit=dr, credit=cr, balance=new_balance,
            ).dict())
            await self.update_account_balance(acc["id"], dr, cr)

        # Mark as posted
        await self.db.journal_entries.update_one(
            {"id": entry.get("id")},
            {"$set": {"status": "posted", "posted_at": datetime.utcnow().isoformat(), "posted_by": user_id}}
        )
        return True

    async def post_journal_entry(self, entry_id: str, user_id: str) -> bool:
        """ترحيل القيد إلى دفتر الأستاذ — IMMUTABLE after posting"""
        entry = await self.get_journal_entry(entry_id)
        if not entry:
            raise ValueError("Journal entry not found")
        
        if entry["status"] == JournalEntryStatus.POSTED.value:
            raise ValueError("IMMUTABILITY VIOLATION: Journal entry already posted. Use reversal to correct.")
        
        if entry["status"] == JournalEntryStatus.CANCELED.value:
            raise ValueError("Cannot post a cancelled entry")

        # An entry with no lines would be marked posted while writing nothing
        # to the ledger — invisible to every report. Refuse instead.
        lines = entry.get("lines") or []
        if not lines:
            raise ValueError("Cannot post an entry with no lines")
        td = round(sum(float(l.get("debit", 0) or 0) for l in lines), 2)
        tc = round(sum(float(l.get("credit", 0) or 0) for l in lines), 2)
        if td != tc:
            raise ValueError(f"Cannot post an unbalanced entry (debit {td} / credit {tc})")

        # ── فحص الفترة المالية: هل مفتوحة؟ ──────────────────────
        entry_date   = entry.get("entry_date", "")
        if entry_date:
            entry_period = entry_date[:7]   # YYYY-MM
            entry_year   = entry_date[:4]   # YYYY
            fp = await self.db.financial_periods.find_one({
                "company_id": entry["company_id"],
                "$or": [
                    {"year": int(entry_year), "month": int(entry_date[5:7])},
                    {"period": entry_period},
                ]
            }, {"_id": 0})
            if fp and fp.get("status") == "closed":
                raise ValueError(
                    f"الفترة المالية {entry_period} مغلقة — "
                    "لا يمكن الترحيل إليها. يتطلب صلاحية إعادة الفتح."
                )

        # Set fiscal year and period automatically
        from datetime import datetime as _dt
        entry_date = entry.get("entry_date", _dt.utcnow().strftime("%Y-%m-%d"))
        fiscal_year = entry_date[:4]
        period = entry_date[:7]  # YYYY-MM
        
        # إنشاء قيود في دفتر الأستاذ
        for line in entry["lines"]:
            # حساب الرصيد الجديد
            account = await self.get_account_by_id(line["account_id"], entry["company_id"])
            if not account:
                raise ValueError(f"Account {line['account_id']} not found")
            
            current_balance = account.get("current_balance", 0)
            account_type = AccountType(account["account_type"])
            nature = get_account_nature(account_type)
            
            if nature == "debit":
                new_balance = current_balance + line["debit"] - line["credit"]
            else:
                new_balance = current_balance + line["credit"] - line["debit"]
            
            # إنشاء قيد دفتر الأستاذ
            ledger_entry = LedgerEntry(
                company_id=entry["company_id"],
                account_id=line["account_id"],
                journal_entry_id=entry_id,
                entry_date=entry["entry_date"],
                description=entry["description"],
                debit=line["debit"],
                credit=line["credit"],
                balance=new_balance
            )
            await self.db.general_ledger.insert_one(ledger_entry.dict())
            
            # تحديث رصيد الحساب
            await self.update_account_balance(line["account_id"], line["debit"], line["credit"])
        
        # Audit log — posting is logged
        try:
            await self.db.audit_logs.insert_one({
                "id": str(uuid.uuid4()),
                "company_id": entry.get("company_id"),
                "action": "journal_entry.posted",
                "entity_type": "journal_entry",
                "entity_id": entry_id,
                "entry_number": entry.get("entry_number"),
                "total_debit": entry.get("total_debit"),
                "total_credit": entry.get("total_credit"),
                "posted_by": user_id,
                "timestamp": datetime.utcnow().isoformat(),
            })
        except Exception:
            pass

        # تحديث حالة القيد (ONLY status/posted fields — immutable ledger)
        await self.db.journal_entries.update_one(
            {"id": entry_id, "status": {"$ne": JournalEntryStatus.POSTED.value}},
            {
                "$set": {
                    "status": JournalEntryStatus.POSTED.value,
                    "posting_date": datetime.utcnow().isoformat(),
                    "posted_at": datetime.utcnow().isoformat(),
                    "posted_by": user_id,
                    "fiscal_year": entry.get("fiscal_year") or entry.get("entry_date","")[:4],
                    "period": entry.get("period") or entry.get("entry_date","")[:7],
                }
            }
        )
        
        return True
    
    async def reverse_journal_entry(self, entry_id: str, user_id: str) -> Dict:
        """عكس قيد يومي"""
        original = await self.get_journal_entry(entry_id)
        if not original:
            raise ValueError("Journal entry not found")
        
        if original["status"] != JournalEntryStatus.POSTED.value:
            raise ValueError("Can only reverse posted entries")
        
        # إنشاء قيد عكسي
        reversed_lines = []
        for line in original["lines"]:
            reversed_lines.append(JournalEntryLine(
                account_id=line["account_id"],
                account_code=line["account_code"],
                account_name=line["account_name"],
                debit=line["credit"],  # عكس المدين والدائن
                credit=line["debit"],
                description=f"عكس: {line.get('description', '')}"
            ))
        
        reversed_entry = JournalEntry(
            company_id=original["company_id"],
            entry_number=await self.get_next_entry_number(original["company_id"]),
            entry_date=datetime.utcnow().strftime("%Y-%m-%d"),
            reference=f"REV-{original['entry_number']}",
            description=f"عكس القيد رقم {original['entry_number']}",
            lines=reversed_lines,
            status=JournalEntryStatus.DRAFT,
            is_reversal=True,
            reversal_of=entry_id,
            created_by=user_id
        )

        result = await self.create_journal_entry(reversed_entry)

        # The reversal used to stay a draft forever while the original was
        # marked "reversed": the original kept its full effect in the ledger
        # and every report, yet the screen said it was cancelled. Post the
        # reversal first; mark the original only once that has succeeded.
        await self.post_journal_entry(result["id"], user_id)

        await self.db.journal_entries.update_one(
            {"id": entry_id},
            {"$set": {"status": JournalEntryStatus.REVERSED.value,
                      "reversed_by": result["id"],
                      "reversal_date": datetime.utcnow().strftime("%Y-%m-%d")}}
        )
        result["status"] = JournalEntryStatus.POSTED.value
        return result
    
    # ==========================================
    # دفتر الأستاذ - General Ledger
    # ==========================================
    
    async def get_ledger_entries(
        self,
        company_id: str,
        account_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict]:
        """الحصول على قيود دفتر الأستاذ"""
        query = {"company_id": company_id}
        
        if account_id:
            query["account_id"] = account_id
        
        if start_date and end_date:
            query["entry_date"] = {"$gte": start_date, "$lte": end_date}
        elif start_date:
            query["entry_date"] = {"$gte": start_date}
        elif end_date:
            query["entry_date"] = {"$lte": end_date}
        
        entries = await self.db.general_ledger.find(
            query, {"_id": 0}
        ).sort("entry_date", 1).to_list(length=10000)
        
        return entries
    
    async def get_account_statement(
        self,
        company_id: str,
        account_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict:
        """كشف حساب — opening balance, lines with a running balance, closing balance.

        Previously: the account was fetched by id with no company check (any
        company could read another's account), closing_balance was the
        all-time current_balance whatever the period, there was no opening
        balance, and the per-line balance was the one stored at posting time —
        wrong whenever entries are posted out of date order.
        """
        account = await self.db.chart_of_accounts.find_one(
            {"id": account_id, "company_id": company_id}, {"_id": 0})
        if not account:
            raise ValueError("Account not found")

        debit_nature = get_account_nature(AccountType(account["account_type"])) == "debit"
        sign = (lambda d, c: d - c) if debit_nature else (lambda d, c: c - d)

        opening = float(account.get("opening_balance", 0) or 0)
        if start_date:
            async for r in self.db.general_ledger.aggregate([
                {"$match": {"company_id": company_id, "account_id": account_id,
                            "entry_date": {"$lt": start_date}}},
                {"$group": {"_id": None, "d": {"$sum": "$debit"}, "c": {"$sum": "$credit"}}},
            ]):
                opening += sign(r["d"], r["c"])

        q = {"company_id": company_id, "account_id": account_id}
        rng = {}
        if start_date:
            rng["$gte"] = start_date
        if end_date:
            rng["$lte"] = end_date + "\uffff"
        if rng:
            q["entry_date"] = rng
        rows = await self.db.general_ledger.find(q, {"_id": 0}).sort(
            [("entry_date", 1), ("created_at", 1)]).to_list(length=None)

        je_ids = list({r.get("journal_entry_id") for r in rows if r.get("journal_entry_id")})
        je_map = {}
        if je_ids:
            async for je in self.db.journal_entries.find(
                    {"id": {"$in": je_ids}},
                    {"_id": 0, "id": 1, "entry_number": 1, "entry_number_str": 1,
                     "reference": 1, "description": 1}):
                je_map[je["id"]] = je

        running = opening
        entries = []
        for r in rows:
            running = round(running + sign(r.get("debit", 0), r.get("credit", 0)), 2)
            je = je_map.get(r.get("journal_entry_id"), {})
            entries.append({
                **r,
                "balance": running,
                "entry_number": je.get("entry_number_str") or je.get("entry_number"),
                "reference": je.get("reference"),
                "description": r.get("description") or je.get("description", ""),
            })

        total_debit = round(sum(e.get("debit", 0) for e in entries), 2)
        total_credit = round(sum(e.get("credit", 0) for e in entries), 2)
        return {
            "account": account,
            "entries": entries,
            "opening_balance": round(opening, 2),
            "total_debit": total_debit,
            "total_credit": total_credit,
            "closing_balance": running,
            "nature": "debit" if debit_nature else "credit",
        }

    # ==========================================
    # التقارير المالية - Financial Reports
    # ==========================================
    
    async def get_trial_balance(
        self,
        company_id: str,
        as_of_date: Optional[str] = None
    ) -> Dict:
        """ميزان المراجعة — balances as of `as_of_date`, from the ledger.
        It read current_balance and ignored the date, so a trial balance for
        any day included every later (even future-dated) entry."""
        as_of_date = as_of_date or datetime.utcnow().strftime("%Y-%m-%d")
        accounts = await self.get_all_accounts(company_id)
        pipeline = [
            {"$match": {"company_id": company_id,
                        "entry_date": {"$lte": as_of_date + "\uffff"}}},
            {"$group": {"_id": "$account_id",
                        "debit": {"$sum": "$debit"}, "credit": {"$sum": "$credit"}}},
        ]
        movement = {r["_id"]: r async for r in self.db.general_ledger.aggregate(pipeline)}

        items = []
        total_debit = 0
        total_credit = 0

        for account in accounts:
            if account.get("is_header") or account.get("account_category") == "header":
                continue
            mv = movement.get(account.get("id"), {"debit": 0, "credit": 0})
            opening = float(account.get("opening_balance", 0) or 0)
            if get_account_nature(AccountType(account["account_type"])) == "debit":
                balance = round(opening + mv["debit"] - mv["credit"], 2)
            else:
                balance = round(opening + mv["credit"] - mv["debit"], 2)
            if balance == 0:
                continue
            
            account_type = AccountType(account["account_type"])
            nature = get_account_nature(account_type)
            
            if nature == "debit":
                if balance >= 0:
                    debit = balance
                    credit = 0
                else:
                    debit = 0
                    credit = abs(balance)
            else:
                if balance >= 0:
                    debit = 0
                    credit = balance
                else:
                    debit = abs(balance)
                    credit = 0
            
            items.append({
                "account_code": account["account_code"],
                "account_name": account["account_name"],
                "account_type": account["account_type"],
                "debit": debit,
                "credit": credit
            })
            
            total_debit += debit
            total_credit += credit
        
        return {
            "as_of_date": as_of_date or datetime.utcnow().strftime("%Y-%m-%d"),
            "items": items,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "is_balanced": abs(total_debit - total_credit) < 0.01
        }
    
    async def get_income_statement(
        self,
        company_id: str,
        start_date: str,
        end_date: str
    ) -> Dict:
        """قائمة الدخل"""
        accounts = await self.get_all_accounts(company_id)

        # Movement WITHIN the period, from the general ledger. The previous
        # version read current_balance, the all-time running total, so every
        # period showed cumulative figures and start_date/end_date did nothing.
        # "\uffff" makes the upper bound inclusive of full ISO timestamps.
        pipeline = [
            {"$match": {
                "company_id": company_id,
                "entry_date": {"$gte": start_date, "$lte": end_date + "\uffff"},
            }},
            {"$group": {"_id": "$account_id",
                        "debit": {"$sum": "$debit"}, "credit": {"$sum": "$credit"}}},
        ]
        movement = {row["_id"]: row async for row in self.db.general_ledger.aggregate(pipeline)}

        revenues = []
        expenses = []
        total_revenue = 0
        total_expenses = 0

        for account in accounts:
            mv = movement.get(account.get("id"))
            if not mv:
                continue
            if account["account_type"] == AccountType.REVENUE.value:
                balance = mv["credit"] - mv["debit"]      # credit-natured
            elif account["account_type"] == AccountType.EXPENSE.value:
                balance = mv["debit"] - mv["credit"]      # debit-natured
            else:
                continue
            if balance == 0:
                continue

            if account["account_type"] == AccountType.REVENUE.value:
                revenues.append({
                    "account_code": account["account_code"],
                    "account_name": account["account_name"],
                    "amount": balance
                })
                total_revenue += balance
            elif account["account_type"] == AccountType.EXPENSE.value:
                expenses.append({
                    "account_code": account["account_code"],
                    "account_name": account["account_name"],
                    "amount": balance
                })
                total_expenses += balance
        
        net_income = total_revenue - total_expenses
        
        return {
            "period_start": start_date,
            "period_end": end_date,
            "revenues": revenues,
            "expenses": expenses,
            "total_revenue": total_revenue,
            "total_expenses": total_expenses,
            "net_income": net_income,
            "is_profit": net_income >= 0
        }
    
    async def get_balance_sheet(
        self,
        company_id: str,
        as_of_date: Optional[str] = None
    ) -> Dict:
        """الميزانية العمومية — every balance as of `as_of_date`, from the ledger.

        Previously: balances came from current_balance (ignoring the date, so
        future-dated entries leaked in) and equity only added the last 365 days
        of net income, dropping every earlier year's result. The two sides then
        never matched and the sheet reported itself unbalanced.
        """
        as_of_date = as_of_date or datetime.utcnow().strftime("%Y-%m-%d")
        accounts = await self.get_all_accounts(company_id)

        pipeline = [
            {"$match": {"company_id": company_id,
                        "entry_date": {"$lte": as_of_date + "\uffff"}}},
            {"$group": {"_id": "$account_id",
                        "debit": {"$sum": "$debit"}, "credit": {"$sum": "$credit"}}},
        ]
        movement = {r["_id"]: r async for r in self.db.general_ledger.aggregate(pipeline)}

        def balance_of(account):
            mv = movement.get(account.get("id"), {"debit": 0, "credit": 0})
            opening = float(account.get("opening_balance", 0) or 0)
            if get_account_nature(AccountType(account["account_type"])) == "debit":
                return opening + mv["debit"] - mv["credit"]
            return opening + mv["credit"] - mv["debit"]

        assets = {"current": [], "fixed": [], "total": 0}
        liabilities = {"current": [], "long_term": [], "total": 0}
        equity = {"items": [], "total": 0}
        accumulated_result = 0.0   # revenue − expense since inception, to as_of_date

        for account in accounts:
            if account.get("is_header") or account.get("account_category") == "header":
                continue
            balance = round(balance_of(account), 2)
            if balance == 0:
                continue

            account_type = account["account_type"]
            category = account.get("account_category")
            item = {"account_code": account["account_code"],
                    "account_name": account["account_name"], "amount": balance}

            if account_type == AccountType.REVENUE.value:
                accumulated_result += balance
            elif account_type == AccountType.EXPENSE.value:
                accumulated_result -= balance
            elif account_type in [AccountType.ASSET.value, AccountType.CONTRA_ASSET.value]:
                (assets["fixed"] if category == AccountCategory.FIXED_ASSET.value
                 else assets["current"]).append(item)
                assets["total"] += -balance if account_type == AccountType.CONTRA_ASSET.value else balance
            elif account_type in [AccountType.LIABILITY.value, AccountType.CONTRA_LIABILITY.value]:
                (liabilities["long_term"] if category == AccountCategory.LONG_TERM_LIABILITY.value
                 else liabilities["current"]).append(item)
                liabilities["total"] += -balance if account_type == AccountType.CONTRA_LIABILITY.value else balance
            elif account_type in [AccountType.EQUITY.value, AccountType.CONTRA_EQUITY.value]:
                equity["items"].append(item)
                equity["total"] += -balance if account_type == AccountType.CONTRA_EQUITY.value else balance

        accumulated_result = round(accumulated_result, 2)
        if accumulated_result != 0:
            equity["items"].append({"account_code": "-",
                                    "account_name": "صافي الأرباح (الخسائر) المتراكمة",
                                    "amount": accumulated_result})
            equity["total"] += accumulated_result

        for group in (assets, liabilities, equity):
            group["total"] = round(group["total"], 2)

        return {
            "as_of_date": as_of_date or datetime.utcnow().strftime("%Y-%m-%d"),
            "assets": assets,
            "liabilities": liabilities,
            "equity": equity,
            "total_liabilities_and_equity": liabilities["total"] + equity["total"],
            "is_balanced": abs(assets["total"] - (liabilities["total"] + equity["total"])) < 0.01
        }
    
    # ==========================================
    # السنة المالية - Fiscal Year
    # ==========================================
    
    async def create_fiscal_year(self, fiscal_year: FiscalYear) -> Dict:
        """إنشاء سنة مالية"""
        # تحديث السنة المالية الحالية
        await self.db.fiscal_years.update_many(
            {"company_id": fiscal_year.company_id, "is_current": True},
            {"$set": {"is_current": False}}
        )
        
        year_dict = fiscal_year.dict()
        await self.db.fiscal_years.insert_one(year_dict)
        year_dict.pop("_id", None)  # Remove MongoDB _id
        return year_dict
    
    async def get_current_fiscal_year(self, company_id: str) -> Optional[Dict]:
        """الحصول على السنة المالية الحالية"""
        return await self.db.fiscal_years.find_one(
            {"company_id": company_id, "is_current": True},
            {"_id": 0}
        )
