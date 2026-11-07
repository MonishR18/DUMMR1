from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from core.database import get_db
from models.user import User
from models.moderation import Block
from schemas.moderation import BlockResponse
from schemas.user import PublicUserResponse
from core.security import get_current_active_user

router = APIRouter(prefix="/api/blocks", tags=["blocks"])

@router.get("", response_model=List[BlockResponse])
def get_blocked_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    return db.query(Block).filter(Block.blocker_id == current_user.id).all()

@router.post("/{user_id}", response_model=BlockResponse, status_code=status.HTTP_201_CREATED)
def block_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot block yourself")
    
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(Block).filter(Block.blocker_id == current_user.id, Block.blocked_id == user_id).first()
    if existing:
        return existing

    block = Block(blocker_id=current_user.id, blocked_id=user_id)
    db.add(block)
    db.commit()
    db.refresh(block)
    return block

@router.delete("/{user_id}")
def unblock_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    block = db.query(Block).filter(Block.blocker_id == current_user.id, Block.blocked_id == user_id).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block relationship not found")
    
    db.delete(block)
    db.commit()
    return {"message": f"Successfully unblocked user {user_id}"}
