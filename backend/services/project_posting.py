"""
تسجيل مصروفات وإيرادات المشاريع في الحسابات.

Every project expense or revenue is one posted journal entry, saved together
with the item — the item does not exist without its entry:

    expense:  Dr the cost account of its category    Cr where the money came from
    revenue:  Dr where the money went                Cr the revenue account

"Where the money came from / went" is picked from what the company really
has: the cash box (161), each bank account, a partner's or the chairman's
current account (an expense the chairman paid personally), a supplier on
credit (251) or a customer on credit (131). The old form offered only
cash / bank / cheque and hard-coded 161 or 162, which is why expenses the
chairman paid had to be "funded" with separate adjustment entries.
"""
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from services import pack_accounts as PA

DEBIT_TYPES = {"asset", "expense", "contra_liability", "contra_equity"}

# category → preferred account codes (first one the company's chart has wins)
EXPENSE_ACCOUNTS = {
    "materials":      ["316", "311"],          # مواد ومستلزمات الموقع
    "labor":          ["317", "312"],          # أجور عمال الموقع
    "subcontractor":  ["315"],                 # مقاولو الباطن
    "equipment":      PA.codes("project_equipment"),   # 318 معدات وسقالات (باقة المقاولات) وإلا 313
    "administrative": ["333", "336", "332"],   # مصروفات إدارية
    "transport":      ["337"],                 # سفر وانتقالات
    "utilities":      ["332"],                 # كهرباء ومياه
    "salaries":       ["331", "312"],          # رواتب
    "rent":           ["335"],                 # إيجارات
    "marketing":      ["341"],                 # دعاية وإعلان
    "software":       ["313", "332"],          # برمجيات واشتراكات
    "other":          ["313", "332"],
    # industry-pack categories: offered and accepted only when the company's
    # chart has the pack account — never a fallback to another account
    "quality_testing": PA.codes("project_quality_testing"),   # 319 اختبارات جودة ومختبرات (المقاولات)
    "site_permits":    PA.codes("project_site_permits"),      # 322 تراخيص وتأمينات المواقع (المقاولات)
    "consultants":     PA.codes("project_consultants"),       # 346 أجور استشاريين (المكاتب المهنية)
}
PACK_ONLY_CATEGORIES = {"quality_testing", "site_permits", "consultants"}
REVENUE_ACCOUNTS = {
    "payment":   ["412", "431"], "advance": ["412", "431"], "milestone": ["431", "412"],
    "final":     ["412", "431"], "retention": ["431", "412"], "other": ["423", "412"],
}


def _kind(t) -> str:
    return str(getattr(t, "value", t) or "").lower()


def _leaf(a: dict) -> bool:
    return bool(a) and not (a.get("is_header") or a.get("account_category") == "header") \
        and a.get("is_active") is not False


async def chart(db, company_id: str) -> dict:
    return {a["account_code"]: a async for a in db.chart_of_accounts.find(
        {"company_id": company_id}, {"_id": 0})}


async def balance(db, company_id: str, acc: dict) -> float:
    rows = await db.general_ledger.aggregate([
        {"$match": {"company_id": company_id, "account_id": acc["id"]}},
        {"$group": {"_id": None, "d": {"$sum": "$debit"}, "c": {"$sum": "$credit"}}}]).to_list(1)
    d, c = (rows[0]["d"], rows[0]["c"]) if rows else (0, 0)
    op = float(acc.get("opening_balance") or 0)
    return round(op + (d - c if _kind(acc.get("account_type")) in DEBIT_TYPES else c - d), 2)


def account_for(ch: dict, kind: str, category: str) -> Optional[dict]:
    """The cost / revenue account a category books to, from this company's chart."""
    table = EXPENSE_ACCOUNTS if kind == "expense" else REVENUE_ACCOUNTS
    for code in table.get(category) or table["other"]:
        if _leaf(ch.get(code)):
            return ch[code]
    if kind == "expense" and category in PACK_ONLY_CATEGORIES:
        return None                               # the pack is not active for this company
    want = "expense" if kind == "expense" else "revenue"
    for code in sorted(ch):                       # any leaf account of the right type
        if _kind(ch[code].get("account_type")) == want and _leaf(ch[code]):
            return ch[code]
    return None


