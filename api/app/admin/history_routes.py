from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.admin.audit_repo import AuditRepo, AuditType, HistoryEntry, get_audit_repo
from app.admin.guard import get_admin_user
from app.auth.tokens import CurrentUser

router = APIRouter(prefix="/admin/history")

Admin = Annotated[CurrentUser, Depends(get_admin_user)]
Audit = Annotated[AuditRepo, Depends(get_audit_repo)]


class HistoryAdminOut(BaseModel):
    id: UUID
    display_name: str


class HistoryEntryOut(BaseModel):
    id: UUID
    type: AuditType
    admin: HistoryAdminOut
    target_name: str | None
    before: dict[str, object] | None
    after: dict[str, object] | None
    reason: str | None
    created_at: datetime


class HistoryOut(BaseModel):
    entries: list[HistoryEntryOut]


def entry_out(entry: HistoryEntry) -> HistoryEntryOut:
    return HistoryEntryOut(
        id=entry.id,
        type=entry.type,
        admin=HistoryAdminOut(id=entry.admin_id, display_name=entry.admin_name),
        target_name=entry.target_name,
        before=entry.before,
        after=entry.after,
        reason=entry.reason,
        created_at=entry.created_at,
    )


@router.get("")
def get_history(_admin: Admin, audit: Audit, type: Literal["score"] | None = None) -> HistoryOut:
    entries = audit.history(scores_only=type == "score")
    return HistoryOut(entries=[entry_out(entry) for entry in entries])
