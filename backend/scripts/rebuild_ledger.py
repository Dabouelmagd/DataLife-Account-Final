"""
Rebuild the general ledger from posted journal entries.

WHY
    Journal entries marked "posted" by older code never produced
    general_ledger rows, and account current_balance values were only
    partly updated. Trial balance, income statement and balance sheet all
    depend on those, so posted entries were missing from every report.

WHAT IT DOES
    1. For every posted, line-based journal entry that has no ledger rows,
       create one ledger row per line, in date order.
    2. Recompute current_balance = opening_balance + ledger movement for
       every account that has ledger movement, using each account's
       nature (debit-natured: asset, expense, contra-liability,
       contra-equity; everything else credit-natured).

SAFETY
    Dry run by default: prints what would change and writes nothing.
    Pass --apply to write. Entries that already have ledger rows are left
    alone, so running it twice cannot double-count. Accounts with a balance
    but no ledger movement are reported and never changed.

USAGE (on the server)
    docker exec datalife_backend python scripts/rebuild_ledger.py
    docker exec datalife_backend python scripts/rebuild_ledger.py --apply
    optional: --company <company_id>
"""

import os
import sys
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from pymongo import MongoClient

DEBIT_NATURE = {"asset", "expense", "contra_liability", "contra_equity"}


def nature(account_type: str) -> str:
    return "debit" if account_type in DEBIT_NATURE else "credit"


def signed(account_type: str, debit: float, credit: float) -> float:
    return (debit - credit) if nature(account_type) == "debit" else (credit - debit)


def main():
    apply = "--apply" in sys.argv
    company_filter = None
    if "--company" in sys.argv:
        company_filter = sys.argv[sys.argv.index("--company") + 1]

    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

    q = {"status": "posted"}
    if company_filter:
        q["company_id"] = company_filter
    entries = list(db.journal_entries.find(q, {"_id": 0}))
    entries.sort(key=lambda e: (e.get("entry_date") or e.get("date") or "", e.get("created_at") or ""))

    accounts = {a["id"]: a for a in db.chart_of_accounts.find({}, {"_id": 0})}

    new_rows, skipped, problems = [], [], []
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    for e in entries:
        label = f"#{e.get('entry_number', '?')} ({e.get('entry_date') or e.get('date')})"
        if db.general_ledger.count_documents({"journal_entry_id": e["id"]}):
            skipped.append(label)
            continue
        lines = e.get("lines") or []
        if not lines:
            problems.append(f"{label}: posted but has no lines — not a line-based entry, skipped")
            continue
        td = round(sum(float(l.get("debit", 0) or 0) for l in lines), 2)
        tc = round(sum(float(l.get("credit", 0) or 0) for l in lines), 2)
        if td != tc:
            problems.append(f"{label}: unbalanced ({td} / {tc}), skipped")
            continue
        missing = [l.get("account_id") for l in lines if l.get("account_id") not in accounts]
        if missing:
            problems.append(f"{label}: unknown account id(s) {missing}, skipped")
            continue
        date = e.get("entry_date") or e.get("date") or ""
        if date[:10] > today:
            problems.append(f"{label}: dated in the future — included, but please check the date")
        for l in lines:
            new_rows.append({
                "id": str(uuid.uuid4()),
                "company_id": e["company_id"],
                "account_id": l["account_id"],
                "journal_entry_id": e["id"],
                "entry_date": date,
                "description": e.get("description", ""),
                "debit": float(l.get("debit", 0) or 0),
                "credit": float(l.get("credit", 0) or 0),
                "balance": 0.0,  # filled in below
                "created_at": datetime.now(timezone.utc).isoformat(),
                "source": "rebuild_ledger",
            })

    # ── Recompute balances from the full ledger (existing + new) ──
    existing = list(db.general_ledger.find({}, {"_id": 0}))
    all_rows = existing + new_rows
    all_rows.sort(key=lambda r: (r.get("entry_date", ""), r.get("created_at", "")))

    running = {}
    for r in all_rows:
        acc = accounts.get(r["account_id"])
        if not acc:
            continue
        base = running.get(r["account_id"], float(acc.get("opening_balance", 0) or 0))
        base += signed(acc.get("account_type", ""), r["debit"], r["credit"])
        running[r["account_id"]] = round(base, 2)
        if r.get("source") == "rebuild_ledger":
            r["balance"] = running[r["account_id"]]

    # ── Report ──
    print("=" * 70)
    print("DRY RUN — nothing written" if not apply else "APPLYING CHANGES")
    print("=" * 70)
    print(f"posted entries scanned        : {len(entries)}")
    print(f"already had ledger rows       : {len(skipped)}")
    print(f"ledger rows to create         : {len(new_rows)}")
    for p in problems:
        print(f"  ! {p}")

    print("\nAccount balance changes:")
    print(f"  {'code':<10}{'account':<34}{'current':>16}{'rebuilt':>16}")
    changes = []
    for acc_id, new_bal in sorted(running.items(), key=lambda kv: accounts[kv[0]].get("account_code", "")):
        acc = accounts[acc_id]
        cur = round(float(acc.get("current_balance", 0) or 0), 2)
        if cur != new_bal:
            changes.append((acc_id, new_bal))
        mark = "" if cur == new_bal else "  ←"
        print(f"  {acc.get('account_code',''):<10}{acc.get('account_name','')[:32]:<34}{cur:>16,.2f}{new_bal:>16,.2f}{mark}")

    orphans = [a for aid, a in accounts.items()
               if aid not in running and round(float(a.get("current_balance", 0) or 0), 2)
               != round(float(a.get("opening_balance", 0) or 0), 2)]
    if orphans:
        print("\nBalances with NO supporting ledger movement (reported only, never changed):")
        for a in orphans:
            print(f"  {a.get('account_code',''):<10}{a.get('account_name','')[:32]:<34}{a.get('current_balance',0):>16,.2f}")

    if not apply:
        print("\nRe-run with --apply to write these changes.")
        return

    if new_rows:
        db.general_ledger.insert_many(new_rows)
    for acc_id, bal in changes:
        db.chart_of_accounts.update_one({"id": acc_id}, {"$set": {"current_balance": bal}})
    print(f"\nDone: {len(new_rows)} ledger rows created, {len(changes)} account balances updated.")


if __name__ == "__main__":
    main()
