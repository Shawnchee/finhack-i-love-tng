// Typed clients for the three backend services that power Semak.
//
// - mule_check_api          (camelCase wire format)        -> NFP + Semak Mule
// - layer3-behavioral-fraud (snake_case wire format)       -> transaction risk
// - fraud_detect_api        (link/post scraper)            -> URL scan
//
// Every call console.logs request and response so wiring is visible in
// DevTools during the demo. On error we console.error and rethrow.

// ---------------------------------------------------------------------------
// Base URLs (Vite env vars with sensible localhost defaults)
// ---------------------------------------------------------------------------

export const MULE_API_URL: string =
  (import.meta.env.VITE_MULE_API_URL as string | undefined) ?? "http://localhost:8000";
export const LAYER3_API_URL: string =
  (import.meta.env.VITE_LAYER3_API_URL as string | undefined) ?? "http://localhost:8083";
export const SCRAPE_API_URL: string =
  (import.meta.env.VITE_SCRAPE_API_URL as string | undefined) ?? "http://localhost:8082";

// ---------------------------------------------------------------------------
// Bank → SWIFT map (used when calling checkSemakMule)
// ---------------------------------------------------------------------------

export const BANK_SWIFT_CODES: Record<string, string> = {
  MBB: "MBBEMYKL",
  CIMB: "CIBBMYKL",
  PBE: "PBBEMYKL",
  RHB: "RHBBMYKL",
  HLB: "HLBBMYKL",
  AMB: "ARBKMYKL",
  BIMB: "BIMBMYKL",
  BSN: "BSNAMYK1",
  AFF: "PHBMMYKL",
  UOB: "UOVBMYKL",
  OCBC: "OCBCMYKX",
  ALL: "MFBBMYKL",
  HSBC: "HBMBMYKL",
};

export type BankCode = keyof typeof BANK_SWIFT_CODES;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Hex-encoded SHA-256 of the given string. Used to derive idSignature. */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/** Returns an idSignature suitable for the mule_check_api NFP endpoint. */
export async function idSignature(idNo: string): Promise<string> {
  return sha256Hex(idNo);
}

async function postJSON<TReq, TRes>(endpoint: string, body: TReq): Promise<TRes> {
  console.log("[api] →", endpoint, body);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    if (!res.ok) {
      console.error("[api] ✕", endpoint, res.status, json);
      throw new Error(
        `[api] ${endpoint} failed (${res.status}): ${typeof json === "string" ? json : JSON.stringify(json)}`,
      );
    }
    console.log("[api] ←", endpoint, json);
    return json as TRes;
  } catch (err) {
    console.error("[api] ✕", endpoint, err);
    throw err;
  }
}

async function getJSON<TRes>(endpoint: string): Promise<TRes> {
  console.log("[api] →", endpoint);
  try {
    const res = await fetch(endpoint, { method: "GET" });
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    if (!res.ok) {
      console.error("[api] ✕", endpoint, res.status, json);
      throw new Error(
        `[api] ${endpoint} failed (${res.status}): ${typeof json === "string" ? json : JSON.stringify(json)}`,
      );
    }
    console.log("[api] ←", endpoint, json);
    return json as TRes;
  } catch (err) {
    console.error("[api] ✕", endpoint, err);
    throw err;
  }
}

// ===========================================================================
// 1) mule_check_api — NFP mule check
// ===========================================================================

export type IdType = "mykad" | "bric" | "police" | "army" | "unhcr" | "passport";

export interface NFPCheckArgs {
  idType: IdType;
  idNo: string;
  nationality?: string;
  purpose?: string;
}

/** Wire payload (camelCase, mule_check_api). */
export interface NFPCheckRequest {
  idSignature: string;
  idType: IdType;
  idNo: string;
  nationality: string;
  purpose: string;
}

export interface NFPMuleCheckPayload {
  idSignature: string;
  idType: IdType;
  idNo: string;
  nationality: string;
  muleTier: string | null;
  muleTierDescription: string | null;
}

