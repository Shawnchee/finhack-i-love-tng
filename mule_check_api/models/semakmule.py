from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class SemakMuleCheckRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    bank_swift_code: str
    bank_account_no: str
    phone_num: str = ""
    company_name: str = ""


class SemakMuleCheckResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    response_code: str
    response_message: str
    bank_swift_code: str
    bank_account_no: str
    is_mule: bool
