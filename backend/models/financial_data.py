from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid

# Journal Entry Model
class JournalEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    date: str
    description: str
    account: str
    debit: float = 0.0
    credit: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# Treasury Transaction Model
class TreasuryTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    date: str
    description: str
    type: str  # in (deposit), out (withdrawal)
    amount: float
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# Bank Transaction Model
class BankTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    date: str
    description: str
    bank_name: str
    type: str  # deposit, withdrawal, transfer
    amount: float
    balance: float
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# Customer Model
class Customer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    name: str
    email: Optional[str] = None
    phone: str
    address: Optional[str] = None
    balance: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# Supplier Model
class Supplier(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    name: str
    email: Optional[str] = None
    phone: str
    address: Optional[str] = None
    balance: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
