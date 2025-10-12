from fastapi import APIRouter, HTTPException, Depends, Header
from models.hr_data import Employee, Allowance, Deduction, Leave, Attendance
from services.auth_service import verify_token
from typing import Optional, List
from database import get_database

router = APIRouter(prefix="/api/hr", tags=["hr"])
db = get_database()

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
@router.get("/employees", response_model=List[Employee])
async def get_employees(current_user: dict = Depends(get_current_user)):
    """Get all employees for the user's company"""
    company_id = current_user.get("company_id")
    employees = await db.employees.find({"company_id": company_id}).to_list(length=None)
    return [Employee(**emp) for emp in employees]

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
@router.get("/allowances", response_model=List[Allowance])
async def get_allowances(current_user: dict = Depends(get_current_user)):
    """Get all allowances for the user's company"""
    company_id = current_user.get("company_id")
    allowances = await db.allowances.find({"company_id": company_id}).to_list(length=None)
    return [Allowance(**a) for a in allowances]

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
@router.get("/deductions", response_model=List[Deduction])
async def get_deductions(current_user: dict = Depends(get_current_user)):
    """Get all deductions for the user's company"""
    company_id = current_user.get("company_id")
    deductions = await db.deductions.find({"company_id": company_id}).to_list(length=None)
    return [Deduction(**d) for d in deductions]

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
@router.get("/leaves", response_model=List[Leave])
async def get_leaves(current_user: dict = Depends(get_current_user)):
    """Get all leaves for the user's company"""
    company_id = current_user.get("company_id")
    leaves = await db.leaves.find({"company_id": company_id}).to_list(length=None)
    return [Leave(**l) for l in leaves]

@router.post("/leaves")
async def create_leave(leave: Leave, current_user: dict = Depends(get_current_user)):
    """Create new leave"""
    leave.company_id = current_user.get("company_id")
    await db.leaves.insert_one(leave.dict())
    return {"message": "Leave created successfully", "id": leave.id}

# Attendance Endpoints
@router.get("/attendance", response_model=List[Attendance])
async def get_attendance(current_user: dict = Depends(get_current_user)):
    """Get all attendance records for the user's company"""
    company_id = current_user.get("company_id")
    attendance = await db.attendance.find({"company_id": company_id}).to_list(length=None)
    return [Attendance(**a) for a in attendance]

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
