"""
Bring past sales invoices and customer payments into the general ledger.

Before the fix:
  - direct invoices created an entry marked "posted" that never reached the
    ledger (fixed by scripts/rebuild_ledger.py — run that FIRST);
  - invoices converted from quotations / generated from subscriptions had no
    entry at all;
  - customer payments had no entry at all.

This script:
  - links an invoice to the entry the old code already created for it
    (source_document_id == invoice id), so nothing is posted twice;
  - posts an entry for every invoice that has none;
  - posts an entry for every recorded payment that has none.
Dry run by default; --apply to write. Safe to re-run.

ORDER
    docker exec datalife_backend python scripts/rebuild_ledger.py --apply
    docker exec datalife_backend python scripts/backfill_sales_ledger.py
    docker exec datalife_backend python scripts/backfill_sales_ledger.py --apply
"""
import os
import sys
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient


async def main():
    apply = "--apply" in sys.argv
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    import api.sales as S
    S.db = db

    linked = posted_inv = posted_pay = failed = 0
    print("DRY RUN — nothing written" if not apply else "APPLYING")
    async for inv in db.sales_invoices.find({}, {"_id": 0}).sort("date", 1):
        label = f"{inv.get('company_id', '')[:8]} {inv.get('invoice_number')}"
        if (inv.get("status") or "").lower() in ("cancelled", "void", "voided"):
            continue
        # 1) invoice entry
        if not inv.get("journal_entry_id"):
            old = await db.journal_entries.find_one(
                {"company_id": inv["company_id"], "source_document_id": inv["id"],
                 "status": {"$in": ["posted", "reversed"]}}, {"_id": 0, "id": 1})
            if old:
                print(f"  link   {label} → existing entry")
                if apply:
                    await db.sales_invoices.update_one({"id": inv["id"]}, {"$set": {"journal_entry_id": old["id"]}})
                linked += 1
            else:
                print(f"  post   {label}  {inv.get('total', 0):,.2f}")
                if apply:
                    try:
                        je = await S.post_sales_invoice(inv, "backfill")
                        await db.sales_invoices.update_one({"id": inv["id"]}, {"$set": {"journal_entry_id": je}})
                    except Exception as e:
                        failed += 1
                        print(f"    ! {e}")
                        continue
                posted_inv += 1
        # 2) payments
        pays = inv.get("payments") or []
        changed = False
        for pay in pays:
            if pay.get("journal_entry_id"):
                continue
            print(f"  pay    {label}  {pay.get('amount', 0):,.2f} ({pay.get('method', 'cash')}) {pay.get('date')}")
            if apply:
                try:
                    pay["journal_entry_id"] = await S.post_customer_payment(inv, pay, "backfill")
                    changed = True
                except Exception as e:
                    failed += 1
                    print(f"    ! {e}")
                    continue
            posted_pay += 1
        if apply and changed:
            await db.sales_invoices.update_one({"id": inv["id"]}, {"$set": {"payments": pays}})

    print(f"\n{'done' if apply else 'would do'}: link {linked} | post invoices {posted_inv} | "
          f"post payments {posted_pay}" + (f" | failed {failed}" if failed else ""))
    if not apply:
        print("Run scripts/rebuild_ledger.py --apply first, then re-run this with --apply.")


if __name__ == "__main__":
    asyncio.run(main())
