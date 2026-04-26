import type { Report } from "./mockReport";

export type ReviewStatus = "pending" | "confirmed_scam" | "false_positive" | "escalated";

export interface ReviewRecord {
  id: string;
  report: Report;
  status: ReviewStatus;
  note: string;
  reviewedAt?: string;
}

const KEY = "semak_dashboard_v1";
const MAX = 100;

// crypto.randomUUID() requires a secure context (HTTPS) in Firefox/Safari.
// Fall back to a timestamp+random id when unavailable (e.g. plain HTTP on prod ALB).
function genId(): string {
  try { return crypto.randomUUID(); } catch { /* fall through */ }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function loadRecords(): ReviewRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ReviewRecord[]) : [];
  } catch {
    return [];
  }
}

function persist(records: ReviewRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(records.slice(0, MAX)));
  } catch { /* ignore quota / permission errors (e.g. Safari private mode) */ }
}

export function appendRecord(report: Report): void {
  const records = loadRecords();
  // Deduplicate by report.id so hot-reload doesn't double-insert.
  if (records.some((r) => r.report.id === report.id)) return;
  const entry: ReviewRecord = {
    id: genId(),
    report,
    status: "pending",
    note: "",
  };
  persist([entry, ...records]);
}

export function updateRecord(
  id: string,
  patch: { status?: ReviewStatus; note?: string },
): void {
  const records = loadRecords().map((r) => {
    if (r.id !== id) return r;
    const next = { ...r, ...patch };
    if (patch.status && patch.status !== "pending") {
      next.reviewedAt = new Date().toISOString();
    }
    return next;
  });
  persist(records);
}

export function clearRecords(): void {
  localStorage.removeItem(KEY);
}
