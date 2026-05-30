"""
Journal Entries API — persistent double-entry accounting.
- Each journal entry has multiple lines (debit/credit pairs).
- General Ledger groups all journal lines by account.
- Trial Balance aggregates net debit/credit per account.
"""
from fastapi import APIRouter, HTTPException, Depends, Header, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
from dotenv import load_dotenv
import os
import uuid
import io

from services.auth_service import verify_token
from services.financial_reports_service import (
    build_trial_balance_pdf,
    build_ledger_pdf,
    send_monthly_financial_report,
)

load_dotenv()

router = APIRouter(prefix="/api/journal-entries", tags=["journal-entries"])

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "multi_tenant_erp")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


# ---------- Models ----------
class JournalLine(BaseModel):
    account: str
    description: Optional[str] = None
    debit: float = 0.0
    credit: float = 0.0


class JournalEntryCreate(BaseModel):
    date: str  # ISO YYYY-MM-DD
    description: str
    reference: Optional[str] = None
    lines: List[JournalLine]


class JournalEntryUpdate(BaseModel):
    date: Optional[str] = None
    description: Optional[str] = None
    reference: Optional[str] = None
    lines: Optional[List[JournalLine]] = None


# ---------- Helpers ----------
async def _get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    token = authorization.replace("Bearer ", "")
    try:
        return verify_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def _validate_balanced(lines: List[JournalLine]):
    total_debit = sum(line.debit for line in lines)
    total_credit = sum(line.credit for line in lines)
    if round(total_debit, 2) != round(total_credit, 2):
        raise HTTPException(
            status_code=400,
            detail=f"Entry not balanced: debit={total_debit} credit={total_credit}",
        )
    if total_debit == 0:
        raise HTTPException(status_code=400, detail="Empty entry — no amounts")


async def _next_entry_number(company_id: str) -> str:
    """Generate sequential entry number per company."""
    count = await db.journal_entries.count_documents({"company_id": company_id})
    return f"JE{str(count + 1).zfill(5)}"


# ---------- Endpoints ----------
@router.get("")
async def list_entries(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    account: Optional[str] = None,
    limit: int = 200,
    current_user: dict = Depends(_get_current_user),
):
    company_id = current_user.get("company_id")
    query = {"company_id": company_id}
    if start_date or end_date:
        date_q = {}
        if start_date:
            date_q["$gte"] = start_date
        if end_date:
            date_q["$lte"] = end_date
        query["date"] = date_q
    if account:
        query["lines.account"] = account
    docs = await db.journal_entries.find(query, {"_id": 0}).sort("date", -1).limit(min(limit, 500)).to_list(length=500)
    return docs


