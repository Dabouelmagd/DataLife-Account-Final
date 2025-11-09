from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
import uuid


class InventoryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    name: str
    category: str  # 'Raw Materials', 'Finished Products', 'Spare Parts', 'Supplies'
    quantity: float
    unit: str  # 'kg', 'pcs', 'ltr', 'm'
    unit_price: float
    total_value: float
    min_stock: float
    status: Literal['in-stock', 'low-stock']
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class InventoryItemCreate(BaseModel):
    name: str
    category: str
    quantity: float
    unit: str
    unit_price: float
    min_stock: float


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    min_stock: Optional[float] = None


class InventoryItemResponse(BaseModel):
    id: str
    name: str
    category: str
    quantity: float
    unit: str
    unit_price: float
    total_value: float
    min_stock: float
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
