from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    college = Column(String, nullable=True)
    role = Column(String, default="CLIENT")
    profile_image = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    skills = Column(String, nullable=True) # or JSON
    expertise = Column(String, nullable=True)
    specialty = Column(String, nullable=True)
    rating = Column(Float, default=0.0)
    completed_orders = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Social Relationships
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="author", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="user", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="user", cascade="all, delete-orphan")
    followers = relationship("Follow", foreign_keys="[Follow.following_id]", back_populates="following", cascade="all, delete-orphan")
    following = relationship("Follow", foreign_keys="[Follow.follower_id]", back_populates="follower", cascade="all, delete-orphan")
    
    # Marketplace Relationships
    client_tasks = relationship("Task", foreign_keys="[Task.creator_id]", back_populates="creator", cascade="all, delete-orphan")
    applications = relationship("TaskApplication", back_populates="worker", cascade="all, delete-orphan")
    
    # Service Marketplace
    services = relationship("Service", back_populates="seller", cascade="all, delete-orphan")
    favorites = relationship("ServiceFavorite", back_populates="user", cascade="all, delete-orphan")
