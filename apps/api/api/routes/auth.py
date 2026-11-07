import time
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from core.database import get_db
from models.user import User
from schemas.user import (
    UserCreate,
    PrivateUserResponse,
    Token,
    RefreshToken,
    PasswordReset,
    PasswordResetConfirm,
)
from core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_email_verification_token,
    create_password_reset_token,
    get_current_active_user,
    oauth2_scheme,
    ALGORITHM,
)
from core.redis import block_token, is_token_blocked
from core.email import send_verification_email, send_password_reset_email
from core.limiter import limiter
from jose import jwt, JWTError
from core.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=PrivateUserResponse)
@limiter.limit("5/minute")
def register(request: Request, user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if username or email exists
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if db.query(User).filter(User.username == user_in.username).first():
        raise HTTPException(status_code=409, detail="Username already registered")
    
    # Prevent normal user from registering as ADMIN
    role = user_in.role.upper()
    if role not in ["CLIENT", "PROVIDER"]:
        if role == "ADMIN":
            raise HTTPException(status_code=400, detail="Cannot register as ADMIN directly")
        raise HTTPException(status_code=400, detail="Invalid role assignment")
        
    db_user = User(
        name=user_in.name,
        username=user_in.username,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=role,
        specialty=user_in.specialty,
        expertise=user_in.specialty,
        bio=user_in.bio,
        avatar_url=user_in.avatar_url,
        profile_image=user_in.avatar_url,
        college=user_in.college,
        is_verified=False,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Email verification token & email dispatch
    verification_token = create_email_verification_token(db_user.id)
    send_verification_email(db_user.email, verification_token)

    return db_user

@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        # Allow login by email as well
        user = db.query(User).filter(User.email == form_data.username).first()
        if not user or not verify_password(form_data.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }

@router.post("/refresh", response_model=Token)
def refresh_token(token_data: RefreshToken, db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token_data.refresh_token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise credentials_exception
        jti = payload.get("jti")
        if not jti or is_token_blocked(jti):
            raise credentials_exception
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        exp = payload.get("exp")
    except JWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise credentials_exception
        
    # Blocklist old refresh token until its expiry (rotation)
    if exp:
        ttl = max(60, int(exp - time.time()))
        block_token(jti, ttl)
    else:
        block_token(jti, 86400 * settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

    access_token = create_access_token(subject=user.id)
    new_refresh_token = create_refresh_token(subject=user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }

@router.post("/logout")
def logout(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti:
            ttl = max(60, int(exp - time.time())) if exp else 3600
            block_token(jti, ttl)
    except JWTError:
        pass
    return {"message": "Successfully logged out"}

@router.get("/me", response_model=PrivateUserResponse)
def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user

@router.get("/verify-email")
def verify_email_get(token: str = Query(...), db: Session = Depends(get_db)):
    return _process_email_verification(token, db)

@router.post("/verify-email")
def verify_email_post(token: str = Query(None), body: Optional[dict] = None, db: Session = Depends(get_db)):
    token_val = token or (body.get("token") if body else None)
    if not token_val:
        raise HTTPException(status_code=400, detail="Verification token is required")
    return _process_email_verification(token_val, db)

def _process_email_verification(token: str, db: Session) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "verify_email":
            raise HTTPException(status_code=400, detail="Invalid verification token")
        jti = payload.get("jti")
        if jti and is_token_blocked(jti):
            raise HTTPException(status_code=400, detail="Verification token already used")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid verification token")
        exp = payload.get("exp")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_verified = True
    db.commit()

    if jti:
        ttl = max(60, int(exp - time.time())) if exp else 86400
        block_token(jti, ttl)

    return {"message": "Email verified successfully"}

@router.post("/forgot-password")
@limiter.limit("5/minute")
def forgot_password(request: Request, reset_data: PasswordReset, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == reset_data.email).first()
    if user:
        reset_token = create_password_reset_token(user.id)
        send_password_reset_email(user.email, reset_token)
    return {"message": "If the email exists, a password reset link has been sent"}

@router.post("/reset-password")
def reset_password(reset_data: PasswordResetConfirm, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(reset_data.token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid reset token")
        jti = payload.get("jti")
        if jti and is_token_blocked(jti):
            raise HTTPException(status_code=400, detail="Reset token has already been used")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid reset token")
        exp = payload.get("exp")
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    user.hashed_password = get_password_hash(reset_data.new_password)
    db.commit()

    if jti:
        ttl = max(60, int(exp - time.time())) if exp else 3600
        block_token(jti, ttl)

    return {"message": "Password has been reset successfully"}
