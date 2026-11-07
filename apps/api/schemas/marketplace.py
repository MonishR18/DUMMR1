from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from schemas.social import UserBasic

class TaskBase(BaseModel):
    title: str
    description: str
    category: Optional[str] = None
    budget: Optional[float] = None
    deadline: Optional[datetime] = None

class TaskCreate(TaskBase):
    pass

class TaskResponse(TaskBase):
    id: int
    status: str
    creator_id: int
    assigned_worker_id: Optional[int] = None
    created_at: datetime
    creator: Optional[UserBasic] = None
    assigned_worker: Optional[UserBasic] = None

    model_config = ConfigDict(from_attributes=True)

class TaskApplicationBase(BaseModel):
    message: Optional[str] = None
    expected_completion: Optional[datetime] = None

class TaskApplicationCreate(TaskApplicationBase):
    pass

class TaskApplicationResponse(TaskApplicationBase):
    id: int
    status: str
    task_id: int
    worker_id: int
    created_at: datetime
    worker: Optional[UserBasic] = None

    model_config = ConfigDict(from_attributes=True)

class TaskDetailResponse(TaskResponse):
    applications: List[TaskApplicationResponse] = []
