"""
Reclassify expenses the board chairman paid personally.

WHY
    Expenses paid from the chairman's own money were entered as
        Dr Expense / Cr 161 Cash on Hand
    so the cash box went ~5.9M negative, which is impossible. The money
    never left the company's cash; the company owes it to the chairman.

WHAT IT DOES
    1. Finds or creates the liability account "جاري رئيس مجلس الإدارة"
       under group 25 (payables), on the first free code 2510..2599.
    2. For every posted entry that credits 161, adds a correcting entry on
       the SAME date:
            Dr 161 Cash on Hand        amount
            Cr جاري رئيس مجلس الإدارة     amount
       Same-date entries keep every historical report correct; the
       original entries are left untouched (posted entries are immutable).
    3. Posts each one through AccountingService, so ledger rows and account
       balances are written exactly as the app writes them.

SAFETY
    Dry run by default. --apply to write. Each correction records the
    original entry id, so re-running never corrects the same entry twice.
    Run AFTER scripts/rebuild_ledger.py --apply.

USAGE
    docker exec datalife_backend python scripts/reclass_owner_payments.py --email dalia@datalifeai.com
    docker exec datalife_backend python scripts/reclass_owner_payments.py --email dalia@datalifeai.com --apply
"""

import os
import sys
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from models.accounting import (
    ChartOfAccount, JournalEntry, JournalEntryLine, AccountType, AccountCategory,
)
from services.accounting_service import AccountingService

CASH_CODE = "161"
ACCOUNT_NAME = "جاري رئيس مجلس الإدارة"
ACCOUNT_NAME_EN = "Board Chairman Current Account"
RECLASS_TYPE = "adjustment"
RECLASS_REF = "RECLASS-"   # idempotency key: reference is never rewritten


async def main():
    apply = "--apply" in sys.argv
    if "--email" not in sys.argv:
        sys.exit("usage: --email <chairman email> [--apply]")
    email = sys.argv[sys.argv.index("--email") + 1]

    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    svc = AccountingService(db)

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("company_id"):
        sys.exit(f"no user with a company for {email}")
    company_id = user["company_id"]

    cash = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": CASH_CODE}, {"_id": 0})
    if not cash:
        sys.exit(f"account {CASH_CODE} not found for this company")

    print("=" * 70)
    print("DRY RUN — nothing written" if not apply else "APPLYING CHANGES")
    print("=" * 70)

    # ── 1. the chairman's current account ──
    owner = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_name": ACCOUNT_NAME}, {"_id": 0})
    if owner:
        print(f"account exists     : {owner['account_code']} {ACCOUNT_NAME}")
    else:
        used = {a["account_code"] async for a in db.chart_of_accounts.find(
            {"company_id": company_id, "account_code": {"$regex": "^25"}}, {"account_code": 1})}
        code = next(str(c) for c in range(2510, 2600) if str(c) not in used)
        parent = await db.chart_of_accounts.find_one(
            {"company_id": company_id, "account_code": "25"}, {"_id": 0, "id": 1})
        print(f"account to create  : {code} {ACCOUNT_NAME} (liability, under 25)")
        owner = ChartOfAccount(
            company_id=company_id, account_code=code,
            account_name=ACCOUNT_NAME, account_name_en=ACCOUNT_NAME_EN,
            account_type=AccountType.LIABILITY, account_category=AccountCategory.PAYABLE,
            parent_account_id=(parent or {}).get("id"), normal_balance="credit",
            description="مبالغ دفعها رئيس مجلس الإدارة نيابة عن الشركة — مستحقة له",
        ).dict()
        if apply:
            await svc.create_account(ChartOfAccount(**owner))

    # ── 2. posted entries that credited the cash box ──
    done, drafts = set(), {}
    async for r in db.journal_entries.find(
            {"company_id": company_id, "reference": {"$regex": f"^{RECLASS_REF}"}},
            {"_id": 0, "id": 1, "status": 1, "source_document_id": 1}):
        if r.get("status") == "posted":
            done.add(r["source_document_id"])
        else:  # created earlier but posting failed — post it, don't duplicate it
            drafts[r["source_document_id"]] = r["id"]

    targets = []
    async for e in db.journal_entries.find(
            {"company_id": company_id, "status": "posted",
             "reference": {"$not": {"$regex": f"^{RECLASS_REF}"}}}, {"_id": 0}):
        amt = sum(float(l.get("credit", 0) or 0) for l in e.get("lines", [])
                  if l.get("account_id") == cash["id"])
        if amt > 0:
            targets.append((e, round(amt, 2)))
    targets.sort(key=lambda t: t[0].get("entry_date", ""))

    total = 0.0
    print(f"\n{'entry':<8}{'date':<13}{'amount':>16}   status")
    for e, amt in targets:
        state = ("already corrected" if e["id"] in done
                 else "draft exists — will post" if e["id"] in drafts else "to correct")
        print(f"#{e.get('entry_number','?'):<7}{e.get('entry_date',''):<13}{amt:>16,.2f}   {state}")
        if e["id"] not in done:
            total += amt
    print(f"{'':<21}{total:>16,.2f}   total to move from cash to {ACCOUNT_NAME}")

    if not apply:
        print("\nRe-run with --apply to write these changes.")
        return

    # ── 3. create and post the corrections ──
    made, failed = 0, []
    for e, amt in targets:
        if e["id"] in done:
            continue
        je = JournalEntry(
            company_id=company_id,
            entry_date=e["entry_date"],
            reference=f"{RECLASS_REF}{e.get('entry_number', '')}",
            description=f"تسوية: مصروفات دفعها رئيس مجلس الإدارة — قيد #{e.get('entry_number', '')}",
            source_document_type=RECLASS_TYPE,
            source_document_id=e["id"],
            created_by=user.get("id", "reclass_script"),
            lines=[
                JournalEntryLine(account_id=cash["id"], account_code=cash["account_code"],
                                 account_name=cash["account_name"], debit=amt, credit=0),
                JournalEntryLine(account_id=owner["id"], account_code=owner["account_code"],
                                 account_name=owner["account_name"], debit=0, credit=amt),
            ],
        )
        try:
            entry_id = drafts.get(e["id"]) or (await svc.create_journal_entry(je))["id"]
            await svc.post_journal_entry(entry_id, user.get("id", "reclass_script"))
            made += 1
        except Exception as err:
            failed.append(f"#{e.get('entry_number','?')} ({e.get('entry_date')}): {err}")
    print(f"\nDone: {made} correcting entries posted.")
    for f in failed:
        print(f"  ! not posted — {f}  (left as a draft; fix and re-run)")


if __name__ == "__main__":
    asyncio.run(main())
