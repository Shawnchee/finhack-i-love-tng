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

export function loadRecords(): ReviewRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ReviewRecord[]) : [];
  } catch {
    return [];
  }
}

function persist(records: ReviewRecord[]): void {
  localStorage.setItem(KEY, JSON.stringify(records.slice(0, MAX)));
}

export function appendRecord(report: Report): void {
  const records = loadRecords();
  // Deduplicate by report.id so hot-reload doesn't double-insert.
  if (records.some((r) => r.report.id === report.id)) return;
  const entry: ReviewRecord = {
    id: crypto.randomUUID(),
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