export interface NFPCheckResponse {
  httpStatusCode: number;
  status: string;
  message: string;
  muleCheck: NFPMuleCheckPayload;
}

export async function checkNFP(args: NFPCheckArgs): Promise<NFPCheckResponse> {
  const body: NFPCheckRequest = {
    idSignature: await idSignature(args.idNo),
    idType: args.idType,
    idNo: args.idNo,
    nationality: args.nationality ?? "MY",
    purpose: args.purpose ?? "01",
  };
  return postJSON<NFPCheckRequest, NFPCheckResponse>(
    `${MULE_API_URL}/api/v1/nfp/mule-check`,
    body,
  );
}

// ===========================================================================
// 2) mule_check_api — Semak Mule registry check
// ===========================================================================

export interface SemakMuleCheckArgs {
  bankSwiftCode: string;
  bankAccountNo: string;
  phoneNum?: string;
  companyName?: string;
}

/** Wire payload (camelCase, mule_check_api). */
export interface SemakMuleCheckRequest {
  bankSwiftCode: string;
  bankAccountNo: string;
  phoneNum?: string;
  companyName?: string;
}

export interface SemakMuleCheckResponse {
  responseCode: string;
  responseMessage: string;
  bankSwiftCode: string;
  bankAccountNo: string;
  isMule: boolean;
}

export async function checkSemakMule(
  args: SemakMuleCheckArgs,
): Promise<SemakMuleCheckResponse> {
  const body: SemakMuleCheckRequest = {
    bankSwiftCode: args.bankSwiftCode,
    bankAccountNo: args.bankAccountNo,
    ...(args.phoneNum ? { phoneNum: args.phoneNum } : {}),
    ...(args.companyName ? { companyName: args.companyName } : {}),
  };
  return postJSON<SemakMuleCheckRequest, SemakMuleCheckResponse>(
    `${MULE_API_URL}/api/v1/semakmule/mule-check`,
    body,
  );
}

// ===========================================================================
// 3) layer3-behavioral-fraud — transaction check (snake_case wire format)
// ===========================================================================

export type TransactionType = "qr_payment" | "duitnow_transfer" | "bill_payment";

export type Layer3Decision = "ALLOW" | "NOTIFY" | "CHALLENGE";
export type ReasonSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CheckTransactionArgs {
  user_id: string;
  recipient_account: string;
  recipient_name: string;
  amount: number;
  transaction_type: TransactionType;
  /** ISO 8601 string with timezone (e.g. new Date().toISOString()). */
  timestamp: string;
}

/** Wire payload (snake_case, layer3-behavioral-fraud). */
export interface CheckTransactionRequest {
  user_id: string;
  recipient_account: string;
  recipient_name: string;
  amount: number;
  transaction_type: TransactionType;
  timestamp: string;
}

export interface ReasonCode {
  code: string;
  severity: ReasonSeverity;
  message: string;
  details?: Record<string, unknown> | null;
}

/**
 * Personas seeded into the layer3 service (see layer3-behavioral-fraud/README.md).
 * One trained Isolation Forest per user; demo scenarios documented inline so
 * the frontend can offer a discoverable dropdown of known-good test inputs.
 */
export interface Layer3Persona {
  user_id: string;
  name: string;
  scenario: string;
  /** Suggested transaction that produces the documented decision for this persona. */
  demo: {
    amount: number;
    transaction_type: TransactionType;
    recipient_account: string;
    expectedDecision: Layer3Decision;
    expectedRisk: number;
  };
}

