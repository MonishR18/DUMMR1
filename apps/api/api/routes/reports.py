from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from core.database import get_db
from models.user import User
from models.moderation import Report
from schemas.moderation import ReportCreate, ReportResponse
from core.security import get_current_active_user

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    report_in: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    target_type = report_in.target_type.upper()
    if target_type not in ["USER", "SERVICE", "POST", "COMMENT"]:
        raise HTTPException(status_code=400, detail="Invalid target_type. Must be USER, SERVICE, POST, or COMMENT.")

    new_report = Report(
        reporter_id=current_user.id,
        target_type=target_type,
        target_id=report_in.target_id,
        reason=report_in.reason,
        status="PENDING",
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    return new_report
