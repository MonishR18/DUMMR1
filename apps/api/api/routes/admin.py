from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from core.database import get_db
from models.user import User
from models.service import Service
from models.order import Order, Review
from models.social import Post, Comment
from models.moderation import Report
from schemas.user import PrivateUserResponse
from schemas.service import ServiceResponse
from schemas.order import OrderResponse, ReviewResponse
from schemas.moderation import ReportResponse, ReportResolve
from core.security import require_role

router = APIRouter(prefix="/api/admin", tags=["admin"])

class AdminDashboardResponse(BaseModel):
    users: int
    services: int
    orders: int
    revenue: float

    model_config = ConfigDict(from_attributes=True)

class MessageResponse(BaseModel):
    message: str

@router.get("/dashboard", response_model=AdminDashboardResponse)
def get_admin_dashboard(db: Session = Depends(get_db), current_user: User = Depends(require_role(["ADMIN"]))):
    rev = db.query(func.coalesce(func.sum(Order.amount), 0.0)).filter(Order.status == "COMPLETED").scalar()
    return {
        "users": db.query(User).count(),
        "services": db.query(Service).count(),
        "orders": db.query(Order).count(),
        "revenue": float(rev or 0.0),
    }

@router.get("/users", response_model=List[PrivateUserResponse])
def get_admin_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    return db.query(User).offset(skip).limit(limit).all()

@router.get("/services", response_model=List[ServiceResponse])
def get_admin_services(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    return db.query(Service).offset(skip).limit(limit).all()

@router.get("/orders", response_model=List[OrderResponse])
def get_admin_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    return db.query(Order).offset(skip).limit(limit).all()

@router.get("/reviews", response_model=List[ReviewResponse])
def get_admin_reviews(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    return db.query(Review).offset(skip).limit(limit).all()

@router.get("/reports", response_model=List[ReportResponse])
def get_admin_reports(
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    query = db.query(Report)
    if status_filter:
        query = query.filter(Report.status == status_filter.upper())
    return query.order_by(Report.created_at.desc()).offset(skip).limit(limit).all()

# Admin write actions

@router.post("/users/{user_id}/deactivate", response_model=PrivateUserResponse)
def deactivate_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role(["ADMIN"]))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user

@router.post("/users/{user_id}/reactivate", response_model=PrivateUserResponse)
def reactivate_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role(["ADMIN"]))):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user

@router.post("/services/{service_id}/unpublish", response_model=ServiceResponse)
def unpublish_service(service_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role(["ADMIN"]))):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    service.status = "DRAFT"
    db.commit()
    db.refresh(service)
    return service

@router.delete("/services/{service_id}", response_model=MessageResponse)
def delete_service(service_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role(["ADMIN"]))):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    db.delete(service)
    db.commit()
    return {"message": f"Service {service_id} deleted successfully"}

@router.delete("/posts/{post_id}", response_model=MessageResponse)
def delete_post(post_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role(["ADMIN"]))):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()
    return {"message": f"Post {post_id} deleted successfully"}

@router.delete("/comments/{comment_id}", response_model=MessageResponse)
def delete_comment(comment_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role(["ADMIN"]))):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(comment)
    db.commit()
    return {"message": f"Comment {comment_id} deleted successfully"}

@router.post("/reports/{report_id}/resolve", response_model=ReportResponse)
def resolve_report(
    report_id: int,
    action: ReportResolve,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["ADMIN"]))
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = action.status.upper()
    db.commit()
    db.refresh(report)
    return report
