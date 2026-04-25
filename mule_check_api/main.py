from fastapi import FastAPI

from mule_check_api.api.v1 import nfp, semakmule
from mule_check_api.core.config import config
from mule_check_api.core.logging import setup_logging
from mule_check_api.db.schema import Base, engine

setup_logging()
Base.metadata.create_all(bind=engine)

app = FastAPI(title=config.app_name)

app.include_router(nfp.router, prefix="/api/v1")
app.include_router(semakmule.router, prefix="/api/v1")
