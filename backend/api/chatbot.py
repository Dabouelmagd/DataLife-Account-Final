"""
AI Chatbot API for Customer Support
Uses Emergent LLM Key with OpenAI GPT for intelligent responses
"""

import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from database import db

load_dotenv()

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])

# Store active chat sessions
chat_sessions = {}

# System prompt for the support chatbot
SYSTEM_PROMPT_AR = """أنت مساعد دعم فني ذكي لنظام DataLife ERP. أنت ودود ومحترف ومتعاون.

معلومات عن النظام:
- DataLife ERP هو نظام متكامل لإدارة موارد المؤسسات
- يشمل: إدارة الموارد البشرية، المحاسبة المالية، إدارة المشاريع، الفواتير، المشتريات
- يدعم اللغة العربية والإنجليزية بالكامل
- نظام سحابي آمن مع تشفير SSL
- يوفر فترة تجريبية مجانية 14 يوم
- يدعم صلاحيات مخصصة لكل مستخدم (10 أنواع)
- يمكن تصدير التقارير بصيغة PDF و CSV
- دعم فني متاح 24/7

قواعد مهمة:
1. أجب دائماً بنفس لغة السؤال
2. كن مختصراً وواضحاً
3. إذا كان السؤال خارج نطاق معرفتك، اقترح التواصل مع الدعم البشري
4. لا تخترع معلومات غير صحيحة
5. إذا طُلب التحويل للدعم البشري، أخبر المستخدم بخيارات التواصل"""

SYSTEM_PROMPT_EN = """You are an intelligent technical support assistant for DataLife ERP system. You are friendly, professional, and helpful.

System Information:
- DataLife ERP is a comprehensive enterprise resource management system
- Includes: HR management, financial accounting, project management, invoicing, purchases
- Full Arabic and English language support
- Secure cloud-based system with SSL encryption
- Offers a free 14-day trial period
- Supports custom permissions for each user (10 types)
- Reports can be exported in PDF and CSV formats
- 24/7 technical support available

Important Rules:
1. Always respond in the same language as the question
2. Be concise and clear
3. If the question is outside your knowledge, suggest contacting human support
4. Do not make up incorrect information
5. If transfer to human support is requested, provide contact options"""


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    language: str = "ar"  # "ar" or "en"


class ChatResponse(BaseModel):
    session_id: str
    message: str
    timestamp: datetime


class ChatHistoryResponse(BaseModel):
    session_id: str
    messages: List[ChatMessage]


class EmailChatRequest(BaseModel):
    session_id: str
    email: str
    language: str = "ar"


class HumanSupportRequest(BaseModel):
    session_id: str
    user_name: str
    user_email: str
    issue_summary: str
    language: str = "ar"


def get_or_create_chat(session_id: str, language: str = "ar") -> LlmChat:
    """Get existing chat session or create a new one"""
    if session_id not in chat_sessions:
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM API key not configured")
        
        system_prompt = SYSTEM_PROMPT_AR if language == "ar" else SYSTEM_PROMPT_EN
        
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=system_prompt
        ).with_model("openai", "gpt-5.2")
        
        chat_sessions[session_id] = {
            "chat": chat,
            "language": language,
            "created_at": datetime.now(timezone.utc)
        }
    
    return chat_sessions[session_id]["chat"]


