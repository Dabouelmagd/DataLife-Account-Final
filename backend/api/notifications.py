from fastapi import APIRouter, HTTPException, Header, WebSocket, WebSocketDisconnect
from typing import Optional, List, Dict
import os
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import json
import asyncio

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# WebSocket connections manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
    
    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass
    
    async def broadcast_to_company(self, message: dict, company_id: str):
        # Get all users in company
        users = await db.users.find({"company_id": company_id}, {"id": 1}).to_list(length=None)
        for user in users:
            user_id = user.get("id")
            if user_id and user_id in self.active_connections:
                for connection in self.active_connections[user_id]:
                    try:
                        await connection.send_json(message)
                    except:
                        pass

manager = ConnectionManager()


# Notification types
NOTIFICATION_TYPES = {
    "subscription_expiring": {
        "title_en": "Subscription Expiring Soon",
        "title_ar": "الاشتراك ينتهي قريباً",
        "icon": "alert-circle",
        "color": "amber"
    },
    "subscription_expired": {
        "title_en": "Subscription Expired",
        "title_ar": "انتهى الاشتراك",
        "icon": "x-circle",
        "color": "red"
    },
    "payment_success": {
        "title_en": "Payment Successful",
        "title_ar": "تم الدفع بنجاح",
        "icon": "check-circle",
        "color": "green"
    },
    "low_inventory": {
        "title_en": "Low Inventory Alert",
        "title_ar": "تنبيه: مخزون منخفض",
        "icon": "package",
        "color": "orange"
    },
    "salary_due": {
        "title_en": "Salary Payment Due",
        "title_ar": "موعد صرف الرواتب",
        "icon": "dollar-sign",
        "color": "blue"
    },
    "leave_request": {
        "title_en": "New Leave Request",
        "title_ar": "طلب إجازة جديد",
        "icon": "calendar",
        "color": "purple"
    },
    "leave_approved": {
        "title_en": "Leave Request Approved",
        "title_ar": "تمت الموافقة على الإجازة",
        "icon": "check",
        "color": "green"
    },
    "leave_rejected": {
        "title_en": "Leave Request Rejected",
        "title_ar": "تم رفض طلب الإجازة",
        "icon": "x",
        "color": "red"
    },
    "new_employee": {
        "title_en": "New Employee Added",
        "title_ar": "تمت إضافة موظف جديد",
        "icon": "user-plus",
        "color": "blue"
    },
    "report_ready": {
        "title_en": "Report Ready",
        "title_ar": "التقرير جاهز",
        "icon": "file-text",
        "color": "green"
    },
    "system": {
        "title_en": "System Notification",
        "title_ar": "إشعار النظام",
        "icon": "bell",
        "color": "gray"
    }
}


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


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for real-time notifications"""
    await manager.connect(websocket, user_id)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            # Echo back or handle commands
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)


@router.get("/")
async def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    authorization: Optional[str] = Header(None)
):
    """Get user notifications"""
    user_data = await verify_token_from_header(authorization)
    user_id = user_data.get("user_id")
    company_id = user_data.get("company_id")
    
    query = {
        "$or": [
            {"user_id": user_id},
            {"company_id": company_id, "broadcast": True}
        ]
    }
    
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(
        query, 
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(length=None)
    
    # Count unread
    unread_count = await db.notifications.count_documents({
        **query,
        "read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }


@router.post("/")
async def create_notification(
    notification_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Create a new notification"""
    user_data = await verify_token_from_header(authorization)
    
    notification_type = notification_data.get("type", "system")
    type_info = NOTIFICATION_TYPES.get(notification_type, NOTIFICATION_TYPES["system"])
    
    notification = {
        "id": f"notif_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
        "type": notification_type,
        "title_en": notification_data.get("title_en") or type_info["title_en"],
        "title_ar": notification_data.get("title_ar") or type_info["title_ar"],
        "message_en": notification_data.get("message_en", ""),
        "message_ar": notification_data.get("message_ar", ""),
        "icon": type_info["icon"],
        "color": type_info["color"],
        "user_id": notification_data.get("user_id"),
        "company_id": notification_data.get("company_id") or user_data.get("company_id"),
        "broadcast": notification_data.get("broadcast", False),
        "data": notification_data.get("data", {}),
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user_data.get("user_id")
    }
    
    await db.notifications.insert_one(notification)
    if "_id" in notification:
        del notification["_id"]
    
    # Send real-time notification
    if notification.get("user_id"):
        await manager.send_personal_message(notification, notification["user_id"])
    elif notification.get("broadcast") and notification.get("company_id"):
        await manager.broadcast_to_company(notification, notification["company_id"])
    
    return notification


