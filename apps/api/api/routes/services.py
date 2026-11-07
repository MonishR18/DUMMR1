from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func
from typing import List, Optional
from core.database import get_db
from models.order import Review
from models.service import Service, Category, ServicePackage, ServiceMedia, ServiceFavorite
from schemas.order import ReviewResponse
from schemas.service import (
    ServiceCreate, ServiceUpdate, ServiceResponse, ServiceDetailResponse,
    ServicePackageCreate, ServicePackageUpdate, ServicePackageResponse,
    ServiceMediaCreate, ServiceMediaResponse, PaginatedServiceResponse
)
from core.security import get_current_active_user, require_role, require_verified_user
from models.user import User
from core.redis import check_and_record_view
from api.routes.social import get_optional_user

router = APIRouter(prefix="/api/services", tags=["services"])

@router.get("", response_model=PaginatedServiceResponse)
def search_services(
    q: Optional[str] = None,
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    rating: Optional[float] = None,
    delivery_days: Optional[int] = None,
    seller_id: Optional[int] = None,
    sort: Optional[str] = "recommended",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    # Subquery to calculate min package price and min delivery days per service (avoid cross join & duplication)
    pkg_subquery = (
        db.query(
            ServicePackage.service_id.label("pkg_service_id"),
            func.min(ServicePackage.price).label("min_price"),
            func.min(ServicePackage.delivery_days).label("min_delivery_days"),
        )
        .group_by(ServicePackage.service_id)
        .subquery()
    )

    query = db.query(Service).outerjoin(
        pkg_subquery, Service.id == pkg_subquery.c.pkg_service_id
    ).filter(Service.status == "PUBLISHED")
    
    if q:
        query = query.filter(Service.title.ilike(f"%{q}%") | Service.description.ilike(f"%{q}%"))
    if category:
        query = query.join(Service.category).filter(Category.slug == category)
    if seller_id:
        query = query.filter(Service.seller_id == seller_id)
    if rating is not None:
        query = query.filter(Service.rating >= rating)
        
    if min_price is not None:
        query = query.filter(pkg_subquery.c.min_price >= min_price)
    if max_price is not None:
        query = query.filter(pkg_subquery.c.min_price <= max_price)
    if delivery_days is not None:
        query = query.filter(pkg_subquery.c.min_delivery_days <= delivery_days)
            
    # Sorting
    if sort == "rating":
        query = query.order_by(desc(Service.rating))
    elif sort == "price_asc":
        query = query.order_by(asc(pkg_subquery.c.min_price).nullslast())
    elif sort == "price_desc":
        query = query.order_by(desc(pkg_subquery.c.min_price).nullslast())
    elif sort == "newest":
        query = query.order_by(desc(Service.created_at))
    elif sort == "popular":
        query = query.order_by(desc(Service.order_count), desc(Service.view_count))
    else: # recommended
        query = query.order_by(desc(Service.rating), desc(Service.review_count))
        
    total = query.count()
    services = query.offset((page - 1) * limit).limit(limit).all()
    
    return {
        "data": services,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit
        }
    }

@router.post("", response_model=ServiceResponse)
def create_service(
    service: ServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["PROVIDER", "ADMIN"]))
):
    if not current_user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email verification required")

    category = db.query(Category).filter(Category.id == service.category_id).first()
    if not category:
        raise HTTPException(status_code=400, detail="Category does not exist")
        
    if db.query(Service).filter(Service.slug == service.slug).first():
        raise HTTPException(status_code=400, detail="Slug already exists")
        
    db_service = Service(**service.model_dump(), seller_id=current_user.id)
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return db_service

@router.get("/saved", response_model=List[ServiceResponse])
def get_saved_services(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    favorites = db.query(ServiceFavorite).filter(ServiceFavorite.user_id == current_user.id).all()
    return [fav.service for fav in favorites if fav.service is not None]

@router.get("/{service_id}", response_model=ServiceDetailResponse)
def get_service(
    service_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user)
):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    # Deduplicate view count per viewer (user id or client IP) with short Redis TTL
    if current_user:
        viewer_key = f"user_{current_user.id}"
    else:
        client_host = request.client.host if request.client else "unknown"
        viewer_key = f"ip_{client_host}"

    if check_and_record_view(service_id, viewer_key, ttl_seconds=3600):
        service.view_count += 1
        db.commit()
        db.refresh(service)

    return service

