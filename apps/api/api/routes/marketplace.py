from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from core.database import get_db
from models.marketplace import Task, TaskApplication
from models.notification import Notification
from schemas.marketplace import (
    TaskCreate,
    TaskResponse,
    TaskDetailResponse,
    TaskApplicationCreate,
    TaskApplicationResponse,
)
from core.security import get_current_active_user, require_verified_user
from models.user import User

router = APIRouter(prefix="/api/tasks", tags=["tasks (job board)"])

@router.get("", response_model=List[TaskResponse])
def get_tasks(db: Session = Depends(get_db), skip: int = 0, limit: int = 20, status: str = "OPEN"):
    tasks = db.query(Task).filter(Task.status == status).order_by(Task.created_at.desc()).offset(skip).limit(limit).all()
    return tasks

@router.post("", response_model=TaskResponse)
def create_task(task: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(require_verified_user)):
    user_id = current_user.id
    db_task = Task(**task.model_dump(), creator_id=user_id)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

@router.get("/{task_id}", response_model=TaskDetailResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.post("/{task_id}/take-up", response_model=TaskApplicationResponse)
def apply_to_task(task_id: int, app: TaskApplicationCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    user_id = current_user.id
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status != "OPEN":
        raise HTTPException(status_code=400, detail="Can only apply to OPEN tasks")
    if task.creator_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot apply to your own task")
        
    existing_app = db.query(TaskApplication).filter(TaskApplication.task_id == task_id, TaskApplication.worker_id == user_id).first()
    if existing_app:
        raise HTTPException(status_code=400, detail="Already applied to this task")
        
    db_app = TaskApplication(**app.model_dump(), task_id=task_id, worker_id=user_id)
    db.add(db_app)
    db.commit()
    db.refresh(db_app)
    return db_app

@router.post("/{task_id}/applications/{app_id}/accept", response_model=TaskApplicationResponse)
def accept_application(task_id: int, app_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    user_id = current_user.id
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.creator_id != user_id:
        raise HTTPException(status_code=403, detail="Only the task creator can accept applications")
    if task.status != "OPEN":
        raise HTTPException(status_code=400, detail="Can only accept applications for OPEN tasks")
        
    app = db.query(TaskApplication).filter(TaskApplication.id == app_id, TaskApplication.task_id == task_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    app.status = "ACCEPTED"
    task.status = "ASSIGNED"
    task.assigned_worker_id = app.worker_id

    # Reject other applications
    db.query(TaskApplication).filter(
        TaskApplication.task_id == task_id,
        TaskApplication.id != app_id
    ).update({"status": "REJECTED"})

    # Notify worker
    db.add(Notification(
        user_id=app.worker_id,
        type="TASK_ASSIGNED",
        title="Application Accepted",
        message=f"Your application for task '{task.title}' has been accepted!"
    ))

    db.commit()
    db.refresh(app)
    return app

@router.post("/{task_id}/start", response_model=TaskResponse)
def start_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.assigned_worker_id != current_user.id and task.creator_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to start this task")
    if task.status != "ASSIGNED":
        raise HTTPException(status_code=400, detail=f"Cannot start task with status {task.status}. Must be ASSIGNED.")

    task.status = "IN_PROGRESS"

    # Notify creator
    if task.creator_id != current_user.id:
        db.add(Notification(
            user_id=task.creator_id,
            type="TASK_STARTED",
            title="Task In Progress",
            message=f"Work has started on task '{task.title}'"
        ))

    db.commit()
    db.refresh(task)
    return task

@router.post("/{task_id}/complete", response_model=TaskResponse)
def complete_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.creator_id != current_user.id and task.assigned_worker_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to complete this task")
    if task.status not in ["ASSIGNED", "IN_PROGRESS"]:
        raise HTTPException(status_code=400, detail=f"Cannot complete task with status {task.status}")

    task.status = "COMPLETED"

    notify_target = task.assigned_worker_id if current_user.id == task.creator_id else task.creator_id
    if notify_target:
        db.add(Notification(
            user_id=notify_target,
            type="TASK_COMPLETED",
            title="Task Completed",
            message=f"Task '{task.title}' has been marked as completed."
        ))

    db.commit()
    db.refresh(task)
    return task

@router.post("/{task_id}/cancel", response_model=TaskResponse)
def cancel_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.creator_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Only task creator can cancel this task")
    if task.status in ["COMPLETED", "CANCELLED"]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel task that is already {task.status}")

    task.status = "CANCELLED"

    if task.assigned_worker_id:
        db.add(Notification(
            user_id=task.assigned_worker_id,
            type="TASK_CANCELLED",
            title="Task Cancelled",
            message=f"Task '{task.title}' has been cancelled by the creator."
        ))

    db.commit()
    db.refresh(task)
    return task
