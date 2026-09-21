"""
Call every GET route in the API and report what breaks. READ-ONLY.

Routes come from the running app's own /openapi.json, so nothing is
missed or hard-coded. Routes with path parameters are skipped (they need
real ids). Requests are made as the given user, with a token minted
locally — no password needed.

    5xx          the handler crashed               → a real bug
    404          registered route answered 404     → handler/lookup bug
    401 / 403    auth or permission                → expected for admin-only routes
    400 / 422    needs query parameters            → informational

USAGE
    docker exec datalife_backend python scripts/smoke_test_routes.py --email dalia@datalifeai.com
"""

import os
import sys
import time
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from pymongo import MongoClient
from services.auth_service import create_access_token

BASE = os.environ.get("SMOKE_BASE_URL", "http://localhost:8000")
SKIP = ("/logout", "/ws", "/stream", "/sse")   # stateful or long-lived


def main():
    if "--email" not in sys.argv:
        sys.exit("usage: --email <user email>")
    email = sys.argv[sys.argv.index("--email") + 1]

    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    user = db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        sys.exit(f"no user {email}")
    token = create_access_token({
        "user_id": user.get("id"), "email": user["email"],
        "company_id": user.get("company_id"), "role": user.get("role"),
    })
    headers = {"Authorization": f"Bearer {token}"}

    spec = httpx.get(f"{BASE}/openapi.json", timeout=30).json()
    paths = sorted(p for p, ops in spec["paths"].items()
                   if "get" in ops and "{" not in p and not any(s in p for s in SKIP))

    buckets = defaultdict(list)
    t0 = time.time()
    with httpx.Client(base_url=BASE, headers=headers, timeout=25) as client:
        for p in paths:
            try:
                code = client.get(p).status_code
            except Exception as e:
                code = f"ERR {type(e).__name__}"
            key = ("5xx" if isinstance(code, int) and code >= 500 else
                   "error" if not isinstance(code, int) else
                   "404" if code == 404 else
                   "auth" if code in (401, 403) else
                   "params" if code in (400, 422) else
                   "ok" if code < 400 else "other")
            buckets[key].append((p, code))

    print("=" * 72)
    print(f"GET routes tested: {len(paths)}  as {email} ({user.get('role')})  in {time.time()-t0:.0f}s")
    print("=" * 72)
    print(f"  ✓ working            : {len(buckets['ok'])}")
    print(f"  ✗ crashed (5xx)      : {len(buckets['5xx'])}")
    print(f"  ✗ 404 on real route  : {len(buckets['404'])}")
    print(f"  ✗ request error      : {len(buckets['error'])}")
    print(f"  · auth / permission  : {len(buckets['auth'])}")
    print(f"  · needs parameters   : {len(buckets['params'])}")
    for key, title in (("5xx", "CRASHED"), ("404", "404"), ("error", "REQUEST ERROR"), ("other", "OTHER")):
        if buckets[key]:
            print(f"\n{title}:")
            for p, c in buckets[key]:
                print(f"  {c}  {p}")


if __name__ == "__main__":
    main()
