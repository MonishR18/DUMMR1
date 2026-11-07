from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import List
from core.database import get_db
from models.messaging import Conversation, Message
from models.moderation import Block
from models.notification import Notification
from schemas.messaging import ConversationCreate, ConversationResponse, MessageCreate, MessageResponse
from core.security import get_current_active_user
from models.user import User

router = APIRouter(prefix="/api/conversations", tags=["messaging"])

def _populate_unread_count(conv: Conversation, user_id: int, db: Session) -> Conversation:
    unread = db.query(func.count(Message.id)).filter(
        Message.conversation_id == conv.id,
        Message.sender_id != user_id,
        Message.is_read == False
    ).scalar() or 0
    conv.unread_count = unread
    return conv

@router.get("", response_model=List[ConversationResponse])
def get_conversations(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    conversations = db.query(Conversation).filter(
        or_(Conversation.buyer_id == current_user.id, Conversation.seller_id == current_user.id)
    ).order_by(Conversation.updated_at.desc().nullslast(), Conversation.created_at.desc()).all()

    for c in conversations:
        _populate_unread_count(c, current_user.id, db)
    return conversations

@router.post("", response_model=ConversationResponse)
def create_conversation(conv: ConversationCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    participant = db.query(User).filter(User.id == conv.participant_id).first()
    if not participant:
        raise HTTPException(status_code=400, detail="Participant not found")
        
    if participant.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot start a conversation with yourself")

    # Enforce blocks
    is_blocked = db.query(Block).filter(
        or_(
            (Block.blocker_id == current_user.id) & (Block.blocked_id == participant.id),
            (Block.blocker_id == participant.id) & (Block.blocked_id == current_user.id)
        )
    ).first()
    if is_blocked:
        raise HTTPException(status_code=403, detail="Cannot message this user due to a block")

    # Unique per order if order_id is present, or unique per user pair for general DM (order_id is None)
    if conv.order_id:
        existing = db.query(Conversation).filter(
            Conversation.order_id == conv.order_id,
            or_(
                (Conversation.buyer_id == current_user.id) & (Conversation.seller_id == participant.id),
                (Conversation.seller_id == current_user.id) & (Conversation.buyer_id == participant.id)
            )
        ).first()
    else:
        existing = db.query(Conversation).filter(
            Conversation.order_id.is_(None),
            or_(
                (Conversation.buyer_id == current_user.id) & (Conversation.seller_id == participant.id),
                (Conversation.seller_id == current_user.id) & (Conversation.buyer_id == participant.id)
            )
        ).first()

    if existing:
        return _populate_unread_count(existing, current_user.id, db)
        
    db_conv = Conversation(
        buyer_id=current_user.id,
        seller_id=participant.id,
        order_id=conv.order_id
    )
    db.add(db_conv)
    db.commit()
    db.refresh(db_conv)
    db_conv.unread_count = 0
    return db_conv

@router.get("/{conversation_id}", response_model=ConversationResponse)
def get_conversation(conversation_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.buyer_id != current_user.id and conv.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return _populate_unread_count(conv, current_user.id, db)

@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
def get_messages(conversation_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.buyer_id != current_user.id and conv.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    return db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at.asc()).all()

@router.post("/{conversation_id}/messages", response_model=MessageResponse)
def send_message(conversation_id: int, msg: MessageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.buyer_id != current_user.id and conv.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    other_id = conv.seller_id if current_user.id == conv.buyer_id else conv.buyer_id

    # Enforce blocks
    is_blocked = db.query(Block).filter(
        or_(
            (Block.blocker_id == current_user.id) & (Block.blocked_id == other_id),
            (Block.blocker_id == other_id) & (Block.blocked_id == current_user.id)
        )
    ).first()
    if is_blocked:
        raise HTTPException(status_code=403, detail="Cannot send message to this user due to a block")
        
    db_msg = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=msg.content
    )
    db.add(db_msg)
    
    # Notify the other participant
    db_notif = Notification(user_id=other_id, type="NEW_MESSAGE", title="New Message", message="You received a new message")
    db.add(db_notif)
    
    db.commit()
    db.refresh(db_msg)
    return db_msg

@router.post("/{conversation_id}/read")
def mark_conversation_as_read(conversation_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_user)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.buyer_id != current_user.id and conv.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.sender_id != current_user.id,
        Message.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"message": "Messages marked as read"}
