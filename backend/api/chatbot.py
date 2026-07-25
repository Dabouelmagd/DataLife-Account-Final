from fastapi import APIRouter

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])

@router.post("/chat")
async def chat(data: dict):
    return {"message": "AI chatbot coming soon", "status": "not_configured"}
