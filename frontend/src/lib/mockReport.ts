import type {
  CheckTransactionRequest,
  CheckTransactionResponse,
  NFPCheckResponse,
  ScanResponse,
  SemakMuleCheckResponse,
} from "./api";

export type Verdict = "low" | "medium" | "high";

/**
 * Source identifiers.
 *
 * "behavior" is the canonical name for the layer3-behavioral-fraud signal.
 * "chat_model" is kept as a legacy alias so existing page code that still
 * references it continues to type-check while pages migrate.
 */ 
export type SourceName =
  | "nfp"
  | "semak_mule"
  | "link_scrape"
  | "behavior"
  | "chat_model";

export type SourceSignal = {
  source: SourceName;
  state: "clean" | "suspicious" | "match" | "skipped";
  headline: string;
  evidence: { label: string; value: string }[];
  /** Raw backend response for debugging / detail panels. */
  raw?: unknown;
  /** Signal-level contribution to the overall score (0–100). */
  score?: number;
};

export type Report = {
  id: string;
  overall: Verdict;
  score: number;
  summary: string;
  createdAt: string;
  inputs: {
    bankAccount?: { bank: string; account: string };
    links?: string[];
    chat?: { source: "upload" | "telegram"; label: string; messageCount: number };
    idCheck?: { idType: string; idNo: string };
    transaction?: CheckTransactionRequest;
  };
  signals: SourceSignal[];
  recommendation: string;
};

const LOW: Report = {
  id: "demo-low",
  overall: "low",
  score: 12,
  summary:
    "Nothing suspicious came up across the four sources we checked. Stay alert but this one looks clean.",
  createdAt: new Date().toISOString(),
  inputs: {
    bankAccount: { bank: "MBB", account: "512298443712" },
    links: ["https://shopee.com.my/verified-seller-123"],
    chat: { source: "upload", label: "whatsapp-export.txt", messageCount: 42 },
  },
  signals: [
    {
      source: "nfp",
      state: "clean",
      headline: "No reports filed against this account.",
      evidence: [
        { label: "Reports", value: "0" },
        { label: "Last check", value: "just now" },
      ],
    },
    {
      source: "semak_mule",
      state: "clean",
      headline: "Not listed on the Semak Mule registry.",
      evidence: [
        { label: "Case refs", value: "—" },
        { label: "Registry", value: "BNM Semak Mule" },
      ],
    },
    {
      source: "link_scrape",
      state: "clean",
      headline: "Domain is a known marketplace. No scam keywords found.",
      evidence: [
        { label: "Title", value: "Shopee Malaysia — Verified Seller" },
        { label: "Flags", value: "none" },
      ],
    },
    {
      source: "behavior",
      state: "clean",
      headline: "Transaction looks consistent with this user's normal pattern.",
      evidence: [
        { label: "Decision", value: "ALLOW" },
        { label: "Risk score", value: "8" },
        { label: "ML anomaly", value: "0.04" },
      ],
    },
  ],
  recommendation: "Looks okay — but always verify payment through official channels.",
};

const MEDIUM: Report = {
  id: "demo-medium",
  overall: "medium",
  score: 52,
  summary:
    "We found a couple of soft signals. Nothing conclusive yet — slow down and double-check before you transfer.",
  createdAt: new Date().toISOString(),
  inputs: {
    bankAccount: { bank: "CIMB", account: "800234112905" },
    links: ["https://myshop-ofr-deal.top/listing"],
    chat: { source: "telegram", label: "@quickdealmy", messageCount: 24 },
  },
  signals: [
    {
      source: "nfp",
      state: "suspicious",
      headline: "1 informal report tied to this account in the last 60 days.",
      evidence: [
        { label: "Reports", value: "1" },
        { label: "Last reported", value: "12 days ago" },
      ],
    },
    {
      source: "semak_mule",
      state: "clean",
      headline: "Not currently flagged on Semak Mule.",
      evidence: [
        { label: "Case refs", value: "—" },
        { label: "Registry", value: "BNM Semak Mule" },
      ],
    },
    {
      source: "link_scrape",
      state: "suspicious",
      headline: "Domain registered 9 days ago. Found 2 scam-pattern phrases.",
      evidence: [
        { label: "Title", value: "Today Only 80% Off — Buy Now" },
        { label: "Flags", value: "fresh domain, urgency copy" },
        { label: "Outbound links", value: "3 (telegram.me, wa.me, bit.ly)" },
      ],
    },
    {
      source: "behavior",
      state: "suspicious",
      headline: "ML flagged unusual amount and timing.",
      evidence: [
        { label: "Decision", value: "NOTIFY" },
        { label: "Risk score", value: "46" },
        { label: "ML anomaly", value: "0.71" },
        { label: "Top reason", value: "amount_outside_normal_range" },
      ],
    },
  ],
  recommendation:
    "Don't transfer yet. Verify the seller through an official channel. Screenshot the chat in case you need to file a report.",
};

