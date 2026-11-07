from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from core.database import get_db
from models.order import Order, OrderStatus
from models.service import Service
from schemas.order import OrderResponse
from schemas.service import ServiceResponse
from core.security import require_role
from models.user import User

router = APIRouter(prefix="/api/seller", tags=["seller"])

def _get_monthly_revenue_sql(db: Session, seller_id: int) -> List[Dict[str, Any]]:
    twelve_months_ago = datetime.now(timezone.utc) - timedelta(days=365)
    year_col = func.extract('year', Order.created_at)
    month_col = func.extract('month', Order.created_at)

    monthly_rows = db.query(
        year_col.label("year"),
        month_col.label("month"),
        func.coalesce(func.sum(Order.amount), 0.0).label("revenue"),
        func.count(Order.id).label("order_count")
    ).filter(
        Order.seller_id == seller_id,
        Order.status == OrderStatus.COMPLETED,
        Order.created_at >= twelve_months_ago
    ).group_by(
        year_col, month_col
    ).order_by(
        year_col.asc(), month_col.asc()
    ).all()

    return [
        {
            "month": f"{int(row.year):04d}-{int(row.month):02d}",
            "revenue": round(float(row.revenue), 2),
            "order_count": int(row.order_count),
        }
        for row in monthly_rows
    ]

@router.get("/services", response_model=List[ServiceResponse])
def get_seller_services(db: Session = Depends(get_db), current_user: User = Depends(require_role(["PROVIDER"]))):
    return db.query(Service).filter(Service.seller_id == current_user.id).order_by(desc(Service.created_at)).all()

@router.get("/dashboard")
def get_seller_dashboard(db: Session = Depends(get_db), current_user: User = Depends(require_role(["PROVIDER"]))):
    # Aggregates computed in SQL
    revenue = db.query(func.coalesce(func.sum(Order.amount), 0.0)).filter(
        Order.seller_id == current_user.id,
        Order.status == OrderStatus.COMPLETED
    ).scalar() or 0.0

    total_orders = db.query(func.count(Order.id)).filter(Order.seller_id == current_user.id).scalar() or 0
    active_orders = db.query(func.count(Order.id)).filter(
        Order.seller_id == current_user.id,
        Order.status.notin_([OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED])
    ).scalar() or 0
    completed_orders = db.query(func.count(Order.id)).filter(
        Order.seller_id == current_user.id,
        Order.status == OrderStatus.COMPLETED
    ).scalar() or 0
    pending_orders = db.query(func.count(Order.id)).filter(
        Order.seller_id == current_user.id,
        Order.status == OrderStatus.PENDING
    ).scalar() or 0
    delivered_orders = db.query(func.count(Order.id)).filter(
        Order.seller_id == current_user.id,
        Order.status == OrderStatus.DELIVERED
    ).scalar() or 0

    service_stats = db.query(
        func.count(Service.id).label("services_count"),
        func.coalesce(func.sum(Service.view_count), 0).label("views"),
        func.coalesce(func.sum(Service.review_count), 0).label("reviews")
    ).filter(Service.seller_id == current_user.id).first()

    monthly_revenue = _get_monthly_revenue_sql(db, current_user.id)

    recent_orders_rows = db.query(Order).filter(
        Order.seller_id == current_user.id
    ).order_by(desc(Order.created_at)).limit(5).all()

    recent_orders = [
        {
            "id": o.id,
            "buyer_id": o.buyer_id,
            "service_id": o.service_id,
            "amount": o.amount,
            "status": o.status.value,
            "created_at": o.created_at,
        }
        for o in recent_orders_rows
    ]

    return {
        "revenue": round(float(revenue), 2),
        "orders": total_orders,
        "active_orders": active_orders,
        "completed_orders": completed_orders,
        "pending_orders": pending_orders,
        "delivered_orders": delivered_orders,
        "services": service_stats.services_count if service_stats else 0,
        "views": service_stats.views if service_stats else 0,
        "rating": float(current_user.rating or 0.0),
        "reviews": service_stats.reviews if service_stats else 0,
        "monthly_revenue": monthly_revenue,
        "recent_orders": recent_orders,
    }

@router.get("/analytics")
def get_seller_analytics(db: Session = Depends(get_db), current_user: User = Depends(require_role(["PROVIDER"]))):
    total_rev = db.query(func.coalesce(func.sum(Order.amount), 0.0)).filter(
        Order.seller_id == current_user.id,
        Order.status == OrderStatus.COMPLETED
    ).scalar() or 0.0

    return {
        "total_revenue": round(float(total_rev), 2),
        "total_orders": db.query(func.count(Order.id)).filter(Order.seller_id == current_user.id).scalar() or 0,
        "active_orders": db.query(func.count(Order.id)).filter(
            Order.seller_id == current_user.id,
            Order.status.notin_([OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED])
        ).scalar() or 0,
        "completed_orders": db.query(func.count(Order.id)).filter(
            Order.seller_id == current_user.id,
            Order.status == OrderStatus.COMPLETED
        ).scalar() or 0,
        "pending_orders": db.query(func.count(Order.id)).filter(
            Order.seller_id == current_user.id,
            Order.status == OrderStatus.PENDING
        ).scalar() or 0,
        "delivered_orders": db.query(func.count(Order.id)).filter(
            Order.seller_id == current_user.id,
            Order.status == OrderStatus.DELIVERED
        ).scalar() or 0,
    }

@router.get("/revenue")
def get_seller_revenue(db: Session = Depends(get_db), current_user: User = Depends(require_role(["PROVIDER"]))):
    total_revenue = db.query(func.coalesce(func.sum(Order.amount), 0.0)).filter(
        Order.seller_id == current_user.id,
        Order.status == OrderStatus.COMPLETED
    ).scalar() or 0.0

    completed_count = db.query(func.count(Order.id)).filter(
        Order.seller_id == current_user.id,
        Order.status == OrderStatus.COMPLETED
    ).scalar() or 0

    monthly_revenue = _get_monthly_revenue_sql(db, current_user.id)

    return {
        "total_revenue": round(float(total_revenue), 2),
        "monthly_revenue": monthly_revenue,
        "orders": completed_count,
    }

@router.get("/orders", response_model=List[OrderResponse])
def get_seller_orders(db: Session = Depends(get_db), current_user: User = Depends(require_role(["PROVIDER"]))):
    return db.query(Order).filter(Order.seller_id == current_user.id).order_by(desc(Order.created_at)).all()
