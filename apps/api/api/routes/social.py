from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from core.database import get_db
from models.social import Post, Comment, Like, Bookmark, Follow
from models.moderation import Block
from models.user import User
from schemas.social import PostCreate, PostResponse, CommentBase, CommentResponse
from core.security import get_current_active_user, require_verified_user, ALGORITHM
from core.limiter import limiter
from core.config import settings
from jose import jwt, JWTError

router = APIRouter(prefix="/api", tags=["social (deprecated)"], deprecated=True)

oauth2_optional = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)

def get_optional_user(token: Optional[str] = Depends(oauth2_optional), db: Session = Depends(get_db)) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id:
            return db.query(User).filter(User.id == int(user_id)).first()
    except JWTError:
        pass
    return None

@router.get("/feed", response_model=List[PostResponse])
def get_feed(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
    skip: int = 0,
    limit: int = 20
):
    query = db.query(Post)
    if current_user:
        # Enforce blocks in feed: hide posts from blocked users or users who blocked current_user
        blocked_user_ids = [
            b[0] for b in db.query(Block.blocked_id).filter(Block.blocker_id == current_user.id).all()
        ] + [
            b[0] for b in db.query(Block.blocker_id).filter(Block.blocked_id == current_user.id).all()
        ]
        if blocked_user_ids:
            query = query.filter(Post.author_id.notin_(blocked_user_ids))
    return query.order_by(Post.created_at.desc()).offset(skip).limit(limit).all()

@router.post("/posts", response_model=PostResponse)
@limiter.limit("10/minute")
def create_post(
    request: Request,
    post: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_verified_user)
):
    user_id = current_user.id
    db_post = Post(content=post.content, author_id=user_id)
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post

@router.post("/posts/{post_id}/like")
def toggle_like(post_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    user_id = current_user.id
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
        
    existing_like = db.query(Like).filter(Like.post_id == post_id, Like.user_id == user_id).first()
    if existing_like:
        db.delete(existing_like)
        db.commit()
        return {"status": "unliked"}
    else:
        new_like = Like(post_id=post_id, user_id=user_id)
        db.add(new_like)
        db.commit()
        return {"status": "liked"}

@router.post("/posts/{post_id}/bookmark")
def toggle_bookmark(post_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    user_id = current_user.id
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
        
    existing_bookmark = db.query(Bookmark).filter(Bookmark.post_id == post_id, Bookmark.user_id == user_id).first()
    if existing_bookmark:
        db.delete(existing_bookmark)
        db.commit()
        return {"status": "unbookmarked"}
    else:
        new_bookmark = Bookmark(post_id=post_id, user_id=user_id)
        db.add(new_bookmark)
        db.commit()
        return {"status": "bookmarked"}

@router.get("/posts/{post_id}/comments", response_model=List[CommentResponse])
def get_comments(post_id: int, db: Session = Depends(get_db)):
    comments = db.query(Comment).filter(Comment.post_id == post_id).order_by(Comment.created_at.asc()).all()
    return comments

@router.post("/posts/{post_id}/comments", response_model=CommentResponse)
@limiter.limit("20/minute")
def create_comment(
    request: Request,
    post_id: int,
    comment: CommentBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    user_id = current_user.id
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
        
    db_comment = Comment(content=comment.content, author_id=user_id, post_id=post_id)
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment
