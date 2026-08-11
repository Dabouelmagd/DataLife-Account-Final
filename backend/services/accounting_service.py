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
            accounts = []
            for acc in DEFAULT_ACCOUNTS:
                account = ChartOfAccount(
                    company_id=company_id,
                    account_code=acc["code"],
                    account_name=acc["name"],
                    account_name_en=acc.get("name_en"),
                    account_type=acc["type"],
                    account_category=acc["category"],
                    is_system=acc.get("is_system", False),
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
    
    async def get_account_by_id(self, account_id: str) -> Optional[Dict]:
        """الحصول على حساب بمعرفه"""
        return await self.db.chart_of_accounts.find_one(
            {"id": account_id}, {"_id": 0}
        )
    
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
        """الحصول على رقم القيد التالي"""
        last_entry = await self.db.journal_entries.find_one(
            {"company_id": company_id},
            sort=[("entry_number", -1)]
        )
        return (last_entry["entry_number"] + 1) if last_entry else 1
    
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
        
        # الحصول على رقم القيد
        entry.entry_number = await self.get_next_entry_number(entry.company_id)
        
        # Set fiscal year + period + posting date automatically
        from datetime import datetime as _dt2
        entry_date = entry.entry_date or _dt2.utcnow().strftime("%Y-%m-%d")
        entry.fiscal_year = entry_date[:4]
        entry.period = entry_date[:7]
        
        entry_dict = entry.dict()
        await self.db.journal_entries.insert_one(entry_dict)
        entry_dict.pop("_id", None)
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

        if debit_code:
            acc = await self.db.chart_of_accounts.find_one(
                {"company_id": company_id, "account_code": debit_code}, {"_id": 0})
            if acc:
                await self.update_account_balance(acc["id"], amount, 0)

        if credit_code:
            acc = await self.db.chart_of_accounts.find_one(
                {"company_id": company_id, "account_code": credit_code}, {"_id": 0})
            if acc:
                await self.update_account_balance(acc["id"], 0, amount)

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
        
        if entry["status"] == JournalEntryStatus.CANCELLED.value:
            raise ValueError("Cannot post a cancelled entry")
        
        # Set fiscal year and period automatically
        from datetime import datetime as _dt
        entry_date = entry.get("entry_date", _dt.utcnow().strftime("%Y-%m-%d"))
        fiscal_year = entry_date[:4]
        period = entry_date[:7]  # YYYY-MM
        
        # إنشاء قيود في دفتر الأستاذ
        for line in entry["lines"]:
            # حساب الرصيد الجديد
            account = await self.get_account_by_id(line["account_id"])
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
            created_by=user_id
        )
        
        result = await self.create_journal_entry(reversed_entry)
        
        # تحديث حالة القيد الأصلي
        await self.db.journal_entries.update_one(
            {"id": entry_id},
            {"$set": {"status": JournalEntryStatus.REVERSED.value}}
        )
        
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
        """كشف حساب"""
        account = await self.get_account_by_id(account_id)
        if not account:
            raise ValueError("Account not found")
        
        entries = await self.get_ledger_entries(company_id, account_id, start_date, end_date)
        
        total_debit = sum(e["debit"] for e in entries)
        total_credit = sum(e["credit"] for e in entries)
        
        return {
            "account": account,
            "entries": entries,
            "total_debit": total_debit,
            "total_credit": total_credit,
            "closing_balance": account.get("current_balance", 0)
        }
    
    # ==========================================
    # التقارير المالية - Financial Reports
    # ==========================================
    
    async def get_trial_balance(
        self,
        company_id: str,
        as_of_date: Optional[str] = None
    ) -> Dict:
        """ميزان المراجعة"""
        accounts = await self.get_all_accounts(company_id)
        
        items = []
        total_debit = 0
        total_credit = 0
        
        for account in accounts:
            balance = account.get("current_balance", 0)
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
        
        revenues = []
        expenses = []
        total_revenue = 0
        total_expenses = 0
        
        for account in accounts:
            balance = account.get("current_balance", 0)
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
        """الميزانية العمومية"""
        accounts = await self.get_all_accounts(company_id)
        
        assets = {"current": [], "fixed": [], "total": 0}
        liabilities = {"current": [], "long_term": [], "total": 0}
        equity = {"items": [], "total": 0}
        
        for account in accounts:
            balance = account.get("current_balance", 0)
            if balance == 0:
                continue
            
            item = {
                "account_code": account["account_code"],
                "account_name": account["account_name"],
                "amount": abs(balance)
            }
            
            account_type = account["account_type"]
            category = account["account_category"]
            
            if account_type in [AccountType.ASSET.value, AccountType.CONTRA_ASSET.value]:
                if category == AccountCategory.FIXED_ASSET.value:
                    assets["fixed"].append(item)
                else:
                    assets["current"].append(item)
                
                if account_type == AccountType.CONTRA_ASSET.value:
                    assets["total"] -= abs(balance)
                else:
                    assets["total"] += balance
            
            elif account_type == AccountType.LIABILITY.value:
                if category == AccountCategory.LONG_TERM_LIABILITY.value:
                    liabilities["long_term"].append(item)
                else:
                    liabilities["current"].append(item)
                liabilities["total"] += balance
            
            elif account_type in [AccountType.EQUITY.value, AccountType.CONTRA_EQUITY.value]:
                equity["items"].append(item)
                if account_type == AccountType.CONTRA_EQUITY.value:
                    equity["total"] -= abs(balance)
                else:
                    equity["total"] += balance
        
        # إضافة صافي الدخل لحقوق الملكية
        income_statement = await self.get_income_statement(
            company_id,
            (datetime.utcnow() - timedelta(days=365)).strftime("%Y-%m-%d"),
            as_of_date or datetime.utcnow().strftime("%Y-%m-%d")
        )
        net_income = income_statement["net_income"]
        
        if net_income != 0:
            equity["items"].append({
                "account_code": "-",
                "account_name": "صافي الدخل للفترة",
                "amount": net_income
            })
            equity["total"] += net_income
        
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
