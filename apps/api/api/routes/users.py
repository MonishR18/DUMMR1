from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from core.database import get_db
from models.order import Review
from models.user import User
from schemas.order import ReviewResponse
from schemas.user import PublicUserResponse, PrivateUserResponse, UserUpdate
from core.security import get_current_active_user, require_role

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/{user_id}", response_model=PublicUserResponse)
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.patch("/me", response_model=PrivateUserResponse)
def update_user_me(user_update: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    update_data = user_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return current_user

from models.service import Service, ServiceFavorite
from schemas.service import ServiceResponse

@router.get("/me/favorites", response_model=List[ServiceResponse])
def get_my_favorites(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    favorites = db.query(ServiceFavorite).filter(ServiceFavorite.user_id == current_user.id).all()
    services = [fav.service for fav in favorites if fav.service is not None]
    return services

@router.get("/{user_id}/services", response_model=List[ServiceResponse])
def get_user_services(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return db.query(Service).filter(Service.seller_id == user_id, Service.status == "PUBLISHED").all()

@router.get("/{user_id}/reviews", response_model=List[ReviewResponse])
def get_user_reviews(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return db.query(Review).filter(Review.seller_id == user_id).order_by(Review.created_at.desc()).all()
