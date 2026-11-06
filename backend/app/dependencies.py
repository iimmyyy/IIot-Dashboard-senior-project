from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import Settings, get_settings
from app.database import get_db
from app.models import AuthSession, ProjectMembership, User
from app.security import constant_time_equal, token_hash


@dataclass(frozen=True)
class AuthContext:
    user: User
    session: AuthSession


Db = Annotated[Session, Depends(get_db)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def aware(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def current_auth(
    request: Request,
    db: Db,
    settings: SettingsDep,
) -> AuthContext:
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required."
        )
    session = db.scalar(
        select(AuthSession)
        .options(
            selectinload(AuthSession.user)
            .selectinload(User.memberships)
            .selectinload(ProjectMembership.project)
        )
        .where(AuthSession.token_hash == token_hash(token))
    )
    if (
        not session
        or session.revoked_at is not None
        or aware(session.expires_at) <= datetime.now(UTC)
        or not session.user.active
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or revoked."
        )
    return AuthContext(user=session.user, session=session)


Auth = Annotated[AuthContext, Depends(current_auth)]


def csrf_auth(
    request: Request,
    auth: Auth,
    settings: SettingsDep,
    csrf_header: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
) -> AuthContext:
    csrf_cookie = request.cookies.get(settings.csrf_cookie_name)
    if (
        not csrf_header
        or not csrf_cookie
        or not constant_time_equal(csrf_header, csrf_cookie)
        or not constant_time_equal(token_hash(csrf_header), auth.session.csrf_hash)
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF validation failed.")
    return auth


CsrfAuth = Annotated[AuthContext, Depends(csrf_auth)]


def membership_for(db: Session, user_id: str, project_id: str) -> ProjectMembership:
    membership = db.scalar(
        select(ProjectMembership).where(
            ProjectMembership.user_id == user_id,
            ProjectMembership.project_id == project_id,
        )
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Project access denied.")
    return membership


def require_project_role(
    db: Session,
    auth: AuthContext,
    project_id: str,
    allowed_roles: set[str],
) -> ProjectMembership:
    membership = membership_for(db, auth.user.id, project_id)
    if membership.role not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role permission denied.")
    return membership


def client_address(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")