@router.post("/send", response_model=ChatResponse)
async def send_message(request: ChatRequest):
    """Send a message to the chatbot and get a response"""
    try:
        # Generate session ID if not provided
        session_id = request.session_id or str(uuid.uuid4())
        
        # Get or create chat session
        chat = get_or_create_chat(session_id, request.language)
        
        # Create user message
        user_message = UserMessage(text=request.message)
        
        # Get response from AI
        response = await chat.send_message(user_message)
        
        # Store in database for persistence
        await store_message(session_id, "user", request.message)
        await store_message(session_id, "assistant", response)
        
        return ChatResponse(
            session_id=session_id,
            message=response,
            timestamp=datetime.now(timezone.utc)
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@router.get("/history/{session_id}", response_model=ChatHistoryResponse)
async def get_chat_history(session_id: str):
    """Get chat history for a session"""
    try:
        messages = await db.chat_messages.find(
            {"session_id": session_id}
        ).sort("timestamp", 1).to_list(100)
        
        chat_messages = [
            ChatMessage(
                role=msg["role"],
                content=msg["content"],
                timestamp=msg["timestamp"]
            )
            for msg in messages
        ]
        
        return ChatHistoryResponse(
            session_id=session_id,
            messages=chat_messages
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching history: {str(e)}")


@router.post("/email-transcript")
async def email_chat_transcript(request: EmailChatRequest):
    """Email the chat transcript to the user"""
    try:
        # Get chat history
        messages = await db.chat_messages.find(
            {"session_id": request.session_id}
        ).sort("timestamp", 1).to_list(100)
        
        if not messages:
            raise HTTPException(status_code=404, detail="No chat history found")
        
        # Format transcript
        if request.language == "ar":
            subject = "نسخة من محادثة الدعم الفني - DataLife ERP"
            intro = "مرحباً،\n\nإليك نسخة من محادثتك مع الدعم الفني:\n\n"
            footer = "\n\nشكراً لتواصلك معنا!\nفريق دعم DataLife ERP"
        else:
            subject = "Support Chat Transcript - DataLife ERP"
            intro = "Hello,\n\nHere is a copy of your support chat:\n\n"
            footer = "\n\nThank you for contacting us!\nDataLife ERP Support Team"
        
        transcript = intro
        for msg in messages:
            role = "أنت" if msg["role"] == "user" else "الدعم" if request.language == "ar" else "You" if msg["role"] == "user" else "Support"
            timestamp = msg["timestamp"].strftime("%H:%M")
            transcript += f"[{timestamp}] {role}: {msg['content']}\n\n"
        transcript += footer
        
        # Store email request (in production, integrate with email service)
        await db.email_requests.insert_one({
            "type": "chat_transcript",
            "email": request.email,
            "session_id": request.session_id,
            "subject": subject,
            "body": transcript,
            "created_at": datetime.now(timezone.utc),
            "status": "pending"
        })
        
        return {
            "success": True,
            "message": "تم إرسال المحادثة إلى بريدك الإلكتروني" if request.language == "ar" else "Chat transcript sent to your email"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending email: {str(e)}")


@router.post("/request-human-support")
async def request_human_support(request: HumanSupportRequest):
    """Request transfer to human support"""
    try:
        # Get chat history for context
        messages = await db.chat_messages.find(
            {"session_id": request.session_id}
        ).sort("timestamp", 1).to_list(50)
        
        # Create support ticket
        ticket = {
            "ticket_id": f"TKT-{uuid.uuid4().hex[:8].upper()}",
            "session_id": request.session_id,
            "user_name": request.user_name,
            "user_email": request.user_email,
            "issue_summary": request.issue_summary,
            "chat_history": [
                {"role": msg["role"], "content": msg["content"]}
                for msg in messages
            ],
            "status": "open",
            "priority": "normal",
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.support_tickets.insert_one(ticket)
        
        if request.language == "ar":
            message = f"تم إنشاء تذكرة دعم برقم: {ticket['ticket_id']}\n\nسيتواصل معك فريق الدعم قريباً على البريد الإلكتروني: {request.user_email}\n\nيمكنك أيضاً التواصل مباشرة:\n📞 الهاتف: +966 50 123 4567\n📧 البريد: support@datalife-erp.com"
        else:
            message = f"Support ticket created: {ticket['ticket_id']}\n\nOur support team will contact you soon at: {request.user_email}\n\nYou can also reach us directly:\n📞 Phone: +966 50 123 4567\n📧 Email: support@datalife-erp.com"
        
        return {
            "success": True,
            "ticket_id": ticket["ticket_id"],
            "message": message
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating ticket: {str(e)}")


@router.delete("/session/{session_id}")
async def clear_chat_session(session_id: str):
    """Clear a chat session"""
    try:
        # Remove from memory
        if session_id in chat_sessions:
            del chat_sessions[session_id]
        
        # Remove from database
        await db.chat_messages.delete_many({"session_id": session_id})
        
        return {"success": True, "message": "Session cleared"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing session: {str(e)}")


async def store_message(session_id: str, role: str, content: str):
    """Store a chat message in the database"""
    await db.chat_messages.insert_one({
        "session_id": session_id,
        "role": role,
        "content": content,
        "timestamp": datetime.now(timezone.utc)
    })