const HIGH: Report = {
  id: "demo-high",
  overall: "high",
  score: 88,
  summary:
    "Strong signals this is a scam. The account is on the Semak Mule registry and the chat shows classic fraud patterns.",
  createdAt: new Date().toISOString(),
  inputs: {
    bankAccount: { bank: "PBE", account: "417788290011" },
    links: ["https://secure-bnm-update.click/verify"],
    chat: { source: "telegram", label: "@officerclaimsdept", messageCount: 137 },
  },
  signals: [
    {
      source: "nfp",
      state: "match",
      headline: "12 reports filed — most recent was yesterday.",
      evidence: [
        { label: "Reports", value: "12" },
        { label: "Last reported", value: "yesterday" },
      ],
    },
    {
      source: "semak_mule",
      state: "match",
      headline: "This account is on the BNM Semak Mule registry.",
      evidence: [
        { label: "Case refs", value: "SM-2025-118722, SM-2025-119034" },
        { label: "Registry", value: "BNM Semak Mule" },
      ],
    },
    {
      source: "link_scrape",
      state: "match",
      headline: "Impersonating a bank login page. Domain is 3 days old.",
      evidence: [
        { label: "Title", value: "Bank Negara — Verify Identity" },
        { label: "Flags", value: "brand impersonation, fresh domain, credential form" },
        { label: "Outbound links", value: "0 (isolated page)" },
      ],
    },
    {
      source: "behavior",
      state: "match",
      headline: "Multiple high-severity rules fired (CHALLENGE decision).",
      evidence: [
        { label: "Decision", value: "CHALLENGE" },
        { label: "Risk score", value: "94" },
        { label: "ML anomaly", value: "0.96" },
        { label: "Top reason", value: "recipient_on_mule_list, velocity_breach" },
      ],
    },
  ],
  recommendation:
    "Do not transfer. Block this contact, save the chat as evidence, and report to NFCC at 997.",
};

export function getMockReport(key: string | null | undefined): Report {
  switch ((key || "").toLowerCase()) {
    case "low":
      return LOW;
    case "medium":
      return MEDIUM;
    case "high":
    default:
      return HIGH;
  }
}

export const SOURCE_LABEL: Record<SourceName, string> = {
  nfp: "National Fraud Portal",
  semak_mule: "Semak Mule",
  link_scrape: "Link scan",
  behavior: "Behavior signals",
  // Legacy alias kept so older page code continues to render until migrated.
  chat_model: "Behavior signals",
};

// ---------------------------------------------------------------------------
// buildReportFromBackends — assemble a Report from real backend responses.
// ---------------------------------------------------------------------------

export interface BackendResponses {
  nfp?: NFPCheckResponse;
  semak?: SemakMuleCheckResponse;
  scrape?: ScanResponse;
  layer3?: CheckTransactionResponse;
}

type SignalState = SourceSignal["state"];

function stateScore(state: SignalState): number {
  if (state === "match") return 50;
  if (state === "suspicious") return 30;
  if (state === "clean") return 10;
  return 0; // skipped
}

