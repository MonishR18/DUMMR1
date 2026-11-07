from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any
from datetime import datetime
from schemas.user import UserResponse

class CategoryBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    is_active: bool = True

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None

class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class ServiceMediaBase(BaseModel):
    media_type: str #image , video 
    url: str
    thumbnail_url: Optional[str] = None
    sort_order: int = 0

class ServiceMediaCreate(ServiceMediaBase):
    pass

class ServiceMediaResponse(ServiceMediaBase):
    id: int
    service_id: int 
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ServicePackageBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float = Field(ge=0.0)
    delivery_days: int = Field(gt=0)
    revisions: int = Field(ge=0, default=0)
    features: Optional[str] = None # JSON string or plain text

class ServicePackageCreate(ServicePackageBase):
    pass

class ServicePackageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = Field(ge=0.0, default=None)
    delivery_days: Optional[int] = Field(gt=0, default=None)
    revisions: Optional[int] = Field(ge=0, default=None)
    features: Optional[str] = None

class ServicePackageResponse(ServicePackageBase):
    id: int
    service_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class ServiceBase(BaseModel):
    title: str
    slug: str
    description: str
    category_id: int

class ServiceCreate(ServiceBase):
    pass

class ServiceUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    status: Optional[str] = None

class ServiceResponse(ServiceBase):
    id: int
    seller_id: int
    status: str
    rating: float
    review_count: int
    order_count: int
    view_count: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    category: Optional[CategoryResponse] = None
    seller: Optional[UserResponse] = None
    media: List[ServiceMediaResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

class ServiceReviewItem(BaseModel):
    id: int
    rating: int
    comment: Optional[str] = None
    reviewer_id: int
    created_at: datetime
    reviewer: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)

class ServiceDetailResponse(ServiceResponse):
    packages: List[ServicePackageResponse] = []
    reviews: List[ServiceReviewItem] = []

class PaginatedServiceResponse(BaseModel):
    data: List[ServiceResponse]
    pagination: Any
