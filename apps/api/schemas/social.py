from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class UserBasic(BaseModel):
    id: int
    name: str
    username: str

    model_config = ConfigDict(from_attributes=True)

class PostBase(BaseModel):
    content: str

class PostCreate(PostBase):
    pass

class PostResponse(PostBase):
    id: int
    author_id: int
    created_at: datetime
    author: Optional[UserBasic] = None

    model_config = ConfigDict(from_attributes=True)

class CommentBase(BaseModel):
    content: str

class CommentCreate(CommentBase):
    post_id: int

class CommentResponse(CommentBase):
    id: int
    author_id: int
    post_id: int
    created_at: datetime
    author: Optional[UserBasic] = None

    model_config = ConfigDict(from_attributes=True)
