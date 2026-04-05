from fastapi import APIRouter, HTTPException, Depends, Header
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
import uuid

router = APIRouter(prefix="/api/activity", tags=["activity"])

# Get database instance
from database import get_database
from services.auth_service import verify_token

db = get_database()

class ActivityLog(BaseModel):
    action: str
    entity_type: str  # user, employee, invoice, etc.
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    details: Optional[dict] = None
    
class ActivityLogResponse(BaseModel):
    id: str
    action: str
    entity_type: str
    entity_id: Optional[str]
    entity_name: Optional[str]
    details: Optional[dict]
    user_id: str
    user_name: str
    company_id: str
    timestamp: str
    
# Activity action constants
ACTIONS = {
    "user_invited": {"ar": "دعوة مستخدم جديد", "en": "Invited new user"},
    "user_deleted": {"ar": "حذف مستخدم", "en": "Deleted user"},
    "user_role_changed": {"ar": "تغيير دور المستخدم", "en": "Changed user role"},
    "user_permissions_changed": {"ar": "تغيير صلاحيات المستخدم", "en": "Changed user permissions"},
    "password_changed": {"ar": "تغيير كلمة المرور", "en": "Changed password"},
    "employee_added": {"ar": "إضافة موظف", "en": "Added employee"},
    "employee_deleted": {"ar": "حذف موظف", "en": "Deleted employee"},
    "invoice_created": {"ar": "إنشاء فاتورة", "en": "Created invoice"},
    "invoice_approved": {"ar": "اعتماد فاتورة", "en": "Approved invoice"},
    "payroll_created": {"ar": "إنشاء كشف رواتب", "en": "Created payroll"},
    "payroll_approved": {"ar": "اعتماد كشف رواتب", "en": "Approved payroll"},
    "settings_updated": {"ar": "تحديث الإعدادات", "en": "Updated settings"},
    "login": {"ar": "تسجيل دخول", "en": "Logged in"},
    "logout": {"ar": "تسجيل خروج", "en": "Logged out"},
}

async def get_current_user(authorization: Optional[str] = Header(None)):
    """Dependency to get current user from JWT token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return payload

async def log_activity(
    company_id: str,
    user_id: str,
    user_name: str,
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    entity_name: Optional[str] = None,
    details: Optional[dict] = None
):
    """Log an activity to the database"""
    log_entry = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "entity_name": entity_name,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.activity_logs.insert_one(log_entry)
    return log_entry

@router.post("/log")
async def create_activity_log(
    log_data: ActivityLog,
    current_user: dict = Depends(get_current_user)
):
    """Create a new activity log entry"""
    # Get user details
    user = await db.users.find_one({"id": current_user.get("user_id")})
    user_name = user.get("full_name", "Unknown") if user else "Unknown"
    
    log_entry = await log_activity(
        company_id=current_user.get("company_id"),
        user_id=current_user.get("user_id"),
        user_name=user_name,
        action=log_data.action,
        entity_type=log_data.entity_type,
        entity_id=log_data.entity_id,
        entity_name=log_data.entity_name,
        details=log_data.details
    )
    
    return {"message": "Activity logged", "id": log_entry["id"]}

@router.get("/logs")
async def get_activity_logs(
    limit: int = 50,
    offset: int = 0,
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get activity logs for the company"""
    # Build query
    query = {"company_id": current_user.get("company_id")}
    
    if entity_type:
        query["entity_type"] = entity_type
    if action:
        query["action"] = action
    
    # Get logs with pagination
    cursor = db.activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(offset).limit(limit)
    logs = await cursor.to_list(length=limit)
    
    # Get total count
    total = await db.activity_logs.count_documents(query)
    
    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@router.get("/logs/recent")
async def get_recent_activity(
    limit: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """Get most recent activity logs"""
    query = {"company_id": current_user.get("company_id")}
    
    cursor = db.activity_logs.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit)
    logs = await cursor.to_list(length=limit)
    
    return {"logs": logs}

@router.get("/stats")
async def get_activity_stats(
    days: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """Get activity statistics for the past N days"""
    from datetime import timedelta
    
    company_id = current_user.get("company_id")
    start_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    # Get counts by action type
    pipeline = [
        {
            "$match": {
                "company_id": company_id,
                "timestamp": {"$gte": start_date.isoformat()}
            }
        },
        {
            "$group": {
                "_id": "$action",
                "count": {"$sum": 1}
            }
        },
        {
            "$sort": {"count": -1}
        }
    ]
    
    action_stats = await db.activity_logs.aggregate(pipeline).to_list(length=100)
    
    # Get counts by entity type
    pipeline[1] = {"$group": {"_id": "$entity_type", "count": {"$sum": 1}}}
    entity_stats = await db.activity_logs.aggregate(pipeline).to_list(length=100)
    
    # Get counts by user
    pipeline[1] = {"$group": {"_id": {"user_id": "$user_id", "user_name": "$user_name"}, "count": {"$sum": 1}}}
    user_stats = await db.activity_logs.aggregate(pipeline).to_list(length=100)
    
    # Get daily counts
    pipeline = [
        {
            "$match": {
                "company_id": company_id,
                "timestamp": {"$gte": start_date.isoformat()}
            }
        },
        {
            "$addFields": {
                "date": {"$substr": ["$timestamp", 0, 10]}
            }
        },
        {
            "$group": {
                "_id": "$date",
                "count": {"$sum": 1}
            }
        },
        {
            "$sort": {"_id": 1}
        }
    ]
    daily_stats = await db.activity_logs.aggregate(pipeline).to_list(length=100)
    
    return {
        "period_days": days,
        "by_action": action_stats,
        "by_entity": entity_stats,
        "by_user": user_stats,
        "by_day": daily_stats
    }

@router.get("/actions")
async def get_available_actions():
    """Get list of available activity actions with translations"""
    return {"actions": ACTIONS}
