import os
from fastapi import APIRouter, Depends, UploadFile, File, Query, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import get_current_user, get_current_active_user, require_provider
from core.storage import save_upload_file, ensure_upload_dir, UPLOAD_DIR
from models.user import User
from models.order import Order

router = APIRouter(prefix="/api/storage", tags=["storage"])

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    folder: str = Query("media", pattern="^(media|deliveries|avatars|documents)$"),
    current_user: User = Depends(get_current_user),
):
    """Upload any permitted media file (images, videos, documents)."""
    result = await save_upload_file(file, subfolder=folder)
    return result

@router.post("/upload/service")
async def upload_service_media(
    file: UploadFile = File(...),
    current_user: User = Depends(require_provider),
):
    """Upload media specifically for a service portfolio or cover image."""
    result = await save_upload_file(file, subfolder="media")
    return result

@router.post("/upload/delivery")
async def upload_delivery_file(
    file: UploadFile = File(...),
    current_user: User = Depends(require_provider),
):
    """Upload deliverable file for an order submission."""
    result = await save_upload_file(file, subfolder="deliveries")
    return result

@router.get("/deliveries/{filename}")
def get_delivery_file(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Authenticated and authorized access to delivery files."""
    safe_filename = os.path.basename(filename)
    folder = ensure_upload_dir("deliveries")
    file_path = os.path.join(folder, safe_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Delivery file not found")

    if current_user.role != "ADMIN":
        # Ensure user is either buyer or seller of the order, or an active provider
        order = db.query(Order).filter(
            Order.delivery_files.contains(safe_filename),
            (Order.buyer_id == current_user.id) | (Order.seller_id == current_user.id),
        ).first()
        if not order and current_user.role != "PROVIDER":
            raise HTTPException(status_code=403, detail="Not authorized to access this delivery file")

    return FileResponse(file_path)
