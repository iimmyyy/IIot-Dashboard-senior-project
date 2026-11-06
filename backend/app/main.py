from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routes import alerts, audit, auth, experiments, health, measurements, workflows

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Schema changes are applied by Alembic in app.start before the server opens.
    yield


app = FastAPI(
    title="BioDry Research API",
    version="0.1.0",
    docs_url="/api/docs" if settings.environment == "local" else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)


@app.middleware("http")
async def security_boundary(request: Request, call_next):  # type: ignore[no-untyped-def]
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if origin != settings.frontend_origin:
            return JSONResponse(status_code=403, content={"detail": "Invalid request origin."})
    response = await call_next(request)
    response.headers["Cache-Control"] = (
        "no-store"
        if request.url.path.startswith("/api/v1/auth")
        else response.headers.get("Cache-Control", "no-cache")
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    return response


for route in (
    health.router,
    auth.router,
    experiments.router,
    measurements.router,
    workflows.router,
    alerts.router,
    audit.router,
):
    app.include_router(route, prefix="/api/v1")

