"""
مراجعة البيانات المستوردة: هل كل ما استُورد مسجّل في مكانه ومرحَّل لدفتر الأستاذ؟

    docker exec datalife_backend python backend/scripts/audit_imports.py
    docker exec datalife_backend python backend/scripts/audit_imports.py --company <company_id>

Read-only. Writes nothing. For every company with imported data it reports:

  * expenses / revenues   rows, total, rows with no entry, rows whose entry is
                          missing or not posted, and whether the entries' total
                          equals the rows' total;
  * leftovers of the old importers that no screen and no account can see:
                          items in `inventory`, rows in `purchases`, bare
                          invoices with no document_type / party / entry,
                          customers or suppliers carrying a "balance" number
                          that was never posted;
  * whether the company's posted entries balance (debit = credit).
"""
import asyncio
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


def money(x):
    return f"{x:,.2f}"


async def audit_company(db, cid: str, name: str):
    print(f"\n════ {name}  ({cid})")
    problems = 0

    for coll, label in (("expenses", "المصروفات"), ("revenues", "الإيرادات")):
        rows = await db[coll].find({"company_id": cid}, {"_id": 0}).to_list(None)
        if not rows:
            continue
        total = sum(float(r.get("amount") or 0) for r in rows)
        no_entry = [r for r in rows if not r.get("journal_entry_id")]
        je_ids = [r["journal_entry_id"] for r in rows if r.get("journal_entry_id")]
        jes = {j["id"]: j async for j in db.journal_entries.find({"id": {"$in": je_ids}}, {"_id": 0})}
        missing = [i for i in je_ids if i not in jes]
        not_posted = [i for i in je_ids if i in jes and jes[i].get("status") != "posted"]
        je_total = sum(float(j.get("total_debit") or 0) for j in jes.values() if j.get("status") == "posted")
        nan_rows = [r for r in rows if r.get("amount") != r.get("amount")]       # NaN
        by_account = defaultdict(float)
        for r in rows:
            by_account[r.get("account_code") or "—"] += float(r.get("amount") or 0)
        print(f"\n  {label}: {len(rows)} صف — إجمالي {money(total)}")
        print(f"    مرحّل في قيود مرحّلة: {money(je_total)}"
              + ("  ✓ مطابق" if abs(je_total - total) < 0.01 else f"  ✗ فرق {money(total - je_total)}"))
        for code, amt in sorted(by_account.items()):
            print(f"      حساب {code}: {money(amt)}")
        for title, bad in (("بدون قيد", no_entry), ("قيدها غير موجود", missing),
                           ("قيدها غير مرحّل", not_posted), ("مبلغها فارغ (NaN)", nan_rows)):
            if bad:
                problems += 1
                print(f"    ✗ {len(bad)} صف {title}")

    leftovers = {
        "أصناف في مجموعة inventory القديمة (لا تظهر في شاشة المخزون)":
            await db.inventory.count_documents({"company_id": cid}),
        "مشتريات في مجموعة purchases القديمة (لا تظهر في الفواتير ولا القيود)":
            await db.purchases.count_documents({"company_id": cid}),
        "فواتير قديمة بلا نوع مستند ولا عميل ولا قيد":
            await db.invoices.count_documents({"company_id": cid, "document_type": {"$exists": False}}),
        "عملاء/موردون عليهم رصيد مكتوب لم يُرحَّل":
            await db.parties.count_documents({"company_id": cid, "balance": {"$nin": [0, 0.0, None]},
                                              "source": {"$ne": "import"}}),
    }
    for label, n in leftovers.items():
        if n:
            problems += 1
            print(f"  ✗ {n} — {label}")

    imported_docs = await db.invoices.count_documents({"company_id": cid, "source": "import"})
    opening_docs = await db.invoices.count_documents({"company_id": cid, "is_opening_balance": True})
    unposted_docs = await db.invoices.count_documents(
        {"company_id": cid, "$or": [{"source": "import"}, {"is_opening_balance": True}],
         "journal_entry_id": {"$in": [None, ""]}})
    if imported_docs or opening_docs:
        print(f"\n  فواتير مستوردة: {imported_docs} — أرصدة افتتاحية: {opening_docs}"
              + (f" — ✗ {unposted_docs} بلا قيد" if unposted_docs else " — كلها لها قيود ✓"))
        problems += 1 if unposted_docs else 0

    dr = cr = 0.0
    async for je in db.journal_entries.find({"company_id": cid, "status": "posted"}, {"_id": 0, "lines": 1}):
        for line in je.get("lines", []):
            dr += float(line.get("debit") or 0)
            cr += float(line.get("credit") or 0)
    ok = abs(dr - cr) < 0.01
    print(f"\n  ميزان المراجعة: مدين {money(dr)} — دائن {money(cr)} " + ("✓ متوازن" if ok else "✗ غير متوازن"))
    problems += 0 if ok else 1
    print(f"\n  النتيجة: {'لا توجد مشاكل ✓' if problems == 0 else f'{problems} نقطة تحتاج مراجعة'}")


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    only = None
    if "--company" in sys.argv:
        only = sys.argv[sys.argv.index("--company") + 1]
    ids = set()
    for coll in ("expenses", "revenues", "import_history", "inventory", "purchases"):
        ids.update(await db[coll].distinct("company_id"))
    ids.discard(None)
    if only:
        ids = {only}
    for cid in sorted(ids):
        company = await db.companies.find_one({"id": cid}, {"_id": 0, "name": 1}) or {}
        await audit_company(db, cid, company.get("name") or "—")


if __name__ == "__main__":
    asyncio.run(main())
