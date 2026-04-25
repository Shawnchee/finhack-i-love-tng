from sqlalchemy import String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from mule_check_api.core.config import config

engine = create_engine(config.db_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class NFPMule(Base):
    __tablename__ = "nfp_mule"
    # Reverse Engineer https://docs.developer.paynet.my/api-reference/nfp#/schemas/muleCheckRequest

    id: Mapped[int] = mapped_column(primary_key=True)
    bank_swift_code: Mapped[str] = mapped_column(String, index=True)
    bank_account: Mapped[str] = mapped_column(String)
    mykad_num: Mapped[str] = mapped_column(String)
    bric_num: Mapped[str] = mapped_column(String)
    police_id: Mapped[str] = mapped_column(String)
    army_id: Mapped[str] = mapped_column(String)
    unhcr_num: Mapped[str] = mapped_column(String)


class SemakMule(Base):
    __tablename__ = "semakmule_mule"

    id: Mapped[int] = mapped_column(primary_key=True)
    bank_swift_code: Mapped[str] = mapped_column(String, index=True)
    bank_account: Mapped[str] = mapped_column(String)
    phone_num: Mapped[str] = mapped_column(String)
    company_name: Mapped[str] = mapped_column(String)
