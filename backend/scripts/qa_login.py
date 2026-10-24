"""
دخول شركة الاختبار — يطبع إيميل مدير «شركة اختبار داتا لايف (QA)».

    docker exec datalife_backend python scripts/qa_login.py            # الإيميل بس
    docker exec datalife_backend python scripts/qa_login.py --reset    # + باسورد جديد يظهر مرة واحدة هنا على السيرفر

The password is printed on the server terminal only — never paste it in a chat.
Touches only the QA company's own admin user.
"""
import asyncio
import os
import secrets
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
COMPANY_NAME = "شركة اختبار داتا لايف (QA)"


async def main():
    from database import db
    from services.auth_service import hash_password
    company = await db.companies.find_one({"name": COMPANY_NAME}, {"_id": 0, "id": 1})
    if not company:
        sys.exit("مفيش شركة اختبار — اعمليها بـ scripts/seed_test_company.py --email <إيميل>")
    users = await db.users.find({"company_id": company["id"], "role": "رئيس مجلس الإدارة"},
                                {"_id": 0, "id": 1, "email": 1}).to_list(5)
    if not users:
        sys.exit("شركة الاختبار مالهاش مدير")
    u = users[0]
    print(f"login      : {u['email']}")
    if "--reset" in sys.argv:
        pw = secrets.token_urlsafe(12)
        await db.users.update_one({"id": u["id"]}, {"$set": {
            "password_hash": hash_password(pw), "updated_at": datetime.now(timezone.utc).isoformat()},
            "$unset": {"password": ""}})   # login reads an old "password" field first
        print(f"password   : {pw}   (جديد — اكتبيه في صفحة الدخول، ومتبعتيهوش في أي شات)")
    else:
        print("password   : اللي ظهر وقت إنشاء الشركة — لو مش معاكي شغّلي نفس الأمر بـ --reset")


asyncio.run(main())
