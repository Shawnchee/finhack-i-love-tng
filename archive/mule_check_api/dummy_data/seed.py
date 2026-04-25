"""Run from project root with: .venv/bin/python -m mule_check_api.dummy_data.seed"""

from archive.mule_check_api.db.schema import (
    Base,
    NFPMule,
    SemakMule,
    SessionLocal,
    engine,
)

_NFP_MULES = [
    NFPMule(
        bank_swift_code="MBBEMYKL",
        bank_account="512802774281",
        mykad_num="900101015555",
        bric_num="",
        police_id="",
        army_id="",
        unhcr_num="",
    ),
    NFPMule(
        bank_swift_code="RHBBMYKL",
        bank_account="17900052144",
        mykad_num="850615085678",
        bric_num="",
        police_id="",
        army_id="",
        unhcr_num="",
    ),
    NFPMule(
        bank_swift_code="CIMBMYKL",
        bank_account="26700077605",
        mykad_num="",
        bric_num="BR123456",
        police_id="",
        army_id="",
        unhcr_num="",
    ),
    NFPMule(
        bank_swift_code="HLBBMYKL",
        bank_account="26444100022578",
        mykad_num="",
        bric_num="",
        police_id="PD98765",
        army_id="",
        unhcr_num="",
    ),
    NFPMule(
        bank_swift_code="PBBEMYKL",
        bank_account="25810500018077",
        mykad_num="",
        bric_num="",
        police_id="",
        army_id="AT11223",
        unhcr_num="",
    ),
]

_SEMAKMULE_MULES = [
    SemakMule(
        bank_swift_code="MBBEMYKL",
        bank_account="512802774281",
        phone_num="0104269914",
        company_name="",
    ),
    SemakMule(
        bank_swift_code="MBBEMYKL",
        bank_account="17900052144",
        phone_num="0179764986",
        company_name="",
    ),
    SemakMule(
        bank_swift_code="RHBBMYKL",
        bank_account="26700077605",
        phone_num="01123520121",
        company_name="",
    ),
    SemakMule(
        bank_swift_code="CIMBMYKL",
        bank_account="1013041100083926",
        phone_num="01161051865",
        company_name="",
    ),
    SemakMule(
        bank_swift_code="HLBBMYKL",
        bank_account="26444100022578",
        phone_num="0163411403",
        company_name="",
    ),
    SemakMule(
        bank_swift_code="PBBEMYKL",
        bank_account="25810500018077",
        phone_num="0142897177",
        company_name="",
    ),
    SemakMule(
        bank_swift_code="PBBEMYKL",
        bank_account="21220000087743",
        phone_num="0142472412",
        company_name="",
    ),
    SemakMule(
        bank_swift_code="MBBEMYKL",
        bank_account="8881032092097",
        phone_num="01125054956",
        company_name="",
    ),
    SemakMule(
        bank_swift_code="RHBBMYKL",
        bank_account="4946775140",
        phone_num="0142447614",
        company_name="Syarikat Mule Sdn Bhd",
    ),
]


def seed() -> None:
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        if db.query(NFPMule).count() == 0:
            db.add_all(_NFP_MULES)

        if db.query(SemakMule).count() == 0:
            db.add_all(_SEMAKMULE_MULES)

        db.commit()
        print("Seed complete.")


if __name__ == "__main__":
    seed()