@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    authorization: Optional[str] = Header(None)
):
    """Mark notification as read"""
    await verify_token_from_header(authorization)
    
    result = await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": result.modified_count > 0}


@router.put("/read-all")
async def mark_all_as_read(authorization: Optional[str] = Header(None)):
    """Mark all notifications as read"""
    user_data = await verify_token_from_header(authorization)
    user_id = user_data.get("user_id")
    company_id = user_data.get("company_id")
    
    result = await db.notifications.update_many(
        {
            "$or": [
                {"user_id": user_id},
                {"company_id": company_id, "broadcast": True}
            ],
            "read": False
        },
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "count": result.modified_count}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a notification"""
    await verify_token_from_header(authorization)
    
    result = await db.notifications.delete_one({"id": notification_id})
    
    return {"success": result.deleted_count > 0}


@router.delete("/clear-all")
async def clear_all_notifications(authorization: Optional[str] = Header(None)):
    """Clear all read notifications"""
    user_data = await verify_token_from_header(authorization)
    user_id = user_data.get("user_id")
    company_id = user_data.get("company_id")
    
    result = await db.notifications.delete_many({
        "$or": [
            {"user_id": user_id},
            {"company_id": company_id, "broadcast": True}
        ],
        "read": True
    })
    
    return {"success": True, "count": result.deleted_count}


# Helper function to create system notifications
async def create_system_notification(
    notification_type: str,
    user_id: str = None,
    company_id: str = None,
    message_en: str = "",
    message_ar: str = "",
    broadcast: bool = False,
    data: dict = None
):
    """Helper to create notifications from other parts of the system"""
    type_info = NOTIFICATION_TYPES.get(notification_type, NOTIFICATION_TYPES["system"])
    
    notification = {
        "id": f"notif_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
        "type": notification_type,
        "title_en": type_info["title_en"],
        "title_ar": type_info["title_ar"],
        "message_en": message_en,
        "message_ar": message_ar,
        "icon": type_info["icon"],
        "color": type_info["color"],
        "user_id": user_id,
        "company_id": company_id,
        "broadcast": broadcast,
        "data": data or {},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "system"
    }
    
    await db.notifications.insert_one(notification)
    
    # Send real-time
    if user_id:
        await manager.send_personal_message(notification, user_id)
    elif broadcast and company_id:
        await manager.broadcast_to_company(notification, company_id)
    
    return notification


# Background task to check for expiring subscriptions
async def check_expiring_subscriptions():
    """Check for subscriptions expiring in the next 7 days"""
    now = datetime.now(timezone.utc)
    week_later = now + timedelta(days=7)
    
    subscriptions = await db.subscriptions.find({
        "status": "active"
    }).to_list(length=None)
    
    for sub in subscriptions:
        try:
            end_date = datetime.fromisoformat(sub.get("end_date", "").replace('Z', '+00:00'))
            days_left = (end_date - now).days
            
            if 0 < days_left <= 7:
                # Check if notification already sent today
                existing = await db.notifications.find_one({
                    "company_id": sub.get("company_id"),
                    "type": "subscription_expiring",
                    "created_at": {"$gte": now.replace(hour=0, minute=0, second=0).isoformat()}
                })
                
                if not existing:
                    await create_system_notification(
                        notification_type="subscription_expiring",
                        company_id=sub.get("company_id"),
                        message_en=f"Your subscription expires in {days_left} days. Renew now to avoid service interruption.",
                        message_ar=f"اشتراكك ينتهي خلال {days_left} أيام. جدد الآن لتجنب انقطاع الخدمة.",
                        broadcast=True,
                        data={"days_left": days_left, "end_date": sub.get("end_date")}
                    )
        except:
            pass


# Background task to check for low inventory
async def check_low_inventory():
    """Check for items with low stock"""
    items = await db.inventory_items.find({
        "quantity": {"$lte": 10}  # Low stock threshold
    }).to_list(length=None)
    
    # Group by company
    company_items = {}
    for item in items:
        company_id = item.get("company_id")
        if company_id not in company_items:
            company_items[company_id] = []
        company_items[company_id].append(item)
    
    for company_id, items_list in company_items.items():
        if items_list:
            item_names = ", ".join([i.get("name", "Unknown")[:20] for i in items_list[:3]])
            count = len(items_list)
            
            await create_system_notification(
                notification_type="low_inventory",
                company_id=company_id,
                message_en=f"{count} items are low on stock: {item_names}{'...' if count > 3 else ''}",
                message_ar=f"{count} منتجات بمخزون منخفض: {item_names}{'...' if count > 3 else ''}",
                broadcast=True,
                data={"count": count, "items": [i.get("name") for i in items_list]}
            )
