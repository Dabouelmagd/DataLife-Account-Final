"""
READ-ONLY. What PermissionMiddleware would refuse (or did, in enforce mode),
grouped by role and area, so each case can be judged: a real gap to close,
or a legitimate use to exempt in services/route_permissions.py.

    docker exec datalife_backend python scripts/permission_denials.py [--days 7]
"""
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pymongo import MongoClient


def main():
    days = int(sys.argv[sys.argv.index("--days") + 1]) if "--days" in sys.argv else 7
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    rows = list(db.permission_audit.find({"at": {"$gte": since}}, {"_id": 0}))
    mode = os.environ.get("PERMISSION_ENFORCEMENT", "log")
    print(f"mode: {mode} | last {days} days | {len(rows)} would-be refusals (deduplicated per user/area/hour)")
    if not rows:
        print("nothing — every request matched the user's permissions")
        return
    groups = defaultdict(lambda: {"users": set(), "paths": defaultdict(int), "n": 0, "need": None})
    for r in rows:
        g = groups[(r.get("role"), r.get("prefix"))]
        g["users"].add(r.get("email"))
        g["paths"][f'{r.get("method")} {r.get("path")}'] += 1
        g["n"] += 1
        g["need"] = r.get("required_any_of")
    for (role, prefix), g in sorted(groups.items(), key=lambda x: -x[1]["n"]):
        print(f"\n{role}  →  {prefix}   (needs any of {', '.join(g['need'] or [])}; {g['n']} events)")
        print(f"   users: {', '.join(sorted(u for u in g['users'] if u))}")
        for p, n in sorted(g["paths"].items(), key=lambda x: -x[1])[:8]:
            print(f"   {n:>4}  {p}")


if __name__ == "__main__":
    main()
