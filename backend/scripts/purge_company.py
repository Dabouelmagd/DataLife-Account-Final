"""
Permanently remove ALL data belonging to one company.

Guards
  - dry run by default: lists every collection and how many documents
  - --apply also requires --confirm <company_id> (the same id, typed again)
  - refuses while the company still has an active user
  - writes a compressed JSON backup of everything it will delete, to the
    persistent uploads volume, BEFORE deleting anything

Keep in mind: Egyptian law requires keeping accounting records for years.
Only purge companies that never traded for real (trials, tests).

USAGE
    docker exec datalife_backend python scripts/purge_company.py --company <id>
    docker exec datalife_backend python scripts/purge_company.py --company <id> --apply --confirm <id>
"""

import os
import sys
import gzip
import json
from datetime import datetime

from pymongo import MongoClient

BACKUP_DIR = "/app/uploads/backups"


def main():
    if "--company" not in sys.argv:
        sys.exit("usage: --company <id> [--apply --confirm <id>]")
    cid = sys.argv[sys.argv.index("--company") + 1]
    apply = "--apply" in sys.argv
    confirm = sys.argv[sys.argv.index("--confirm") + 1] if "--confirm" in sys.argv else None

    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    company = db.companies.find_one({"id": cid}, {"_id": 0})
    print(f"company: {company.get('name') if company else '(no company record)'}  [{cid}]")

    active = db.users.count_documents({"company_id": cid, "is_active": {"$ne": False}})
    if active:
        sys.exit(f"refusing: {active} active user(s) still belong to this company")

    plan = []
    for name in sorted(db.list_collection_names()):
        q = {"id": cid} if name == "companies" else {"company_id": cid}
        n = db[name].count_documents(q)
        if n:
            plan.append((name, q, n))
    total = sum(n for _, _, n in plan)
    for name, _, n in plan:
        print(f"  {name:<34} {n:>7}")
    print(f"  {'TOTAL':<34} {total:>7}")

    if not apply:
        print(f"\nDRY RUN — nothing deleted. To delete:\n  --apply --confirm {cid}")
        return
    if confirm != cid:
        sys.exit("refusing: --confirm must repeat the exact company id")

    os.makedirs(BACKUP_DIR, exist_ok=True)
    path = f"{BACKUP_DIR}/company_{cid}_{datetime.utcnow():%Y%m%d_%H%M%S}.json.gz"
    with gzip.open(path, "wt", encoding="utf-8") as fh:
        json.dump({name: list(db[name].find(q, {"_id": 0})) for name, q, _ in plan},
                  fh, ensure_ascii=False, default=str)
    print(f"\nbackup written: {path}")

    for name, q, _ in plan:
        db[name].delete_many(q)
    print(f"deleted {total} documents across {len(plan)} collections")


if __name__ == "__main__":
    main()
