"""
مراجعة وإصلاح دفتر الأستاذ — البنوك والقيود "المرحّلة" التي لم تدخل الدفتر.

    docker exec datalife_backend python scripts/repair_ledger.py                 # تقرير فقط
    docker exec datalife_backend python scripts/repair_ledger.py --apply         # إصلاح
    docker exec datalife_backend python scripts/repair_ledger.py --company <id>  # شركة واحدة

What it finds, per company:

  1. entries marked "posted" with no rows in the general ledger. Bank movements
     and project income/expenses were created already "posted" and then the
     posting step refused them — so the trial balance, balance sheet and
     dashboard never saw them.                       --apply: writes their rows.
  2. bank accounts whose opening balance was stored on the bank record only.
                                                     --apply: posts Dr bank / Cr 213.
  3. bank movements with no journal entry (listed — the counter account is
     your decision), and bank entries left as drafts.  --apply: posts the drafts.
  4. chart balances (current_balance) that drifted from the ledger.
                                                     --apply: recomputes them.

Then it prints, for each bank, the balance on the bank page next to the
balance in the ledger, and the dashboard figures next to the trial balance.
Every fix is an ordinary posted entry or ledger row — nothing is deleted.
"""
import argparse
import asyncio
import os
import sys
import uuid
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db  # noqa: E402

DEBIT_TYPES = {"asset", "expense", "contra_liability", "contra_equity"}


def _kind(t) -> str:
    """account type as its plain value, whether stored as text or as the enum."""
    return str(getattr(t, "value", t) or "").lower()
IN_TYPES = ("deposit", "check_deposit", "transfer_in")
OUT_TYPES = ("withdrawal", "check_issued", "transfer_out")


def m(x):
    return f"{x:,.2f}"


async def ledger_balances(cid):
    accounts = await db.chart_of_accounts.find({"company_id": cid}, {"_id": 0}).to_list(None)
    mv = {r["_id"]: r async for r in db.general_ledger.aggregate([
        {"$match": {"company_id": cid}},
        {"$group": {"_id": "$account_id", "d": {"$sum": "$debit"}, "c": {"$sum": "$credit"}}}])}
    out = {}
    for a in accounts:
        r = mv.get(a.get("id"), {"d": 0, "c": 0})
        op = float(a.get("opening_balance") or 0)
        debit = _kind(a.get("account_type")) in DEBIT_TYPES
        bal = op + (r["d"] - r["c"] if debit else r["c"] - r["d"])
        out[a["id"]] = (a, round(bal, 2))
    return out


