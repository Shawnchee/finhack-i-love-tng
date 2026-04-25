from sqlalchemy.orm import Session

from archive.mule_check_api.db.schema import SemakMule
from archive.mule_check_api.models.semakmule import (
    SemakMuleCheckRequest,
    SemakMuleCheckResponse,
)


class SemakMuleService:
    def __init__(self, db: Session):
        self._db = db

    def check_mule(self, request: SemakMuleCheckRequest) -> SemakMuleCheckResponse:
        is_mule = self._is_mule(request)

        return SemakMuleCheckResponse(
            response_code="00",
            response_message="Success",
            bank_swift_code=request.bank_swift_code,
            bank_account_no=request.bank_account_no,
            is_mule=is_mule,
        )

    def _is_mule(self, request: SemakMuleCheckRequest) -> bool:
        query = self._db.query(SemakMule).filter(
            SemakMule.bank_swift_code == request.bank_swift_code,
            SemakMule.bank_account == request.bank_account_no,
        )

        if request.phone_num:
            query = query.filter(SemakMule.phone_num == request.phone_num)

        return query.first() is not None
