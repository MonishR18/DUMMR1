import hmac
import hashlib
import json
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from core.database import get_db
from core.config import settings
from core.security import get_current_user
from models.user import User
from models.order import Order, OrderStatus
from models.payment import Payment
from models.notification import Notification

router = APIRouter(prefix="/api/payments", tags=["payments"])

PLATFORM_FEE_PERCENT = 0.10 # 10% platform fee

class CheckoutRequest(BaseModel):
    order_id: int
    provider: Optional[str] = "razorpay" # "razorpay" | "stripe" | "mock"
    currency: Optional[str] = "USD"
    model_config = ConfigDict(extra="ignore")

class MockConfirmRequest(BaseModel):
    order_id: int
    payment_id: Optional[str] = None
    model_config = ConfigDict(extra="ignore")

@router.post("/checkout")
def create_checkout_session(
    data: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Initialize a payment checkout session for an order."""
    order = db.query(Order).filter(Order.id == data.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.buyer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to pay for this order")

    if order.status not in [OrderStatus.PENDING, OrderStatus.CONFIRMED]:
        raise HTTPException(
            status_code=400,
            detail=f"Order cannot be paid for in current status: {order.status}",
        )

    provider = data.provider.lower() if data.provider else settings.PAYMENT_PROVIDER.lower()
    amount = float(order.amount)
    platform_fee = round(amount * PLATFORM_FEE_PERCENT, 2)
    seller_amount = round(amount - platform_fee, 2)

    # Create Payment record
    provider_txn_id = f"txn_{provider}_{uuid.uuid4().hex[:12]}"
    payment = Payment(
        order_id=order.id,
        provider=provider,
        provider_transaction_id=provider_txn_id,
        amount=amount,
        currency=data.currency or "USD",
        status="PENDING",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    # Real Razorpay integration if keys exist
    if provider == "razorpay" and settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
        try:
            import razorpay
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            razorpay_order = client.order.create({
                "amount": int(amount * 100), # Amount in paise / cents
                "currency": data.currency or "USD",
                "receipt": f"receipt_order_{order.id}",
                "notes": {"order_id": order.id, "payment_id": payment.id},
            })
            payment.provider_transaction_id = razorpay_order["id"]
            db.commit()

            return {
                "payment_id": payment.id,
                "provider": "razorpay",
                "key_id": settings.RAZORPAY_KEY_ID,
                "razorpay_order_id": razorpay_order["id"],
                "amount": amount,
                "currency": data.currency,
                "platform_fee": platform_fee,
                "seller_amount": seller_amount,
            }
        except Exception as e:
            # Fall back to mock response in development
            pass

    # Real Stripe integration if keys exist
    if provider == "stripe" and settings.STRIPE_API_KEY:
        try:
            import stripe
            stripe.api_key = settings.STRIPE_API_KEY
            intent = stripe.PaymentIntent.create(
                amount=int(amount * 100),
                currency=data.currency.lower() if data.currency else "usd",
                metadata={"order_id": order.id, "payment_id": payment.id},
            )
            payment.provider_transaction_id = intent.id
            db.commit()

            return {
                "payment_id": payment.id,
                "provider": "stripe",
                "client_secret": intent.client_secret,
                "amount": amount,
                "currency": data.currency,
                "platform_fee": platform_fee,
                "seller_amount": seller_amount,
            }
        except Exception as e:
            pass

    # Default / Dev Mode response
    return {
        "payment_id": payment.id,
        "provider": provider,
        "transaction_id": provider_txn_id,
        "amount": amount,
        "currency": data.currency or "USD",
        "platform_fee": platform_fee,
        "seller_amount": seller_amount,
        "mode": "dev_mock",
        "message": "Use /api/payments/mock-confirm to verify payment in development",
    }

@router.post("/webhook")
async def payment_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_razorpay_signature: Optional[str] = Header(None),
    stripe_signature: Optional[str] = Header(None),
):
    """Receive and verify payment webhooks from Razorpay or Stripe."""
    body_bytes = await request.body()
    body_str = body_bytes.decode("utf-8")

    # Razorpay Webhook
    if x_razorpay_signature:
        if not settings.RAZORPAY_KEY_SECRET:
            raise HTTPException(status_code=500, detail="Razorpay secret not configured")

        expected_sig = hmac.new(
            settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
            body_bytes,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected_sig, x_razorpay_signature):
            raise HTTPException(status_code=400, detail="Invalid Razorpay signature")

        try:
            payload = json.loads(body_str)
            event = payload.get("event")
            if event == "payment.captured":
                payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
                rzp_order_id = payment_entity.get("order_id")
                
                payment = db.query(Payment).filter(
                    Payment.provider_transaction_id == rzp_order_id
                ).first()

                if payment:
                    payment.status = "PAID"
                    order = db.query(Order).filter(Order.id == payment.order_id).first()
                    if order and order.status == OrderStatus.PENDING:
                        order.status = OrderStatus.CONFIRMED
                    db.commit()
            return {"status": "ok"}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    # Stripe Webhook
    if stripe_signature and settings.STRIPE_WEBHOOK_SECRET and settings.STRIPE_API_KEY:
        try:
            import stripe
            stripe.api_key = settings.STRIPE_API_KEY
            event = stripe.Webhook.construct_event(
                body_str, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
            )
            if event["type"] == "payment_intent.succeeded":
                intent = event["data"]["object"]
                payment = db.query(Payment).filter(
                    Payment.provider_transaction_id == intent["id"]
                ).first()
                if payment:
                    payment.status = "PAID"
                    order = db.query(Order).filter(Order.id == payment.order_id).first()
                    if order and order.status == OrderStatus.PENDING:
                        order.status = OrderStatus.CONFIRMED
                    db.commit()
            return {"status": "ok"}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    return {"status": "ignored", "reason": "No valid payment provider signature"}

@router.post("/mock-confirm")
def mock_confirm_payment(
    data: MockConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Simulate successful payment confirmation for test & dev environments."""
    order = db.query(Order).filter(Order.id == data.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.buyer_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to confirm this payment")

    payment = db.query(Payment).filter(
        Payment.order_id == order.id
    ).order_by(Payment.id.desc()).first()

    if not payment:
        payment = Payment(
            order_id=order.id,
            provider="mock",
            provider_transaction_id=data.payment_id or f"mock_{uuid.uuid4().hex[:10]}",
            amount=order.amount,
            currency="USD",
            status="PAID",
        )
        db.add(payment)
    else:
        payment.status = "PAID"

    if order.status == OrderStatus.PENDING:
        order.status = OrderStatus.CONFIRMED

    # Notify Seller
    notif = Notification(
        user_id=order.seller_id,
        type="PAYMENT_RECEIVED",
        title="Payment Received",
        message=f"Payment of ${order.amount} for Order #{order.id} was confirmed and is in escrow.",
    )
    db.add(notif)
    db.commit()

    return {
        "status": "success",
        "order_id": order.id,
        "order_status": order.status.value,
        "payment_status": payment.status,
        "amount": order.amount,
    }

@router.get("/order/{order_id}")
def get_order_payments(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all payments related to a specific order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.buyer_id != current_user.id and order.seller_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to view payments for this order")

    payments = db.query(Payment).filter(Payment.order_id == order_id).all()
    return [
        {
            "id": p.id,
            "order_id": p.order_id,
            "provider": p.provider,
            "provider_transaction_id": p.provider_transaction_id,
            "amount": p.amount,
            "currency": p.currency,
            "status": p.status,
            "created_at": p.created_at,
        }
        for p in payments
    ]
