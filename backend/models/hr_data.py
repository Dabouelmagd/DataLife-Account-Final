from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import uuid

# Employee Model
class Employee(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    name: str
    position: str
    department: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    hire_date: str
    basic_salary: float
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# Allowance Model
class Allowance(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    employee_id: str
    employee_name: str
    type: str  # Transport, Housing, Meal, etc.
    amount: float
    month: str
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# Deduction Model
class Deduction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    employee_id: str
    employee_name: str
    type: str  # Insurance, Tax, Absence, etc.
    amount: float
    month: str
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# Leave Model
class Leave(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    employee_id: str
    employee_name: str
    leave_type: str  # casual, annual
    start_date: str
    end_date: Optional[str] = None
    days: int
    reason: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# Attendance Model
class Attendance(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    employee_id: str
    employee_name: str
    date: str
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    status: str  # present, absent, late
    hours: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
