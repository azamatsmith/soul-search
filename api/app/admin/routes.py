import re
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from app.admin.audit_repo import AuditEntry, AuditRepo, get_audit_repo
from app.admin.emails_repo import AllowedEmail, AllowedEmailsRepo, get_allowed_emails_repo
from app.admin.guard import get_admin_user
from app.auth.tokens import CurrentUser
from app.errors import ApiError

router = APIRouter(prefix="/admin")

Admin = Annotated[CurrentUser, Depends(get_admin_user)]
Emails = Annotated[AllowedEmailsRepo, Depends(get_allowed_emails_repo)]
Audit = Annotated[AuditRepo, Depends(get_audit_repo)]

EMAIL_PATTERN = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


class AllowedEmailOut(BaseModel):
    email: str
    display_name: str | None


class AllowedEmailsOut(BaseModel):
    emails: list[AllowedEmailOut]


class AddEmailBody(BaseModel):
    email: str


def normalize_email(email: str) -> str:
    return email.strip().lower()


def email_out(entry: AllowedEmail) -> AllowedEmailOut:
    return AllowedEmailOut(email=entry.email, display_name=entry.display_name)


@router.get("/allowed-emails")
def list_allowed_emails(_admin: Admin, emails: Emails) -> AllowedEmailsOut:
    return AllowedEmailsOut(emails=[email_out(entry) for entry in emails.list()])


@router.post("/allowed-emails", status_code=201)
def add_allowed_email(
    body: AddEmailBody, admin: Admin, emails: Emails, audit: Audit
) -> AllowedEmailOut:
    email = normalize_email(body.email)
    if not EMAIL_PATTERN.fullmatch(email):
        raise ApiError(422, "invalid_email")
    entry = emails.add(email, admin.id)
    if entry is None:
        raise ApiError(409, "already_allowed")
    audit.record(AuditEntry(admin_id=admin.id, type="emails", before=None, after={"email": email}))
    return email_out(entry)


@router.delete("/allowed-emails/{email}", status_code=204)
def remove_allowed_email(email: str, admin: Admin, emails: Emails, audit: Audit) -> Response:
    email = normalize_email(email)
    if email == normalize_email(admin.email):
        raise ApiError(422, "cannot_remove_self")
    if not emails.remove(email):
        raise ApiError(404, "not_found")
    audit.record(AuditEntry(admin_id=admin.id, type="emails", before={"email": email}, after=None))
    return Response(status_code=204)
