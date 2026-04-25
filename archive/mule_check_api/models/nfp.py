from enum import StrEnum

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class IdType(StrEnum):
    MYKAD = "mykad"
    BRIC = "bric"
    POLICE = "police"
    ARMY = "army"
    UNHCR = "unhcr"
    PASSPORT = "passport"


class NFPMuleCheckRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id_signature: str
    id_type: IdType
    id_no: str
    nationality: str
    purpose: str


class MuleCheckResult(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id_signature: str
    id_type: IdType
    id_no: str
    nationality: str
    mule_tier: int | None = None
    mule_tier_description: str | None = None


class NFPMuleCheckResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    http_status_code: str
    status: int
    message: str
    mule_check: MuleCheckResult
