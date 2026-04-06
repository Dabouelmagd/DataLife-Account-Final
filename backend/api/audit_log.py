"""
Audit Log API - سجل التدقيق
Tracks all important operations in the system
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid

from database import db
from api.users import get_current_user

router = APIRouter(prefix="/api/audit", tags=["Audit Log"])


# ============== Models ==============

class AuditLogEntry(BaseModel):
    action: str  # create, update, delete, activate, deactivate, login, logout
    entity_type: str  # user, company, invoice, permission, settings, etc.
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    details: Optional[str] = None


class AuditLogResponse(BaseModel):
    id: str
    action: str
    action_ar: str
    entity_type: str
    entity_type_ar: str
    entity_id: Optional[str]
    entity_name: Optional[str]
    old_values: Optional[dict]
    new_values: Optional[dict]
    details: Optional[str]
    performed_by_id: str
    performed_by_name: str
    performed_by_email: str
    company_id: Optional[str]
    company_name: Optional[str]
    ip_address: Optional[str]
    timestamp: str


# ============== Helper Functions ==============

ACTION_TRANSLATIONS = {
    "create": "إنشاء",
    "update": "تعديل",
    "delete": "حذف",
    "activate": "تفعيل",
    "deactivate": "إلغاء تفعيل",
    "login": "تسجيل دخول",
    "logout": "تسجيل خروج",
    "change_role": "تغيير الدور",
    "change_permissions": "تغيير الصلاحيات",
    "approve": "موافقة",
    "reject": "رفض",
    "export": "تصدير",
    "import": "استيراد",
}

ENTITY_TRANSLATIONS = {
    "user": "مستخدم",
    "company": "شركة",
    "invoice": "فاتورة",
    "permission": "صلاحية",
    "settings": "إعدادات",
    "employee": "موظف",
    "bank_account": "حساب بنكي",
    "bank_transaction": "حركة بنكية",
    "journal_entry": "قيد يومية",
    "product": "منتج",
    "customer": "عميل",
    "supplier": "مورد",
    "project": "مشروع",
    "payroll": "راتب",
    "attendance": "حضور",
    "leave": "إجازة",
    "report": "تقرير",
    "coupon": "كوبون",
    "subscription": "اشتراك",
}


async def log_audit(
    action: str,
    entity_type: str,
    performed_by_id: str,
    performed_by_name: str,
    performed_by_email: str,
    company_id: Optional[str] = None,
    company_name: Optional[str] = None,
    entity_id: Optional[str] = None,
    entity_name: Optional[str] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None
):
    """Helper function to create audit log entry"""
    
    log_entry = {
        "id": str(uuid.uuid4()),
        "action": action,
        "action_ar": ACTION_TRANSLATIONS.get(action, action),
        "entity_type": entity_type,
        "entity_type_ar": ENTITY_TRANSLATIONS.get(entity_type, entity_type),
        "entity_id": entity_id,
        "entity_name": entity_name,
        "old_values": old_values,
        "new_values": new_values,
        "details": details,
        "performed_by_id": performed_by_id,
        "performed_by_name": performed_by_name,
        "performed_by_email": performed_by_email,
        "company_id": company_id,
        "company_name": company_name,
        "ip_address": ip_address,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.audit_logs.insert_one(log_entry)
    return log_entry


# ============== API Endpoints ==============

@router.get("/logs")
async def get_audit_logs(
    authorization: Optional[str] = Header(None),
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    performed_by: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """Get audit logs with filters - Super Admin or Company Manager only"""
    
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Build query filter
    query = {}
    
    # Super Admin sees all, others see only their company
    super_admin_roles = ['Super Admin', 'مدير النظام', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي']
    if user.get('role') not in super_admin_roles:
        query["company_id"] = user.get('company_id')
    
    if action:
        query["action"] = action
    
    if entity_type:
        query["entity_type"] = entity_type
    
    if performed_by:
        query["$or"] = [
            {"performed_by_name": {"$regex": performed_by, "$options": "i"}},
            {"performed_by_email": {"$regex": performed_by, "$options": "i"}}
        ]
    
    if start_date:
        query["timestamp"] = {"$gte": start_date}
    
    if end_date:
        if "timestamp" in query:
            query["timestamp"]["$lte"] = end_date
        else:
            query["timestamp"] = {"$lte": end_date}
    
    # Get total count
    total_count = await db.audit_logs.count_documents(query)
    
    # Get logs with pagination
    logs = await db.audit_logs.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "logs": logs,
        "total": total_count,
        "limit": limit,
        "skip": skip
    }


@router.get("/logs/{log_id}")
async def get_audit_log_detail(
    log_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get single audit log detail"""
    
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    log = await db.audit_logs.find_one({"id": log_id}, {"_id": 0})
    
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    
    # Check access
    super_admin_roles = ['Super Admin', 'مدير النظام', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي']
    if user.get('role') not in super_admin_roles:
        if log.get('company_id') != user.get('company_id'):
            raise HTTPException(status_code=403, detail="Access denied")
    
    return log


@router.get("/statistics")
async def get_audit_statistics(
    authorization: Optional[str] = Header(None),
    days: int = 30
):
    """Get audit log statistics"""
    
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Calculate date range
    from datetime import timedelta
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Build query
    query = {"timestamp": {"$gte": start_date.isoformat()}}
    
    super_admin_roles = ['Super Admin', 'مدير النظام', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي']
    if user.get('role') not in super_admin_roles:
        query["company_id"] = user.get('company_id')
    
    # Get total count
    total_logs = await db.audit_logs.count_documents(query)
    
    # Get counts by action
    action_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    actions_result = await db.audit_logs.aggregate(action_pipeline).to_list(length=20)
    actions_by_type = {item["_id"]: item["count"] for item in actions_result}
    
    # Get counts by entity type
    entity_pipeline = [
        {"$match": query},
        {"$group": {"_id": "$entity_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    entities_result = await db.audit_logs.aggregate(entity_pipeline).to_list(length=20)
    entities_by_type = {item["_id"]: item["count"] for item in entities_result}
    
    # Get top users
    users_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$performed_by_email",
            "name": {"$first": "$performed_by_name"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    users_result = await db.audit_logs.aggregate(users_pipeline).to_list(length=10)
    top_users = [{"email": item["_id"], "name": item["name"], "count": item["count"]} for item in users_result]
    
    # Get daily activity
    daily_pipeline = [
        {"$match": query},
        {"$addFields": {
            "date": {"$substr": ["$timestamp", 0, 10]}
        }},
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    daily_result = await db.audit_logs.aggregate(daily_pipeline).to_list(length=days)
    daily_activity = [{"date": item["_id"], "count": item["count"]} for item in daily_result]
    
    return {
        "total_logs": total_logs,
        "period_days": days,
        "actions_by_type": actions_by_type,
        "entities_by_type": entities_by_type,
        "top_users": top_users,
        "daily_activity": daily_activity
    }


@router.get("/actions")
async def get_available_actions():
    """Get list of available actions for filtering"""
    return {
        "actions": [
            {"key": k, "label_en": k.replace("_", " ").title(), "label_ar": v}
            for k, v in ACTION_TRANSLATIONS.items()
        ]
    }


@router.get("/entity-types")
async def get_available_entity_types():
    """Get list of available entity types for filtering"""
    return {
        "entity_types": [
            {"key": k, "label_en": k.replace("_", " ").title(), "label_ar": v}
            for k, v in ENTITY_TRANSLATIONS.items()
        ]
    }
