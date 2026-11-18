import os
import uuid
import logging
from typing import Optional, Dict, Any
from fastapi import UploadFile, HTTPException, status
from core.config import settings

logger = logging.getLogger(__name__)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
ALLOWED_DOC_TYPES = {"application/pdf", "application/zip", "application/x-zip-compressed"}
ALL_ALLOWED_TYPES = ALLOWED_IMAGE_TYPES | ALLOWED_VIDEO_TYPES | ALLOWED_DOC_TYPES

MIME_TO_EXTENSIONS = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
    "image/gif": {".gif"},
    "video/mp4": {".mp4"},
    "video/webm": {".webm"},
    "video/quicktime": {".mov", ".qt"},
    "application/pdf": {".pdf"},
    "application/zip": {".zip"},
    "application/x-zip-compressed": {".zip"},
}

MAX_IMAGE_SIZE = 10 * 1024 * 1024       # 10 MB
MAX_VIDEO_SIZE = 100 * 1024 * 1024     # 100 MB

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))

def ensure_upload_dir(subfolder: str = "media") -> str:
    folder = os.path.join(UPLOAD_DIR, subfolder)
    os.makedirs(folder, exist_ok=True)
    return folder

def validate_magic_bytes(content: bytes, content_type: str) -> bool:
    """Validate content bytes match known file signatures (magic bytes)."""
    if len(content) < 4:
        return False
    if content_type == "image/jpeg":
        return content.startswith(b"\xff\xd8\xff")
    elif content_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    elif content_type == "image/gif":
        return content.startswith(b"GIF87a") or content.startswith(b"GIF89a")
    elif content_type == "image/webp":
        return len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"
    elif content_type == "application/pdf":
        return content.startswith(b"%PDF")
    elif content_type in ("application/zip", "application/x-zip-compressed"):
        return content.startswith(b"PK\x03\x04") or content.startswith(b"PK\x05\x06") or content.startswith(b"PK\x07\x08")
    elif content_type in ("video/mp4", "video/quicktime"):
        return len(content) >= 8 and content[4:8] == b"ftyp"
    elif content_type == "video/webm":
        return content.startswith(b"\x1a\x45\xdf\xa3")
    return False

async def save_upload_file(file: UploadFile, subfolder: str = "media") -> Dict[str, Any]:
    """Validate and store an uploaded file with MIME, extension, and magic-byte checks."""
    content_type = file.content_type or "application/octet-stream"
    
    if content_type not in ALL_ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{content_type}'. Allowed: images (jpeg, png, webp, gif), videos (mp4, webm), or documents (pdf, zip).",
        )

    # Cross-validate file extension against declared MIME type
    ext = os.path.splitext(file.filename or "")[1].lower()
    allowed_exts = MIME_TO_EXTENSIONS.get(content_type, set())
    if ext:
        if ext not in allowed_exts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension '{ext}' does not match content type '{content_type}'. Allowed: {sorted(list(allowed_exts))}",
            )
    else:
        # Default extension if omitted in filename
        if content_type == "image/jpeg":
            ext = ".jpg"
        elif content_type == "image/png":
            ext = ".png"
        elif content_type == "image/webp":
            ext = ".webp"
        elif content_type == "image/gif":
            ext = ".gif"
        elif content_type == "video/mp4":
            ext = ".mp4"
        elif content_type == "video/webm":
            ext = ".webm"
        elif content_type == "video/quicktime":
            ext = ".mov"
        elif content_type == "application/pdf":
            ext = ".pdf"
        elif content_type in ("application/zip", "application/x-zip-compressed"):
            ext = ".zip"
        else:
            ext = ".bin"

    # Read content to check file size and magic bytes
    content = await file.read()
    file_size = len(content)

    max_size = MAX_IMAGE_SIZE if content_type in ALLOWED_IMAGE_TYPES else MAX_VIDEO_SIZE
    if file_size > max_size:
        limit_mb = max_size // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {limit_mb}MB.",
        )

    # Magic byte verification
    if not validate_magic_bytes(content, content_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File content does not match declared type '{content_type}' (magic byte check failed).",
        )

    # Generate secure unique filename
    unique_filename = f"{uuid.uuid4().hex}{ext}"

    # Handle S3 storage if configured
    if settings.STORAGE_PROVIDER == "s3" and settings.AWS_S3_BUCKET and settings.AWS_ACCESS_KEY_ID:
        try:
            import boto3
            s3 = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION,
            )
            s3_key = f"{subfolder}/{unique_filename}"
            s3.put_object(
                Bucket=settings.AWS_S3_BUCKET,
                Key=s3_key,
                Body=content,
                ContentType=content_type,
            )
            file_url = f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}"
            return {
                "url": file_url,
                "filename": unique_filename,
                "original_name": file.filename,
                "content_type": content_type,
                "size": file_size,
                "provider": "s3",
            }
        except Exception as e:
            logger.warning(f"S3 upload failed, falling back to local: {e}")

    # Default: Local file storage
    folder = ensure_upload_dir(subfolder)
    file_path = os.path.join(folder, unique_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    # Delivery files use authenticated download endpoint; others are static
    if subfolder == "deliveries":
        file_url = f"/api/storage/deliveries/{unique_filename}"
    else:
        file_url = f"/static/uploads/{subfolder}/{unique_filename}"

    return {
        "url": file_url,
        "filename": unique_filename,
        "original_name": file.filename,
        "content_type": content_type,
        "size": file_size,
        "provider": "local",
    }
