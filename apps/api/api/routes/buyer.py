from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from core.database import get_db
from models.order import Order, OrderStatus
from models.service import ServiceFavorite, Service
from schemas.order import OrderResponse
from schemas.service import ServiceResponse
from core.security import get_current_active_user
from models.user import User

router = APIRouter(prefix="/api/buyer", tags=["buyer"])


@router.get("/dashboard")
def get_buyer_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    orders = db.query(Order).filter(Order.buyer_id == current_user.id).all()
    active_orders = [o for o in orders if o.status not in {OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.REFUNDED}]
    completed_orders = [o for o in orders if o.status == OrderStatus.COMPLETED]
    pending_orders = [o for o in orders if o.status == OrderStatus.PENDING]

    return {
        "orders": len(orders),
        "active_orders": len(active_orders),
        "completed_orders": len(completed_orders),
        "pending_orders": len(pending_orders),
        "cancelled_orders": len([o for o in orders if o.status == OrderStatus.CANCELLED]),
        "total_spent": round(sum(o.amount for o in completed_orders), 2),
        "spend": round(sum(o.amount for o in completed_orders), 2),
        "favorites": db.query(ServiceFavorite).filter(ServiceFavorite.user_id == current_user.id).count(),
        "saved_services": db.query(ServiceFavorite).filter(ServiceFavorite.user_id == current_user.id).count(),
    }


@router.get("/orders", response_model=List[OrderResponse])
def get_buyer_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(Order).filter(Order.buyer_id == current_user.id).order_by(desc(Order.created_at)).all()


@router.get("/favorites", response_model=List[ServiceResponse])
def get_buyer_favorites(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    favorites = db.query(ServiceFavorite).filter(ServiceFavorite.user_id == current_user.id).all()
    return [fav.service for fav in favorites if fav.service is not None]


@router.get("/activity")
def get_buyer_activity(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    orders = db.query(Order).filter(Order.buyer_id == current_user.id).order_by(desc(Order.created_at)).limit(10).all()
    favorites = db.query(ServiceFavorite).filter(ServiceFavorite.user_id == current_user.id).order_by(desc(ServiceFavorite.created_at)).limit(5).all()
    return {
        "recent_orders": [
            {
                "id": order.id,
                "service_id": order.service_id,
                "status": order.status.value,
                "amount": order.amount,
                "created_at": order.created_at,
            }
            for order in orders
        ],
        "favorite_services": [
            {
                "service_id": favorite.service_id,
                "created_at": favorite.created_at,
            }
            for favorite in favorites
        ],
    }