@router.post("")
async def create_entry(payload: JournalEntryCreate, current_user: dict = Depends(_get_current_user)):
    _validate_balanced(payload.lines)
    company_id = current_user.get("company_id")
    entry_number = await _next_entry_number(company_id)
    doc = {
        "id": str(uuid.uuid4()),
        "entry_number": entry_number,
        "company_id": company_id,
        "user_id": current_user.get("user_id"),
        "date": payload.date,
        "description": payload.description,
        "reference": payload.reference or "",
        "lines": [line.dict() for line in payload.lines],
        "total_debit": round(sum(line.debit for line in payload.lines), 2),
        "total_credit": round(sum(line.credit for line in payload.lines), 2),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.journal_entries.insert_one(dict(doc))
    return {k: v for k, v in doc.items() if k != "_id"}


@router.put("/{entry_id}")
async def update_entry(entry_id: str, payload: JournalEntryUpdate, current_user: dict = Depends(_get_current_user)):
    existing = await db.journal_entries.find_one({"id": entry_id, "company_id": current_user.get("company_id")}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if payload.date is not None:
        update_data["date"] = payload.date
    if payload.description is not None:
        update_data["description"] = payload.description
    if payload.reference is not None:
        update_data["reference"] = payload.reference
    if payload.lines is not None:
        _validate_balanced(payload.lines)
        update_data["lines"] = [line.dict() for line in payload.lines]
        update_data["total_debit"] = round(sum(line.debit for line in payload.lines), 2)
        update_data["total_credit"] = round(sum(line.credit for line in payload.lines), 2)
    await db.journal_entries.update_one({"id": entry_id}, {"$set": update_data})
    return await db.journal_entries.find_one({"id": entry_id}, {"_id": 0})


@router.delete("/{entry_id}")
async def delete_entry(entry_id: str, current_user: dict = Depends(_get_current_user)):
    res = await db.journal_entries.delete_one({"id": entry_id, "company_id": current_user.get("company_id")})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    return {"deleted": True}


@router.get("/ledger")
async def general_ledger(
    account: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(_get_current_user),
):
    """
    General Ledger — every journal line grouped by account, with a running
    balance per account.
    """
    company_id = current_user.get("company_id")
    match = {"company_id": company_id}
    if start_date or end_date:
        date_q = {}
        if start_date:
            date_q["$gte"] = start_date
        if end_date:
            date_q["$lte"] = end_date
        match["date"] = date_q
    pipeline: list = [
        {"$match": match},
        {"$unwind": "$lines"},
    ]
    if account:
        pipeline.append({"$match": {"lines.account": account}})
    pipeline.extend([
        {"$sort": {"date": 1, "entry_number": 1}},
        {"$group": {
            "_id": "$lines.account",
            "transactions": {"$push": {
                "entry_number": "$entry_number",
                "date": "$date",
                "description": "$description",
                "line_description": "$lines.description",
                "debit": "$lines.debit",
                "credit": "$lines.credit",
            }},
            "total_debit": {"$sum": "$lines.debit"},
            "total_credit": {"$sum": "$lines.credit"},
        }},
        {"$sort": {"_id": 1}},
    ])
    raw = await db.journal_entries.aggregate(pipeline).to_list(length=500)
    result = []
    for r in raw:
        running = 0.0
        txs_with_balance = []
        for tx in r["transactions"]:
            running += tx["debit"] - tx["credit"]
            txs_with_balance.append({**tx, "running_balance": round(running, 2)})
        result.append({
            "account": r["_id"],
            "total_debit": round(r["total_debit"], 2),
            "total_credit": round(r["total_credit"], 2),
            "balance": round(r["total_debit"] - r["total_credit"], 2),
            "transactions": txs_with_balance,
        })
    return result


@router.get("/trial-balance")
async def trial_balance(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(_get_current_user),
):
    """Trial Balance — net debit/credit per account."""
    company_id = current_user.get("company_id")
    match = {"company_id": company_id}
    if start_date or end_date:
        date_q = {}
        if start_date:
            date_q["$gte"] = start_date
        if end_date:
            date_q["$lte"] = end_date
        match["date"] = date_q
    pipeline = [
        {"$match": match},
        {"$unwind": "$lines"},
        {"$group": {
            "_id": "$lines.account",
            "total_debit": {"$sum": "$lines.debit"},
            "total_credit": {"$sum": "$lines.credit"},
        }},
        {"$sort": {"_id": 1}},
    ]
    rows = await db.journal_entries.aggregate(pipeline).to_list(length=500)
    accounts = []
    grand_debit = 0.0
    grand_credit = 0.0
    for r in rows:
        d = round(r["total_debit"], 2)
        c = round(r["total_credit"], 2)
        balance = round(d - c, 2)
        accounts.append({
            "account": r["_id"],
            "total_debit": d,
            "total_credit": c,
            "debit_balance": balance if balance > 0 else 0,
            "credit_balance": abs(balance) if balance < 0 else 0,
        })
        grand_debit += d
        grand_credit += c
    return {
        "accounts": accounts,
        "totals": {
            "total_debit": round(grand_debit, 2),
            "total_credit": round(grand_credit, 2),
            "is_balanced": round(grand_debit, 2) == round(grand_credit, 2),
        },
    }



# ---------- PDF Export Endpoints ----------
@router.get("/trial-balance/pdf")
async def trial_balance_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(_get_current_user),
):
    """Return Trial Balance as a downloadable PDF."""
    company_id = current_user.get("company_id")
    try:
        pdf_bytes, _ = await build_trial_balance_pdf(db, company_id, start_date, end_date)
    except RuntimeError as err:
        raise HTTPException(status_code=503, detail=str(err))
    fname = f"trial-balance-{datetime.now().date().isoformat()}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@router.get("/ledger/pdf")
async def ledger_pdf(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(_get_current_user),
):
    """Return General Ledger as a downloadable PDF."""
    company_id = current_user.get("company_id")
    try:
        pdf_bytes, _ = await build_ledger_pdf(db, company_id, start_date, end_date)
    except RuntimeError as err:
        raise HTTPException(status_code=503, detail=str(err))
    fname = f"general-ledger-{datetime.now().date().isoformat()}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


class MonthlyReportRequest(BaseModel):
    month: Optional[int] = None  # 1-12; defaults to previous month
    year: Optional[int] = None
    recipient_email: Optional[str] = None  # defaults to company contact email


@router.post("/send-monthly-report")
async def send_monthly_report(payload: MonthlyReportRequest,
                              current_user: dict = Depends(_get_current_user)):
    """Manually trigger the monthly financial reports email for this company."""
    company_id = current_user.get("company_id")
    company = await db.companies.find_one({"id": company_id},
                                          {"_id": 0, "contact_email": 1, "name": 1}) or {}
    recipient = payload.recipient_email or company.get("contact_email")
    if not recipient:
        raise HTTPException(status_code=400, detail="No recipient email available")
    now = datetime.now(timezone.utc)
    if payload.month and payload.year:
        month, year = payload.month, payload.year
    else:
        if now.month == 1:
            month, year = 12, now.year - 1
        else:
            month, year = now.month - 1, now.year
    res = await send_monthly_financial_report(
        company_id=company_id, recipient_email=recipient, month=month, year=year, db=db,
    )
    if not res.get("sent"):
        raise HTTPException(status_code=500, detail=res.get("error", "Failed to send report"))
    return res
