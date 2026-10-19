"""
حذف أسئلة المقابلات المكررة (نفس النص في نفس الشركة).

    docker exec datalife_backend python scripts/dedupe_interview_questions.py
    docker exec datalife_backend python scripts/dedupe_interview_questions.py --apply

Saving AI suggestions used to fail after the questions were already written,
so each retry saved another copy. This keeps the oldest copy of each question
and retires the rest (is_active=false — nothing is erased). Dry run by default.
"""
import asyncio
import os
import sys

from motor.motor_asyncio import AsyncIOMotorClient


async def main():
    apply = "--apply" in sys.argv
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    seen, extra = {}, []
    async for q in db.interview_questions.find({"is_active": True}, {"_id": 0}).sort("created_at", 1):
        key = (q.get("company_id"), " ".join((q.get("question") or "").split()))
        if key in seen:
            extra.append(q["id"])
        else:
            seen[key] = q["id"]
    print(f"أسئلة فريدة: {len(seen)} — نسخ مكررة: {len(extra)}")
    if extra and apply:
        res = await db.interview_questions.update_many({"id": {"$in": extra}}, {"$set": {"is_active": False}})
        print(f"تم إخفاء {res.modified_count} نسخة مكررة")
    elif extra:
        print("DRY RUN — أضف --apply للتنفيذ")


asyncio.run(main())
