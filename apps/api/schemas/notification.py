from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class NotificationBase(BaseModel):
    type: str
    title: str
    message: str
    is_read: bool = False

class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
