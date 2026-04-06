from fastapi import APIRouter, HTTPException, Depends, Header, Query
from models.hr_data import Employee, Allowance, Deduction, Leave, Attendance
from services.auth_service import verify_token
from typing import Optional, List
from database import get_database

router = APIRouter(prefix="/api/hr", tags=["hr"])
db = get_database()

# Default pagination settings
DEFAULT_PAGE_SIZE = 100
MAX_PAGE_SIZE = 1000

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

# Employees Endpoints
@router.get("/employees")
async def get_employees(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, description="Items per page")
):
    """Get employees for the user's company with pagination"""
    company_id = current_user.get("company_id")
    skip = (page - 1) * limit
    
    # Get total count for pagination info
    total = await db.employees.count_documents({"company_id": company_id})
    
    # Query with projection (exclude sensitive fields) and pagination
    employees = await db.employees.find(
        {"company_id": company_id},
        {"_id": 0}  # Exclude MongoDB _id
    ).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "data": employees,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }

@router.post("/employees")
async def create_employee(employee: Employee, current_user: dict = Depends(get_current_user)):
    """Create new employee"""
    # Check permissions
    allowed_roles = ["General Manager", "CEO", "Board Chairman", "HR Manager", 
                     "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة", "مدير الموارد البشرية"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    employee.company_id = current_user.get("company_id")
    await db.employees.insert_one(employee.dict())
    return {"message": "Employee created successfully", "id": employee.id}

# Allowances Endpoints
@router.get("/allowances")
async def get_allowances(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
):
    """Get allowances for the user's company with pagination"""
    company_id = current_user.get("company_id")
    skip = (page - 1) * limit
    
    total = await db.allowances.count_documents({"company_id": company_id})
    allowances = await db.allowances.find(
        {"company_id": company_id},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "data": allowances,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }

@router.post("/allowances")
async def create_allowance(allowance: Allowance, current_user: dict = Depends(get_current_user)):
    """Create new allowance"""
    allowed_roles = ["General Manager", "CEO", "Board Chairman", "HR Manager", "Financial Manager",
                     "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة", "مدير الموارد البشرية", "المدير المالي"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    allowance.company_id = current_user.get("company_id")
    await db.allowances.insert_one(allowance.dict())
    return {"message": "Allowance created successfully", "id": allowance.id}

# Deductions Endpoints
@router.get("/deductions")
async def get_deductions(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
):
    """Get deductions for the user's company with pagination"""
    company_id = current_user.get("company_id")
    skip = (page - 1) * limit
    
    total = await db.deductions.count_documents({"company_id": company_id})
    deductions = await db.deductions.find(
        {"company_id": company_id},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "data": deductions,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }

@router.post("/deductions")
async def create_deduction(deduction: Deduction, current_user: dict = Depends(get_current_user)):
    """Create new deduction"""
    allowed_roles = ["General Manager", "CEO", "Board Chairman", "HR Manager", "Financial Manager",
                     "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة", "مدير الموارد البشرية", "المدير المالي"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    deduction.company_id = current_user.get("company_id")
    await db.deductions.insert_one(deduction.dict())
    return {"message": "Deduction created successfully", "id": deduction.id}

# Leaves Endpoints
@router.get("/leaves")
async def get_leaves(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
):
    """Get leaves for the user's company with pagination"""
    company_id = current_user.get("company_id")
    skip = (page - 1) * limit
    
    total = await db.leaves.count_documents({"company_id": company_id})
    leaves = await db.leaves.find(
        {"company_id": company_id},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "data": leaves,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }

@router.post("/leaves")
async def create_leave(leave: Leave, current_user: dict = Depends(get_current_user)):
    """Create new leave"""
    leave.company_id = current_user.get("company_id")
    await db.leaves.insert_one(leave.dict())
    return {"message": "Leave created successfully", "id": leave.id}

# Attendance Endpoints
@router.get("/attendance")
async def get_attendance(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
):
    """Get attendance records for the user's company with pagination"""
    company_id = current_user.get("company_id")
    skip = (page - 1) * limit
    
    total = await db.attendance.count_documents({"company_id": company_id})
    attendance = await db.attendance.find(
        {"company_id": company_id},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "data": attendance,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }

@router.post("/attendance")
async def create_attendance(attendance: Attendance, current_user: dict = Depends(get_current_user)):
    """Create new attendance record"""
    allowed_roles = ["General Manager", "CEO", "Board Chairman", "HR Manager",
                     "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة", "مدير الموارد البشرية"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    attendance.company_id = current_user.get("company_id")
    await db.attendance.insert_one(attendance.dict())
    return {"message": "Attendance recorded successfully", "id": attendance.id}
