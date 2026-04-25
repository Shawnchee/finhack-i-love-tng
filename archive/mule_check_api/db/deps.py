from collections.abc import Generator

from sqlalchemy.orm import Session

from archive.mule_check_api.db.schema import SessionLocal


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
