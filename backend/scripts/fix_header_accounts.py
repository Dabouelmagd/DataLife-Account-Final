"""
Mark the chart's grouping accounts as headers (حسابات تجميعية).

An account that other accounts hang under was often stored as a normal,
postable account: the seed set allow_posting=False for some codes but left
is_header False, 9/91/92 were flagged only by category, and industry packs
added children under accounts that never became headers. Reports then showed
group accounts as lines of their own and entries could land on them.

For each parent account (some other account names it as parent_code):
  * no ledger movement and no opening balance  → flagged as a header
    (is_header=True, allow_posting=False). Nothing else changes.
  * it has movement or an opening balance      → left postable and listed,
    because the system posts to some of these directly (254 taxes payable,
    332 general expenses …). Moving those balances is a decision for the
    accountant, not a script.

Dry run by default.

USAGE
    docker exec datalife_backend python scripts/fix_header_accounts.py
    docker exec datalife_backend python scripts/fix_header_accounts.py --apply
    docker exec datalife_backend python scripts/fix_header_accounts.py --email dalia@datalifeai.com --apply
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient

# parents the system posts to by code (land and intangible assets, perpetual
# stock 125, invoice VAT fallback, imports, projects,
# government payments) — flagging them would make those postings fail
POSTED_BY_SYSTEM = {"111", "125", "222", "254", "332", "336", "338"}


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

    total_fixed = 0
    for cid in company_ids:
        accounts = list(db.chart_of_accounts.find(
            {"company_id": cid},
            {"_id": 0, "id": 1, "account_code": 1, "account_name": 1, "parent_code": 1,
             "is_header": 1, "allow_posting": 1, "account_category": 1, "opening_balance": 1}))
        parent_codes = {str(a.get("parent_code")) for a in accounts if a.get("parent_code")}
        used = set(db.general_ledger.distinct("account_id", {"company_id": cid}))

        fix, keep = [], []
        for a in accounts:
            code = str(a.get("account_code") or "")
            if code not in parent_codes:
                continue
            already = a.get("is_header") and a.get("allow_posting") is False
            if already:
                continue
            has_money = a.get("id") in used or float(a.get("opening_balance") or 0) != 0 \
                or code in POSTED_BY_SYSTEM
            (keep if has_money else fix).append(a)

        if not fix and not keep:
            continue
        print(f"\n=== company {cid}")
        for a in sorted(fix, key=lambda x: x["account_code"]):
            print(f"  header ← {a['account_code']:<8} {a.get('account_name')}")
        for a in sorted(keep, key=lambda x: x["account_code"]):
            print(f"  kept postable (movement / used by the system) {a['account_code']:<8} {a.get('account_name')}")

        if apply and fix:
            db.chart_of_accounts.update_many(
                {"company_id": cid, "id": {"$in": [a["id"] for a in fix]}},
                {"$set": {"is_header": True, "allow_posting": False}})
        total_fixed += len(fix)

    print(f"\n{'flagged' if apply else 'would flag'} {total_fixed} account(s) as headers"
          + ("" if apply else " — run again with --apply"))


if __name__ == "__main__":
    main()
