"""
HR Leaves & Terminations
========================
المسارات التي تناديها صفحات «إجازة عارضة» و«إجازة سنوية» و«إنهاء الخدمة».

الواجهة كانت مكتوبة على هذه المسارات لكنها لم تكن موجودة في الـ backend،
فكانت الصفحات الثلاث ترجع 404 وتظهر فارغة دائماً.

نموذج Leave يحمل leave_type (casual / annual) وstatus، فالتقسيم هنا
مجرد ترشيح فوق نفس المجموعة — لا تكرار في التخزين.

ملاحظة: الصفحات تتوقع مصفوفة مباشرة من GET، وليس {data: [...]}.
"""

import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient

from dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/hr", tags=["HR Leaves & Terminations"])

client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
db = client[os.environ.get("DB_NAME", "multi_tenant_erp")]

VALID_STATUSES = {"pending", "approved", "rejected"}


# ── Payloads ────────────────────────────────────────────────

class CasualLeaveIn(BaseModel):
    employee_id: str
    employee_name: Optional[str] = ""
    date: str                      # يوم واحد
    reason: Optional[str] = None
    status: str = "pending"


class AnnualLeaveIn(BaseModel):
    employee_id: str
    employee_name: Optional[str] = ""
    start_date: str
    end_date: Optional[str] = None
    days: int = 0
    reason: Optional[str] = None
    status: str = "pending"


class StatusIn(BaseModel):
    status: str


class TerminationIn(BaseModel):
    employee_id: str
    employee_code: Optional[str] = ""
    employee_name: Optional[str] = ""
    termination_date: str
    reason: Optional[str] = None
    reason_details: Optional[str] = None
    notice_period: Optional[str] = "30"
    final_settlement: Optional[str] = None
    notes: Optional[str] = None


# ── Helpers ─────────────────────────────────────────────────

def _company(user: dict) -> str:
    cid = user.get("company_id")
    if not cid:
        raise HTTPException(403, "No company associated with this account")
    return cid


async def _list_leaves(user: dict, leave_type: str, limit: int) -> List[dict]:
    return await db.leaves.find(
        {"company_id": _company(user), "leave_type": leave_type},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=limit)


async def _set_status(user: dict, leave_id: str, leave_type: str, status: str):
    if status not in VALID_STATUSES:
        raise HTTPException(400, f"status must be one of {sorted(VALID_STATUSES)}")
    res = await db.leaves.update_one(
        {"id": leave_id, "company_id": _company(user), "leave_type": leave_type},
        {"$set": {
            "status": status,
            "reviewed_by": user.get("sub") or user.get("email"),
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Leave not found")
    return {"message": "Status updated", "id": leave_id, "status": status}


async def _delete_leave(user: dict, leave_id: str, leave_type: str):
    res = await db.leaves.delete_one(
        {"id": leave_id, "company_id": _company(user), "leave_type": leave_type}
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Leave not found")
    return {"message": "Leave deleted", "id": leave_id}


# ── Casual leaves ───────────────────────────────────────────

@router.get("/casual-leaves")
async def get_casual_leaves(
    current_user: dict = Depends(get_current_user),
    limit: int = Query(500, ge=1, le=2000),
):
    return await _list_leaves(current_user, "casual", limit)


@router.post("/casual-leaves")
async def create_casual_leave(
    payload: CasualLeaveIn,
    current_user: dict = Depends(get_current_user),
):
    doc = payload.dict()
    doc.update({
        "id": str(uuid.uuid4()),
        "company_id": _company(current_user),
        "leave_type": "casual",
        "start_date": payload.date,
        "end_date": payload.date,
        "days": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("sub") or current_user.get("email"),
    })
    await db.leaves.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/casual-leaves/{leave_id}/status")
async def update_casual_leave_status(
    leave_id: str,
    payload: StatusIn,
    current_user: dict = Depends(get_current_user),
):
    return await _set_status(current_user, leave_id, "casual", payload.status)


@router.delete("/casual-leaves/{leave_id}")
async def delete_casual_leave(
    leave_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await _delete_leave(current_user, leave_id, "casual")


# ── Annual leaves ───────────────────────────────────────────

@router.get("/annual-leaves")
async def get_annual_leaves(
    current_user: dict = Depends(get_current_user),
    limit: int = Query(500, ge=1, le=2000),
):
    return await _list_leaves(current_user, "annual", limit)


@router.post("/annual-leaves")
async def create_annual_leave(
    payload: AnnualLeaveIn,
    current_user: dict = Depends(get_current_user),
):
    doc = payload.dict()
    doc.update({
        "id": str(uuid.uuid4()),
        "company_id": _company(current_user),
        "leave_type": "annual",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("sub") or current_user.get("email"),
    })
    if not doc.get("days") and doc.get("start_date") and doc.get("end_date"):
        try:
            d1 = datetime.fromisoformat(doc["start_date"][:10])
            d2 = datetime.fromisoformat(doc["end_date"][:10])
            doc["days"] = max((d2 - d1).days + 1, 1)
        except ValueError:
            doc["days"] = 1
    await db.leaves.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/annual-leaves/{leave_id}/status")
async def update_annual_leave_status(
    leave_id: str,
    payload: StatusIn,
    current_user: dict = Depends(get_current_user),
):
    return await _set_status(current_user, leave_id, "annual", payload.status)


@router.delete("/annual-leaves/{leave_id}")
async def delete_annual_leave(
    leave_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await _delete_leave(current_user, leave_id, "annual")


# ── Terminations ────────────────────────────────────────────
# تُخزَّن في end_of_service، وهي نفس المجموعة التي يقرأها نظام الرواتب،
# حتى لا ينقسم سجل إنهاء الخدمة على مخزنين.

@router.get("/terminations")
async def get_terminations(
    current_user: dict = Depends(get_current_user),
    limit: int = Query(500, ge=1, le=2000),
):
    return await db.end_of_service.find(
        {"company_id": _company(current_user)},
        {"_id": 0}
    ).sort("termination_date", -1).to_list(length=limit)


@router.post("/terminations")
async def create_termination(
    payload: TerminationIn,
    current_user: dict = Depends(get_current_user),
):
    doc = payload.dict()
    doc.update({
        "id": str(uuid.uuid4()),
        "company_id": _company(current_user),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.get("sub") or current_user.get("email"),
    })
    await db.end_of_service.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/terminations/{termination_id}")
async def delete_termination(
    termination_id: str,
    current_user: dict = Depends(get_current_user),
):
    res = await db.end_of_service.delete_one(
        {"id": termination_id, "company_id": _company(current_user)}
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Termination not found")
    return {"message": "Termination deleted", "id": termination_id}
