"""
Add default-chart accounts that an existing company is missing.

The default chart gained accounts that automated postings require (VAT,
payroll tax, corporate tax, losses, POS, petty cash, ...). Companies
created before that have the old chart, so those postings would fail.

Only ADDS missing codes. Never edits, renames or deletes an existing
account, and never touches balances. Dry run by default.

USAGE
    docker exec datalife_backend python scripts/sync_default_accounts.py            # all companies, preview
    docker exec datalife_backend python scripts/sync_default_accounts.py --apply
    docker exec datalife_backend python scripts/sync_default_accounts.py --email dalia@datalifeai.com --apply
"""

import os
import sys
import uuid
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient
from models.accounting import DEFAULT_ACCOUNTS

DEBIT_NATURE = {"asset", "expense", "contra_liability", "contra_equity"}


def main():
    apply = "--apply" in sys.argv
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

    if "--email" in sys.argv:
        email = sys.argv[sys.argv.index("--email") + 1]
        u = db.users.find_one({"email": email}, {"company_id": 1})
        if not u or not u.get("company_id"):
            sys.exit(f"no company for {email}")
        company_ids = [u["company_id"]]
    else:
        company_ids = db.chart_of_accounts.distinct("company_id")

    print("DRY RUN — nothing written" if not apply else "APPLYING")
    total = 0
    for cid in company_ids:
        existing = {a["account_code"]: a for a in db.chart_of_accounts.find(
            {"company_id": cid}, {"_id": 0, "account_code": 1, "id": 1})}
        if not existing:
            continue  # company never initialised its chart — the app seeds it on first use
        todo = [d for d in DEFAULT_ACCOUNTS if d["code"] not in existing]
        name = (db.companies.find_one({"id": cid}, {"name": 1}) or {}).get("name", cid)
        print(f"\n{name}  ({len(existing)} accounts) — {len(todo)} to add")
        new_docs = []
        for d in todo:
            parent = existing.get(d.get("parent_code")) or next(
                (x for x in new_docs if x["account_code"] == d.get("parent_code")), None)
            t = d["type"].value
            doc = {
                "id": str(uuid.uuid4()), "company_id": cid,
                "account_code": d["code"], "account_name": d["name"],
                "account_name_en": d.get("name_en"), "account_type": t,
                "account_category": d["category"].value,
                "parent_account_id": (parent or {}).get("id"),
                "is_header": d.get("is_header", False),
                "allow_posting": not d.get("is_header", False),
                "is_system": d.get("is_system", False), "is_active": True,
                "normal_balance": "debit" if t in DEBIT_NATURE else "credit",
                "opening_balance": 0.0, "current_balance": 0.0, "currency_id": "EGP",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
            new_docs.append(doc)
            print(f"   + {d['code']:<6} {d['name']}")
        if apply and new_docs:
            db.chart_of_accounts.insert_many(new_docs)
        total += len(new_docs)

    print(f"\n{'added' if apply else 'would add'}: {total} accounts")
    if not apply:
        print("Re-run with --apply to write.")


if __name__ == "__main__":
    main()
