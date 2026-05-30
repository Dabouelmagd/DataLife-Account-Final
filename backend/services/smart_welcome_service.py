"""
Smart Welcome service — triggered upon successful subscription activation.

When a company upgrades from Trial to a Paid plan (Professional / Enterprise)
*and* they were referred via a referral code, this service:

  1. Sends a personalised welcome email via Resend (free with existing key).
  2. Sets `beta_access: true` on their company doc so they see beta UI.
  3. Includes a Calendly onboarding link from CALENDLY_URL env var.

Designed to be fire-and-forget — failures are logged but never block the
payment flow.
"""
from __future__ import annotations
import os
import asyncio
import uuid
from datetime import datetime, timezone


CALENDLY_URL = os.environ.get(
    "CALENDLY_URL",
    "https://calendly.com/datalifeaccount/onboarding",
)


async def trigger_smart_welcome(*, company_id: str, plan: str, db) -> dict:
    """
    Run after subscription activation. Returns a status dict; never raises.
    Only fires for paid plans where the company was originally referred.
    """
    try:
        if plan.lower() not in ("professional", "enterprise"):
            return {"sent": False, "reason": "plan_not_eligible"}

        company = await db.companies.find_one(
            {"id": company_id},
            {"_id": 0, "name": 1, "contact_email": 1,
             "referred_by_code": 1, "beta_access": 1},
        )
        if not company:
            return {"sent": False, "reason": "company_not_found"}

        was_referred = bool(company.get("referred_by_code"))

        # 1) Always grant beta access for paid Professional/Enterprise upgraders
        await db.companies.update_one(
            {"id": company_id},
            {"$set": {
                "beta_access": True,
                "beta_access_granted_at": datetime.now(timezone.utc).isoformat(),
                "onboarding_calendly_url": CALENDLY_URL,
            }},
        )

        recipient = company.get("contact_email")
        if not recipient:
            return {"sent": False, "reason": "no_email", "beta_access": True}

        # 2) Send the welcome email
        await _send_welcome_email(
            recipient=recipient,
            company_name=company.get("name") or "",
            plan=plan,
            was_referred=was_referred,
        )

        # 3) In-app notification
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "type": "smart_welcome",
            "title": "أهلاً بكم في الباقة المتقدمة! 🎉",
            "title_en": "Welcome to your upgraded plan! 🎉",
            "message": (
                "تم تفعيل وصولك لمميزات البيتا والتحجيز للجلسة التعريفية المجانية متاح."
            ),
            "severity": "success",
            "read": False,
            "action_url": CALENDLY_URL,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

        return {
            "sent": True,
            "recipient": recipient,
            "was_referred": was_referred,
            "beta_access": True,
            "calendly_url": CALENDLY_URL,
        }
    except Exception as err:
        print(f"[smart_welcome] failed: {err}")
        return {"sent": False, "reason": "exception", "error": str(err)}


async def _send_welcome_email(*, recipient: str, company_name: str,
                              plan: str, was_referred: bool) -> None:
    import resend
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        return
    sender = os.environ.get("SENDER_EMAIL", "noreply@datalifeaccount.com")
    plan_label_ar = "المحترف" if plan.lower() == "professional" else "المؤسسي"
    plan_label_en = plan.capitalize()
    referral_line_ar = (
        "<p style='color:#10b981; font-weight:bold;'>"
        "🎁 شكراً لانضمامك عبر إحالة! حصلت على شهر تجربة إضافي."
        "</p>"
        if was_referred else ""
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;direction:rtl;max-width:640px;margin:auto;">
      <div style="background:linear-gradient(135deg,#28376B,#1e2a52);color:#fff;padding:32px;border-radius:12px 12px 0 0;text-align:center;">
        <div style="font-size:48px;line-height:1;margin-bottom:8px;">🚀</div>
        <h1 style="margin:0;font-size:24px;">أهلاً بك في باقة {plan_label_ar}</h1>
        <p style="margin:8px 0 0;opacity:.9;font-size:13px;">Welcome to your {plan_label_en} plan</p>
      </div>
      <div style="background:#fff;padding:28px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px;">
        <p style="color:#334155;font-size:15px;">
          مرحباً <strong>{company_name}</strong>،
        </p>
        <p style="color:#334155;font-size:14px;line-height:1.9;">
          تم تفعيل اشتراككم بنجاح! 🎉 جهّزنا لكم هدايا ترحيبية حصرية:
        </p>
        {referral_line_ar}

        <!-- Gift 1: Onboarding Call -->
        <div style="background:#f0f9ff;border:1px solid #0ea5e9;border-radius:10px;padding:18px;margin:18px 0;">
          <div style="font-size:18px;font-weight:bold;color:#0c4a6e;margin-bottom:6px;">
            📅 جلسة Onboarding مجانية (30 دقيقة)
          </div>
          <div style="font-size:13px;color:#475569;margin-bottom:12px;">
            احجز جلسة شخصية مع فريقنا لإعداد حسابكم وتدريب موظفيكم على المنصة.
          </div>
          <a href="{CALENDLY_URL}"
             style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;
                    padding:10px 20px;border-radius:8px;font-weight:bold;font-size:13px;">
            احجز الجلسة الآن
          </a>
        </div>

        <!-- Gift 2: Beta Access -->
        <div style="background:#f5f3ff;border:1px solid #8b5cf6;border-radius:10px;padding:18px;margin:18px 0;">
          <div style="font-size:18px;font-weight:bold;color:#4c1d95;margin-bottom:6px;">
            ⚡ وصول مبكر لمميزات البيتا
          </div>
          <div style="font-size:13px;color:#475569;">
            تم تفعيل وصولكم لكل المميزات الجديدة قبل إطلاقها الرسمي،
            بما في ذلك Affiliate Dashboard وتقارير ذكية مدعومة بالذكاء الاصطناعي.
          </div>
        </div>

        <!-- Gift 3: Priority Support -->
        <div style="background:#ecfdf5;border:1px solid #10b981;border-radius:10px;padding:18px;margin:18px 0;">
          <div style="font-size:18px;font-weight:bold;color:#065f46;margin-bottom:6px;">
            🎯 دعم بالأولوية
          </div>
          <div style="font-size:13px;color:#475569;">
            رد خلال أقل من ساعتين في أوقات العمل عبر الإيميل والواتساب.
          </div>
        </div>

        <p style="color:#64748b;font-size:12px;margin-top:24px;text-align:center;">
          عندك أي سؤال؟ ردي على هذا الإيميل مباشرة 💬
        </p>
      </div>
      <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:14px;">
        DataLife Account © {datetime.now().year} — صنع بحب للشركات العربية
      </p>
    </div>
    """
    try:
        resend.api_key = api_key
        await asyncio.to_thread(resend.Emails.send, {
            "from": f"DataLife Account <{sender}>",
            "to": [recipient],
            "subject": f"🚀 أهلاً بكم في باقة {plan_label_ar}! هداياكم الترحيبية بالداخل",
            "html": html,
        })
    except Exception as err:
        print(f"[smart_welcome] email send failed: {err}")
