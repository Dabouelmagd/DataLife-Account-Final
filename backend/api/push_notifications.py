"""
Push Notifications API
نظام إشعارات Push للمتصفح
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/push", tags=["push-notifications"])

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_EMAIL = os.environ.get('VAPID_EMAIL', 'mailto:info@datalifeai.com')


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict


class NotificationPayload(BaseModel):
    title: str
    body: str
    icon: Optional[str] = "/logo192.png"
    badge: Optional[str] = "/logo192.png"
    url: Optional[str] = "/"
    tag: Optional[str] = None


async def verify_user(authorization: str):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    from services.auth_service import verify_token
    token = authorization.split(" ")[1]
    user_data = verify_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_data


@router.get("/vapid-key")
async def get_vapid_public_key():
    """Get VAPID public key for client subscription"""
    return {"publicKey": VAPID_PUBLIC_KEY}


@router.post("/subscribe")
async def subscribe_push(
    subscription: PushSubscription,
    authorization: Optional[str] = Header(None)
):
    """Subscribe to push notifications"""
    user_data = await verify_user(authorization)
    user_id = user_data.get("user_id")
    
    sub_data = {
        "user_id": user_id,
        "email": user_data.get("email"),
        "company_id": user_data.get("company_id"),
        "endpoint": subscription.endpoint,
        "keys": subscription.keys,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    
    await db.push_subscriptions.update_one(
        {"endpoint": subscription.endpoint},
        {"$set": sub_data},
        upsert=True
    )
    
    return {"success": True, "message": "Subscribed to push notifications"}


@router.post("/unsubscribe")
async def unsubscribe_push(
    subscription: PushSubscription,
    authorization: Optional[str] = Header(None)
):
    """Unsubscribe from push notifications"""
    await verify_user(authorization)
    
    await db.push_subscriptions.delete_one({"endpoint": subscription.endpoint})
    return {"success": True, "message": "Unsubscribed from push notifications"}


@router.get("/notifications")
async def get_notifications(
    authorization: Optional[str] = Header(None),
    limit: int = 20,
    skip: int = 0
):
    """Get user notifications (in-app)"""
    user_data = await verify_user(authorization)
    user_id = user_data.get("user_id")
    company_id = user_data.get("company_id")
    
    query = {"$or": [{"user_id": user_id}, {"company_id": company_id}, {"target": "all"}]}
    
    notifications = await db.user_notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    total = await db.user_notifications.count_documents(query)
    unread = await db.user_notifications.count_documents({**query, "read": False})
    
    return {"notifications": notifications, "total": total, "unread": unread}


@router.put("/notifications/read")
async def mark_notifications_read(
    authorization: Optional[str] = Header(None)
):
    """Mark all notifications as read"""
    user_data = await verify_user(authorization)
    user_id = user_data.get("user_id")
    company_id = user_data.get("company_id")
    
    query = {"$or": [{"user_id": user_id}, {"company_id": company_id}, {"target": "all"}]}
    await db.user_notifications.update_many(query, {"$set": {"read": True}})
    
    return {"success": True}


@router.put("/notifications/{notification_id}/read")
async def mark_single_notification_read(
    notification_id: str,
    authorization: Optional[str] = Header(None)
):
    """Mark a single notification as read"""
    await verify_user(authorization)
    await db.user_notifications.update_one({"id": notification_id}, {"$set": {"read": True}})
    return {"success": True}


def send_push_notification(subscription_info: dict, payload: dict) -> bool:
    """Send a push notification to a single subscription"""
    try:
        if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
            logger.warning("VAPID keys not configured")
            return False
        
        webpush(
            subscription_info={
                "endpoint": subscription_info["endpoint"],
                "keys": subscription_info["keys"]
            },
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_EMAIL}
        )
        return True
    except WebPushException as e:
        logger.error(f"Push failed: {e}")
        if e.response and e.response.status_code in [404, 410]:
            return False
        return False
    except Exception as e:
        logger.error(f"Push error: {e}")
        return False


async def send_push_to_user(user_id: str, title: str, body: str, url: str = "/", tag: str = None):
    """Send push notification to a specific user"""
    import uuid
    
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "body": body,
        "url": url,
        "tag": tag,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_notifications.insert_one(notification)
    
    subscriptions = await db.push_subscriptions.find(
        {"user_id": user_id, "is_active": True}, {"_id": 0}
    ).to_list(length=10)
    
    payload = {"title": title, "body": body, "icon": "/logo192.png", "url": url, "tag": tag or str(uuid.uuid4())}
    
    for sub in subscriptions:
        success = send_push_notification(sub, payload)
        if not success:
            await db.push_subscriptions.update_one(
                {"endpoint": sub["endpoint"]}, {"$set": {"is_active": False}}
            )


async def send_push_to_company(company_id: str, title: str, body: str, url: str = "/", tag: str = None):
    """Send push notification to all users in a company"""
    import uuid
    
    notification = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "title": title,
        "body": body,
        "url": url,
        "tag": tag,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_notifications.insert_one(notification)
    
    subscriptions = await db.push_subscriptions.find(
        {"company_id": company_id, "is_active": True}, {"_id": 0}
    ).to_list(length=100)
    
    payload = {"title": title, "body": body, "icon": "/logo192.png", "url": url, "tag": tag or str(uuid.uuid4())}
    
    for sub in subscriptions:
        success = send_push_notification(sub, payload)
        if not success:
            await db.push_subscriptions.update_one(
                {"endpoint": sub["endpoint"]}, {"$set": {"is_active": False}}
            )


async def send_push_to_all(title: str, body: str, url: str = "/", tag: str = None):
    """Send push notification to all subscribed users"""
    import uuid
    
    notification = {
        "id": str(uuid.uuid4()),
        "target": "all",
        "title": title,
        "body": body,
        "url": url,
        "tag": tag,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_notifications.insert_one(notification)
    
    subscriptions = await db.push_subscriptions.find(
        {"is_active": True}, {"_id": 0}
    ).to_list(length=1000)
    
    payload = {"title": title, "body": body, "icon": "/logo192.png", "url": url, "tag": tag or str(uuid.uuid4())}
    
    for sub in subscriptions:
        success = send_push_notification(sub, payload)
        if not success:
            await db.push_subscriptions.update_one(
                {"endpoint": sub["endpoint"]}, {"$set": {"is_active": False}}
            )


@router.post("/send-test")
async def send_test_push(authorization: Optional[str] = Header(None)):
    """Send a test push notification to the current user"""
    user_data = await verify_user(authorization)
    user_id = user_data.get("user_id")
    
    await send_push_to_user(
        user_id=user_id,
        title="DataLife Account",
        body="تم تفعيل إشعارات Push بنجاح! Push notifications activated successfully!",
        url="/",
        tag="test"
    )
    
    return {"success": True, "message": "Test notification sent"}