function _formatAcc(acc: string): string {
  const digits = acc.replace(/\D/g, "");
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function _idTypeLabel(t: string): string {
  switch (t) {
    case "mykad":
      return "MyKad";
    case "bric":
      return "BRIC";
    case "police":
      return "Police ID";
    case "army":
      return "Army ID";
    case "unhcr":
      return "UNHCR";
    case "passport":
      return "Passport";
    default:
      return t;
  }
}

function buildNfpSignal(nfp?: NFPCheckResponse): SourceSignal {
  if (!nfp) {
    return {
      source: "nfp",
      state: "skipped",
      headline: "NFP check skipped.",
      evidence: [],
    };
  }
  const tier = nfp.muleCheck?.muleTier;
  const matched = tier !== null && tier !== undefined && String(tier).trim() !== "";
  const state: SignalState = matched ? "match" : "clean";
  // Build the headline from real backend fields rather than canned copy.
  // We have: muleTier (1/2), muleTierDescription ("confirmed"/"suspected"),
  // idType, idNo. The backend doesn't return narrative text, so this is the
  // most specific honest statement we can render.
  const idLabel = _idTypeLabel(nfp.muleCheck?.idType ?? "");
  const idNo = nfp.muleCheck?.idNo ?? "";
  const desc = nfp.muleCheck?.muleTierDescription;
  const headline = matched
    ? `${idLabel || "ID"} ${idNo} matches a ${desc ? desc + " " : ""}mule on the National Fraud Portal (tier ${tier}).`
    : `${idLabel || "ID"} ${idNo} is not on the National Fraud Portal.`;

  return {
    source: "nfp",
    state,
    headline,
    evidence: [
      { label: "Status", value: nfp.status ?? "—" },
      { label: "Tier", value: matched ? String(tier) : "—" },
      {
        label: "Tier description",
        value: nfp.muleCheck?.muleTierDescription ?? "—",
      },
      { label: "ID type", value: idLabel || "—" },
      { label: "ID number", value: idNo || "—" },
      { label: "Message", value: nfp.message ?? "—" },
    ],
    raw: nfp,
    score: stateScore(state),
  };
}

function buildSemakSignal(semak?: SemakMuleCheckResponse): SourceSignal {
  if (!semak) {
    return {
      source: "semak_mule",
      state: "skipped",
      headline: "Semak Mule check skipped.",
      evidence: [],
    };
  }
  const state: SignalState = semak.isMule ? "match" : "clean";
  const acc = _formatAcc(semak.bankAccountNo);
  const swift = semak.bankSwiftCode;
  const headline = semak.isMule
    ? `${swift} account ${acc} is on the BNM Semak Mule registry.`
    : `${swift} account ${acc} is not on the BNM Semak Mule registry.`;

  return {
    source: "semak_mule",
    state,
    headline,
    evidence: [
      { label: "Account", value: acc },
      { label: "SWIFT", value: swift },
      { label: "Response code", value: semak.responseCode },
      { label: "Response message", value: semak.responseMessage },
    ],
    raw: semak,
    score: stateScore(state),
  };
}

// Pretty labels for the LLM's scam-type taxonomy (api.ts ScamCategory).
const SCAM_CATEGORY_LABEL: Record<string, string> = {
  CAPITAL_MARKET: "Capital-market scam",
  ROMANCE: "Romance scam",
  EMPLOYMENT: "Employment scam",
  DELIVERY: "Delivery scam",
  IMPERSONATION: "Impersonation scam",
  BANKING: "Banking phish",
  GENERAL: "General scam",
  UNKNOWN: "Unclassified",
};

function buildScrapeSignal(scrape?: ScanResponse): SourceSignal {
  if (!scrape) {
    return {
      source: "link_scrape",
      state: "skipped",
      headline: "No link to scan.",
      evidence: [],
    };
  }

  const matchedCount = scrape.keywords_matched?.length ?? 0;
  const verdict = scrape.verdict;
  const scamConfidence = scrape.scam?.confidence ?? 0;
  const indicators = scrape.scam?.indicators_found ?? [];
  const indicatorEvidence = scrape.scam?.indicator_evidence ?? {};

  // Verdict from the LLM is authoritative when present; otherwise fall back
  // to keyword-count heuristics for the legacy/no-LLM path.
  let state: SignalState;
  if (verdict === "SCAM") {
    state = "match";
  } else if (verdict === "NOT_SCAM") {
    state = matchedCount > 0 ? "suspicious" : "clean";
  } else if (matchedCount > 2 || scamConfidence >= 0.7) {
    state = "match";
  } else if (matchedCount > 0 || scamConfidence >= 0.4) {
    state = "suspicious";
  } else {
    state = "clean";
  }

  const headline =
    scrape.evidence_summary?.trim() ||
    (state === "match"
      ? indicators.length > 0
        ? `Classified as a scam — flagged for ${indicators.slice(0, 2).join(", ")}.`
        : `Found ${matchedCount} scam-pattern keywords on this page.`
      : state === "suspicious"
        ? `Found ${matchedCount} scam-pattern keyword${matchedCount === 1 ? "" : "s"} on this page.`
        : "No scam-pattern keywords or scam indicators found on this page.");

  const evidence: { label: string; value: string }[] = [
    { label: "Platform", value: scrape.platform || "—" },
    { label: "Title", value: scrape.title || "—" },
    { label: "Verdict", value: verdict ?? "—" },
  ];

  // Scam category (NEW) — the LLM's classification into the 8-category taxonomy.
  if (scrape.scam_type && scrape.scam_type.category !== "UNKNOWN") {
    const cat = scrape.scam_type.category;
    evidence.push({
      label: "Scam type",
      value: `${SCAM_CATEGORY_LABEL[cat] ?? cat} (${scrape.scam_type.confidence.toFixed(2)})`,
    });
  }

  if (scrape.scam) {
    evidence.push({
      label: "Scam confidence",
      value: scamConfidence.toFixed(2),
    });
    // Surface up to 3 indicators with their evidence quotes inline so the
    // panel shows *why* the LLM flagged the page, not just the labels.
    for (const indicator of indicators.slice(0, 3)) {
      const quote = indicatorEvidence[indicator];
      evidence.push({
        label: indicator.replace(/_/g, " "),
        value: quote ? `"${quote}"` : "(no quote returned)",
      });
    }
    if (indicators.length > 3) {
      evidence.push({
        label: "Other indicators",
        value: indicators.slice(3).join(", "),
      });
    }
  }

  if (scrape.regulatory) {
    evidence.push({
      label: "Capital market",
      value: scrape.regulatory.is_capital_market ? "yes" : "no",
    });
    if (scrape.regulatory.product_types.length > 0) {
      evidence.push({
        label: "Product types",
        value: scrape.regulatory.product_types.join(", "),
      });
    }
  }

  if (scrape.localisation) {
    evidence.push({
      label: "Targets Malaysians",
      value: scrape.localisation.targets_malaysians ? "yes" : "no",
    });
    if (scrape.localisation.languages_detected.length > 0) {
      evidence.push({
        label: "Languages",
        value: scrape.localisation.languages_detected.join(", "),
      });
    }
    if (scrape.localisation.localisation_cues.length > 0) {
      evidence.push({
        label: "Localisation cues",
        value: scrape.localisation.localisation_cues.slice(0, 3).join(" · "),
      });
    }
  }

  evidence.push({
    label: "Keywords matched",
    value: matchedCount > 0 ? scrape.keywords_matched.join(", ") : "none",
  });

  return {
    source: "link_scrape",
    state,
    headline,
    evidence,
    raw: scrape,
    score: stateScore(state),
  };
}

function buildBehaviorSignal(layer3?: CheckTransactionResponse): SourceSignal {
  if (!layer3) {
    return {
      source: "behavior",
      state: "skipped",
      headline: "No transaction provided for behavioral check.",
      evidence: [],
    };
  }
  let state: SignalState;
  switch (layer3.decision) {
    case "CHALLENGE":
      state = "match";
      break;
    case "NOTIFY":
      state = "suspicious";
      break;
    case "ALLOW":
    default:
      state = "clean";
  }

  const topReasons = (layer3.reason_codes ?? [])
    .slice(0, 3)
    .map((r) => r.code)
    .join(", ");

  // Prefer the backend's plain-language `user_friendly_warning` over our
  // canned fallbacks — layer3 already produces a tailored sentence per
  // decision tier (e.g. "This transaction matches multiple fraud patterns…")
  // and the user explicitly wants that surfaced rather than a generic line.
  const headline =
    layer3.user_friendly_warning?.trim() ||
    (state === "match"
      ? "Multiple high-severity rules fired."
      : state === "suspicious"
        ? "ML flagged unusual amount or timing."
        : "Transaction looks consistent with this user's normal pattern.");

  const evidence: { label: string; value: string }[] = [
    { label: "Decision", value: layer3.decision },
    { label: "Risk score", value: String(layer3.risk_score) },
    { label: "ML anomaly", value: layer3.ml_anomaly_score.toFixed(4) },
    { label: "Top reasons", value: topReasons || "—" },
  ];

  // Surface the backend's recommended next step too — it's a separate field
  // from the warning and useful as a row in the evidence panel.
  if (layer3.recommended_action?.trim()) {
    evidence.push({
      label: "Recommended action",
      value: layer3.recommended_action.trim(),
    });
  }

  return {
    source: "behavior",
    state,
    headline,
    evidence,
    raw: layer3,
    score: stateScore(state),
  };
}

// Probabilistic scoring.
//
// Each available source produces a fraud probability p_i ∈ [0, 1]. Sources that
// were skipped (no input) don't participate — they neither raise nor lower the
// score. The combined score is the noisy-OR / inclusion-exclusion combine:
//
//     P(fraud) = 1 − ∏(1 − p_i)
//
// Properties this gives us, all of which we want:
//   - A single strong hit (e.g. Semak match, p=0.92) drives the score high
//     on its own (≥90) without needing other sources to "agree".
//   - Multiple weak hits compound — two suspicious sources at p=0.4 each
//     combine to ~0.64, more than either alone.
//   - Adding a clean source (p≈0.05) slightly *reduces* the combined score,
//     reflecting the extra evidence that nothing's wrong on that axis.
//   - Continuous backend signals (layer3.risk_score, scrape.scam.confidence)
//     feed in directly instead of being collapsed to a 3-bucket state.
//
// We then write the per-source p back onto each signal's `score` field as a
// 0–100 contribution so the UI/evidence panels can show how each source
// pushed the verdict.
const FRAUD_P = {
  // Strong, deterministic registry hit. Almost always means stay-away.
  SEMAK_MATCH: 0.92,
  SEMAK_CLEAN: 0.05,

  // NFP tiers — tier 1 = confirmed mule, tier 2 = suspected.
  NFP_TIER_1: 0.85,
  NFP_TIER_2: 0.6,
  NFP_OTHER_TIER: 0.5, // future-proofing: any non-empty tier we don't know
  NFP_CLEAN: 0.05,

  // Scrape "match" / "suspicious" fallback when no LLM confidence is supplied.
  SCRAPE_MATCH: 0.75,
  SCRAPE_SUSPICIOUS: 0.4,
  SCRAPE_CLEAN: 0.05,
} as const;

function nfpProbability(responses: BackendResponses): number | null {
  const tier = responses.nfp?.muleCheck?.muleTier;
  if (tier === undefined) return null; // service was skipped
  const tierStr = tier === null ? "" : String(tier).trim();
  if (tierStr === "") return FRAUD_P.NFP_CLEAN;
  if (tierStr === "1") return FRAUD_P.NFP_TIER_1;
  if (tierStr === "2") return FRAUD_P.NFP_TIER_2;
  return FRAUD_P.NFP_OTHER_TIER;
}

function semakProbability(responses: BackendResponses): number | null {
  if (!responses.semak) return null;
  return responses.semak.isMule ? FRAUD_P.SEMAK_MATCH : FRAUD_P.SEMAK_CLEAN;
}

function scrapeProbability(
  responses: BackendResponses,
  signal: SourceSignal | undefined,
): number | null {
  const scrape = responses.scrape;
  if (!scrape || !signal || signal.state === "skipped") return null;
  // Prefer the LLM's continuous confidence when available.
  if (typeof scrape.scam?.confidence === "number") {
    return Math.max(0, Math.min(1, scrape.scam.confidence));
  }
  if (signal.state === "match") return FRAUD_P.SCRAPE_MATCH;
  if (signal.state === "suspicious") return FRAUD_P.SCRAPE_SUSPICIOUS;
  return FRAUD_P.SCRAPE_CLEAN;
}

function behaviorProbability(responses: BackendResponses): number | null {
  if (!responses.layer3) return null;
  // Layer3 already produces a 0–100 risk score that subsumes the decision tier.
  return Math.max(0, Math.min(1, responses.layer3.risk_score / 100));
}

function pickOverall(
  signals: SourceSignal[],
  responses: BackendResponses,
): { overall: Verdict; score: number } {
  const ps: { source: SourceSignal["source"]; p: number }[] = [];

  const semakP = semakProbability(responses);
  if (semakP !== null) ps.push({ source: "semak_mule", p: semakP });

  const nfpP = nfpProbability(responses);
  if (nfpP !== null) ps.push({ source: "nfp", p: nfpP });

  const scrapeP = scrapeProbability(
    responses,
    signals.find((s) => s.source === "link_scrape"),
  );
  if (scrapeP !== null) ps.push({ source: "link_scrape", p: scrapeP });

  const behaviorP = behaviorProbability(responses);
  if (behaviorP !== null) ps.push({ source: "behavior", p: behaviorP });

  // Write per-source contributions back onto the signal so the evidence panel
  // can render "this source contributed N pts".
  for (const { source, p } of ps) {
    const sig = signals.find((s) => s.source === source);
    if (sig) sig.score = Math.round(p * 100);
  }

  // Noisy-OR combine. With zero participating sources, default to 0.
  const combined =
    ps.length === 0 ? 0 : 1 - ps.reduce((acc, { p }) => acc * (1 - p), 1);

  const score = Math.round(combined * 100);
  const overall: Verdict = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  return { overall, score };
}

/**
 * Pick a verdict-band summary that prefers real backend prose over canned
 * copy. Priority order:
 *   1. Layer3's `user_friendly_warning` when behavior was a match (CHALLENGE)
 *      — the strongest signal driving a high verdict in many
 *      transactional flows.
 *   2. Scrape's `evidence_summary` when the LLM produced a SCAM verdict —
 *      a tailored 2-4 sentence narrative for officer review.
 *   3. Stitched factual sentence from any other matched signals (NFP /
 *      SemakMule). These services don't produce narrative, so we compose
 *      one from their structured fields.
 *   4. Generic fallback copy keyed off the overall bucket.
 */
function composeSummary(
  signals: SourceSignal[],
  responses: BackendResponses,
  overall: Verdict,
): string {
  const layer3 = responses.layer3;
  const scrape = responses.scrape;
  const semak = responses.semak;
  const nfp = responses.nfp;

  // Strongest narrative-producing signals first.
  if (
    layer3 &&
    layer3.decision === "CHALLENGE" &&
    layer3.user_friendly_warning?.trim()
  ) {
    return layer3.user_friendly_warning.trim();
  }
  if (scrape?.verdict === "SCAM" && scrape.evidence_summary?.trim()) {
    return scrape.evidence_summary.trim();
  }

  // Stitch a factual line from registry hits.
  const factualParts: string[] = [];
  if (semak?.isMule) {
    factualParts.push(
      `${semak.bankSwiftCode} account ${_formatAcc(semak.bankAccountNo)} is on the BNM Semak Mule registry`,
    );
  }
  const tier = nfp?.muleCheck?.muleTier;
  if (tier !== undefined && tier !== null && String(tier).trim() !== "") {
    const desc = nfp?.muleCheck?.muleTierDescription;
    factualParts.push(
      `the ID matches a ${desc ?? "tier " + tier} mule on the National Fraud Portal`,
    );
  }
  if (factualParts.length > 0) {
    return factualParts.join("; ").replace(/^./, (c) => c.toUpperCase()) + ".";
  }

  // Layer3 NOTIFY (suspicious) and other soft signals — use the warning even
  // for non-match decisions if present.
  if (layer3?.user_friendly_warning?.trim()) {
    return layer3.user_friendly_warning.trim();
  }
  if (scrape?.verdict === "NOT_SCAM" && scrape.evidence_summary?.trim()) {
    return scrape.evidence_summary.trim();
  }

  // Last-resort fallbacks — only reached if every backend was skipped or
  // returned no narrative whatsoever.
  void signals;
  return overall === "high"
    ? "Strong signals this is a scam. Do not transfer."
    : overall === "medium"
      ? "Mixed signals. Slow down and double-check before you transfer."
      : "No strong fraud signals detected across the sources we checked.";
}

export function buildReportFromBackends(responses: BackendResponses): Report {
  const signals: SourceSignal[] = [
    buildNfpSignal(responses.nfp),
    buildSemakSignal(responses.semak),
    buildScrapeSignal(responses.scrape),
    buildBehaviorSignal(responses.layer3),
  ];

  const { overall, score } = pickOverall(signals, responses);

  // Compose the headline summary from real backend narratives. We pick the
  // strongest signal that produced a *human-written* sentence and lead with
  // that. Generic copy is only used when no backend gave us text to render.
  const summary = composeSummary(signals, responses, overall);

  const recommendation =
    responses.layer3?.recommended_action?.trim() ||
    (overall === "high"
      ? "Do not transfer. Block this contact, save the evidence, and report to NFCC at 997."
      : overall === "medium"
        ? "Don't transfer yet. Verify the recipient through an official channel."
        : "Looks okay — but always verify payment through official channels.");

  return {
    id: `live-${Date.now()}`,
    overall,
    score,
    summary,
    createdAt: new Date().toISOString(),
    inputs: {},
    signals,
    recommendation,
  };
}
