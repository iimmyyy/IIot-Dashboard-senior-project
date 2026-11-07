from sqlalchemy.engine import make_url

from app.config import Settings


def test_database_url_preserves_reserved_password_characters() -> None:
    password = "safe@hash#percent%slash/password"
    settings = Settings(
        database_url=None,
        database_driver="postgresql+psycopg",
        database_host="db",
        database_port=5432,
        database_name="biodry",
        database_user="biodry",
        database_password=password,
    )

    parsed = make_url(settings.sqlalchemy_url())

    assert parsed.host == "db"
    assert parsed.database == "biodry"
    assert parsed.username == "biodry"
    assert parsed.password == password
