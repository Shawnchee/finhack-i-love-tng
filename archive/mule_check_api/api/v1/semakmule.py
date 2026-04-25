from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from archive.mule_check_api.db.deps import get_db
from archive.mule_check_api.models.semakmule import (
    SemakMuleCheckRequest,
    SemakMuleCheckResponse,
)
from archive.mule_check_api.services.semakmule_service import SemakMuleService

router = APIRouter(prefix="/semakmule", tags=["SemakMule"])


def get_semakmule_service(db: Session = Depends(get_db)) -> SemakMuleService:
    return SemakMuleService(db=db)


@router.post("/mule-check", response_model=SemakMuleCheckResponse)
def mule_check(
    request: SemakMuleCheckRequest,
    service: SemakMuleService = Depends(get_semakmule_service),
):
    result = service.check_mule(request)
    return JSONResponse(content=result.model_dump(by_alias=True))
