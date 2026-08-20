from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
import os
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import secrets
import string

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


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


def generate_id(prefix=""):
    """Generate unique ID"""
    random_part = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    return f"{prefix}{random_part}"


# ============ PROJECTS ============

@router.post("/projects")
async def create_project(
    project_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Create a new project"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    project = {
        "id": generate_id("proj_"),
        "company_id": company_id,
        "name": project_data.get("name"),
        "description": project_data.get("description", ""),
        "status": "planning",  # planning, in_progress, on_hold, completed, cancelled
        "priority": project_data.get("priority", "medium"),  # low, medium, high, urgent
        "start_date": project_data.get("start_date"),
        "end_date": project_data.get("end_date"),
        "budget": project_data.get("budget", 0),
        "manager_id": project_data.get("manager_id"),
        "team_members": project_data.get("team_members", []),
        "tags": project_data.get("tags", []),
        "progress": 0,
        "tasks_count": 0,
        "completed_tasks": 0,
        "created_by": user_data.get("user_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.projects.insert_one(project)
    if "_id" in project:
        del project["_id"]
    
    return project


@router.get("/projects")
async def get_projects(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get all projects"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    query = {"company_id": company_id}
    if status:
        query["status"] = status
    if priority:
        query["priority"] = priority
    
    projects = await db.projects.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=None)
    
    return projects


@router.get("/projects/{project_id}")
async def get_project(
    project_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get single project with tasks"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    project = await db.projects.find_one(
        {"id": project_id, "company_id": company_id},
        {"_id": 0}
    )
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get project tasks
    tasks = await db.tasks.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=None)
    
    project["tasks"] = tasks
    
    return project


@router.put("/projects/{project_id}")
async def update_project(
    project_id: str,
    update_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update project"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    allowed_fields = ["name", "description", "status", "priority", "start_date", 
                      "end_date", "budget", "manager_id", "team_members", "tags"]
    
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.projects.update_one(
        {"id": project_id, "company_id": company_id},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"success": True}


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete project and its tasks"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    # Delete all tasks in project
    await db.tasks.delete_many({"project_id": project_id})
    
    # Delete project
    result = await db.projects.delete_one({"id": project_id, "company_id": company_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"success": True}


# ============ TASKS ============

@router.post("/")
async def create_task(
    task_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Create a new task"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    task = {
        "id": generate_id("task_"),
        "company_id": company_id,
        "project_id": task_data.get("project_id"),
        "title": task_data.get("title"),
        "description": task_data.get("description", ""),
        "status": "todo",  # todo, in_progress, review, completed, cancelled
        "priority": task_data.get("priority", "medium"),
        "assigned_to": task_data.get("assigned_to"),
        "due_date": task_data.get("due_date"),
        "estimated_hours": task_data.get("estimated_hours", 0),
        "actual_hours": 0,
        "tags": task_data.get("tags", []),
        "checklist": task_data.get("checklist", []),
        "attachments": [],
        "comments": [],
        "created_by": user_data.get("user_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tasks.insert_one(task)
    if "_id" in task:
        del task["_id"]
    
    # Update project task count
    if task.get("project_id"):
        await db.projects.update_one(
            {"id": task.get("project_id")},
            {"$inc": {"tasks_count": 1}}
        )
    
    return task


@router.get("/")
async def get_tasks(
    project_id: Optional[str] = None,
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    priority: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get all tasks with filters"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    query = {"company_id": company_id}
    if project_id:
        query["project_id"] = project_id
    if status:
        query["status"] = status
    if assigned_to:
        query["assigned_to"] = assigned_to
    if priority:
        query["priority"] = priority
    
    tasks = await db.tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=None)
    
    return tasks


@router.get("/my-tasks")
async def get_my_tasks(authorization: Optional[str] = Header(None)):
    """Get tasks assigned to current user"""
    user_data = await verify_token_from_header(authorization)
    user_id = user_data.get("user_id")
    
    tasks = await db.tasks.find(
        {"assigned_to": user_id, "status": {"$ne": "completed"}},
        {"_id": 0}
    ).sort("due_date", 1).to_list(length=None)
    
    return tasks


@router.get("/{task_id}")
async def get_task(
    task_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get single task"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    task = await db.tasks.find_one(
        {"id": task_id, "company_id": company_id},
        {"_id": 0}
    )
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task


@router.put("/{task_id}")
async def update_task(
    task_id: str,
    update_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update task"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    # Get current task
    task = await db.tasks.find_one({"id": task_id, "company_id": company_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    old_status = task.get("status")
    new_status = update_data.get("status", old_status)
    
    allowed_fields = ["title", "description", "status", "priority", "assigned_to",
                      "due_date", "estimated_hours", "actual_hours", "tags", "checklist"]
    
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if new_status == "completed" and old_status != "completed":
        update_fields["completed_at"] = datetime.now(timezone.utc).isoformat()
        # Update project progress
        if task.get("project_id"):
            await db.projects.update_one(
                {"id": task.get("project_id")},
                {"$inc": {"completed_tasks": 1}}
            )
            await update_project_progress(task.get("project_id"))
    
    elif old_status == "completed" and new_status != "completed":
        update_fields["completed_at"] = None
        # Update project progress
        if task.get("project_id"):
            await db.projects.update_one(
                {"id": task.get("project_id")},
                {"$inc": {"completed_tasks": -1}}
            )
            await update_project_progress(task.get("project_id"))
    
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": update_fields}
    )
    
    return {"success": True}


async def update_project_progress(project_id: str):
    """Update project progress percentage"""
    project = await db.projects.find_one({"id": project_id})
    if project:
        total = project.get("tasks_count", 0)
        completed = project.get("completed_tasks", 0)
        progress = round((completed / total * 100), 1) if total > 0 else 0
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {"progress": progress}}
        )


@router.delete("/{task_id}")
async def delete_task(
    task_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete task"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    task = await db.tasks.find_one({"id": task_id, "company_id": company_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update project counts
    if task.get("project_id"):
        dec_fields = {"tasks_count": -1}
        if task.get("status") == "completed":
            dec_fields["completed_tasks"] = -1
        await db.projects.update_one(
            {"id": task.get("project_id")},
            {"$inc": dec_fields}
        )
        await update_project_progress(task.get("project_id"))
    
    await db.tasks.delete_one({"id": task_id})
    
    return {"success": True}


@router.post("/{task_id}/comments")
async def add_task_comment(
    task_id: str,
    comment_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Add comment to task"""
    user_data = await verify_token_from_header(authorization)
    user_id = user_data.get("user_id")
    
    # Fetch user's full name from database
    user_name = "Unknown"
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "full_name": 1})
    if user:
        user_name = user.get("full_name", "Unknown")
    
    comment = {
        "id": generate_id("comment_"),
        "text": comment_data.get("text"),
        "user_id": user_id,
        "user_name": user_name,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.tasks.update_one(
        {"id": task_id},
        {"$push": {"comments": comment}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return comment


@router.put("/{task_id}/checklist/{item_index}")
async def update_checklist_item(
    task_id: str,
    item_index: int,
    item_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update checklist item"""
    await verify_token_from_header(authorization)
    
    update_field = f"checklist.{item_index}.completed"
    
    result = await db.tasks.update_one(
        {"id": task_id},
        {"$set": {update_field: item_data.get("completed", False)}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"success": True}


@router.get("/dashboard/stats")
async def get_task_stats(authorization: Optional[str] = Header(None)):
    """Get task statistics for dashboard"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    user_id = user_data.get("user_id")
    
    # All tasks
    all_tasks = await db.tasks.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(length=None)
    
    # My tasks
    my_tasks = [t for t in all_tasks if t.get("assigned_to") == user_id]
    
    # Calculate stats
    def get_status_counts(tasks):
        counts = {"todo": 0, "in_progress": 0, "review": 0, "completed": 0}
        for t in tasks:
            status = t.get("status", "todo")
            if status in counts:
                counts[status] += 1
        return counts
    
    # Overdue tasks
    today = datetime.now(timezone.utc).date().isoformat()
    overdue = [t for t in all_tasks if t.get("due_date") and t.get("due_date") < today and t.get("status") != "completed"]
    
    # Due this week
    week_end = (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat()
    due_this_week = [t for t in all_tasks if t.get("due_date") and today <= t.get("due_date") <= week_end and t.get("status") != "completed"]
    
    return {
        "total_tasks": len(all_tasks),
        "my_tasks": len(my_tasks),
        "overdue": len(overdue),
        "due_this_week": len(due_this_week),
        "by_status": get_status_counts(all_tasks),
        "my_tasks_by_status": get_status_counts(my_tasks)
    }


# ============ TASK NOTIFICATIONS ============

@router.get("/stats")
async def get_task_stats_alias(authorization: Optional[str] = Header(None)):
    """Alias for /dashboard/stats — frontend compatibility"""
    return await get_task_stats(authorization)


@router.get("/projects/{project_id}/export")
async def export_project(
    project_id: str,
    authorization: Optional[str] = Header(None)
):
    """Export full project data: info + tasks + financials + expenses + revenues"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")

    project = await db.projects.find_one({"id": project_id, "company_id": company_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tasks = await db.tasks.find({"project_id": project_id, "company_id": company_id}, {"_id": 0}).to_list(None)
    
    # Financial entries linked to project
    financials = await db.journal_entries.find(
        {"company_id": company_id, "project_id": project_id}, {"_id": 0}
    ).to_list(None)
    
    # Expenses
    expenses = await db.project_expenses.find(
        {"project_id": project_id, "company_id": company_id}, {"_id": 0}
    ).to_list(None)
    
    # Revenues / progress claims
    revenues = await db.project_revenues.find(
        {"project_id": project_id, "company_id": company_id}, {"_id": 0}
    ).to_list(None)

    # Progress claims (مستخلصات)
    claims = await db.project_claims.find(
        {"project_id": project_id, "company_id": company_id}, {"_id": 0}
    ).to_list(None)

    # Summary calculations
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    total_revenues = sum(r.get("amount", 0) for r in revenues)
    total_claims   = sum(c.get("amount", 0) for c in claims)
    task_stats = {
        "total": len(tasks),
        "completed": sum(1 for t in tasks if t.get("status") == "completed"),
        "in_progress": sum(1 for t in tasks if t.get("status") == "in_progress"),
        "overdue": sum(1 for t in tasks if t.get("due_date") and t.get("due_date") < datetime.now(timezone.utc).date().isoformat() and t.get("status") != "completed"),
    }

    return {
        "project":       project,
        "tasks":         tasks,
        "task_stats":    task_stats,
        "financials":    financials,
        "expenses":      expenses,
        "revenues":      revenues,
        "claims":        claims,
        "summary": {
            "total_expenses": total_expenses,
            "total_revenues": total_revenues,
            "total_claims":   total_claims,
            "net_profit":     total_revenues - total_expenses,
            "budget":         project.get("budget", 0),
            "budget_used_pct": round((total_expenses / project.get("budget", 1)) * 100, 1) if project.get("budget") else 0,
        },
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/notifications/due-soon")
async def get_due_soon_tasks(authorization: Optional[str] = Header(None)):
    """Get tasks due soon (within 3 days) for notifications"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    user_id = user_data.get("user_id")
    
    today = datetime.now(timezone.utc).date()
    three_days = (today + timedelta(days=3)).isoformat()
    today_str = today.isoformat()
    
    # Find tasks assigned to user that are due soon
    tasks = await db.tasks.find({
        "company_id": company_id,
        "assigned_to": user_id,
        "status": {"$nin": ["completed", "cancelled"]},
        "due_date": {"$lte": three_days, "$gte": today_str}
    }, {"_id": 0}).to_list(length=None)
    
    # Categorize by urgency
    due_today = []
    due_tomorrow = []
    due_soon = []
    
    tomorrow = (today + timedelta(days=1)).isoformat()
    day_after = (today + timedelta(days=2)).isoformat()
    
    for task in tasks:
        due = task.get("due_date")
        if due == today_str:
            due_today.append(task)
        elif due == tomorrow:
            due_tomorrow.append(task)
        else:
            due_soon.append(task)
    
    return {
        "due_today": due_today,
        "due_tomorrow": due_tomorrow,
        "due_within_3_days": due_soon,
        "total_urgent": len(due_today) + len(due_tomorrow) + len(due_soon)
    }


@router.get("/notifications/overdue")
async def get_overdue_tasks(authorization: Optional[str] = Header(None)):
    """Get overdue tasks for notifications"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    user_id = user_data.get("user_id")
    
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Find overdue tasks assigned to user
    tasks = await db.tasks.find({
        "company_id": company_id,
        "assigned_to": user_id,
        "status": {"$nin": ["completed", "cancelled"]},
        "due_date": {"$lt": today}
    }, {"_id": 0}).sort("due_date", 1).to_list(length=None)
    
    return {
        "overdue_tasks": tasks,
        "total_overdue": len(tasks)
    }


@router.post("/notifications/check-and-send")
async def check_and_send_task_notifications(authorization: Optional[str] = Header(None)):
    """Check for tasks due soon and create notifications"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    today = datetime.now(timezone.utc).date()
    today_str = today.isoformat()
    tomorrow_str = (today + timedelta(days=1)).isoformat()
    
    # Find all tasks due today or tomorrow
    tasks = await db.tasks.find({
        "company_id": company_id,
        "status": {"$nin": ["completed", "cancelled"]},
        "due_date": {"$in": [today_str, tomorrow_str]},
        "assigned_to": {"$ne": None}
    }, {"_id": 0}).to_list(length=None)
    
    notifications_created = 0
    
    for task in tasks:
        assigned_to = task.get("assigned_to")
        due_date = task.get("due_date")
        
        # Check if notification already sent today for this task
        existing = await db.notifications.find_one({
            "data.task_id": task.get("id"),
            "created_at": {"$gte": today_str}
        })
        
        if existing:
            continue
        
        # Determine notification type
        if due_date == today_str:
            title_en = "Task Due Today"
            title_ar = "مهمة مستحقة اليوم"
            message_en = f"Task '{task.get('title')}' is due today"
            message_ar = f"المهمة '{task.get('title')}' مستحقة اليوم"
            color = "red"
        else:
            title_en = "Task Due Tomorrow"
            title_ar = "مهمة مستحقة غداً"
            message_en = f"Task '{task.get('title')}' is due tomorrow"
            message_ar = f"المهمة '{task.get('title')}' مستحقة غداً"
            color = "amber"
        
        # Create notification
        notification = {
            "id": f"notif_{datetime.now().strftime('%Y%m%d%H%M%S%f')}_{task.get('id')[:8]}",
            "type": "task_due",
            "title_en": title_en,
            "title_ar": title_ar,
            "message_en": message_en,
            "message_ar": message_ar,
            "icon": "clock",
            "color": color,
            "user_id": assigned_to,
            "company_id": company_id,
            "broadcast": False,
            "data": {
                "task_id": task.get("id"),
                "task_title": task.get("title"),
                "due_date": due_date,
                "project_id": task.get("project_id")
            },
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "system"
        }
        
        await db.notifications.insert_one(notification)
        notifications_created += 1
    
    return {
        "success": True,
        "notifications_created": notifications_created,
        "tasks_checked": len(tasks)
    }


# Background task function to be called by scheduler
async def check_task_due_dates():
    """Background function to check all companies for due tasks"""
    today = datetime.now(timezone.utc).date()
    today_str = today.isoformat()
    tomorrow_str = (today + timedelta(days=1)).isoformat()
    
    # Find all tasks due today or tomorrow across all companies
    tasks = await db.tasks.find({
        "status": {"$nin": ["completed", "cancelled"]},
        "due_date": {"$in": [today_str, tomorrow_str]},
        "assigned_to": {"$ne": None}
    }).to_list(length=None)
    
    for task in tasks:
        assigned_to = task.get("assigned_to")
        company_id = task.get("company_id")
        due_date = task.get("due_date")
        
        # Check if notification already sent
        existing = await db.notifications.find_one({
            "data.task_id": task.get("id"),
            "type": "task_due",
            "created_at": {"$gte": today_str}
        })
        
        if existing:
            continue
        
        # Create notification
        if due_date == today_str:
            title_en, title_ar = "Task Due Today", "مهمة مستحقة اليوم"
            color = "red"
        else:
            title_en, title_ar = "Task Due Tomorrow", "مهمة مستحقة غداً"
            color = "amber"
        
        notification = {
            "id": f"notif_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
            "type": "task_due",
            "title_en": title_en,
            "title_ar": title_ar,
            "message_en": f"Task '{task.get('title')}' is due {'today' if due_date == today_str else 'tomorrow'}",
            "message_ar": f"المهمة '{task.get('title')}' مستحقة {'اليوم' if due_date == today_str else 'غداً'}",
            "icon": "clock",
            "color": color,
            "user_id": assigned_to,
            "company_id": company_id,
            "broadcast": False,
            "data": {"task_id": task.get("id"), "due_date": due_date},
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "system"
        }
        
        await db.notifications.insert_one(notification)

