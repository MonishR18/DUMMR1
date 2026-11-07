from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String, nullable=True)
    budget = Column(Float, nullable=True)
    status = Column(String, default="OPEN", index=True) # OPEN, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED
    deadline = Column(DateTime(timezone=True), nullable=True)
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_worker_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    creator = relationship("User", foreign_keys=[creator_id], back_populates="client_tasks")
    assigned_worker = relationship("User", foreign_keys=[assigned_worker_id])
    applications = relationship("TaskApplication", back_populates="task", cascade="all, delete-orphan")

class TaskApplication(Base):
    __tablename__ = "task_applications"
    
    id = Column(Integer, primary_key=True, index=True)
    message = Column(Text, nullable=True)
    status = Column(String, default="PENDING") # PENDING, ACCEPTED, REJECTED
    expected_completion = Column(DateTime(timezone=True), nullable=True)
    
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    worker_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    task = relationship("Task", back_populates="applications")
    worker = relationship("User", back_populates="applications")
