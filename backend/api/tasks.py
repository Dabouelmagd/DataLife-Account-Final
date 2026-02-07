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
    
    comment = {
        "id": generate_id("comment_"),
        "text": comment_data.get("text"),
        "user_id": user_data.get("user_id"),
        "user_name": user_data.get("full_name", "Unknown"),
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
