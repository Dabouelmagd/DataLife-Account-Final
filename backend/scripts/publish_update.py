"""
ينشر «تحديث نظام» يظهر لكل الشركات في صفحة «تحديثات النظام» وكشريط داخل البرنامج.

    python scripts/publish_update.py                    # يعرض ما سيُنشر فقط
    python scripts/publish_update.py --apply            # ينشر (بدون بريد)
    python scripts/publish_update.py --apply --email    # ينشر ويرسل بريداً لكل الشركات النشطة

The notes below are the release being published; edit RELEASE for the next one.
Publishing the same version twice is refused.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

RELEASE = {
    "version": "2026.10.21",
    "title_ar": "الحضور بالموقع، تقييم الأداء، كشف المرتبات، والقطاع الطبي",
    "title_en": "GPS attendance, performance reviews, payroll sheet, medical sector",
    "description_ar": "مجموعة تحديثات للموارد البشرية والرواتب والحسابات. لا يمس التحديث أي بيانات.",
    "description_en": "HR, payroll and accounting updates. Your data is not affected.",
    "features": [
        "الحضور بالبصمة والموقع (GPS) واليدوي معاً — اختر الطرق المستخدمة من «طرق الحضور وموقع العمل»، وزر «حضور بالموقع» داخل نطاق 40 متراً",
        "حسابات دخول للموظفين بضغطة واحدة — كل موظف يرى صفحته فقط: راتبه وإجازاته وحضوره وتقييماته",
        "تقييم الأداء بمقاييس جاهزة لكل إدارة (7 مجموعات) قابلة للتعديل، ويظهر التقييم في صفحة الموظف وفي «تقييماتي» ببوابة الموظف",
        "كشف المرتبات التفصيلي: كل بدل وكل خصم في عمود، مع فلتر بالإدارة والفرع وتصدير Excel",
        "ربط مستخدمي البرنامج بملفات الموظفين من صفحة الموظفين",
        "دليل استخدام المقابلات والاختبار النفسي واختبار القدرات داخل صفحة التوظيف",
        "شاشة القطاع الطبي: تقسيم الخدمة بين المنشأة والأطباء، سداد الأتعاب، وتحصيل أو رفض مطالبات التأمين",
        "إيراد نقاط البيع في حساب واحد (4121)، وتصحيح قيد مبيعات المحافظ الإلكترونية",
        "المخزون: الجرد والتحويل وتكاليف الاستيراد بقيود محاسبية من شاشة المخزون نفسها",
    ],
    "is_critical": False,
}


async def main():
    apply, email = "--apply" in sys.argv, "--email" in sys.argv
    from database import db
    print(f"الإصدار {RELEASE['version']}: {RELEASE['title_ar']}")
    for f in RELEASE["features"]:
        print("  ✓", f)
    if await db.app_updates.find_one({"version": RELEASE["version"]}, {"_id": 1}):
        print("\nهذا الإصدار منشور بالفعل — غيّر version لنشر تحديث جديد")
        return
    if not apply:
        print("\nلم يُنشر شيء — أضف --apply للنشر" + ("" if email else " (و --email لإرسال بريد للشركات)"))
        return
    update = {**RELEASE, "id": str(uuid.uuid4()), "send_email": email, "is_active": True,
              "created_at": datetime.now(timezone.utc).isoformat(), "created_by": "DataLife",
              "seen_by": [], "updated_by": [], "emails_sent": 0}
    await db.app_updates.insert_one(dict(update))
    sent = 0
    if email:
        from api.app_updates import _send_update_emails
        sent = await _send_update_emails(update)
        await db.app_updates.update_one({"id": update["id"]}, {"$set": {"emails_sent": sent}})
    print(f"\nتم النشر{f' — أُرسل {sent} بريد' if email else ' (بدون بريد)'}")


asyncio.run(main())
