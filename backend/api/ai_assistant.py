"""
AI Assistant API — natural-language Q&A over the company's business data.
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel
import os

from services.auth_service import verify_token
from services.ai_assistant_service import run_assistant_query

load_dotenv()

router = APIRouter(prefix="/api/ai-assistant", tags=["ai-assistant"])

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "multi_tenant_erp")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


async def _get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    token = authorization.replace("Bearer ", "")
    try:
        return verify_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


class AskRequest(BaseModel):
    question: str
    session_id: Optional[str] = None


@router.post("/ask")
async def ask(req: AskRequest, current_user: dict = Depends(_get_current_user)):
    """Ask the AI assistant a question. Returns intent + result + natural-language answer."""
    if not req.question or len(req.question.strip()) < 2:
        raise HTTPException(status_code=400, detail="Question is too short")
    company_id = current_user.get("company_id")
    user_id = current_user.get("user_id")
    if not company_id:
        raise HTTPException(status_code=400, detail="No company context in token")
    try:
        return await run_assistant_query(
            db=db,
            company_id=company_id,
            user_id=user_id,
            question=req.question.strip(),
            session_id=req.session_id,
        )
    except RuntimeError as err:
        # LLM key missing or transient error
        raise HTTPException(status_code=503, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"AI assistant failed: {err}")


@router.get("/history")
async def history(limit: int = 20, current_user: dict = Depends(_get_current_user)):
    """Get the last N Q&A pairs for the current user."""
    user_id = current_user.get("user_id")
    docs = await db.ai_assistant_history.find(
        {"user_id": user_id},
        {"_id": 0, "intent": 0, "result_size": 0},
    ).sort("created_at", -1).limit(min(limit, 50)).to_list(length=50)
    return list(reversed(docs))


@router.delete("/history")
async def clear_history(current_user: dict = Depends(_get_current_user)):
    """Clear the current user's AI conversation history."""
    user_id = current_user.get("user_id")
    res = await db.ai_assistant_history.delete_many({"user_id": user_id})
    return {"deleted": res.deleted_count}
