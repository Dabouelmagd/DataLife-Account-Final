"""
فواتير التجديد التلقائي — للاشتراكات اللي العميل اختار لها «تجديد تلقائي».

Card payment is not live yet, so "auto-renew" means: 7 days before the end
date a renewal invoice (a pending payment request priced by services/pricing,
with the same plan, period and sector packs) is raised once and the company's
management is notified in the app; they pay it the usual way and the platform
admin approves it like any other payment. When the bank link is ready the same
request can be charged instead of waiting for a transfer.
"""
from datetime import datetime, timedelta, timezone
import secrets

RENEW_DAYS_BEFORE = 7
MANAGERS = ["رئيس مجلس الإدارة", "Board Chairman", "مدير عام", "General Manager", "CEO",
            "المدير التنفيذي", "المدير المالي", "CFO"]


def _dt(v):
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except Exception:
        return None


async def raise_renewal_invoices(db, now: datetime = None) -> dict:
    from services.pricing import quote
    from services.notify import notify
    now = now or datetime.now(timezone.utc)
    horizon = now + timedelta(days=RENEW_DAYS_BEFORE)
    made, skipped = 0, 0
    async for sub in db.subscriptions.find({"status": "active", "auto_renew": True}, {"_id": 0}):
        ends = _dt(sub.get("end_date"))
        if not ends or not (now - timedelta(days=1) <= ends <= horizon):
            continue
        if await db.payment_requests.find_one({"renewal_of": sub["id"]}, {"_id": 0, "id": 1}):
            continue
        try:
            q = quote(sub.get("plan"), sub.get("duration") or "monthly", sub.get("renewal_packs") or [],
                      True, start=ends)
        except Exception:
            skipped += 1
            continue
        company = await db.companies.find_one({"id": sub["company_id"]}, {"_id": 0, "name": 1}) or {}
        req = {"id": f"preq_{secrets.token_hex(8)}", "company_id": sub["company_id"],
               "company_name": company.get("name", ""), "kind": "renewal", "renewal_of": sub["id"],
               "package_id": f"{q['plan']}_{q['duration']}", "plan": q["plan"], "duration": q["duration"],
               "packs": q["packs"], "auto_renew": True, "quote": q, "amount_egp": q["total"],
               "payment_method": "", "reference_number": "", "receipt_url": "",
               "notes": "فاتورة تجديد تلقائي", "status": "awaiting_payment",
               "due_date": ends.date().isoformat(), "created_at": now.isoformat()}
        await db.payment_requests.insert_one(dict(req))
        await notify(db, sub["company_id"], roles=MANAGERS, kind="subscription",
                     title="فاتورة تجديد الاشتراك جاهزة",
                     body=f"اشتراكك بيتجدد يوم {ends.date().isoformat()} — المطلوب {q['total']:,.2f} ج.م (شامل الضريبة). "
                          "ادفع بإنستاباي أو فودافون كاش أو تحويل بنكي وارفع الإيصال من صفحة الاشتراك.",
                     link="/subscription", data={"payment_request_id": req["id"]})
        made += 1
    return {"renewal_invoices": made, "skipped": skipped}
