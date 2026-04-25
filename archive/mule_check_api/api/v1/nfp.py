from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from archive.mule_check_api.db.deps import get_db
from archive.mule_check_api.models.nfp import NFPMuleCheckRequest, NFPMuleCheckResponse
from archive.mule_check_api.services.nfp_service import NFPService

router = APIRouter(prefix="/nfp", tags=["NFP"])


def get_nfp_service(db: Session = Depends(get_db)) -> NFPService:
    return NFPService(db=db)


# Ref: https://docs.developer.paynet.my/api-reference/nfp#/paths/nfp-api-v2-server-mule-check/post
@router.post("/mule-check", response_model=NFPMuleCheckResponse)
def mule_check(
    request: NFPMuleCheckRequest,
    service: NFPService = Depends(get_nfp_service),
):
    result = service.check_mule(request)
    return JSONResponse(content=result.model_dump(by_alias=True))
