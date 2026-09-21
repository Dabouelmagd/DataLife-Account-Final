"""
Move suppliers from the legacy `suppliers` collection into `suppliers_extended`,
the single supplier store. Skips any whose name already exists for the same
company. Dry run by default; --apply to write. The legacy rows are left in
place (nothing deleted).

    docker exec datalife_backend python scripts/merge_suppliers.py [--apply]
"""
import os, sys
from datetime import datetime, timezone
from pymongo import MongoClient

apply = "--apply" in sys.argv
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
moved = skipped = 0
for s in db.suppliers.find({}, {"_id": 0}):
    exists = db.suppliers_extended.find_one({"company_id": s.get("company_id"), "name": s.get("name")})
    if exists or db.suppliers_extended.find_one({"id": s.get("id")}):
        skipped += 1
        continue
    doc = {**s, "is_active": True, "migrated_from": "suppliers",
           "created_at": s.get("created_at") or datetime.now(timezone.utc).isoformat()}
    doc.pop("balance", None)
    print(f"  + {s.get('company_id', '')[:8]}  {s.get('name')}")
    if apply:
        db.suppliers_extended.insert_one(doc)
    moved += 1
print(f"{'moved' if apply else 'would move'}: {moved} | already present: {skipped}")
if not apply:
    print("Re-run with --apply to write.")
