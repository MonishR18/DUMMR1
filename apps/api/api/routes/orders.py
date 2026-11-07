from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from datetime import datetime, timedelta, timezone
from core.database import get_db
from models.messaging import Conversation
from models.order import Order, OrderStatus, Review
from models.service import Service, ServicePackage
from models.notification import Notification
from schemas.order import OrderCreate, OrderResponse, OrderAction, ReviewCreate, ReviewResponse
from core.security import get_current_active_user, require_verified_user, require_client
from models.user import User

router = APIRouter(prefix="/api/orders", tags=["orders"])

VALID_ORDER_TRANSITIONS = {
    OrderStatus.PENDING: {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
    OrderStatus.CONFIRMED: {OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED},
    OrderStatus.IN_PROGRESS: {OrderStatus.DELIVERED, OrderStatus.CANCELLED},
    OrderStatus.DELIVERED: {OrderStatus.REVISION_REQUESTED, OrderStatus.COMPLETED, OrderStatus.CANCELLED},
    OrderStatus.REVISION_REQUESTED: {OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED},
    OrderStatus.COMPLETED: set(),
    OrderStatus.CANCELLED: set(),
    OrderStatus.REFUNDED: set(),
}


def create_notification(db: Session, user_id: int, type: str, title: str, message: str):
    db_notif = Notification(user_id=user_id, type=type, title=title, message=message)
    db.add(db_notif)
    db.commit()


def _ensure_valid_transition(order: Order, new_status: OrderStatus):
    current = order.status
    allowed = VALID_ORDER_TRANSITIONS.get(current, set())
    if new_status not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid transition from {current.value} to {new_status.value}")


def _create_conversation_for_order(db: Session, buyer_id: int, seller_id: int, order_id: int | None = None):
    if order_id:
        existing = db.query(Conversation).filter(
            Conversation.order_id == order_id,
            ((Conversation.buyer_id == buyer_id) & (Conversation.seller_id == seller_id)) |
            ((Conversation.buyer_id == seller_id) & (Conversation.seller_id == buyer_id))
        ).first()
    else:
        existing = db.query(Conversation).filter(
            Conversation.order_id.is_(None),
            ((Conversation.buyer_id == buyer_id) & (Conversation.seller_id == seller_id)) |
            ((Conversation.buyer_id == seller_id) & (Conversation.seller_id == buyer_id))
        ).first()
    if existing:
        return existing

    conversation = Conversation(buyer_id=buyer_id, seller_id=seller_id, order_id=order_id)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.post("", response_model=OrderResponse)
def create_order(order: OrderCreate, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    require_verified_user(current_user)
    service = db.query(Service).filter(Service.id == order.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    if service.status != "PUBLISHED":
        raise HTTPException(status_code=400, detail="Service is not published")
    if service.seller_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot order your own service")

    package = db.query(ServicePackage).filter(ServicePackage.id == order.package_id, ServicePackage.service_id == order.service_id).first()
    if not package:
        raise HTTPException(status_code=400, detail="Invalid package for this service")

    delivery_date = datetime.now(timezone.utc) + timedelta(days=package.delivery_days)
    db_order = Order(
        buyer_id=current_user.id,
        seller_id=service.seller_id,
        service_id=service.id,
        package_id=package.id,
        amount=float(package.price),
        status=OrderStatus.PENDING,
        requirements=order.requirements,
        delivery_date=delivery_date,
    )

    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    _create_conversation_for_order(db, current_user.id, service.seller_id, order_id=db_order.id)
    create_notification(db, service.seller_id, "NEW_ORDER", "New Order Received", f"You have a new order for {service.title}")
    return db_order


@router.get("", response_model=List[OrderResponse])
def get_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if current_user.role == "ADMIN":
        return db.query(Order).order_by(desc(Order.created_at)).all()
    return db.query(Order).filter((Order.buyer_id == current_user.id) | (Order.seller_id == current_user.id)).order_by(desc(Order.created_at)).all()


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyer_id != current_user.id and order.seller_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    return order


@router.post("/{order_id}/accept", response_model=OrderResponse)
def accept_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    _ensure_valid_transition(order, OrderStatus.CONFIRMED)

    order.status = OrderStatus.CONFIRMED
    order.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    create_notification(db, order.buyer_id, "ORDER_ACCEPTED", "Order Accepted", f"Your order {order.id} has been accepted")
    return order


@router.post("/{order_id}/start", response_model=OrderResponse)
def start_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    _ensure_valid_transition(order, OrderStatus.IN_PROGRESS)

    order.status = OrderStatus.IN_PROGRESS
    order.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    create_notification(db, order.buyer_id, "ORDER_STARTED", "Order Started", f"Seller started working on order {order.id}")
    return order


@router.post("/{order_id}/deliver", response_model=OrderResponse)
def deliver_order(order_id: int, action: OrderAction | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    _ensure_valid_transition(order, OrderStatus.DELIVERED)

    payload = action.model_dump(exclude_unset=True) if action else {}
    order.status = OrderStatus.DELIVERED
    order.delivery_message = payload.get("delivery_message") or payload.get("message") or order.delivery_message
    if payload.get("delivery_files") is not None:
        order.delivery_files = str(payload["delivery_files"])
    if payload.get("delivery_timestamp") is not None:
        order.delivery_timestamp = payload["delivery_timestamp"]
    else:
        order.delivery_timestamp = datetime.now(timezone.utc)
    order.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    create_notification(db, order.buyer_id, "ORDER_DELIVERED", "Order Delivered", f"Your order {order.id} has been delivered")
    return order


@router.post("/{order_id}/revision", response_model=OrderResponse)
def revision_order(order_id: int, action: OrderAction, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    _ensure_valid_transition(order, OrderStatus.REVISION_REQUESTED)

    order.status = OrderStatus.REVISION_REQUESTED
    order.delivery_message = action.message or order.delivery_message
    order.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    create_notification(db, order.seller_id, "REVISION_REQUESTED", "Revision Requested", f"Buyer requested revision for order {order.id}")
    return order


@router.post("/{order_id}/complete", response_model=OrderResponse)
def complete_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyer_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    _ensure_valid_transition(order, OrderStatus.COMPLETED)

    order.status = OrderStatus.COMPLETED
    order.completed_at = datetime.now(timezone.utc)
    order.updated_at = datetime.now(timezone.utc)

    seller = db.query(User).filter(User.id == order.seller_id).first()
    if seller:
        seller.completed_orders += 1

    service = db.query(Service).filter(Service.id == order.service_id).first()
    if service:
        service.order_count = (service.order_count or 0) + 1

    db.commit()
    db.refresh(order)
    create_notification(db, order.seller_id, "ORDER_COMPLETED", "Order Completed", f"Order {order.id} has been marked completed")
    create_notification(db, order.buyer_id, "ORDER_COMPLETED", "Order Completed", f"Order {order.id} has been completed")
    return order


@router.post("/{order_id}/cancel", response_model=OrderResponse)
def cancel_order(order_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyer_id != current_user.id and order.seller_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
    _ensure_valid_transition(order, OrderStatus.CANCELLED)

    order.status = OrderStatus.CANCELLED
    order.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)

    notify_id = order.seller_id if current_user.id == order.buyer_id else order.buyer_id
    create_notification(db, notify_id, "ORDER_CANCELLED", "Order Cancelled", f"Order {order.id} was cancelled")
    return order


@router.post("/{order_id}/review", response_model=ReviewResponse)
def create_review(order_id: int, review: ReviewCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.buyer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the buyer can review this order")
    if order.status != OrderStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Order must be completed before a review can be submitted")
    if review.rating < 1 or review.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    existing = db.query(Review).filter(Review.order_id == order_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Review already submitted for this order")

    db_review = Review(
        order_id=order_id,
        service_id=order.service_id,
        reviewer_id=current_user.id,
        seller_id=order.seller_id,
        rating=review.rating,
        comment=review.comment,
    )
    db.add(db_review)

    service = db.query(Service).filter(Service.id == order.service_id).first()
    if service:
        total_reviews = (service.review_count or 0) + 1
        service.review_count = total_reviews
        service.rating = ((service.rating or 0.0) * (total_reviews - 1) + review.rating) / total_reviews if total_reviews > 0 else float(review.rating)

    seller = db.query(User).filter(User.id == order.seller_id).first()
    if seller:
        seller_services = db.query(Service).filter(Service.seller_id == order.seller_id).all()
        if seller_services:
            seller.rating = round(sum((s.rating or 0.0) for s in seller_services) / len(seller_services), 2)

    db.commit()
    db.refresh(db_review)
    create_notification(db, order.seller_id, "NEW_REVIEW", "New Review", f"You received a {review.rating}-star review for order {order.id}")
    return db_review
