"""
حالة النسخ الاحتياطي — backup status for PLATFORM administrators.

The backup itself runs on the host (deploy/backup/mongo_backup.sh, cron). It
writes a small status file with no secrets in it; docker-compose mounts that
folder read-only into this container (BACKUP_STATUS_FILE, default
/backup_status/last_backup.json). When the file is not there, this endpoint
says "unknown" — it never reports a backup it cannot see.
"""
import json
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Header

from api.admin_common import verify_admin

router = APIRouter(prefix="/api/backup", tags=["Backup"])

STATUS_FILE = os.environ.get("BACKUP_STATUS_FILE", "/backup_status/last_backup.json")
STALE_HOURS = float(os.environ.get("BACKUP_STALE_HOURS", "36"))


def read_status(path: str = None) -> dict:
    path = path or STATUS_FILE
    base = {"state": "unknown", "source": path, "stale_after_hours": STALE_HOURS}
    if not os.path.isfile(path):
        return {**base, "message_ar": "لا توجد معلومات عن النسخ الاحتياطي — ملف الحالة غير متاح لهذا الخادم",
                "message": "No backup status file is visible to the backend"}
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except Exception:
        return {**base, "message_ar": "ملف حالة النسخ الاحتياطي غير مقروء", "message": "Status file unreadable"}

    out = {**base, **{k: data.get(k) for k in ("time", "file", "size", "sha256", "verified", "offsite",
                                                "ok", "error", "db", "kept", "duration_seconds")}}
    when: Optional[datetime] = None
    try:
        when = datetime.fromisoformat(str(data.get("time")).replace("Z", "+00:00"))
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
    except Exception:
        when = None
    age_h = (datetime.now(timezone.utc) - when).total_seconds() / 3600 if when else None
    out["age_hours"] = round(age_h, 1) if age_h is not None else None

    offsite = str(data.get("offsite") or "none")
    if not data.get("ok") or not data.get("verified"):
        out["state"] = "failed"
        out["message_ar"] = "آخر نسخة احتياطية فشلت أو لم يتم التحقق منها"
    elif age_h is None or age_h > STALE_HOURS:
        out["state"] = "stale"
        out["message_ar"] = f"آخر نسخة احتياطية أقدم من {int(STALE_HOURS)} ساعة"
    elif offsite in ("none", "failed", ""):
        out["state"] = "warning"
        out["message_ar"] = ("النسخة الاحتياطية سليمة لكنها على نفس الخادم فقط — لا توجد نسخة خارجية "
                             "(قاعدة 3-2-1 غير مكتملة)")
    else:
        out["state"] = "ok"
        out["message_ar"] = "النسخة الاحتياطية سليمة ومُتحقَّق منها ولها نسخة خارج الخادم"
    out["three_two_one"] = out["state"] == "ok"
    return out


@router.get("/status")
async def backup_status(authorization: Optional[str] = Header(None)):
    await verify_admin(authorization)
    return read_status()
