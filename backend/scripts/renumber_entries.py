"""
إعادة ترقيم قيود اليومية المكررة أرقامها.

    docker exec datalife_backend python scripts/renumber_entries.py --company <id>
    docker exec datalife_backend python scripts/renumber_entries.py --company <id> --apply

Older entries were numbered before the atomic counter existed, so several
carry the same number — #1 appears twice, #2 twice, and so on. The entries
themselves are different and every one is real; only the numbers collide.

Nothing is deleted and no amount is touched: each entry keeps its lines, its
date, its accounts and its balances exactly as they are. Only the number
changes, and the old one is recorded on the entry (previous_entry_number) so
an auditor can follow any reference made to it before today.

Order is by date, then by the original number, then by creation time — so the
new sequence follows the books' own chronology rather than inventing one.

The company's counter is moved past the highest number afterwards, so the next
entry cannot collide with a renumbered one.
"""

import asyncio
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


def arg(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        if len(sys.argv) > i + 1:
            return sys.argv[i + 1]
    return default


async def main():
    apply = "--apply" in sys.argv
    company_id = arg("--company")
    if not company_id:
        print("حدد الشركة: --company <company_id>")
        return

    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    company = await db.companies.find_one({"id": company_id}, {"_id": 0, "name": 1})
    if not company:
        print("الشركة غير موجودة")
        return

    entries = await db.journal_entries.find(
        {"company_id": company_id}, {"_id": 0, "id": 1, "entry_number": 1, "entry_date": 1,
                                     "description": 1, "created_at": 1, "status": 1,
                                     "previous_entry_number": 1}).to_list(None)
    if not entries:
        print("لا توجد قيود")
        return

    counts = Counter(e.get("entry_number") for e in entries)
    duplicated = {n for n, c in counts.items() if c > 1}
    print(f"\nالشركة: {company.get('name')}")
    print(f"عدد القيود: {len(entries)} | أرقام مكررة: {len(duplicated)}"
          + (f" ({', '.join('#' + str(n) for n in sorted(duplicated))})" if duplicated else ""))

    already = [e for e in entries if e.get("previous_entry_number")]
    if already:
        print(f"تنبيه: {len(already)} قيداً أُعيد ترقيمه من قبل — لن يُعاد ترقيمه مرة أخرى بلا داعٍ")

    if not duplicated:
        print("لا يوجد تكرار — لا حاجة لإعادة الترقيم\n")
        return

    # chronology first, then the original number, then creation time
    ordered = sorted(entries, key=lambda e: (str(e.get("entry_date") or ""),
                                             int(e.get("entry_number") or 0),
                                             str(e.get("created_at") or "")))

    print("\nالترقيم المقترح:\n")
    changes = []
    for new_number, entry in enumerate(ordered, 1):
        old = entry.get("entry_number")
        mark = "→" if old != new_number else " "
        print(f"  #{str(old):<4} {mark} #{new_number:<4} | {entry.get('entry_date')} | "
              f"{str(entry.get('description') or '')[:52]}")
        if old != new_number:
            changes.append((entry["id"], old, new_number))

    print(f"\n{'سيتغيّر' if not apply else 'تغيّر'} رقم {len(changes)} قيد من {len(entries)}")
    print("لا يُحذف أي قيد، ولا يتغيّر أي مبلغ أو حساب — الرقم فقط.")

    if not apply:
        print("\nللتنفيذ: أضف --apply\n")
        return

    for entry_id, old, new_number in changes:
        await db.journal_entries.update_one({"id": entry_id}, {"$set": {
            "entry_number": new_number,
            "previous_entry_number": old,
            "renumbered_at": __import__("datetime").datetime.now(
                __import__("datetime").timezone.utc).isoformat()}})

    highest = len(ordered)
    # the counter is keyed by company_id, not _id — writing the wrong key would
    # leave the live counter untouched and the next entry would collide again
    await db.journal_counters.update_one(
        {"company_id": company_id}, {"$set": {"last_number": highest}}, upsert=True)
    print(f"\nتم. عدّاد الشركة ضُبط على {highest} فلن يتكرر رقم جديد.\n")


if __name__ == "__main__":
    asyncio.run(main())
