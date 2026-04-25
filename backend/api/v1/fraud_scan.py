from fastapi import APIRouter, HTTPException, Request

from backend.models.fraud_scan import ScanRequest, ScanResponse
from backend.services.fraud_scan.service import FraudScanService

router = APIRouter(prefix="/scan", tags=["FraudScan"])


def _get_service(request: Request) -> FraudScanService:
    return request.app.state.fraud_scan_service


@router.post("/url", response_model=ScanResponse)
async def scan_url(body: ScanRequest, request: Request):
    service = _get_service(request)
    try:
        return await service.scan(body.url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")
