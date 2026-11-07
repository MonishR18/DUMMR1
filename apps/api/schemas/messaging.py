from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from schemas.user import UserResponse

class MessageBase(BaseModel):
    content: str

class MessageCreate(MessageBase):
    pass

class MessageResponse(MessageBase):
    id: int
    conversation_id: int
    sender_id: int
    is_read: bool
    created_at: datetime
    
    sender: Optional[UserResponse] = None
    
    model_config = ConfigDict(from_attributes=True)

class ConversationBase(BaseModel):
    order_id: Optional[int] = None

class ConversationCreate(ConversationBase):
    participant_id: int # The other user to chat with, backend figures out buyer/seller

class ConversationResponse(ConversationBase):
    id: int
    buyer_id: int
    seller_id: int
    unread_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    buyer: Optional[UserResponse] = None
    seller: Optional[UserResponse] = None
    
    model_config = ConfigDict(from_attributes=True)