async def company(cid, name, apply):
    print(f"\n════ {name}  ({cid})")
    by_code = {a["account_code"]: a async for a in db.chart_of_accounts.find({"company_id": cid}, {"_id": 0})}
    fixes = 0

    # 1 ── posted entries that never reached the ledger
    posted = await db.journal_entries.find(
        {"company_id": cid, "status": {"$in": ["posted", "POSTED"]}}, {"_id": 0}).to_list(None)
    gl_ids = set(await db.general_ledger.distinct("journal_entry_id", {"company_id": cid}))
    phantom = [e for e in posted if e["id"] not in gl_ids and e.get("lines")]
    no_lines = [e for e in posted if e["id"] not in gl_ids and not e.get("lines")]
    if no_lines:
        print(f"  ⚠ {len(no_lines)} قيد مرحّل بلا سطور ولا دفتر — يحتاج مراجعة يدوية")
    print(f"\n  قيود مرحّلة: {len(posted)} — منها {len(phantom)} لم تدخل دفتر الأستاذ")
    for e in phantom[:15]:
        print(f"    • {e.get('entry_number_str') or e.get('entry_number')}  {e.get('entry_date', '')[:10]}  "
              f"{m(float(e.get('total_debit') or 0))}  {(e.get('description') or '')[:60]}")
    if len(phantom) > 15:
        print(f"    … و{len(phantom) - 15} غيرها")
    if apply and phantom:
        for e in phantom:
            rows = []
            for ln in e["lines"]:
                acc_id = ln.get("account_id") or (by_code.get(str(ln.get("account_code"))) or {}).get("id")
                if not acc_id:
                    rows = None
                    print(f"    ✗ {e.get('entry_number_str')}: حساب {ln.get('account_code')} غير موجود — تُرك")
                    break
                rows.append({"id": str(uuid.uuid4()), "company_id": cid, "account_id": acc_id,
                             "journal_entry_id": e["id"], "entry_date": e.get("entry_date"),
                             "description": e.get("description", ""),
                             "debit": float(ln.get("debit") or 0), "credit": float(ln.get("credit") or 0),
                             "balance": 0, "created_at": datetime.utcnow(), "repaired": True})
            if rows:
                await db.general_ledger.insert_many(rows)
                await db.journal_entries.update_one({"id": e["id"]}, {"$set": {"gl_repaired_at": datetime.utcnow().isoformat()}})
                fixes += 1
        print(f"    ✓ أُدخلت في الدفتر")

    # 2 ── bank opening balances
    banks = await db.bank_accounts.find({"company_id": cid}).to_list(None)
    from api.bank_management import post_bank_opening
    for b in banks:
        op = round(float(b.get("opening_balance") or 0), 2)
        if op and not b.get("opening_entry_id"):
            print(f"\n  البنك {b.get('bank_name')} {b.get('account_number')}: رصيد افتتاحي {m(op)} غير مسجّل في الدفتر")
            if apply:
                e = await post_bank_opening(cid, "repair", str(b["_id"]), b)
                await db.bank_accounts.update_one({"_id": b["_id"]}, {"$set": {"opening_entry_id": e["id"]}})
                print(f"    ✓ قيد {e.get('entry_number_str')}")
                fixes += 1

    # 3 ── bank movements with no entry / draft entry
    txns = await db.bank_transactions.find({"company_id": cid}).to_list(None)
    bank_by_id = {str(b["_id"]): b for b in banks}
    no_entry = [t for t in txns if not t.get("journal_entry_id")]
    je_ids = [t["journal_entry_id"] for t in txns if t.get("journal_entry_id")]
    jes = {j["id"]: j async for j in db.journal_entries.find({"id": {"$in": je_ids}}, {"_id": 0})}
    drafts = [t for t in txns if t.get("journal_entry_id") and
              str(jes.get(t["journal_entry_id"], {}).get("status", "")).lower() == "draft"]
    if txns:
        print(f"\n  حركات بنكية: {len(txns)} — بدون قيد: {len(no_entry)} — قيدها مسودة لم يُرحَّل: {len(drafts)}")
    for t in no_entry[:15]:
        print(f"    • بدون قيد: {t.get('transaction_number')}  {t.get('transaction_date')}  "
              f"{t.get('transaction_type')}  {m(float(t.get('amount') or 0))}  {(t.get('description') or '')[:40]}")
    if no_entry:
        print("      (لا تُنشأ لها قيود تلقائياً — الحساب المقابل يحتاج قرارك؛ سجّلها من صفحة القيود)")
    from services.accounting_service import AccountingService
    svc = AccountingService(db)
    if apply:
        for t in drafts:
            try:
                await svc.post_journal_entry(t["journal_entry_id"], "repair")
                fixes += 1
            except Exception as ex:
                print(f"    ✗ {t.get('transaction_number')}: {ex}")

    # 4 ── chart balances vs ledger
    bals = await ledger_balances(cid)
    drift = [(a, b) for a, b in bals.values() if abs(float(a.get("current_balance") or 0) - b) > 0.01
             and not (a.get("is_header") or a.get("account_category") == "header")]
    print(f"\n  حسابات رصيدها المخزَّن يختلف عن الدفتر: {len(drift)}")
    for a, b in drift[:10]:
        print(f"    {a['account_code']:<8} {a['account_name'][:35]:<35} مخزَّن {m(float(a.get('current_balance') or 0)):>16}  الدفتر {m(b):>16}")
    if apply and drift:
        for a, b in drift:
            await db.chart_of_accounts.update_one({"id": a["id"]}, {"$set": {"current_balance": b}})
        print("    ✓ أُعيد حسابها من الدفتر")

    # report — banks: page vs ledger
    bals = await ledger_balances(cid)
    led = {a["account_code"]: b for a, b in bals.values()}
    if banks:
        print("\n  البنوك — صفحة البنوك مقابل الدفتر:")
        per_code = {}
        for b in banks:
            bid = str(b["_id"])
            dep = sum(float(t["amount"]) for t in txns if t.get("bank_account_id") == bid and t["transaction_type"] in IN_TYPES)
            wd = sum(float(t["amount"]) for t in txns if t.get("bank_account_id") == bid and t["transaction_type"] in OUT_TYPES)
            page = float(b.get("opening_balance") or 0) + dep - wd
            code = b.get("linked_account_code") or "162"
            per_code[code] = per_code.get(code, 0) + page
            print(f"    {b.get('bank_name', '')[:25]:<25} {b.get('account_number', ''):<18} حساب {code}: الصفحة {m(page)}")
        for code, page in per_code.items():
            ok = abs(page - led.get(code, 0)) < 0.01
            print(f"    ⇐ حساب {code} في الدفتر {m(led.get(code, 0))}  {'✓ مطابق' if ok else f'✗ فرق {m(page - led.get(code, 0))}'}")
            if not ok:
                print("      (الفرق = حركات سُجِّلت على هذا الحساب من خارج صفحة البنوك، أو العكس)")

    from services.executive_dashboard import build
    dash = (await build(db, cid, set(), True)).get("sections", {}).get("financial") or {}
    if dash:
        print("\n  لوحة التحكم (من الدفتر): نقدية وبنوك {}  عملاء {}  موردون {}  نتيجة الشهر {}".format(
            m(dash["cash_and_banks"]), m(dash["receivables"]), m(dash["payables"]), m(dash["month_profit"])))
    tb = await svc.get_trial_balance(cid)
    print(f"  ميزان المراجعة: مدين {m(tb['total_debit'])}  دائن {m(tb['total_credit'])}  "
          f"{'✓ متوازن' if tb['is_balanced'] else '✗ غير متوازن'}")
    drafts_all = await db.journal_entries.count_documents({"company_id": cid, "status": {"$in": ["draft", "DRAFT"]}})
    if drafts_all:
        print(f"  قيود مسودة لم تُرحَّل (لا تظهر في أي تقرير): {drafts_all}")
    return fixes


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--company")
    args = ap.parse_args()
    q = {"id": args.company} if args.company else {}
    companies = await db.companies.find(q, {"_id": 0, "id": 1, "name": 1, "company_name": 1}).to_list(None)
    print("وضع الإصلاح" if args.apply else "تقرير فقط — لن يُكتب شيء (أضف --apply للإصلاح)")
    total = 0
    for c in companies:
        has = await db.journal_entries.count_documents({"company_id": c["id"]}, limit=1) \
            or await db.bank_accounts.count_documents({"company_id": c["id"]}, limit=1)
        if has:
            total += await company(c["id"], c.get("name") or c.get("company_name") or "", args.apply)
    print(f"\nتم. إصلاحات: {total}" if args.apply else "\nتم.")


if __name__ == "__main__":
    asyncio.run(main())
