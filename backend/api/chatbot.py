"""
Support chatbot — the floating chat bubble shown on every page.

Previously a stub: /chat returned "coming soon" and the four routes the
widget calls did not exist, so every message failed.

There is no AI model wired in, so this does not pretend to be one. It
answers common questions from a small knowledge base, and anything it
can't answer is routed to a human: requests land in db.support_tickets
and are emailed to the support inbox.

The widget is public (it runs on the landing page, before login), so
these routes are unauthenticated. Inputs are length-capped and sessions
are bounded to keep that safe.
"""

import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])

client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
db = client[os.environ.get("DB_NAME", "multi_tenant_erp")]

SUPPORT_EMAIL = os.environ.get("ADMIN_ALERT_EMAIL", "dalia@datalifeai.com")
MAX_MESSAGE = 2000
MAX_HISTORY = 60


# ── Knowledge base ─────────────────────────────────────────
# (keywords, arabic answer, english answer)
KB = [
    # order matters: specific intents before the generic pricing entry
    (("كود", "تفعيل", "code", "activate", "activation"),
     "لتفعيل كود: افتح صفحة الأسعار، أدخل الكود في خانة «كود التفعيل» واضغط تفعيل. مدة الاشتراك محددة داخل الكود نفسه.",
     "To redeem a code, open Pricing, enter it in the activation code field and press activate. The subscription length is set by the code."),
    (("دفع", "انستاباي", "instapay", "فودافون", "vodafone", "pay", "payment"),
     "يمكنك الدفع عبر InstaPay أو فودافون كاش ثم إرسال رقم العملية من صفحة الاشتراك، ويُفعَّل حسابك بعد تأكيد الدفع. أو استخدم كود تفعيل إن كان لديك.",
     "Pay via InstaPay or Vodafone Cash and submit the reference number from the subscription page; your account is activated once payment is confirmed. You can also use an activation code."),
    (("ضريب", "فاتورة", "eta", "invoice", "tax"),
     "النظام مطابق لمنظومة الفاتورة الإلكترونية لمصلحة الضرائب المصرية (ETA). يمكنك ربط حسابك من إعدادات الفواتير.",
     "The system is compliant with the Egyptian Tax Authority e-invoicing (ETA). Connect your account from invoice settings."),
    (("راتب", "رواتب", "مرتب", "payroll", "salary"),
     "نظام الرواتب يحسب ضريبة الدخل والتأمينات وفق القانون ١٤٨/٢٠١٩، ويدير المسيرات والسلف ونهاية الخدمة. تجده في الموارد البشرية ← الرواتب.",
     "Payroll computes income tax and social insurance per Law 148/2019 and manages runs, loans and end of service. Find it under HR → Payroll."),
    (("كلمة المرور", "باسورد", "password", "دخول", "login"),
     "لاستعادة كلمة المرور اضغط «نسيت كلمة المرور؟» في صفحة الدخول. وإن استمرت المشكلة اطلب التحدث مع الدعم.",
     "To reset your password, press 'Forgot password?' on the login page. If it persists, ask to talk to support."),
    (("سعر", "اسعار", "أسعار", "باقة", "باقات", "اشتراك", "price", "pricing", "plan", "cost"),
     "لدينا ثلاث باقات: أساسي واحترافي ومؤسسي، باشتراك شهري أو سنوي. تجد التفاصيل في قسم «الأسعار» بالصفحة الرئيسية.",
     "We offer Basic, Professional and Enterprise plans, monthly or yearly. See the Pricing section on the home page."),
]

FALLBACK_AR = ("لم أجد إجابة دقيقة لسؤالك. اضغط «التحدث مع الدعم» وسيتواصل معك فريقنا عبر البريد الإلكتروني.")
FALLBACK_EN = ("I don't have a precise answer to that. Press 'Talk to support' and our team will reach you by email.")


def _answer(message: str, language: str) -> str:
    text = message.lower()
    for keywords, ar, en in KB:
        if any(k in text for k in keywords):
            return ar if language == "ar" else en
    return FALLBACK_AR if language == "ar" else FALLBACK_EN


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _send_email(to: str, subject: str, html: str) -> bool:
    try:
        from api.email_notifications import send_email_async
        result = await send_email_async(to, subject, html)
        return bool(result and result.get("status") == "success")
    except Exception as e:
        logger.error(f"chatbot email failed: {e}")
        return False


# ── Schemas ────────────────────────────────────────────────

