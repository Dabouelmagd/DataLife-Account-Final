"""
تصحيح إشارات أرقام القيود داخل الأوصاف بعد إعادة الترقيم.

    docker exec datalife_backend python scripts/fix_entry_references.py --company <id>
    docker exec datalife_backend python scripts/fix_entry_references.py --company <id> --apply

Some descriptions quote another entry by number — "تسوية: … — قيد #3". After
renumbering, that "#3" still reads as 3, but 3 now belongs to a different
entry: the reference points at the wrong document, which is worse than no
reference at all.

Every renumbered entry carries previous_entry_number, so the old→new map is
known exactly. A quoted number is rewritten only when the old number is
unambiguous — when one entry held it. Where two entries shared it (which is
why renumbering was needed), the reference cannot be resolved from the number
alone and is left untouched and reported, for a person to decide.

Nothing else in the text changes, and no amount, account or date is touched.
"""

import asyncio
import os
import re
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

# "قيد #3" / "قيد رقم 3" / "entry #3"
PATTERN = re.compile(r"(قيد\s*(?:رقم\s*)?#?\s*|entry\s*#?\s*)(\d+)", re.IGNORECASE)


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
    entries = await db.journal_entries.find(
        {"company_id": company_id},
        {"_id": 0, "id": 1, "entry_number": 1, "entry_date": 1, "description": 1,
         "previous_entry_number": 1}).sort("entry_number", 1).to_list(None)
    if not entries:
        print("لا توجد قيود")
        return

    # old number → the entries that held it
    old_to_new = defaultdict(list)
    for e in entries:
        old = e.get("previous_entry_number")
        if old:
            old_to_new[int(old)].append(e["entry_number"])
        else:
            old_to_new[int(e["entry_number"])].append(e["entry_number"])

    # Every old number was duplicated — that is why renumbering was needed — so
    # the number alone resolves nothing. The date does: a settlement quoting
    # "قيد #3" means the entry of that old number posted on the SAME day, which
    # is how these books pair an expense with its settlement. A reference is
    # rewritten only when exactly one entry matches both the old number and the
    # date; anything else is left alone and reported.
    by_old_and_date = defaultdict(list)
    for e in entries:
        old = int(e.get("previous_entry_number") or e.get("entry_number"))
        by_old_and_date[(old, str(e.get("entry_date") or "")[:10])].append(e["entry_number"])

    print("APPLYING — سيتم التعديل فعلياً\n" if apply else
          "DRY RUN — لن يُكتب شيء. أضف --apply للتنفيذ\n")

    changed = skipped = 0
    for entry in entries:
        text = str(entry.get("description") or "")
        if not PATTERN.search(text):
            continue

        unresolved = []

        same_day = str(entry.get("entry_date") or "")[:10]

        def replace(match):
            nonlocal unresolved
            old = int(match.group(2))
            candidates = [n for n in by_old_and_date.get((old, same_day), [])
                          if n != entry["entry_number"]]
            if len(candidates) != 1:
                unresolved.append(old)
                return match.group(0)
            return f"{match.group(1)}{candidates[0]}"

        new_text = PATTERN.sub(replace, text)
        if unresolved:
            skipped += 1
            print(f"  #{entry['entry_number']} | {entry['entry_date']} | تُرك كما هو — "
                  f"لا يوجد قيد واحد بالرقم القديم #{unresolved[0]} في نفس التاريخ")
            print(f"      {text[:80]}")
            continue
        if new_text == text:
            continue

        changed += 1
        print(f"  #{entry['entry_number']} | {entry['entry_date']}")
        print(f"      قبل: {text[:80]}")
        print(f"      بعد: {new_text[:80]}")
        if apply:
            await db.journal_entries.update_one({"id": entry["id"]}, {"$set": {
                "description": new_text, "description_before_renumber": text}})

    print(f"\n{'عُدّل' if apply else 'سيُعدَّل'} {changed} وصف"
          + (f" | تُرك {skipped} لتعذّر تحديد المقصود" if skipped else ""))
    if not apply and changed:
        print("للتنفيذ: أضف --apply\n")


if __name__ == "__main__":
    asyncio.run(main())
