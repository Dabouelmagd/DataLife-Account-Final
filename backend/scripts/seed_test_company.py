"""
Create a separate QA company to test on — never the real company's data.

What it does
  - a new company "شركة اختبار داتا لايف (QA)" marked is_test, with one
    admin user (role رئيس مجلس الإدارة) and a generated password
  - e-invoicing (ETA) settings forced to the PRE-PRODUCTION environment, so
    nothing a tester submits is registered with the Tax Authority
  - sends no e-mail (no welcome mail, no invitations)
  - with --import: loads the fictional data in scripts/qa_dataset.py through
    the real import screens' API (10 employees across the tax brackets,
    customers, suppliers, stock, balanced opening trial balance)

USAGE (on the server)
    docker exec datalife_backend python scripts/seed_test_company.py --email you+qa@gmail.com
    docker exec datalife_backend python scripts/seed_test_company.py --email you+qa@gmail.com --import

  Use an address that reaches you (a Gmail "+qa" alias works): sign-in may
  send a verification code to it.

REMOVING IT LATER
    1) deactivate its user in Settings → Users (or set is_active false)
    2) docker exec datalife_backend python scripts/purge_company.py --company <id>          (preview)
       docker exec datalife_backend python scripts/purge_company.py --company <id> --apply --confirm <id>
"""

import asyncio
import os
import secrets
import sys
import tempfile
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

COMPANY_NAME = "شركة اختبار داتا لايف (QA)"
API = os.environ.get("QA_API_BASE", "http://localhost:8000")


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


async def main():
    email = (arg("--email") or "").strip().lower()
    if "@" not in email:
        sys.exit("usage: --email <admin e-mail for the QA company> [--import]")

    from database import db
    from models.company import CompanyCreate
    from models.user import UserCreate
    from services.company_service import create_company
    from services.user_service import create_user
    from services.auth_service import create_access_token

    if await db.users.find_one({"email": email}, {"_id": 0, "id": 1}):
        sys.exit(f"STOP: a user with {email} already exists — use another address (e.g. a new +alias)")

    company = await create_company(db, CompanyCreate(
        name=COMPANY_NAME, industry="Trading", size="Small", contact_email=email,
        city="القاهرة", country="مصر", description="شركة اختبار — بيانات وهمية بالكامل"))
    now = datetime.now(timezone.utc).isoformat()
    await db.companies.update_one({"id": company.id}, {"$set": {
        "is_test": True, "name_ar": COMPANY_NAME, "subscription_status": "trial", "qa_created_at": now}})

    password = secrets.token_urlsafe(12)
    user = await create_user(db, UserCreate(email=email, password=password, full_name="مختبر النظام (QA)",
                                            company_id=company.id, role="رئيس مجلس الإدارة"), password)

    # ETA: pre-production only
    from models.eta_settings import CompanyETASettings
    eta = CompanyETASettings(company_id=company.id).dict()
    eta["environment"] = "preprod"
    await db.company_eta_settings.delete_many({"company_id": company.id})
    await db.company_eta_settings.insert_one(eta)

    print("\n=== QA company created ===")
    print(f"company id : {company.id}")
    print(f"login      : {email}")
    print(f"password   : {password}   (shown once — change it after the first sign-in)")
    print("ETA        : pre-production environment (no real submissions)")

    if "--import" not in sys.argv:
        print("\nNext: sign in and import the Excel files (Settings → import), in their numbered order.")
        return

    import httpx
    from scripts.qa_dataset import files, write_xlsx, IMPORT_ENDPOINTS, check_balanced
    check_balanced()
    token = create_access_token(data={"user_id": user.id, "email": user.email,
                                      "company_id": company.id, "role": user.role})
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(base_url=API, timeout=120) as client:
        # the chart of accounts is created on first use
        r = await client.get("/api/accounting/accounts", headers=headers)
        print(f"\nchart of accounts: HTTP {r.status_code}")
        with tempfile.TemporaryDirectory() as tmp:
            for name, (title, rows) in files().items():
                if name not in IMPORT_ENDPOINTS:
                    continue
                path = os.path.join(tmp, name)
                write_xlsx(path, title, rows)
                with open(path, "rb") as fh:
                    r = await client.post(IMPORT_ENDPOINTS[name], headers=headers, files={
                        "file": (name, fh, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
                try:
                    body = r.json()
                except Exception:
                    body = r.text[:300]
                msg = body.get("message") if isinstance(body, dict) else body
                if isinstance(msg, dict):
                    msg = msg.get("message")
                detail = body.get("detail") if isinstance(body, dict) else None
                print(f"{name:28s} HTTP {r.status_code}  {msg or detail}")
                if r.status_code >= 400 and isinstance(detail, dict):
                    for e in (detail.get("errors") or [])[:10]:
                        print("    ", e)
    print("\nDone. Sign in with the login above.")


if __name__ == "__main__":
    asyncio.run(main())
