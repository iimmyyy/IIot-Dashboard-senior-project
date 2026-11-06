from datetime import UTC, datetime

from fastapi import APIRouter
from sqlalchemy import text

from app.dependencies import Db
from app.schemas import HealthOut

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
def health(db: Db) -> HealthOut:
    db.execute(text("SELECT 1"))
    return HealthOut(status="ok", database="connected", time=datetime.now(UTC))

