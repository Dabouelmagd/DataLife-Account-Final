"""
Moves pack accounts that were added under the wrong parent.

148 «شركات التأمين الطبي» (medical pack) was added under 14 «مشروعات تحت
التنفيذ»; it is a receivable and belongs under 13 «المدينون». Only the chart
tree changes — balances, entries and the balance sheet (which reads the
account's category) are untouched.

    python scripts/fix_pack_parents.py            # show what would move
    python scripts/fix_pack_parents.py --apply    # move it
"""
import os
import sys

from pymongo import MongoClient

MOVES = [("148", "14", "13")]          # code, wrong parent, right parent


def main():
    apply = "--apply" in sys.argv
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    moved = 0
    for code, wrong, right in MOVES:
        for acc in db.chart_of_accounts.find({"account_code": code, "parent_code": wrong},
                                             {"_id": 0, "id": 1, "company_id": 1, "account_name": 1}):
            parent = db.chart_of_accounts.find_one({"company_id": acc["company_id"], "account_code": right},
                                                   {"_id": 0, "id": 1})
            print(f"  company {acc['company_id']}: {code} {acc.get('account_name')}  {wrong} → {right}")
            if apply:
                db.chart_of_accounts.update_one(
                    {"id": acc["id"]},
                    {"$set": {"parent_code": right, "parent_account_id": (parent or {}).get("id")}})
            moved += 1
    print(f"\n{'moved' if apply else 'would move'} {moved} account(s)" + ("" if apply else " — run with --apply"))


if __name__ == "__main__":
    main()
