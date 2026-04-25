# Backend Handbook

Dummy backend that mirrors the PayNet NFP and SemakMule APIs. Intended for MVP development and frontend integration testing — responses match the production payload format without hitting live systems.

---

## Context

Both APIs are anti-mule data sharing platforms operated in Malaysia, accessible only to licensed banks and financial institutions.

| Platform | Purpose |
|---|---|
| **NFP** (National Fraud Portal) | Checks if an individual's identity document is linked to a known mule account |
| **SemakMule** | Checks if a bank account or phone number is linked to a known mule |

---

## Project Structure

```
backend/
├── api/v1/
│   ├── nfp.py          # POST /api/v1/nfp/mule-check
│   └── semakmule.py    # POST /api/v1/semakmule/mule-check
├── models/
│   ├── nfp.py          # NFPMuleCheckRequest / NFPMuleCheckResponse
│   └── semakmule.py    # SemakMuleCheckRequest / SemakMuleCheckResponse
├── services/
│   ├── nfp_service.py          # NFP lookup logic
│   └── semakmule_service.py    # SemakMule lookup logic
├── db/
│   ├── schema.py       # SQLAlchemy table definitions
│   └── deps.py         # get_db() FastAPI dependency
├── core/
│   ├── config.py       # App config via pydantic-settings
│   └── logging.py      # Logging setup
├── dummy-data/
│   └── seed.py         # Populates DB with known mule records
└── main.py             # FastAPI app entry point
```

---

## Getting Started

**Install dependencies**
```bash
pip install -r requirements.txt
```

**Seed the database**
```bash
python -m backend.dummy-data.seed
```

This creates `test.db` at the project root with pre-loaded mule records for both tables.

**Start the server**
```bash
uvicorn backend.main:app --reload
```

Interactive docs available at `http://localhost:8000/docs`.

---

## API Reference

### NFP — Mule Check

`POST /api/v1/nfp/mule-check`

Checks whether an identity document is associated with a known mule. Mirrors the PayNet NFP API.

Reference: https://docs.developer.paynet.my/api-reference/nfp#/paths/nfp-api-v2-server-mule-check/post

**Request**
```json
{
  "idSignature": "1fd6499862530505e6fc16298aec25ed89e860d81950c6",
  "idType": "mykad",
  "idNo": "900101015555",
  "nationality": "MY",
  "purpose": "01"
}
```

| Field | Type | Description |
|---|---|---|
| `idSignature` | string | Hashed ID (accepted but unused in dummy backend) |
| `idType` | enum | `mykad` · `bric` · `police` · `army` · `unhcr` · `passport` |
| `idNo` | string | Plain ID number — used for DB lookup |
| `nationality` | string | ISO country code |
| `purpose` | string | Reason for check (e.g. `"01"` = account opening) |

**Response — mule found**
```json
{
  "httpStatusCode": "OK",
  "status": 200,
  "message": "success",
  "muleCheck": {
    "idSignature": "1fd6499862530505e6fc16298aec25ed89e860d81950c6",
    "idType": "mykad",
    "idNo": "900101015555",
    "nationality": "MY",
    "muleTier": 1,
    "muleTierDescription": "confirmed"
  }
}
```

**Response — not a mule**
```json
{
  "httpStatusCode": "OK",
  "status": 200,
  "message": "success",
  "muleCheck": {
    "idSignature": "...",
    "idType": "mykad",
    "idNo": "000000000000",
    "nationality": "MY",
    "muleTier": null,
    "muleTierDescription": null
  }
}
```

| `muleTier` | Meaning |
|---|---|
| `1` | Confirmed mule |
| `2` | Suspected mule |
| `null` | Not found in mule database |

---

### SemakMule — Mule Check

`POST /api/v1/semakmule/mule-check`

Checks whether a bank account (and optionally a phone number) is linked to a known mule.

**Request**
```json
{
  "bankSwiftCode": "MBBEMYKL",
  "bankAccountNo": "512802774281",
  "phoneNum": "0104269914",
  "companyName": ""
}
```

| Field | Type | Description |
|---|---|---|
| `bankSwiftCode` | string | Bank SWIFT/BIC code |
| `bankAccountNo` | string | Bank account number |
| `phoneNum` | string | Optional — narrows match if provided |
| `companyName` | string | Optional — for corporate accounts |

**Response — mule found**
```json
{
  "responseCode": "00",
  "responseMessage": "Success",
  "bankSwiftCode": "MBBEMYKL",
  "bankAccountNo": "512802774281",
  "isMule": true
}
```

**Response — not a mule**
```json
{
  "responseCode": "00",
  "responseMessage": "Success",
  "bankSwiftCode": "MBBEMYKL",
  "bankAccountNo": "000000000000",
  "isMule": false
}
```

---

## Seed Data

### NFP Mules

| Bank | Account | ID Type | ID No |
|---|---|---|---|
| MBBEMYKL | 512802774281 | mykad | 900101015555 |
| RHBBMYKL | 17900052144 | mykad | 850615085678 |
| CIMBMYKL | 26700077605 | bric | BR123456 |
| HLBBMYKL | 26444100022578 | police | PD98765 |
| PBBEMYKL | 25810500018077 | army | AT11223 |

### SemakMule Mules

| Bank | Account | Phone |
|---|---|---|
| MBBEMYKL | 512802774281 | 0104269914 |
| MBBEMYKL | 17900052144 | 0179764986 |
| RHBBMYKL | 26700077605 | 01123520121 |
| CIMBMYKL | 1013041100083926 | 01161051865 |
| HLBBMYKL | 26444100022578 | 0163411403 |
| PBBEMYKL | 25810500018077 | 0142897177 |
| PBBEMYKL | 21220000087743 | 0142472412 |
| MBBEMYKL | 8881032092097 | 01125054956 |
| RHBBMYKL | 4946775140 | 0142447614 |

---

## Common Bank SWIFT Codes (Malaysia)

| Bank | SWIFT Code |
|---|---|
| Maybank | MBBEMYKL |
| RHB Bank | RHBBMYKL |
| CIMB Bank | CIMBMYKL |
| Hong Leong Bank | HLBBMYKL |
| Public Bank | PBBEMYKL |
