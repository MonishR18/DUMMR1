from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from schemas.social import UserBasic

class ReportCreate(BaseModel):
    target_type: str # USER, SERVICE, POST, COMMENT
    target_id: int
    reason: str

class ReportResponse(BaseModel):
    id: int
    reporter_id: int
    target_type: str
    target_id: int
    reason: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    reporter: Optional[UserBasic] = None

    model_config = ConfigDict(from_attributes=True)

class ReportResolve(BaseModel):
    status: str = "RESOLVED" # RESOLVED, DISMISSED

class BlockResponse(BaseModel):
    id: int
    blocker_id: int
    blocked_id: int
    created_at: datetime
    blocked: Optional[UserBasic] = None

    model_config = ConfigDict(from_attributes=True)
