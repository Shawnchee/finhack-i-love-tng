from sqlalchemy.orm import Session

from backend.db.schema import SemakMule
from backend.models.semakmule import SemakMuleCheckRequest, SemakMuleCheckResponse


class SemakMuleService:
    def __init__(self, db: Session) -> None:
        self._db = db

    def check_mule(self, request: SemakMuleCheckRequest) -> SemakMuleCheckResponse:
        return SemakMuleCheckResponse(
            response_code="00",
            response_message="Success",
            bank_swift_code=request.bank_swift_code,
            bank_account_no=request.bank_account_no,
            is_mule=self._is_mule(request),
        )

    def _is_mule(self, request: SemakMuleCheckRequest) -> bool:
        query = self._db.query(SemakMule).filter(
            SemakMule.bank_swift_code == request.bank_swift_code,
            SemakMule.bank_account == request.bank_account_no,
        )
        if request.phone_num:
            query = query.filter(SemakMule.phone_num == request.phone_num)
        return query.first() is not None
