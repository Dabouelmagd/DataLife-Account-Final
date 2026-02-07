from fastapi import APIRouter, HTTPException, Header, Request
from typing import Optional
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import httpx

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_WHATSAPP_NUMBER = os.environ.get('TWILIO_WHATSAPP_NUMBER', 'whatsapp:+14155238886')


async def verify_token_from_header(authorization: str):
    """Verify token from authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    from services.auth_service import verify_token
    token = authorization.split(" ")[1]
    user_data = verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return user_data


async def send_whatsapp_message(to_number: str, message: str):
    """Send WhatsApp message via Twilio"""
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        return {"success": False, "error": "Twilio not configured"}
    
    # Format phone number
    if not to_number.startswith('whatsapp:'):
        to_number = f"whatsapp:{to_number}"
    if not to_number.startswith('whatsapp:+'):
        to_number = to_number.replace('whatsapp:', 'whatsapp:+')
    
    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
    
    data = {
        "From": TWILIO_WHATSAPP_NUMBER,
        "To": to_number,
        "Body": message
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                data=data,
                auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            )
            
            if response.status_code in [200, 201]:
                result = response.json()
                return {
                    "success": True,
                    "sid": result.get("sid"),
                    "status": result.get("status")
                }
            else:
                return {
                    "success": False,
                    "error": response.text
                }
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/send")
async def send_message(
    request_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Send WhatsApp message"""
    await verify_token_from_header(authorization)
    
    to_number = request_data.get("to")
    message = request_data.get("message")
    
    if not to_number or not message:
        raise HTTPException(status_code=400, detail="Missing 'to' or 'message' field")
    
    result = await send_whatsapp_message(to_number, message)
    
    # Log the message
    log_entry = {
        "to": to_number,
        "message": message[:100] + "..." if len(message) > 100 else message,
        "result": result,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.whatsapp_logs.insert_one(log_entry)
    
    return result


@router.post("/send-notification")
async def send_notification(
    request_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Send pre-formatted notification"""
    await verify_token_from_header(authorization)
    
    notification_type = request_data.get("type")
    to_number = request_data.get("to")
    data = request_data.get("data", {})
    language = request_data.get("language", "ar")
    
    if not to_number:
        raise HTTPException(status_code=400, detail="Missing phone number")
    
    # Get notification template
    message = get_notification_message(notification_type, data, language)
    
    if not message:
        raise HTTPException(status_code=400, detail="Invalid notification type")
    
    return await send_whatsapp_message(to_number, message)


def get_notification_message(notification_type: str, data: dict, language: str) -> str:
    """Get formatted notification message"""
    templates = {
        "subscription_expiring": {
            "ar": f"""⚠️ *تنبيه: اشتراكك ينتهي قريباً*

شركة: {data.get('company_name', '-')}
الخطة: {data.get('plan', '-')}
تاريخ الانتهاء: {data.get('end_date', '-')}
الأيام المتبقية: {data.get('days_left', 0)} يوم

جدد اشتراكك الآن لتجنب انقطاع الخدمة.
https://datalifeaccount.com/subscription""",
            "en": f"""⚠️ *Alert: Your subscription is expiring soon*

Company: {data.get('company_name', '-')}
Plan: {data.get('plan', '-')}
End Date: {data.get('end_date', '-')}
Days Left: {data.get('days_left', 0)} days

Renew now to avoid service interruption.
https://datalifeaccount.com/subscription"""
        },
        "payment_success": {
            "ar": f"""✅ *تم الدفع بنجاح!*

شكراً لاشتراكك في DataLife Account

الخطة: {data.get('plan', '-')}
المدة: {data.get('duration', '-')}
المبلغ: {data.get('amount', 0):,.0f} جنيه

تم تفعيل اشتراكك بنجاح.
https://datalifeaccount.com/dashboard""",
            "en": f"""✅ *Payment Successful!*

Thank you for subscribing to DataLife Account

Plan: {data.get('plan', '-')}
Duration: {data.get('duration', '-')}
Amount: {data.get('amount', 0):,.0f} EGP

Your subscription has been activated.
https://datalifeaccount.com/dashboard"""
        },
        "low_inventory": {
            "ar": f"""📦 *تنبيه: مخزون منخفض*

المنتجات التالية بحاجة لإعادة تعبئة:

{data.get('items_list', '-')}

إجمالي المنتجات: {data.get('count', 0)}

راجع المخزون الآن:
https://datalifeaccount.com/dashboard""",
            "en": f"""📦 *Alert: Low Inventory*

The following products need restocking:

{data.get('items_list', '-')}

Total items: {data.get('count', 0)}

Review inventory now:
https://datalifeaccount.com/dashboard"""
        },
        "salary_reminder": {
            "ar": f"""💰 *تذكير: موعد صرف الرواتب*

الشهر: {data.get('month', '-')}
عدد الموظفين: {data.get('employee_count', 0)}
إجمالي الرواتب: {data.get('total_amount', 0):,.0f} جنيه

يرجى مراجعة كشف الرواتب قبل الصرف.
https://datalifeaccount.com/dashboard""",
            "en": f"""💰 *Reminder: Salary Payment Due*

Month: {data.get('month', '-')}
Employees: {data.get('employee_count', 0)}
Total: {data.get('total_amount', 0):,.0f} EGP

Please review payroll before processing.
https://datalifeaccount.com/dashboard"""
        },
        "daily_summary": {
            "ar": f"""📊 *التقرير اليومي - DataLife Account*

📅 التاريخ: {data.get('date', '-')}

💰 المالية:
• الإيرادات: {data.get('revenue', 0):,.0f} جنيه
• المصروفات: {data.get('expenses', 0):,.0f} جنيه
• الصافي: {data.get('profit', 0):,.0f} جنيه

👥 الموارد البشرية:
• الحضور: {data.get('attendance', 0)}
• الإجازات: {data.get('leaves', 0)}

📦 المخزون:
• إجمالي المنتجات: {data.get('inventory_count', 0)}
• منخفض المخزون: {data.get('low_stock', 0)}""",
            "en": f"""📊 *Daily Summary - DataLife Account*

📅 Date: {data.get('date', '-')}

💰 Financial:
• Revenue: {data.get('revenue', 0):,.0f} EGP
• Expenses: {data.get('expenses', 0):,.0f} EGP
• Net: {data.get('profit', 0):,.0f} EGP

👥 HR:
• Attendance: {data.get('attendance', 0)}
• Leaves: {data.get('leaves', 0)}

📦 Inventory:
• Total Items: {data.get('inventory_count', 0)}
• Low Stock: {data.get('low_stock', 0)}"""
        }
    }
    
    if notification_type in templates:
        return templates[notification_type].get(language, templates[notification_type]["en"])
    
    return None


@router.get("/logs")
async def get_message_logs(
    limit: int = 50,
    authorization: Optional[str] = Header(None)
):
    """Get WhatsApp message logs"""
    await verify_token_from_header(authorization)
    
    logs = await db.whatsapp_logs.find(
        {}, 
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(length=None)
    
    return logs


@router.get("/status")
async def get_whatsapp_status():
    """Check WhatsApp integration status"""
    configured = bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN)
    
    return {
        "configured": configured,
        "provider": "Twilio" if configured else None,
        "whatsapp_number": TWILIO_WHATSAPP_NUMBER if configured else None
    }


# Helper function to send notifications from other modules
async def send_system_whatsapp(
    to_number: str,
    notification_type: str,
    data: dict,
    language: str = "ar"
):
    """Send system notification via WhatsApp"""
    message = get_notification_message(notification_type, data, language)
    if message:
        return await send_whatsapp_message(to_number, message)
    return {"success": False, "error": "Invalid notification type"}
