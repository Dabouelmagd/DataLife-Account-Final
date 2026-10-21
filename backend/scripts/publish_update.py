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
    "version": "2026.10.22",
    "title_ar": "أسعار أوضح، تطبيق الموظف، العمل عن بُعد، والصناديق الاختيارية",
    "title_en": "Clearer pricing, employee app, remote work, optional payroll funds",
    "description_ar": "تحديثات في الرواتب والحضور والحسابات والضرائب والاشتراك. لا يمس التحديث أي بيانات.",
    "description_en": "Payroll, attendance, accounting, tax and subscription updates. Your data is not affected.",
    "features": [
        "صفحة أسعار جديدة: تختار الباقة الأساسية، ثم المجالات المتخصصة، وتشوف الإجمالي شامل الضريبة وفاتورة مبدئية قبل الدفع، مع تجديد تلقائي اختياري",
        "الصناديق والمساهمات على الأجور (الطوارئ، الشهداء، ذوي الإعاقة، التأمين الصحي الشامل) بقت اختيارية لكل شركة بنسبها — راجعها مع محاسبك من «الرواتب ← الإعدادات»",
        "العمل عن بُعد لموظفين محددين: الباقي لازم يسجّل من نطاق موقع الشركة",
        "تطبيق الموظف على الموبايل: لينك واحد datalifeaccount.com/staff، ويتثبّت على الشاشة الرئيسية",
        "تصحيح الحضور بالموقع: المتصفح كان ممنوع من تحديد الموقع، ودلوقتي بياخد الموقع من الـ GPS أو الواي فاي ويقول سبب أي مشكلة",
        "إقفال السنة المالية وإعادة فتحها، وفروق العملة وإعادة التقييم، والتسوية البنكية",
        "نقاط البيع بتكمّل من غير إنترنت، والإيصال الإلكتروني، وربط متجر سلة",
        "الضرائب: الخصم قبل الضريبة، الخصم النقدي، ضريبة الدمغة والجدول، ونموذج 10 من الفواتير",
        "المرتجعات للمخزن أو الحجر أو الإعدام، والإشعار الدائن مربوط بالفاتورة الأصلية، وإلغاء الفاتورة يعكس قيودها والمخزون",
        "الإضافي بنسب قانون العمل، وبيانات نماذج التأمينات 1 و6",
        "تصدير كل بيانات شركتك من الإعدادات، ونسخة احتياطية يومية مشفّرة خارج السيرفر",
        "حقول الأرقام بتقبل الأرقام العربية، ومنتقي الشهر شغّال على Safari وFirefox",
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
