"""
Move erp-core approval requests out of approval_requests into their own
collection (erp_approval_requests). The two approval engines used one
collection with different schemas. erp-core rows are the ones with a
"document_type" field. Dry run by default.

    docker exec datalife_backend python scripts/migrate_erp_approvals.py [--apply]
"""
import os
import sys

from pymongo import MongoClient


def main():
    apply = "--apply" in sys.argv
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    rows = list(db.approval_requests.find({"document_type": {"$exists": True}}, {"_id": 0}))
    for r in rows:
        print(f"  {str(r.get('company_id', ''))[:8]}  {r.get('document_type')}  {r.get('amount')}  [{r.get('status')}]")
        if apply and not db.erp_approval_requests.find_one({"id": r["id"]}, {"_id": 1}):
            db.erp_approval_requests.insert_one(r)
    if apply and rows:
        db.approval_requests.delete_many({"document_type": {"$exists": True}})
    print(f"\n{'moved' if apply else 'would move'} {len(rows)} request(s)" + ("" if apply else " — run again with --apply"))


if __name__ == "__main__":
    main()
