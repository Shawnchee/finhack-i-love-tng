from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from archive.mule_check_api.api.v1 import nfp
from archive.mule_check_api.api.v1 import semakmule
from archive.mule_check_api.core.config import config
from archive.mule_check_api.core.logging import setup_logging
from archive.mule_check_api.db.schema import Base, engine

setup_logging()
Base.metadata.create_all(bind=engine)

app = FastAPI(title=config.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(nfp.router, prefix="/api/v1")
app.include_router(semakmule.router, prefix="/api/v1")
