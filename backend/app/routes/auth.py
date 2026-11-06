from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload

from app.audit import add_audit_event
from app.config import Settings
from app.dependencies import Auth, CsrfAuth, Db, SettingsDep, client_address
from app.models import AuthSession, LoginRateLimit, ProjectMembership, User
from app.presenters import user_out
from app.schemas import AuthOut, LoginRequest, UserOut
from app.security import new_token, privacy_hash, token_hash, verify_password

router = APIRouter(prefix="/auth", tags=["authentication"])


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def normalized_username(value: str) -> str:
    return value.strip().lower()


def limit_key(request: Request, username: str) -> str:
    return privacy_hash(f"{client_address(request)}:{username}")


def checked_rate_limit(
    db: Db, settings: Settings, key: str, now: datetime
) -> LoginRateLimit | None:
    record = db.scalar(
        select(LoginRateLimit).where(LoginRateLimit.key_hash == key).with_for_update()
    )
    if record and record.blocked_until and _utc(record.blocked_until) > now:
        retry = max(1, int((_utc(record.blocked_until) - now).total_seconds()))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many sign-in attempts. Try again later.",
            headers={"Retry-After": str(retry)},
        )
    window = timedelta(minutes=settings.login_window_minutes)
    if record and _utc(record.window_started_at) + window <= now:
        record.attempts = 0
        record.window_started_at = now
        record.blocked_until = None
    return record


def record_failed_login(
    db: Db,
    settings: Settings,
    key: str,
    record: LoginRateLimit | None,
    now: datetime,
) -> None:
    if not record:
        record = LoginRateLimit(key_hash=key, window_started_at=now, attempts=0)
        db.add(record)
    record.attempts += 1
    if record.attempts >= settings.login_attempt_limit:
        record.blocked_until = now + timedelta(minutes=settings.login_window_minutes)
    db.commit()


def set_auth_cookies(
    response: Response,
    settings: Settings,
    session_token: str,
    csrf_token: str,
) -> None:
    max_age = settings.session_hours * 60 * 60
    response.set_cookie(
        settings.session_cookie_name,
        session_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path="/",
        max_age=max_age,
    )
    response.set_cookie(
        settings.csrf_cookie_name,
        csrf_token,
        httponly=False,
        secure=settings.cookie_secure,
        samesite="strict",
        path="/",
        max_age=max_age,
    )


@router.post("/login", response_model=AuthOut)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Db,
    settings: SettingsDep,
) -> AuthOut:
    now = datetime.now(UTC)
    username = normalized_username(payload.username)
    key = limit_key(request, username)
    limiter = checked_rate_limit(db, settings, key, now)
    user = db.scalar(
        select(User)
        .options(selectinload(User.memberships).selectinload(ProjectMembership.project))
        .where(User.username == username)
    )
    if not user or not user.active or not verify_password(payload.password, user.password_hash):
        # Always execute one Argon2 verification, including for unknown accounts.
        if not user:
            verify_password(payload.password, None)
        record_failed_login(db, settings, key, limiter, now)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

    db.execute(delete(LoginRateLimit).where(LoginRateLimit.key_hash == key))
    session_token = new_token()
    csrf_token = new_token()
    expires_at = now + timedelta(hours=settings.session_hours)
    session = AuthSession(
        user_id=user.id,
        token_hash=token_hash(session_token),
        csrf_hash=token_hash(csrf_token),
        expires_at=expires_at,
        client_address_hash=privacy_hash(client_address(request)),
        user_agent=request.headers.get("user-agent", "")[:300] or None,
    )
    db.add(session)
    db.flush()
    add_audit_event(
        db,
        action="auth.login",
        target_type="session",
        target_id=session.id,
        actor_id=user.id,
        project_id=None,
    )
    db.commit()
    set_auth_cookies(response, settings, session_token, csrf_token)
    return AuthOut(user=user_out(user), csrf_token=csrf_token, expires_at=expires_at)


@router.get("/me", response_model=UserOut)
def me(auth: Auth) -> UserOut:
    return user_out(auth.user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    auth: CsrfAuth,
    db: Db,
    settings: SettingsDep,
) -> Response:
    auth.session.revoked_at = datetime.now(UTC)
    add_audit_event(
        db,
        action="auth.logout",
        target_type="session",
        target_id=auth.session.id,
        actor_id=auth.user.id,
        project_id=None,
    )
    db.commit()
    response.delete_cookie(settings.session_cookie_name, path="/")
    response.delete_cookie(settings.csrf_cookie_name, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response

