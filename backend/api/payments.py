from fastapi import APIRouter

router = APIRouter(prefix="/api/payments", tags=["payments"])

@router.post("/create-checkout")
async def create_checkout(data: dict):
    return {"message": "Stripe payments coming soon", "status": "not_configured"}
