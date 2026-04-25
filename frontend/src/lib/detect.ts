export type DetectedKind = "bank" | "link" | "telegram" | "unknown";

export function detectInput(raw: string): DetectedKind {
  const v = raw.trim();
  if (!v) return "unknown";
  if (/^@[A-Za-z0-9_]{3,}$/.test(v)) return "telegram";
  if (/^https?:\/\//i.test(v) || /^[a-z0-9-]+\.[a-z]{2,}(\/|$)/i.test(v))
    return "link";
  if (/^\d[\d\s-]{9,18}$/.test(v)) return "bank";
  return "unknown";
}

export const MALAYSIAN_BANKS = [
  { code: "MBB", name: "Maybank" },
  { code: "CIMB", name: "CIMB Bank" },
  { code: "PBE", name: "Public Bank" },
  { code: "RHB", name: "RHB Bank" },
  { code: "HLB", name: "Hong Leong Bank" },
  { code: "AMB", name: "AmBank" },
  { code: "BIMB", name: "Bank Islam" },
  { code: "BSN", name: "Bank Simpanan Nasional" },
  { code: "AFF", name: "Affin Bank" },
  { code: "UOB", name: "UOB Malaysia" },
  { code: "OCBC", name: "OCBC Malaysia" },
  { code: "ALL", name: "Alliance Bank" },
  { code: "HSBC", name: "HSBC Malaysia" },
];
