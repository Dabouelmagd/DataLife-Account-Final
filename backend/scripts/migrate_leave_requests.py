"""
Move leave requests made from the employee portal into the HR leave records.

The portal saved them in db.leave_requests, which no screen could approve, so
they stayed «معلّق» forever. New requests now go to db.leaves (and the
approvals queue). This copies the old ones across, once; pending ones then
appear in HR → الإجازات. Dry run by default.

    docker exec datalife_backend python scripts/migrate_leave_requests.py
    docker exec datalife_backend python scripts/migrate_leave_requests.py --apply
"""
import os
import sys

from pymongo import MongoClient


def main():
    apply = "--apply" in sys.argv
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    moved = 0
    for r in db.leave_requests.find({}, {"_id": 0}):
        if db.leaves.find_one({"id": r["id"]}, {"_id": 1}):
            continue
        print(f"  {r.get('company_id', '')[:8]}  {r.get('employee_name', '')}  {r.get('leave_type')}  "
              f"{r.get('start_date')} → {r.get('end_date')}  [{r.get('status')}]")
        if apply:
            db.leaves.insert_one({**r, "migrated_from": "leave_requests"})
        moved += 1
    print(f"\n{'moved' if apply else 'would move'} {moved} request(s)" + ("" if apply else " — run again with --apply"))


if __name__ == "__main__":
    main()
