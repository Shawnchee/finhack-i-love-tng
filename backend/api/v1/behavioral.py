from fastapi import APIRouter, HTTPException, Request

from backend.models.behavioral import (
    CheckTransactionRequest,
    CheckTransactionResponse,
    SimulateTransactionRequest,
    UserProfileResponse,
)
from backend.services.behavioral.service import BehavioralService

router = APIRouter(prefix="/behavioral", tags=["Behavioral"])


def _get_service(request: Request) -> BehavioralService:
    return request.app.state.behavioral_service


@router.post("/check-transaction", response_model=CheckTransactionResponse)
def check_transaction(body: CheckTransactionRequest, request: Request):
    try:
        return _get_service(request).check_transaction(body)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Unknown user_id: {exc}")


@router.get("/user-profile/{user_id}", response_model=UserProfileResponse)
def user_profile(user_id: str, request: Request):
    try:
        return _get_service(request).get_user_profile(user_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown user_id: {user_id}")


@router.post("/simulate-transaction", response_model=UserProfileResponse)
def simulate_transaction(body: SimulateTransactionRequest, request: Request):
    try:
        return _get_service(request).simulate_transaction(body)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown user_id: {body.user_id}")