@router.put("/{service_id}", response_model=ServiceResponse)
@router.patch("/{service_id}", response_model=ServiceResponse)
def update_service(service_id: int, service: ServiceUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db_service = db.query(Service).filter(Service.id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    if db_service.seller_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to edit this service")
        
    if service.slug and service.slug != db_service.slug:
        if db.query(Service).filter(Service.slug == service.slug).first():
            raise HTTPException(status_code=400, detail="Slug already exists")
            
    update_data = service.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_service, key, value)
        
    db.commit()
    db.refresh(db_service)
    return db_service

@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(service_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db_service = db.query(Service).filter(Service.id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    if db_service.seller_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized to delete this service")
        
    db.delete(db_service)
    db.commit()

@router.post("/{service_id}/publish", response_model=ServiceResponse)
def publish_service(service_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db_service = db.query(Service).filter(Service.id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    if db_service.seller_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_service.status = "PUBLISHED"
    db.commit()
    db.refresh(db_service)
    return db_service

@router.post("/{service_id}/pause", response_model=ServiceResponse)
def pause_service(service_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    db_service = db.query(Service).filter(Service.id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    if db_service.seller_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_service.status = "PAUSED"
    db.commit()
    db.refresh(db_service)
    return db_service

# --- Packages ---
@router.get("/{service_id}/reviews", response_model=List[ReviewResponse])
def get_service_reviews(service_id: int, db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return db.query(Review).filter(Review.service_id == service_id).order_by(desc(Review.created_at)).all()

@router.get("/{service_id}/packages", response_model=List[ServicePackageResponse])
def get_service_packages(service_id: int, db: Session = Depends(get_db)):
    return db.query(ServicePackage).filter(ServicePackage.service_id == service_id).all()

@router.post("/{service_id}/packages", response_model=ServicePackageResponse)
def create_service_package(service_id: int, package: ServicePackageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    if service.seller_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_package = ServicePackage(**package.model_dump(), service_id=service_id)
    db.add(db_package)
    db.commit()
    db.refresh(db_package)
    return db_package

# Media and Favorites
@router.post("/{service_id}/media", response_model=ServiceMediaResponse)
def add_service_media(service_id: int, media: ServiceMediaCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    if service.seller_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_media = ServiceMedia(**media.model_dump(), service_id=service_id)
    db.add(db_media)
    db.commit()
    db.refresh(db_media)
    return db_media

@router.get("/{service_id}/media", response_model=List[ServiceMediaResponse])
def get_service_media(service_id: int, db: Session = Depends(get_db)):
    return db.query(ServiceMedia).filter(ServiceMedia.service_id == service_id).order_by(ServiceMedia.sort_order).all()

@router.delete("/{service_id}/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service_media(service_id: int, media_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    if service.seller_id != current_user.id and current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    media = db.query(ServiceMedia).filter(ServiceMedia.id == media_id, ServiceMedia.service_id == service_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
        
    db.delete(media)
    db.commit()

# Favorites
@router.post("/{service_id}/favorite")
def favorite_service(service_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    existing = db.query(ServiceFavorite).filter(ServiceFavorite.user_id == current_user.id, ServiceFavorite.service_id == service_id).first()
    if existing:
        return {"status": "already_favorited"}
        
    fav = ServiceFavorite(user_id=current_user.id, service_id=service_id)
    db.add(fav)
    db.commit()
    return {"status": "favorited"}

@router.delete("/{service_id}/favorite", status_code=status.HTTP_204_NO_CONTENT)
def unfavorite_service(service_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    fav = db.query(ServiceFavorite).filter(ServiceFavorite.user_id == current_user.id, ServiceFavorite.service_id == service_id).first()
    if not fav:
        raise HTTPException(status_code=404, detail="Favorite not found")
        
    db.delete(fav)
    db.commit()

@router.post("/{service_id}/save")
def toggle_save_service(service_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    existing = db.query(ServiceFavorite).filter(ServiceFavorite.user_id == current_user.id, ServiceFavorite.service_id == service_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"saved": False, "status": "removed"}
    fav = ServiceFavorite(user_id=current_user.id, service_id=service_id)
    db.add(fav)
    db.commit()
    return {"saved": True, "status": "saved"}
