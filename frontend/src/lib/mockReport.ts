export type Verdict = "low" | "medium" | "high";

export type SourceSignal = {
  source: "nfp" | "semak_mule" | "link_scrape" | "chat_model";
  state: "clean" | "suspicious" | "match" | "skipped";
  headline: string;
  evidence: { label: string; value: string }[];
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
      source: "chat_model",
      state: "clean",
      headline: "Conversation tone looks normal. No urgency or impersonation detected.",
      evidence: [
        { label: "Fraud probability", value: "8%" },
        { label: "Top feature", value: "neutral sentiment" },
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
      source: "chat_model",
      state: "suspicious",
      headline: "Some urgency and off-platform payment nudges detected.",
      evidence: [
        { label: "Fraud probability", value: "46%" },
        { label: "Top features", value: "urgency, payment redirect, discount hook" },
        { label: "Excerpt", value: '"Transfer now so we can reserve the stock, promo ends in 10 min"' },
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
      source: "chat_model",
      state: "match",
      headline: "Fake-authority impersonation with high urgency and threats.",
      evidence: [
        { label: "Fraud probability", value: "94%" },
        { label: "Top features", value: "authority impersonation, threat of arrest, urgency" },
        { label: "Excerpt", value: '"Anda perlu transfer dalam 30 minit sebelum akaun dibekukan"' },
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

export const SOURCE_LABEL: Record<SourceSignal["source"], string> = {
  nfp: "National Fraud Portal",
  semak_mule: "Semak Mule",
  link_scrape: "Link scan",
  chat_model: "Chat behaviour",
};
