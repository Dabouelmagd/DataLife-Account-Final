"""
من أين جاء كل رقم في لوحة التحكم؟ — read-only.

    docker exec datalife_backend python scripts/explain_dashboard.py --company <id>

Lists every account with a balance (code, name, type, active, balance), the
general-ledger totals, the accounts the trial balance leaves out, and every
journal entry with its lines — so each dashboard figure can be traced to the
entries behind it.
"""
import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db  # noqa: E402

DEBIT_TYPES = {"asset", "expense", "contra_liability", "contra_equity"}


def m(x):
    return f"{x:,.2f}"


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--company", required=True)
    cid = ap.parse_args().company

    accounts = await db.chart_of_accounts.find({"company_id": cid}, {"_id": 0}).to_list(None)
    print(f"عدد الحسابات في الشجرة: {len(accounts)}"
          f"  (غير نشطة: {sum(1 for a in accounts if a.get('is_active') is False)})")
    codes = [a.get("account_code") for a in accounts]
    dups = sorted({c for c in codes if codes.count(c) > 1})
    if dups:
        print(f"⚠ أكواد مكررة: {', '.join(dups)}")

    mv = {r["_id"]: r async for r in db.general_ledger.aggregate([
        {"$match": {"company_id": cid}},
        {"$group": {"_id": "$account_id", "d": {"$sum": "$debit"}, "c": {"$sum": "$credit"}, "n": {"$sum": 1}}}])}
    tot = await db.general_ledger.aggregate([
        {"$match": {"company_id": cid}},
        {"$group": {"_id": None, "d": {"$sum": "$debit"}, "c": {"$sum": "$credit"}, "n": {"$sum": 1}}}]).to_list(1)
    if tot:
        print(f"دفتر الأستاذ: {tot[0]['n']} سطر — مدين {m(tot[0]['d'])}  دائن {m(tot[0]['c'])}")
    ids = {a.get("id") for a in accounts}
    orphan = [k for k in mv if k not in ids]
    if orphan:
        print(f"⚠ سطور في الدفتر على حسابات غير موجودة في الشجرة: {len(orphan)} حساب")

    print("\nالحسابات التي لها رصيد:")
    print(f"  {'الكود':<8} {'الاسم':<38} {'النوع':<10} {'نشط':<4} {'افتتاحي':>14} {'مدين':>14} {'دائن':>14} {'الرصيد':>14}")
    for a in sorted(accounts, key=lambda x: str(x.get("account_code"))):
        r = mv.get(a.get("id"), {"d": 0, "c": 0, "n": 0})
        op = float(a.get("opening_balance") or 0)
        if not (r["n"] or op):
            continue
        t = str(getattr(a.get("account_type"), "value", a.get("account_type")))
        bal = op + (r["d"] - r["c"] if t in DEBIT_TYPES else r["c"] - r["d"])
        flags = ("رأس " if a.get("is_header") or a.get("account_category") == "header" else "") + \
                ("✗" if a.get("is_active") is False else "✓")
        print(f"  {a.get('account_code', ''):<8} {str(a.get('account_name', ''))[:38]:<38} {t:<10} {flags:<4} "
              f"{m(op):>14} {m(r['d']):>14} {m(r['c']):>14} {m(bal):>14}")

    print("\nالقيود:")
    async for e in db.journal_entries.find({"company_id": cid}, {"_id": 0}).sort("entry_date", 1):
        print(f"\n  {e.get('entry_number_str') or e.get('entry_number')}  {str(e.get('entry_date', ''))[:10]}  "
              f"[{e.get('status')}]  {e.get('source_document_type', '')}  {(e.get('description') or '')[:70]}")
        for ln in e.get("lines") or []:
            print(f"      {ln.get('account_code', ''):<8} {str(ln.get('account_name', ''))[:34]:<34} "
                  f"مدين {m(float(ln.get('debit') or 0)):>14}  دائن {m(float(ln.get('credit') or 0)):>14}")


if __name__ == "__main__":
    asyncio.run(main())
