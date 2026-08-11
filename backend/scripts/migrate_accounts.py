"""
Migration Script — Add Missing Accounts to Existing Companies
سكريبت الترحيل — إضافة الحسابات الناقصة للشركات الموجودة

Run on server:
  cd /opt/datalifeaccount
  docker exec -it datalife_backend python3 -m scripts.migrate_accounts
"""

import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from models.accounting import DEFAULT_ACCOUNTS, ChartOfAccount
from datetime import datetime

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME   = os.environ.get("DB_NAME", "datalife_erp")

# Codes added in this migration (19 new accounts)
NEW_CODES = {
    # Migration 1 — July 2026
    "15","151","163",
    "214","215",
    "23","231","256","257",
    "32","321",
    "335","336","337","338","344",
    "43","431","432",
    # Migration 2 — Egyptian Law 148/2019 + 91/2005
    "137","138","141",
    "258","259","260","261","262","263","264",
    "315","316","317",
    "339","340",
    "414","415","416",
}

async def migrate():
    print("=" * 60)
    print("DataLife — Migration: Complete Chart of Accounts (71→90)")
    print("=" * 60)

    if not MONGO_URL:
        print("❌ MONGO_URL not set in environment")
        return

    client = AsyncIOMotorClient(MONGO_URL)
    db     = client[DB_NAME]

    # Get all companies
    companies = await db.companies.find(
        {}, {"_id": 0, "id": 1, "name": 1}
    ).to_list(length=10000)

    if not companies:
        print("⚠️  No companies found")
        client.close()
        return

    print(f"\n📋 Companies found: {len(companies)}")

    new_accounts_def = [a for a in DEFAULT_ACCOUNTS if a["code"] in NEW_CODES]
    print(f"📦 New accounts per company: {len(new_accounts_def)}\n")

    for a in sorted(new_accounts_def, key=lambda x: x["code"]):
        print(f"   {a['code']:8} | {a['name']}")

    print()

    total_added = total_skip = total_errors = 0

    for company in companies:
        cid   = company["id"]
        cname = company.get("name", cid[:8])
        added = skipped = 0

        for acc_def in new_accounts_def:
            code = acc_def["code"]

            # Skip if already exists
            exists = await db.chart_of_accounts.find_one(
                {"company_id": cid, "account_code": code}
            )
            if exists:
                skipped += 1
                continue

            # Build document
            try:
                account = ChartOfAccount(
                    company_id       = cid,
                    account_code     = code,
                    account_name     = acc_def["name"],
                    account_name_en  = acc_def.get("name_en"),
                    account_type     = acc_def["type"],
                    account_category = acc_def["category"],
                    is_system        = acc_def.get("is_system", False),
                    description      = (
                        "حساب رئيسي تجميعي" if acc_def.get("is_header")
                        else "حساب فرعي يقبل حركات"
                    ),
                )
                doc = account.dict()
                doc["is_header"]   = acc_def.get("is_header", False)
                doc["parent_code"] = acc_def.get("parent_code")
                doc["current_balance"] = 0.0
                doc["created_at"]  = datetime.utcnow().isoformat()
                doc.pop("_id", None)

                await db.chart_of_accounts.insert_one(doc)
                added += 1
            except Exception as e:
                total_errors += 1
                print(f"   ❌ {code} / {cname}: {e}")

        total_added += added
        total_skip  += skipped
        icon = "✅" if added > 0 else "⏭️ "
        print(f"  {icon} {cname[:35]:35} | +{added:2} added  {skipped:2} existed")

    print("\n" + "=" * 60)
    print(f"✅ Done!")
    print(f"   Companies : {len(companies)}")
    print(f"   Added     : {total_added}")
    print(f"   Skipped   : {total_skip}")
    print(f"   Errors    : {total_errors}")
    print("=" * 60)

    client.close()

if __name__ == "__main__":
    asyncio.run(migrate())
