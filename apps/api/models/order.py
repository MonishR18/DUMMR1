from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, Enum as SQLAlchemyEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from core.database import Base

class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    DELIVERED = "DELIVERED"
    REVISION_REQUESTED = "REVISION_REQUESTED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    buyer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    seller_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="RESTRICT"), nullable=False, index=True)
    package_id = Column(Integer, ForeignKey("service_packages.id", ondelete="RESTRICT"), nullable=False)
    
    amount = Column(Float, nullable=False)
    status = Column(SQLAlchemyEnum(OrderStatus), default=OrderStatus.PENDING, index=True)
    requirements = Column(Text, nullable=True)
    delivery_date = Column(DateTime(timezone=True), nullable=True)
    
    delivery_message = Column(Text, nullable=True)
    delivery_files = Column(Text, nullable=True) # JSON list
    delivery_timestamp = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    buyer = relationship("User", foreign_keys=[buyer_id])
    seller = relationship("User", foreign_keys=[seller_id])
    service = relationship("Service")
    package = relationship("ServicePackage")
    
    reviews = relationship("Review", back_populates="order", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="order", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="order", cascade="all, delete-orphan")

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, unique=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    rating = Column(Integer, nullable=False) # 1-5
    comment = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    order = relationship("Order", back_populates="reviews")
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    seller = relationship("User", foreign_keys=[seller_id])
    service = relationship("Service", back_populates="reviews")
