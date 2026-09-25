"""
ترحيل المصروفات والإيرادات المستوردة قبل الإصلاح.

    docker exec datalife_backend python backend/scripts/post_imported_rows.py
    docker exec datalife_backend python backend/scripts/post_imported_rows.py --apply

Rows imported before the posting fix sit in `expenses` / `revenues` with no
journal entry behind them: the money is visible on the expense screen and
absent from the trial balance. This posts each one and writes its entry number
back onto the row.

Safe to run more than once: a row that already carries a journal_entry_id is
skipped, so nothing is posted twice. Dry run by default — it prints what it
would do, per account, and writes nothing until --apply.
"""

import asyncio
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


async def main():
    apply = "--apply" in sys.argv
    only_company = None
    if "--company" in sys.argv:
        i = sys.argv.index("--company")
        if len(sys.argv) > i + 1:
            only_company = sys.argv[i + 1]

    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    from services.import_posting import post_row

    print("APPLYING — سيتم الترحيل فعلياً\n" if apply else
          "DRY RUN — لن يُكتب شيء. أضف --apply للتنفيذ\n")

    grand = Counter()
    for collection, data_type in (("expenses", "expense"), ("revenues", "revenue")):
        query = {"journal_entry_id": {"$exists": False}}
        if only_company:
            query["company_id"] = only_company
        rows = await db[collection].find(query).to_list(None)
        if not rows:
            print(f"  {collection}: لا توجد صفوف بلا قيد")
            continue

        by_company = Counter(r.get("company_id", "—") for r in rows)
        print(f"  {collection}: {len(rows)} صف بلا قيد، في {len(by_company)} شركة")

        posted = failed = 0
        per_account = Counter()
        failures = []
        for row in rows:
            company_id = row.get("company_id")
            if not company_id:
                failures.append((row.get("description", "")[:40], "الصف بلا شركة"))
                failed += 1
                continue
            try:
                if apply:
                    result = await post_row(db, company_id, row.get("created_by") or "system",
                                            row, data_type)
                    await db[collection].update_one({"_id": row["_id"]}, {"$set": {
                        "journal_entry_id": result["journal_entry_id"],
                        "entry_number": result["entry_number"],
                        "account_code": result["account_code"],
                        "used_default_account": result["used_default_account"],
                        "backfilled": True}})
                    per_account[result["account_code"]] += 1
                else:
                    # dry run: resolve the account only, so the report is real
                    from services.import_posting import (resolve_account, DEFAULT_EXPENSE,
                                                         DEFAULT_REVENUE)
                    amount = float(row.get("amount") or 0)
                    if amount <= 0:
                        raise ValueError("المبلغ صفر أو سالب")
                    code, _ = await resolve_account(
                        db, company_id, row.get("account") or row.get("category"),
                        DEFAULT_EXPENSE if data_type == "expense" else DEFAULT_REVENUE)
                    per_account[code] += 1
                posted += 1
            except Exception as e:
                failed += 1
                failures.append((str(row.get("description", ""))[:40], str(e)[:70]))

        print(f"    {'رُحّل' if apply else 'سيُرحَّل'}: {posted} | يتعذّر: {failed}")
        if per_account:
            print("    التوزيع على الحسابات:")
            for code, count in per_account.most_common(10):
                account = await db.chart_of_accounts.find_one(
                    {"account_code": code}, {"_id": 0, "account_name": 1}) or {}
                print(f"      {code:<7}{account.get('account_name', '')[:40]:<42}{count} صف")
        if failures:
            print("    أمثلة لما يتعذّر ترحيله:")
            for desc, reason in failures[:5]:
                print(f"      • {desc or '(بلا وصف)'} — {reason}")
        grand[collection] = posted

    # rows written by a failed import: no amount, no description, no entry.
    # They are not data, and leaving them makes every later count wrong.
    empty_query = {"journal_entry_id": {"$exists": False},
                   "$or": [{"amount": {"$in": [0, 0.0, None]}}, {"amount": {"$exists": False}}],
                   "$and": [{"$or": [{"description": ""}, {"description": None},
                                     {"description": {"$exists": False}}]}]}
    if only_company:
        empty_query["company_id"] = only_company
    for collection in ("expenses", "revenues"):
        empty = await db[collection].count_documents(empty_query)
        if not empty:
            continue
        print(f"\n  {collection}: {empty} صف فارغ تماماً (بلا مبلغ وبلا وصف وبلا قيد)")
        print("     هذه ليست بيانات — كتبها استيراد فشل في قراءة الملف.")
        if "--clean-empty" in sys.argv and apply:
            result = await db[collection].delete_many(empty_query)
            print(f"     حُذف {result.deleted_count} صف")
        else:
            print("     لحذفها: أضف --clean-empty --apply")

    total = sum(grand.values())
    print(f"\n{'تم ترحيل' if apply else 'سيُرحَّل'} {total} صف إجمالاً")
    if not apply and total:
        print("للتنفيذ: أضف --apply إلى الأمر")


if __name__ == "__main__":
    asyncio.run(main())
