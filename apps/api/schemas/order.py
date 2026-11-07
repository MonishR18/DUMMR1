from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any
from datetime import datetime
from schemas.user import UserResponse
from schemas.service import ServiceResponse, ServicePackageResponse

class OrderBase(BaseModel):
    requirements: Optional[str] = None

class OrderCreate(OrderBase):
    service_id: int
    package_id: int

class OrderUpdate(BaseModel):
    status: Optional[str] = None
    delivery_message: Optional[str] = None
    delivery_files: Optional[str] = None
    delivery_timestamp: Optional[datetime] = None

class OrderAction(BaseModel):
    message: Optional[str] = None
    delivery_message: Optional[str] = None
    delivery_files: Optional[List[str]] = None
    delivery_timestamp: Optional[datetime] = None

class OrderResponse(OrderBase):
    id: int
    buyer_id: int
    seller_id: int
    service_id: int
    package_id: int
    amount: float
    status: str
    delivery_date: Optional[datetime] = None
    delivery_message: Optional[str] = None
    delivery_files: Optional[str] = None
    delivery_timestamp: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    buyer: Optional[UserResponse] = None
    seller: Optional[UserResponse] = None
    service: Optional[ServiceResponse] = None
    package: Optional[ServicePackageResponse] = None
    
    model_config = ConfigDict(from_attributes=True)

class ReviewBase(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None

class ReviewCreate(ReviewBase):
    pass

class ReviewResponse(ReviewBase):
    id: int
    order_id: int
    service_id: int
    reviewer_id: int
    seller_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    reviewer: Optional[UserResponse] = None
    
    model_config = ConfigDict(from_attributes=True)