class SendIn(BaseModel):
    session_id: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=MAX_MESSAGE)
    language: str = "ar"


class TranscriptIn(BaseModel):
    session_id: Optional[str] = None
    email: str = Field(..., max_length=254)
    language: str = "ar"


class HumanSupportIn(BaseModel):
    session_id: Optional[str] = None
    user_name: str = Field(..., min_length=1, max_length=120)
    user_email: str = Field(..., max_length=254)
    issue_summary: str = Field("General inquiry", max_length=MAX_MESSAGE)
    language: str = "ar"


# ── Routes ─────────────────────────────────────────────────

@router.post("/send")
async def send_message(data: SendIn):
    session_id = data.session_id or str(uuid.uuid4())
    reply = _answer(data.message, data.language)
    ts = _now()

    await db.chatbot_sessions.update_one(
        {"session_id": session_id},
        {
            "$setOnInsert": {"session_id": session_id, "created_at": ts},
            "$set": {"updated_at": ts, "language": data.language},
            "$push": {"messages": {
                "$each": [
                    {"role": "user", "content": data.message, "timestamp": ts},
                    {"role": "assistant", "content": reply, "timestamp": ts},
                ],
                "$slice": -MAX_HISTORY,
            }},
        },
        upsert=True,
    )
    return {"session_id": session_id, "message": reply, "timestamp": ts}


# kept so older callers of /chat don't break
@router.post("/chat")
async def chat(data: SendIn):
    return await send_message(data)


@router.delete("/session/{session_id}")
async def clear_session(session_id: str):
    await db.chatbot_sessions.delete_one({"session_id": session_id})
    return {"message": "Session cleared"}


@router.post("/email-transcript")
async def email_transcript(data: TranscriptIn):
    if "@" not in data.email:
        raise HTTPException(status_code=400, detail="Invalid email")

    session = await db.chatbot_sessions.find_one({"session_id": data.session_id}, {"_id": 0}) \
        if data.session_id else None
    messages = (session or {}).get("messages", [])
    if not messages:
        raise HTTPException(status_code=404, detail="No conversation to send")

    ar = data.language == "ar"
    rows = "".join(
        f'<p style="margin:6px 0"><b>{"أنت" if m["role"]=="user" else "الدعم"}:</b> {m["content"]}</p>'
        if ar else
        f'<p style="margin:6px 0"><b>{"You" if m["role"]=="user" else "Support"}:</b> {m["content"]}</p>'
        for m in messages
    )
    html = f'<div dir="{"rtl" if ar else "ltr"}" style="font-family:sans-serif">{rows}</div>'
    sent = await _send_email(
        data.email,
        "نسخة من محادثتك مع دعم داتا لايف" if ar else "Your DataLife support transcript",
        html,
    )
    if not sent:
        raise HTTPException(status_code=502, detail="Email could not be sent")
    return {"message": "Transcript sent"}


@router.post("/request-human-support")
async def request_human_support(data: HumanSupportIn):
    if "@" not in data.user_email:
        raise HTTPException(status_code=400, detail="Invalid email")

    ar = data.language == "ar"
    session = await db.chatbot_sessions.find_one({"session_id": data.session_id}, {"_id": 0}) \
        if data.session_id and data.session_id != "no-session" else None

    ticket = {
        "id": str(uuid.uuid4()),
        "source": "chatbot",
        "user_name": data.user_name,
        "user_email": data.user_email,
        "issue_summary": data.issue_summary,
        "language": data.language,
        "session_id": data.session_id,
        "conversation": (session or {}).get("messages", []),
        "status": "open",
        "created_at": _now(),
    }
    await db.support_tickets.insert_one(dict(ticket))

    await _send_email(
        SUPPORT_EMAIL,
        f"طلب دعم جديد — {data.user_name}",
        f'<div dir="rtl" style="font-family:sans-serif">'
        f'<p><b>الاسم:</b> {data.user_name}</p>'
        f'<p><b>البريد:</b> {data.user_email}</p>'
        f'<p><b>المشكلة:</b> {data.issue_summary}</p>'
        f'<p style="color:#888">رقم الطلب: {ticket["id"]}</p></div>',
    )

    return {
        "message": (f"شكراً {data.user_name}، تم استلام طلبك وسيتواصل معك فريق الدعم على {data.user_email} قريباً."
                    if ar else
                    f"Thanks {data.user_name}, your request was received. Support will reach you at {data.user_email} soon."),
        "ticket_id": ticket["id"],
    }
