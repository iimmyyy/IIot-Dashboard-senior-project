import hashlib
import hmac
import secrets

from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()
DUMMY_HASH = password_hash.hash("BioDry dummy password used only to equalize failed login work")


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, encoded: str | None) -> bool:
    try:
        return password_hash.verify(password, encoded or DUMMY_HASH)
    except Exception:
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def constant_time_equal(left: str, right: str) -> bool:
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))


def privacy_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def validate_bootstrap_password(password: str) -> None:
    if len(password) < 14:
        raise ValueError("Bootstrap passwords must contain at least 14 characters.")
    if password.lower() in {"password123456", "biodry-password", "changeme123456"}:
        raise ValueError("Choose a non-default bootstrap password.")

