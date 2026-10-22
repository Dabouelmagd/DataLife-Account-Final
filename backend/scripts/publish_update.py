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
    "version": "2026.10.22.2",
    "title_ar": "باقات أوضح، «رواتب الشهر»، وحسابات المجالات بقت بتتقيد لوحدها",
    "title_en": "Clearer plans, «Monthly payroll», and sector accounts now post automatically",
    "description_ar": "تحديثات في الباقات والرواتب وبوابة الموظف والمجالات المتخصصة. لا يمس التحديث أي بيانات.",
    "description_en": "Plan, payroll, employee portal and sector-pack updates. Your data is not affected.",
    "features": [
        "كل باقة (المبتدئ، المحترف، المؤسسي) بقت فيها أدوات مختلفة وموضّحة في صفحة الأسعار — اشتراكك الحالي فيه كل الأدوات زي ما هو لحد ما يخلص",
        "الباقات المتخصصة بتفتح أدواتها على أي باقة أساسية: التجزئة والمطاعم بتفتح نقاط البيع، والمقاولات والمكاتب المهنية والإعلان بتفتح المشاريع، وهكذا",
        "«مسير الرواتب» بقى اسمه «رواتب الشهر»",
        "بوابة الموظف: المرتب بيظهر مخفي، والموظف عنده زرار «إظهار / إخفاء المرتب» — وإدارة الموارد البشرية لسه تقدر تقفل المرتب خالص من الإعدادات",
        "حسابات المجالات المتخصصة بقت بتتقيد تلقائياً: عجز وزيادة جرد الفروع وعمولات شبكات الدفع، تكلفة الأغذية والهالك في المطاعم، إيرادات التصدير، إيرادات التعليم والنقل والأتعاب المهنية، ومستخلصات مقاولي الباطن",
        "المطاعم: البيع عن طريق منصات التوصيل من الكاشير، وتسوية كل منصة بعد خصم عمولتها",
        "المقاولات والمكاتب المهنية والإعلان: «أعمال منجزة لم تُفوتر» في المشروع، وبتتقفل لوحدها لما تطلع الفاتورة أو المستخلص",
        "التصنيع: تسجيل الهالك من أمر الإنتاج وبيع الهوالك",
        "التطوير العقاري: إقفال المشروع وتحويل الوحدات التامة، ووديعة الصيانة عند التسليم",
        "القطاع الطبي: تختار أتعاب الأطباء تتسجل أمانة للطبيب أو مصروف على المنشأة",
        "الاستيراد: بنود جديدة للأرضيات والفحص والنقل الداخلي في الاعتمادات وتكاليف الاستيراد",
        "العُهد: بنود جديدة حسب مجالك (وقود وصيانة الأسطول، المواد التعليمية، هالك المطبخ)",
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
