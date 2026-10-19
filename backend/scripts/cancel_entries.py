"""
إلغاء عملية من الحسابات بقيود عكسية — لا يُحذف شيء.

    docker exec datalife_backend python scripts/cancel_entries.py --company <id> --find "١٠٪"
    docker exec datalife_backend python scripts/cancel_entries.py --company <id> --find "١٠٪" --apply

--find picks the project expenses whose entry description contains the text,
and with each one the "تسوية: مصروفات دفعها رئيس مجلس الإدارة — قيد #N"
entry that funded it. Without --apply it only lists them.

--apply, for each entry: posts a reversal dated the same day as the original
(so every report, for every date, reads as if the payment never happened),
marks the original "reversed", and marks the project expense cancelled so the
project's totals drop it too. The originals stay in the books for the audit
trail, each pointing to its reversal.
"""
import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import db  # noqa: E402


def m(x):
    return f"{x:,.2f}"


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--company", required=True)
    ap.add_argument("--find", required=True, help="نص في بيان القيد")
    ap.add_argument("--reason", default="إلغاء الشيكات — العملية أُلغيت")
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    cid = a.company

    posted = {"company_id": cid, "status": {"$in": ["posted", "POSTED"]}}
    main_entries = await db.journal_entries.find(
        {**posted, "description": {"$regex": a.find}}, {"_id": 0}).sort("entry_date", 1).to_list(None)
    if not main_entries:
        print("لا توجد قيود مرحّلة بهذا البيان (ربما أُلغيت من قبل).")
        return
    targets = []
    for e in main_entries:
        targets.append(e)
        n = e.get("entry_number")
        if e.get("source_document_type") == "project_expense" and n is not None:
            async for adj in db.journal_entries.find(
                    {**posted, "description": {"$regex": f"قيد #{n}$"}}, {"_id": 0}):
                if adj["id"] not in {t["id"] for t in targets}:
                    targets.append(adj)

    print("سيُلغى بقيد عكسي:" if a.apply else "تقرير فقط — أضف --apply للإلغاء. القيود:")
    total = 0.0
    for e in targets:
        amt = float(e.get("total_debit") or 0)
        total += amt if e.get("source_document_type") == "project_expense" else 0
        print(f"\n  {e.get('entry_number_str') or e.get('entry_number')}  {str(e.get('entry_date'))[:10]}  "
              f"{m(amt)}  {e.get('description', '')[:80]}")
        for ln in e.get("lines") or []:
            print(f"      {ln.get('account_code', ''):<6} {str(ln.get('account_name', ''))[:34]:<34} "
                  f"مدين {m(float(ln.get('debit') or 0)):>14}  دائن {m(float(ln.get('credit') or 0)):>14}")
    print(f"\n  إجمالي المصروف الملغى: {m(total)}")
    if not a.apply:
        return

    from services.accounting_service import AccountingService
    svc = AccountingService(db)
    projects = set()
    for e in targets:
        r = await svc.reverse_journal_entry(e["id"], "cancel-script", e.get("entry_date", "")[:10] or None)
        await db.journal_entries.update_one({"id": r["id"]}, {"$set": {
            "description": f"عكس {e.get('entry_number_str') or e.get('entry_number')} — {a.reason}"[:200]}})
        print(f"  ✓ {e.get('entry_number_str') or e.get('entry_number')} ← عكسه {r.get('entry_number_str')}")
        if e.get("source_document_type") == "project_expense" and e.get("source_document_id"):
            exp = await db.project_expenses.find_one_and_update(
                {"id": e["source_document_id"], "company_id": cid},
                {"$set": {"status": "cancelled", "cancel_reason": a.reason, "reversal_entry_id": r["id"]}})
            if exp:
                projects.add(exp["project_id"])
    if projects:
        from api.project_financials import update_project_financials
        for p in projects:
            await update_project_financials(p)
        print(f"  ✓ أُعيد حساب إجمالي المشروع ({len(projects)})")
    tb = await svc.get_trial_balance(cid)
    print(f"\nميزان المراجعة: مدين {m(tb['total_debit'])}  دائن {m(tb['total_credit'])}  "
          f"{'✓ متوازن' if tb['is_balanced'] else '✗ غير متوازن'}")


if __name__ == "__main__":
    asyncio.run(main())
