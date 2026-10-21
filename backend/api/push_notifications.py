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
import asyncio
try:
    from pywebpush import webpush, WebPushException
except Exception:          # library missing: in-app notifications still work
    webpush = None

    class WebPushException(Exception):
        response = None

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


def _visible(user_id: str, company_id: str) -> dict:
    """The rows a user sees: their own, their company's broadcasts."""
    return {"$or": [{"user_id": user_id}, {"company_id": company_id, "broadcast": True}]}


def _shape(n: dict) -> dict:
    """db.notifications rows carry title/body (new) or title_ar/message_ar (older)."""
    return {**n, "title": n.get("title") or n.get("title_ar") or n.get("title_en") or "",
            "body": n.get("body") or n.get("message_ar") or n.get("message_en") or "",
            "link": n.get("link") or n.get("url") or ""}


@router.get("/notifications")
async def get_notifications(
    authorization: Optional[str] = Header(None),
    limit: int = 20,
    skip: int = 0
):
    """Get user notifications (in-app) — the same store as /api/notifications,
    plus platform-wide announcements."""
    user_data = await verify_user(authorization)
    user_id = user_data.get("user_id")
    company_id = user_data.get("company_id")

    query = _visible(user_id, company_id)
    notifications = await db.notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    total = await db.notifications.count_documents(query)
    unread = await db.notifications.count_documents({**query, "read": False})

    # platform-wide announcements (send_push_to_all) still live in user_notifications
    legacy_q = {"$or": [{"user_id": user_id}, {"target": "all"}]}
    legacy = await db.user_notifications.find(legacy_q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(length=limit)
    unread += await db.user_notifications.count_documents({**legacy_q, "read": False})
    total += len(legacy)
    merged = sorted([_shape(n) for n in notifications + legacy],
                    key=lambda n: str(n.get("created_at") or ""), reverse=True)[:limit]
    return {"notifications": merged, "total": total, "unread": unread}


@router.put("/notifications/read")
async def mark_notifications_read(
    authorization: Optional[str] = Header(None)
):
    """Mark all notifications as read"""
    user_data = await verify_user(authorization)
    user_id = user_data.get("user_id")
    company_id = user_data.get("company_id")

    now = datetime.now(timezone.utc).isoformat()
    await db.notifications.update_many({**_visible(user_id, company_id), "read": False},
                                       {"$set": {"read": True, "read_at": now}})
    # only the user's own legacy rows: marking a company/global row read
    # used to mark it read for everyone
    await db.user_notifications.update_many({"user_id": user_id}, {"$set": {"read": True}})
    return {"success": True}


@router.put("/notifications/{notification_id}/read")
async def mark_single_notification_read(
    notification_id: str,
    authorization: Optional[str] = Header(None)
):
    """Mark a single notification as read"""
    user_data = await verify_user(authorization)
    user_id = user_data.get("user_id")
    q = {"id": notification_id, "user_id": user_id}
    if await db.notifications.find_one(q, {"_id": 1}):
        await db.notifications.update_one(q, {"$set": {"read": True}})
    elif await db.user_notifications.find_one(q, {"_id": 1}):
        await db.user_notifications.update_one(q, {"$set": {"read": True}})
    else:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


def send_push_notification(subscription_info: dict, payload: dict):
    """Send one push (blocking — call through asyncio.to_thread).
    True = delivered, False = the subscription is gone (404/410),
    None = not sent for another reason (keys missing, network) — keep it."""
    if webpush is None or not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        return None
    try:
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
        resp = getattr(e, "response", None)
        if resp is not None and getattr(resp, "status_code", None) in (404, 410):
            return False
        return None
    except Exception as e:
        logger.error(f"Push error: {e}")
        return None


async def _push_subscriptions(db_, query: dict, payload: dict, cap: int):
    subscriptions = await db_.push_subscriptions.find(
        {**query, "is_active": True}, {"_id": 0}).to_list(length=cap)
    for sub in subscriptions:
        try:
            ok = await asyncio.to_thread(send_push_notification, sub, payload)
        except Exception as e:
            logger.error(f"Push error: {e}")
            ok = None
        if ok is False:   # only a gone subscription is retired
            await db_.push_subscriptions.update_one(
                {"endpoint": sub["endpoint"]}, {"$set": {"is_active": False}})


async def push_to_devices(db_, user_id: str, title: str, body: str, url: str = "/", tag: str = None):
    """Web push to a user's subscribed browsers only (no in-app row). Never raises."""
    import uuid
    try:
        payload = {"title": title, "body": body, "icon": "/logo192.png", "url": url or "/",
                   "tag": tag or str(uuid.uuid4())}
        await _push_subscriptions(db_ if db_ is not None else db, {"user_id": user_id}, payload, 10)
    except Exception as e:
        logger.error(f"Push error: {e}")


async def send_push_to_user(user_id: str, title: str, body: str, url: str = "/", tag: str = None,
                            company_id: str = None):
    """In-app row in db.notifications (what the bell reads) + web push."""
    import uuid
    notification = {
        "id": f"notif_{uuid.uuid4().hex[:16]}",
        "type": "system", "kind": "system",
        "user_id": user_id,
        "company_id": company_id,
        "title": title, "body": body, "link": url, "url": url,
        "title_ar": title, "title_en": title, "message_ar": body, "message_en": body,
        "tag": tag,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    await push_to_devices(db, user_id, title, body, url, tag or notification["id"])


async def send_push_to_company(company_id: str, title: str, body: str, url: str = "/", tag: str = None):
    """Company broadcast row in db.notifications + push to the company's browsers."""
    import uuid
    notification = {
        "id": f"notif_{uuid.uuid4().hex[:16]}",
        "type": "system", "kind": "system",
        "company_id": company_id, "broadcast": True,
        "title": title, "body": body, "link": url, "url": url,
        "title_ar": title, "title_en": title, "message_ar": body, "message_en": body,
        "tag": tag,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    payload = {"title": title, "body": body, "icon": "/logo192.png", "url": url, "tag": tag or str(uuid.uuid4())}
    await _push_subscriptions(db, {"company_id": company_id}, payload, 100)


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
    payload = {"title": title, "body": body, "icon": "/logo192.png", "url": url, "tag": tag or str(uuid.uuid4())}
    await _push_subscriptions(db, {}, payload, 1000)


@router.post("/send-test")
async def send_test_push(authorization: Optional[str] = Header(None)):
    """Send a test push notification to the current user"""
    user_data = await verify_user(authorization)
    user_id = user_data.get("user_id")
    
    await send_push_to_user(
        user_id=user_id,
        company_id=user_data.get("company_id"),
        title="DataLife Account",
        body="تم تفعيل إشعارات Push بنجاح! Push notifications activated successfully!",
        url="/",
        tag="test"
    )
    
    return {"success": True, "message": "Test notification sent"}
