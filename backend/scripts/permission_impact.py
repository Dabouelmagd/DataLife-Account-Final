"""
READ-ONLY. Permissions are enforced by the frontend only: any logged-in user
can call payroll, ledger, treasury... APIs directly. Before enforcing them in
the backend, this shows — per company, per user — what each user would lose,
so nobody gets locked out.

Effective permissions = the user's stored list ∪ their role's defaults
(models.permission.ROLE_PERMISSIONS), which is what the UI shows today.

    docker exec datalife_backend python scripts/permission_impact.py
"""
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pymongo import MongoClient
from models.permission import ROLE_PERMISSIONS

KEY_AREAS = ["financial", "hr", "invoices", "sales", "purchases", "inventory", "users"]
PLATFORM = {"Super Admin"}


def effective(user):
    stored = set(user.get("permissions") or [])
    role_defaults = set((ROLE_PERMISSIONS.get(user.get("role") or "", {}) or {}).get("permissions", []))
    return stored | role_defaults, stored, role_defaults


def main():
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    companies = {c["id"]: c.get("name", "") for c in db.companies.find({}, {"_id": 0, "id": 1, "name": 1})}
    users = list(db.users.find({"is_active": {"$ne": False}}, {"_id": 0, "email": 1, "role": 1,
                                                            "permissions": 1, "company_id": 1}))
    print("=" * 78)
    print(f"active users: {len(users)} in {len({u.get('company_id') for u in users})} companies — nothing is changed")
    print("=" * 78)
    unknown_roles = Counter()
    for cid in sorted({u.get("company_id") for u in users}, key=lambda x: companies.get(x, "") or ""):
        members = [u for u in users if u.get("company_id") == cid]
        print(f"\n[{companies.get(cid, cid or '—')}]")
        for u in sorted(members, key=lambda x: x.get("role") or ""):
            role = u.get("role") or "—"
            if role in PLATFORM:
                print(f"  {u.get('email',''):<34} {role:<22} platform admin — unaffected")
                continue
            eff, stored, defaults = effective(u)
            if role not in ROLE_PERMISSIONS:
                unknown_roles[role] += 1
            has = [a for a in KEY_AREAS if a in eff]
            lacks = [a for a in KEY_AREAS if a not in eff]
            note = "" if stored else "  (no stored list: role defaults only)"
            print(f"  {u.get('email',''):<34} {role:<22} keeps {','.join(has) or '—'}"
                  f"{'  | LOSES ' + ','.join(lacks) if lacks else ''}{note}")
    if unknown_roles:
        print("\nroles not in ROLE_PERMISSIONS (only their stored list would count):")
        for r, n in unknown_roles.items():
            print(f"  {r}: {n} user(s)")


if __name__ == "__main__":
    main()
