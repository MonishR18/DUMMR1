from fastapi import APIRouter, Depends, UploadFile, File, Query
from core.security import get_current_user, require_provider
from core.storage import save_upload_file
from models.user import User

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
