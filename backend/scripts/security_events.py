"""
Read the security log.

    docker exec datalife_backend python scripts/security_events.py            # last 24h
    docker exec datalife_backend python scripts/security_events.py --days 7
    docker exec datalife_backend python scripts/security_events.py --kind login_failed
    docker exec datalife_backend python scripts/security_events.py --email a@b.com

Shows what happened, to whom and from where. Repeated failures from one
address, or a lockout on an account nobody was using, are what to look for.
"""
import os
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pymongo import MongoClient

LABELS = {
    "login_failed": "دخول فاشل",
    "login_locked": "إيقاف مؤقت بعد محاولات",
    "login_ok": "دخول ناجح",
    "2fa_sent": "إرسال رمز التحقق",
    "2fa_failed": "رمز تحقق خاطئ",
    "2fa_ok": "تحقق بخطوتين ناجح",
    "password_reset_requested": "طلب استعادة كلمة المرور",
    "file_denied": "رفض عرض ملف",
    "permission_denied": "رفض صلاحية",
}
WORRYING = {"login_failed", "login_locked", "2fa_failed", "file_denied"}


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv and len(sys.argv) > sys.argv.index(name) + 1 else default


def main():
    days = float(arg("--days", 1))
    kind = arg("--kind")
    email = arg("--email")
    limit = int(arg("--limit", 200))

    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    q = {"at": {"$gte": since}}
    if kind:
        q["kind"] = kind
    if email:
        q["email"] = email

    rows = list(db.security_events.find(q, {"_id": 0}).sort("at", -1).limit(limit))
    window = f"آخر {int(days)} يوم" if days >= 1 else f"آخر {int(days * 24)} ساعة"
    print(f"\nالسجل الأمني — {window} — {len(rows)} حدث\n")
    if not rows:
        print("  لا شيء مسجّل في هذه الفترة.")
        return

    counts = Counter(r["kind"] for r in rows)
    print("  الملخّص:")
    for k, n in counts.most_common():
        mark = " ⚠" if k in WORRYING and n > 5 else ""
        print(f"    {LABELS.get(k, k):<28} {n}{mark}")

    # repeated failures from one address are the thing worth seeing
    bad = [r for r in rows if r["kind"] in WORRYING]
    if bad:
        by_ip = Counter(r.get("ip") or "-" for r in bad)
        noisy = [(ip, n) for ip, n in by_ip.most_common(5) if n > 3 and ip != "-"]
        if noisy:
            print("\n  عناوين متكررة في المحاولات الفاشلة:")
            for ip, n in noisy:
                print(f"    {ip:<20} {n} محاولة")

    print("\n  الأحدث:")
    for r in rows[:25]:
        when = (r.get("at") or "")[:19].replace("T", " ")
        who = r.get("email") or r.get("user_id") or "-"
        print(f"    {when}  {LABELS.get(r['kind'], r['kind']):<26} {who[:30]:<32} {r.get('ip') or '-':<16} {(r.get('detail') or '')[:40]}")

    if len(rows) == limit:
        print(f"\n  (عُرض {limit} فقط — استخدم --limit لعدد أكبر)")


if __name__ == "__main__":
    main()
