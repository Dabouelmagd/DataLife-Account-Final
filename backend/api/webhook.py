from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/webhook", tags=["webhook"])

@router.post("/stripe")
async def stripe_webhook(request: Request):
    return {"status": "not_configured"}
