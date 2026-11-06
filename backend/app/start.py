import os
import subprocess
import sys
import time


def migrate_with_retries(attempts: int = 12) -> None:
    for attempt in range(1, attempts + 1):
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            check=False,
        )
        if result.returncode == 0:
            return
        if attempt == attempts:
            raise SystemExit("Database migrations failed after bounded retries.")
        time.sleep(min(5, attempt))


def main() -> None:
    migrate_with_retries()
    os.execvp(
        sys.executable,
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
            "--proxy-headers",
            "--forwarded-allow-ips=frontend",
        ],
    )


if __name__ == "__main__":
    main()

