from sqlalchemy.orm import Session

from mule_check_api.db.schema import NFPMule
from mule_check_api.models.nfp import (
    IdType,
    MuleCheckResult,
    NFPMuleCheckRequest,
    NFPMuleCheckResponse,
)

_MULE_TIER_DESCRIPTIONS = {
    1: "confirmed",
    2: "suspected",
}

# Maps IdType to the corresponding NFPMule column for lookup
_ID_COLUMN_MAP = {
    IdType.MYKAD: NFPMule.mykad_num,
    IdType.BRIC: NFPMule.bric_num,
    IdType.POLICE: NFPMule.police_id,
    IdType.ARMY: NFPMule.army_id,
    IdType.UNHCR: NFPMule.unhcr_num,
}


class NFPService:
    def __init__(self, db: Session):
        self._db = db

    def check_mule(self, request: NFPMuleCheckRequest) -> NFPMuleCheckResponse:
        mule_tier = self._get_mule_tier(request)

        return NFPMuleCheckResponse(
            http_status_code="OK",
            status=200,
            message="success",
            mule_check=MuleCheckResult(
                id_signature=request.id_signature,
                id_type=request.id_type,
                id_no=request.id_no,
                nationality=request.nationality,
                mule_tier=mule_tier,
                mule_tier_description=_MULE_TIER_DESCRIPTIONS.get(mule_tier)
                if mule_tier
                else None,
            ),
        )

    def _get_mule_tier(self, request: NFPMuleCheckRequest) -> int | None:
        column = _ID_COLUMN_MAP.get(request.id_type)
        if column is None:
            return None

        mule = self._db.query(NFPMule).filter(column == request.id_no).first()
        return 1 if mule else None
