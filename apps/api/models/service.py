from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    services = relationship("Service", back_populates="category")

class Service(Base):
    __tablename__ = "services"
    
    id = Column(Integer, primary_key=True, index=True)
    seller_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    title = Column(String, index=True, nullable=False)
    slug = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String, default="DRAFT", index=True) # DRAFT, PUBLISHED, PAUSED, ARCHIVED
    rating = Column(Float, default=0.0)
    review_count = Column(Integer, default=0)
    order_count = Column(Integer, default=0)
    view_count = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    seller = relationship("User", back_populates="services")
    category = relationship("Category", back_populates="services")
    packages = relationship("ServicePackage", back_populates="service", cascade="all, delete-orphan")
    media = relationship("ServiceMedia", back_populates="service", cascade="all, delete-orphan")
    favorites = relationship("ServiceFavorite", back_populates="service", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="service", cascade="all, delete-orphan")

class ServicePackage(Base):
    __tablename__ = "service_packages"
    
    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False) # e.g. Basic, Standard, Premium
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    delivery_days = Column(Integer, nullable=False)
    revisions = Column(Integer, default=0)
    features = Column(String, nullable=True) # JSON stored as string, or JSONB if postgres
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    service = relationship("Service", back_populates="packages")

class ServiceMedia(Base):
    __tablename__ = "service_media"
    
    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False, index=True)
    media_type = Column(String, nullable=False) # IMAGE, VIDEO
    url = Column(String, nullable=False)
    thumbnail_url = Column(String, nullable=True)
    sort_order = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    service = relationship("Service", back_populates="media")

class ServiceFavorite(Base):
    __tablename__ = "service_favorites"
    
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    service = relationship("Service", back_populates="favorites")
    user = relationship("User", back_populates="favorites")