export const LAYER3_PERSONAS: Layer3Persona[] = [
  {
    user_id: "user_001",
    name: "Aisyah",
    scenario: "RM4800 to new account at 23:47 — love-scam pattern",
    demo: {
      amount: 4800,
      transaction_type: "duitnow_transfer",
      recipient_account: "9999000111",
      expectedDecision: "CHALLENGE",
      expectedRisk: 99,
    },
  },
  {
    user_id: "user_002",
    name: "Ahmad",
    scenario: "5× RM2000 within 10 minutes — phone-theft pattern",
    demo: {
      amount: 2000,
      transaction_type: "duitnow_transfer",
      recipient_account: "8888000222",
      expectedDecision: "CHALLENGE",
      expectedRisk: 100,
    },
  },
  {
    user_id: "user_003",
    name: "Wei",
    scenario: "RM150 to new account at 03:00 — subtle anomaly",
    demo: {
      amount: 150,
      transaction_type: "duitnow_transfer",
      recipient_account: "7777000333",
      expectedDecision: "ALLOW",
      expectedRisk: 30,
    },
  },
  {
    user_id: "user_004",
    name: "Mak Timah",
    scenario: "RM8000 to new account at 20:00 — PDRM-impersonation scam",
    demo: {
      amount: 8000,
      transaction_type: "duitnow_transfer",
      recipient_account: "6666000444",
      expectedDecision: "CHALLENGE",
      expectedRisk: 99,
    },
  },
];

export interface CheckTransactionResponse {
  decision: Layer3Decision;
  risk_score: number;
  reason_codes: ReasonCode[];
  ml_anomaly_score: number;
  user_friendly_warning: string | null;
  recommended_action: string | null;
}

export async function checkTransaction(
  args: CheckTransactionArgs,
): Promise<CheckTransactionResponse> {
  const body: CheckTransactionRequest = {
    user_id: args.user_id,
    recipient_account: args.recipient_account,
    recipient_name: args.recipient_name,
    amount: args.amount,
    transaction_type: args.transaction_type,
    timestamp: args.timestamp,
  };
  return postJSON<CheckTransactionRequest, CheckTransactionResponse>(
    `${LAYER3_API_URL}/api/check_transaction`,
    body,
  );
}

// ===========================================================================
// 4) layer3-behavioral-fraud — user profile
// ===========================================================================

export interface UserProfileResponse {
  user_id: string;
  // Layer3 returns a flexible profile shape. Keep the additional keys open so
  // we don't have to keep this in lock-step with the backend mid-demo.
  [key: string]: unknown;
}

export async function getUserProfile(user_id: string): Promise<UserProfileResponse> {
  return getJSON<UserProfileResponse>(
    `${LAYER3_API_URL}/api/user_profile/${encodeURIComponent(user_id)}`,
  );
}

// ===========================================================================
// 5) fraud_detect_api — URL scan (scrape + LLM classification)
// ===========================================================================

export type ScamVerdict = "SCAM" | "NOT_SCAM" | "NEEDS_REVIEW";

export type ScamCategory =
  | "CAPITAL_MARKET"
  | "ROMANCE"
  | "EMPLOYMENT"
  | "DELIVERY"
  | "IMPERSONATION"
  | "BANKING"
  | "GENERAL"
  | "UNKNOWN";

export interface RegulatoryDetail {
  is_capital_market: boolean;
  product_types: string[];
  intent: string;
  reasoning: string;
}

export interface LocalisationDetail {
  targets_malaysians: boolean;
  localisation_cues: string[];
  languages_detected: string[];
  reasoning: string;
}

export interface ScamTypeDetail {
  category: ScamCategory;
  confidence: number;
  reasoning: string;
}

export interface ScamDetail {
  is_scam: boolean;
  confidence: number;
  indicators_found: string[];
  indicator_evidence: Record<string, string>;
  reasoning: string;
}

export interface ScanRequest {
  url: string;
}

export interface ScanResponse {
  // Source metadata (always present)
  post_id: string;
  platform: string;
  url: string;
  title: string;
  body: string;
  keywords_matched: string[];

  // Classification (null when classification was skipped or failed upstream)
  regulatory: RegulatoryDetail | null;
  localisation: LocalisationDetail | null;
  scam_type: ScamTypeDetail | null;
  scam: ScamDetail | null;
  verdict: ScamVerdict | null;
  evidence_summary: string | null;
}

export async function scanUrl(url: string): Promise<ScanResponse> {
  return postJSON<ScanRequest, ScanResponse>(
    `${SCRAPE_API_URL}/api/scan`,
    { url },
  );
}
