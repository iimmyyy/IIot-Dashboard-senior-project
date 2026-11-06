FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN groupadd --system biodry && useradd --system --gid biodry --create-home biodry
WORKDIR /app

COPY pyproject.toml ./
COPY app ./app
RUN pip install --upgrade pip && pip install "."

COPY alembic.ini ./
COPY alembic ./alembic

USER biodry
EXPOSE 8000
CMD ["python", "-m", "app.start"]