async def money_options(db, company_id: str, kind: str) -> list:
    """Where an expense can be paid from / a revenue received into."""
    ch = await chart(db, company_id)
    out = []
    if _leaf(ch.get("161")):
        out.append({"id": "cash", "label": "الخزينة", "account_code": "161",
                    "balance": await balance(db, company_id, ch["161"]), "group": "نقدية"})
    async for b in db.bank_accounts.find({"company_id": company_id, "is_active": {"$ne": False}}):
        code = b.get("linked_account_code") or "162"
        if _leaf(ch.get(code)):
            out.append({"id": f"bank:{b['_id']}", "label": f"{b.get('bank_name', '')} — {b.get('account_number', '')}",
                        "account_code": code, "balance": await balance(db, company_id, ch[code]), "group": "بنوك"})
    if not any(o["group"] == "بنوك" for o in out) and _leaf(ch.get("162")):
        out.append({"id": "account:162", "label": ch["162"]["account_name"], "account_code": "162",
                    "balance": await balance(db, company_id, ch["162"]), "group": "بنوك"})
    # partners' / chairman's current accounts — money they put in or take out
    for code, a in sorted(ch.items()):
        name = str(a.get("account_name") or "")
        # "جاري الشركاء", "جاري رئيس مجلس الإدارة" — not "دائنون تجاريون" or
        # "الجزء الجاري" of a lease, which merely contain the letters
        if _leaf(a) and name.startswith("جاري ") and "الشركات" not in name and \
                _kind(a.get("account_type")) in ("liability", "equity"):
            out.append({"id": f"account:{code}",
                        "label": (f"دفعها: {a['account_name']}" if kind == "expense" else f"استلمها: {a['account_name']}"),
                        "account_code": code, "group": "الشركاء والإدارة"})
    credit = ("251", "آجل — على المورد (يُسدَّد لاحقاً)") if kind == "expense" \
        else ("131", "آجل — على العميل (يُحصَّل لاحقاً)")
    if _leaf(ch.get(credit[0])):
        out.append({"id": f"account:{credit[0]}", "label": credit[1], "account_code": credit[0], "group": "آجل"})
    return out


async def resolve_source(db, company_id: str, ch: dict, source: str):
    """(ledger account, bank record or None) for an option id."""
    if source == "cash":
        return ch.get("161"), None
    if source.startswith("bank:"):
        try:
            bank = await db.bank_accounts.find_one({"_id": ObjectId(source[5:]), "company_id": company_id})
        except Exception:
            bank = None
        if not bank:
            return None, None
        return ch.get(bank.get("linked_account_code") or "162"), bank
    if source.startswith("account:"):
        return ch.get(source[8:]), None
    return None, None


