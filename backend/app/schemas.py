from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

class OrderStatusSchema(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class OrderItemBase(BaseModel):
    name: str = Field(..., min_length=1, description="Name of the catalog item")
    price: float = Field(..., ge=0, description="Price per unit of the item")
    quantity: int = Field(..., gt=0, description="Quantity being purchased")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Item name cannot consist solely of whitespace.")
        return v.strip()


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemResponse(OrderItemBase):
    id: int

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    customer_name: str = Field(..., min_length=1, description="Name of ordering customer")
    items: List[OrderItemCreate] = Field(..., min_items=1, description="List of items in the order")

    @field_validator("customer_name")
    @classmethod
    def validate_customer_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Customer name cannot be empty or only whitespace.")
        return v.strip()


class OrderResponse(BaseModel):
    id: str
    customer_name: str
    status: OrderStatusSchema
    total_amount: float
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemResponse]

    class Config:
        from_attributes = True
