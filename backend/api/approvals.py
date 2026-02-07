from fastapi import APIRouter, HTTPException, Header
from typing import Optional, List
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import secrets
import string

router = APIRouter(prefix="/api/approvals", tags=["approvals"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


def generate_id(prefix=""):
    """Generate unique ID"""
    random_part = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    return f"{prefix}{random_part}"


async def verify_token(authorization: str):
    """Verify token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    from services.auth_service import verify_token as vt
    token = authorization.split(" ")[1]
    data = vt(token)
    
    if not data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return data


# Approval types and their configurations
APPROVAL_TYPES = {
    "leave_request": {
        "name_en": "Leave Request",
        "name_ar": "طلب إجازة",
        "default_approvers": ["HR Manager", "General Manager"]
    },
    "expense": {
        "name_en": "Expense Approval",
        "name_ar": "الموافقة على المصروفات",
        "default_approvers": ["Financial Manager", "General Manager"]
    },
    "purchase_order": {
        "name_en": "Purchase Order",
        "name_ar": "أمر شراء",
        "default_approvers": ["Procurement Manager", "Financial Manager", "General Manager"]
    },
    "invoice": {
        "name_en": "Invoice Approval",
        "name_ar": "الموافقة على الفاتورة",
        "default_approvers": ["Financial Manager"]
    },
    "salary_change": {
        "name_en": "Salary Change",
        "name_ar": "تغيير الراتب",
        "default_approvers": ["HR Manager", "General Manager"]
    },
    "document": {
        "name_en": "Document Approval",
        "name_ar": "الموافقة على المستند",
        "default_approvers": ["General Manager"]
    }
}


# ============ APPROVAL REQUESTS ============

@router.post("/request")
async def create_approval_request(
    request_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Create a new approval request"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    approval_type = request_data.get("type")
    
    if approval_type not in APPROVAL_TYPES:
        raise HTTPException(status_code=400, detail="Invalid approval type")
    
    type_config = APPROVAL_TYPES[approval_type]
    
    # Get approvers (from workflow settings or defaults)
    workflow = await db.approval_workflows.find_one({
        "company_id": company_id,
        "type": approval_type,
        "is_active": True
    })
    
    if workflow:
        approvers = workflow.get("approvers", [])
        approval_levels = workflow.get("levels", 1)
    else:
        # Use defaults - find users with these roles
        approvers = []
        for role in type_config["default_approvers"]:
            users = await db.users.find(
                {"company_id": company_id, "role": role, "is_active": True},
                {"_id": 0, "id": 1, "full_name": 1, "role": 1, "email": 1}
            ).to_list(length=None)
            for u in users:
                if u.get("id") not in [a.get("user_id") for a in approvers]:
                    approvers.append({
                        "user_id": u.get("id"),
                        "user_name": u.get("full_name"),
                        "role": u.get("role"),
                        "email": u.get("email"),
                        "level": len(approvers) + 1
                    })
        approval_levels = len(set(a.get("level") for a in approvers))
    
    approval_request = {
        "id": generate_id("apr_"),
        "company_id": company_id,
        "type": approval_type,
        "type_name_en": type_config["name_en"],
        "type_name_ar": type_config["name_ar"],
        "title": request_data.get("title"),
        "description": request_data.get("description", ""),
        "reference_type": request_data.get("reference_type"),  # leave, expense, po, invoice, etc.
        "reference_id": request_data.get("reference_id"),
        "amount": request_data.get("amount"),
        "currency": request_data.get("currency", "EGP"),
        "attachments": request_data.get("attachments", []),
        "data": request_data.get("data", {}),
        "status": "pending",  # pending, approved, rejected, cancelled
        "current_level": 1,
        "total_levels": approval_levels,
        "approvers": approvers,
        "approval_history": [],
        "requester_id": user_data.get("user_id"),
        "requester_name": user_data.get("full_name"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.approval_requests.insert_one(approval_request)
    if "_id" in approval_request:
        del approval_request["_id"]
    
    # Send notification to first level approvers
    first_level_approvers = [a for a in approvers if a.get("level") == 1]
    for approver in first_level_approvers:
        await create_approval_notification(
            approval_request["id"],
            approver.get("user_id"),
            company_id,
            "new_request"
        )
    
    return approval_request


@router.get("/pending")
async def get_pending_approvals(authorization: Optional[str] = Header(None)):
    """Get pending approvals for current user"""
    user_data = await verify_token(authorization)
    user_id = user_data.get("user_id")
    company_id = user_data.get("company_id")
    
    # Find requests where user is an approver at current level
    requests = await db.approval_requests.find({
        "company_id": company_id,
        "status": "pending",
        "approvers": {
            "$elemMatch": {
                "user_id": user_id,
                "level": {"$exists": True}
            }
        }
    }, {"_id": 0}).to_list(length=None)
    
    # Filter to only show requests at user's approval level
    pending = []
    for req in requests:
        current_level = req.get("current_level", 1)
        user_levels = [a.get("level") for a in req.get("approvers", []) if a.get("user_id") == user_id]
        if current_level in user_levels:
            pending.append(req)
    
    return pending


@router.get("/my-requests")
async def get_my_requests(
    status: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get requests created by current user"""
    user_data = await verify_token(authorization)
    user_id = user_data.get("user_id")
    
    query = {"requester_id": user_id}
    if status:
        query["status"] = status
    
    requests = await db.approval_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=None)
    
    return requests


@router.get("/{request_id}")
async def get_approval_request(
    request_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get single approval request"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    request = await db.approval_requests.find_one(
        {"id": request_id, "company_id": company_id},
        {"_id": 0}
    )
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return request


@router.post("/{request_id}/approve")
async def approve_request(
    request_id: str,
    approval_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Approve a request"""
    user_data = await verify_token(authorization)
    user_id = user_data.get("user_id")
    company_id = user_data.get("company_id")
    
    request = await db.approval_requests.find_one(
        {"id": request_id, "company_id": company_id}
    )
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    # Check if user is an approver at current level
    current_level = request.get("current_level", 1)
    user_levels = [a.get("level") for a in request.get("approvers", []) if a.get("user_id") == user_id]
    
    if current_level not in user_levels:
        raise HTTPException(status_code=403, detail="Not authorized to approve at this level")
    
    # Add to approval history
    approval_entry = {
        "action": "approved",
        "level": current_level,
        "user_id": user_id,
        "user_name": user_data.get("full_name"),
        "comments": approval_data.get("comments", ""),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Check if this is the final level
    total_levels = request.get("total_levels", 1)
    
    if current_level >= total_levels:
        # Final approval
        update_data["status"] = "approved"
        update_data["approved_at"] = datetime.now(timezone.utc).isoformat()
        
        # Execute post-approval action
        await execute_approval_action(request)
    else:
        # Move to next level
        update_data["current_level"] = current_level + 1
        
        # Notify next level approvers
        next_level_approvers = [a for a in request.get("approvers", []) if a.get("level") == current_level + 1]
        for approver in next_level_approvers:
            await create_approval_notification(
                request_id,
                approver.get("user_id"),
                company_id,
                "level_approved"
            )
    
    await db.approval_requests.update_one(
        {"id": request_id},
        {
            "$set": update_data,
            "$push": {"approval_history": approval_entry}
        }
    )
    
    # Notify requester
    await create_approval_notification(
        request_id,
        request.get("requester_id"),
        company_id,
        "approved" if update_data.get("status") == "approved" else "level_approved"
    )
    
    return {"success": True, "status": update_data.get("status", "pending")}


@router.post("/{request_id}/reject")
async def reject_request(
    request_id: str,
    rejection_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Reject a request"""
    user_data = await verify_token(authorization)
    user_id = user_data.get("user_id")
    company_id = user_data.get("company_id")
    
    request = await db.approval_requests.find_one(
        {"id": request_id, "company_id": company_id}
    )
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    # Check if user is an approver
    current_level = request.get("current_level", 1)
    user_levels = [a.get("level") for a in request.get("approvers", []) if a.get("user_id") == user_id]
    
    if current_level not in user_levels:
        raise HTTPException(status_code=403, detail="Not authorized to reject")
    
    rejection_entry = {
        "action": "rejected",
        "level": current_level,
        "user_id": user_id,
        "user_name": user_data.get("full_name"),
        "reason": rejection_data.get("reason", ""),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.approval_requests.update_one(
        {"id": request_id},
        {
            "$set": {
                "status": "rejected",
                "rejected_at": datetime.now(timezone.utc).isoformat(),
                "rejection_reason": rejection_data.get("reason", ""),
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"approval_history": rejection_entry}
        }
    )
    
    # Notify requester
    await create_approval_notification(
        request_id,
        request.get("requester_id"),
        company_id,
        "rejected"
    )
    
    return {"success": True, "status": "rejected"}


@router.post("/{request_id}/cancel")
async def cancel_request(
    request_id: str,
    authorization: Optional[str] = Header(None)
):
    """Cancel own request"""
    user_data = await verify_token(authorization)
    user_id = user_data.get("user_id")
    
    request = await db.approval_requests.find_one({"id": request_id})
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request.get("requester_id") != user_id:
        raise HTTPException(status_code=403, detail="Can only cancel your own requests")
    
    if request.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending requests")
    
    await db.approval_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True}


# ============ WORKFLOW CONFIGURATION ============

@router.get("/workflows")
async def get_workflows(authorization: Optional[str] = Header(None)):
    """Get all approval workflows"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    workflows = await db.approval_workflows.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(length=None)
    
    # Add default types that don't have custom workflows
    existing_types = [w.get("type") for w in workflows]
    for type_key, type_config in APPROVAL_TYPES.items():
        if type_key not in existing_types:
            workflows.append({
                "type": type_key,
                "name_en": type_config["name_en"],
                "name_ar": type_config["name_ar"],
                "is_default": True,
                "default_approvers": type_config["default_approvers"]
            })
    
    return workflows


@router.post("/workflows")
async def create_workflow(
    workflow_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Create or update approval workflow"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    approval_type = workflow_data.get("type")
    
    if approval_type not in APPROVAL_TYPES:
        raise HTTPException(status_code=400, detail="Invalid approval type")
    
    workflow = {
        "company_id": company_id,
        "type": approval_type,
        "name_en": APPROVAL_TYPES[approval_type]["name_en"],
        "name_ar": APPROVAL_TYPES[approval_type]["name_ar"],
        "approvers": workflow_data.get("approvers", []),
        "levels": workflow_data.get("levels", 1),
        "auto_approve_below": workflow_data.get("auto_approve_below"),  # Auto-approve if amount below this
        "escalation_days": workflow_data.get("escalation_days", 3),
        "is_active": True,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.approval_workflows.update_one(
        {"company_id": company_id, "type": approval_type},
        {"$set": workflow},
        upsert=True
    )
    
    return {"success": True}


# ============ STATISTICS ============

@router.get("/stats")
async def get_approval_stats(authorization: Optional[str] = Header(None)):
    """Get approval statistics"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    user_id = user_data.get("user_id")
    
    all_requests = await db.approval_requests.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(length=None)
    
    # My pending approvals
    my_pending = 0
    for req in all_requests:
        if req.get("status") == "pending":
            current_level = req.get("current_level", 1)
            user_levels = [a.get("level") for a in req.get("approvers", []) if a.get("user_id") == user_id]
            if current_level in user_levels:
                my_pending += 1
    
    # By status
    by_status = {}
    for req in all_requests:
        status = req.get("status", "unknown")
        if status not in by_status:
            by_status[status] = 0
        by_status[status] += 1
    
    # By type
    by_type = {}
    for req in all_requests:
        req_type = req.get("type", "unknown")
        if req_type not in by_type:
            by_type[req_type] = 0
        by_type[req_type] += 1
    
    # Average approval time
    approved_requests = [r for r in all_requests if r.get("status") == "approved" and r.get("approved_at")]
    avg_time = 0
    if approved_requests:
        total_hours = 0
        for req in approved_requests:
            created = datetime.fromisoformat(req.get("created_at").replace('Z', '+00:00'))
            approved = datetime.fromisoformat(req.get("approved_at").replace('Z', '+00:00'))
            total_hours += (approved - created).total_seconds() / 3600
        avg_time = round(total_hours / len(approved_requests), 1)
    
    return {
        "my_pending": my_pending,
        "total_requests": len(all_requests),
        "by_status": by_status,
        "by_type": by_type,
        "average_approval_hours": avg_time
    }


# ============ HELPER FUNCTIONS ============

async def create_approval_notification(request_id: str, user_id: str, company_id: str, action: str):
    """Create notification for approval action"""
    messages = {
        "new_request": {
            "en": "New approval request pending your review",
            "ar": "طلب موافقة جديد بانتظار مراجعتك"
        },
        "level_approved": {
            "en": "Approval request has been approved at current level",
            "ar": "تمت الموافقة على الطلب في المستوى الحالي"
        },
        "approved": {
            "en": "Your request has been fully approved",
            "ar": "تمت الموافقة على طلبك بالكامل"
        },
        "rejected": {
            "en": "Your request has been rejected",
            "ar": "تم رفض طلبك"
        }
    }
    
    notification = {
        "id": f"notif_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
        "type": "approval",
        "title_en": "Approval Update",
        "title_ar": "تحديث الموافقة",
        "message_en": messages.get(action, {}).get("en", ""),
        "message_ar": messages.get(action, {}).get("ar", ""),
        "icon": "clipboard-check" if action in ["approved", "level_approved"] else "clipboard-x" if action == "rejected" else "clipboard",
        "color": "green" if action in ["approved", "level_approved"] else "red" if action == "rejected" else "blue",
        "user_id": user_id,
        "company_id": company_id,
        "data": {"request_id": request_id, "action": action},
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.notifications.insert_one(notification)


async def execute_approval_action(request: dict):
    """Execute action after final approval"""
    ref_type = request.get("reference_type")
    ref_id = request.get("reference_id")
    
    if not ref_type or not ref_id:
        return
    
    if ref_type == "leave":
        await db.leaves.update_one(
            {"id": ref_id},
            {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
        )
    elif ref_type == "purchase_order":
        await db.purchase_orders.update_one(
            {"po_number": ref_id},
            {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
        )
    elif ref_type == "invoice":
        await db.invoices.update_one(
            {"invoice_number": ref_id},
            {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
        )