async def post_item(db, company_id: str, user_id: str, *, kind: str, project: dict, item: dict,
                    source: str, account_id: Optional[str] = None) -> dict:
    """Post the entry for one project expense / revenue. Raises ValueError with
    an Arabic reason; nothing is written when it does."""
    from services.import_documents import post_two_line_entry

    amount = round(float(item.get("amount") or 0), 2)
    if amount <= 0:
        raise ValueError("المبلغ يجب أن يكون أكبر من صفر")
    date = str(item.get("date") or "")[:10] or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if date > datetime.now(timezone.utc).strftime("%Y-%m-%d"):
        raise ValueError("التاريخ في المستقبل — المصروف أو الإيراد يُسجَّل بتاريخ حدوثه")
    if len(str(item.get("description") or "").strip()) < 3:
        raise ValueError("اكتب بياناً واضحاً")

    ch = await chart(db, company_id)
    if account_id:
        main = next((a for a in ch.values() if a.get("id") == account_id), None)
        want = "expense" if kind == "expense" else "revenue"
        if not _leaf(main) or _kind(main.get("account_type")) != want:
            raise ValueError("اختر حساب " + ("مصروف" if kind == "expense" else "إيراد") + " فرعياً")
    else:
        main = account_for(ch, kind, item.get("category") or "other")
    if not main and kind == "expense" and (item.get("category") in PACK_ONLY_CATEGORIES):
        code = EXPENSE_ACCOUNTS[item["category"]][0]
        from services.ops_posting import PACK_HINT
        raise ValueError(f"الحساب {code} غير موجود في شجرة حسابات الشركة — فعّل «{PACK_HINT.get(code, '')}» "
                         "من إعدادات الحسابات أو اختر تصنيفاً آخر")
    if not main:
        raise ValueError("لا يوجد في شجرة الحسابات حساب " + ("مصروفات" if kind == "expense" else "إيرادات"))

    money, bank = await resolve_source(db, company_id, ch, source or "")
    if not _leaf(money):
        raise ValueError("اختر من أين دُفع المبلغ" if kind == "expense" else "اختر أين استُلم المبلغ")
    if kind == "expense" and money["account_code"] == "161":
        bal = await balance(db, company_id, money)
        if amount > bal + 0.005:
            raise ValueError(f"رصيد الخزينة {bal:,.2f} لا يكفي — اختر بنكاً أو «دفعها رئيس مجلس الإدارة / الشريك»")

    pname = project.get("name") or project.get("id")
    desc = f"{'مصروف' if kind == 'expense' else 'إيراد'} مشروع ({pname}): {item['description']}"[:200]
    dr, cr = (main, money) if kind == "expense" else (money, main)
    entry = await post_two_line_entry(db, company_id, user_id, date, dr["account_code"], cr["account_code"],
                                      amount, desc, f"project_{kind}", item["id"])
    # project_id was set on the entry header only. Every report that splits by
    # project (budget actuals, income statement per project) reads it from the
    # journal LINE, like cost_center_id, so project spending always read 0.
    # Tag both lines (and the reversal copies line dimensions on cancel).
    je = await db.journal_entries.find_one({"id": entry["id"], "company_id": company_id}, {"_id": 0, "lines": 1})
    lines = [{**ln, "project_id": project["id"]} for ln in (je or {}).get("lines") or []]
    await db.journal_entries.update_one({"id": entry["id"], "company_id": company_id},
                                        {"$set": {"project_id": project["id"], "lines": lines}})

    bank_txn = None
    if bank:
        bank_txn = str((await db.bank_transactions.insert_one({
            "company_id": company_id, "bank_account_id": str(bank["_id"]),
            "transaction_type": "withdrawal" if kind == "expense" else "deposit",
            "amount": amount, "description": desc, "reference": item.get("reference_number") or item["id"],
            "beneficiary": item.get("vendor"), "counter_account_code": main["account_code"],
            "auto_create_journal": False, "transaction_number": entry.get("entry_number_str"),
            "bank_name": bank.get("bank_name"), "account_number": bank.get("account_number"),
            "transaction_date": date, "journal_entry_id": entry["id"],
            "journal_entry_number": entry.get("entry_number"), "status": "posted",
            "source": f"project_{kind}", "created_at": datetime.now(timezone.utc), "created_by": user_id,
        })).inserted_id)

    return {"journal_entry_id": entry["id"], "journal_entry_number": entry.get("entry_number_str"),
            "account_id": main["id"], "account_code": main["account_code"], "account_name": main["account_name"],
            "paid_from": source, "paid_from_code": money["account_code"], "paid_from_name": money["account_name"],
            "bank_transaction_id": bank_txn, "date": date, "amount": amount, "status": "posted"}


async def cancel_item(db, company_id: str, user_id: str, kind: str, item: dict, reason: str) -> dict:
    """Reverse the item's entry on its own date and mark it cancelled."""
    from services.accounting_service import AccountingService
    coll = db.project_expenses if kind == "expense" else db.project_revenues
    rev = None
    je = await db.journal_entries.find_one(
        {"company_id": company_id, "source_document_type": f"project_{kind}",
         "source_document_id": item["id"], "status": {"$in": ["posted", "POSTED"]}}, {"_id": 0})
    if je:
        rev = await AccountingService(db).reverse_journal_entry(je["id"], user_id, je.get("entry_date", "")[:10] or None)
        await db.journal_entries.update_one({"id": rev["id"]}, {"$set": {
            "description": f"إلغاء {'مصروف' if kind == 'expense' else 'إيراد'} مشروع: {item.get('description', '')} — {reason}"[:200]}})
    if item.get("bank_transaction_id"):
        try:
            await db.bank_transactions.update_one({"_id": ObjectId(item["bank_transaction_id"])},
                                                  {"$set": {"status": "cancelled"}})
        except Exception:
            pass
    await coll.update_one({"id": item["id"], "company_id": company_id}, {"$set": {
        "status": "cancelled", "cancel_reason": reason, "cancelled_by": user_id,
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
        "reversal_entry_id": rev["id"] if rev else None}})
    return {"reversal_entry_number": rev.get("entry_number_str") if rev else None}
