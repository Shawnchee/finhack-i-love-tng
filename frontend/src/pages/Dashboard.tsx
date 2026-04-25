import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Flag,
  Landmark,
  Link as LinkIcon,
  Activity,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  BarChart2,
  ListChecks,
  MessageSquare,
  ArrowUpRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  loadRecords,
  appendRecord,
  updateRecord,
  clearRecords,
  type ReviewRecord,
  type ReviewStatus,
} from "../lib/dashboardStore";
import { getMockReport, type Verdict, SOURCE_LABEL } from "../lib/mockReport";
import { cn } from "../lib/cn";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const VERDICT_META: Record<Verdict, { label: string; badgeCls: string; barColor: string }> = {
  low: { label: "Low risk", badgeCls: "bg-good/15 text-good", barColor: "#0BA66C" },
  medium: { label: "Medium risk", badgeCls: "bg-blue-soft text-blue", barColor: "#005ABE" },
  high: { label: "High risk", badgeCls: "bg-yellow/30 text-ink border border-yellow/60", barColor: "#FFCD00" },
};

const STATUS_META: Record<ReviewStatus, { label: string; cls: string; icon: typeof Flag }> = {
  pending: { label: "Pending", cls: "bg-surface text-ink-muted border border-rule", icon: Clock },
  confirmed_scam: { label: "Confirmed scam", cls: "bg-bad/10 text-bad border border-bad/30", icon: AlertOctagon },
  false_positive: { label: "False positive", cls: "bg-good/10 text-good border border-good/30", icon: CheckCircle2 },
  escalated: { label: "Escalated", cls: "bg-yellow/20 text-ink border border-yellow/50", icon: Flag },
};

type Tab = "analytics" | "queue";
type QueueFilter = "all" | ReviewStatus;

// ---------------------------------------------------------------------------
// Seed demo records so the dashboard isn't empty on first load
// ---------------------------------------------------------------------------

function seedDemoIfEmpty(): void {
  const existing = loadRecords();
  if (existing.length > 0) return;

  // Inline imports — these are synchronous modules already loaded by the bundle.
  // Dynamic import() would be async; direct import at top would create a
  // circular-looking dependency. Using the already-imported symbols is cleanest.
  const seeds: Array<{ key: string; daysAgo: number; status: ReviewStatus }> = [
    { key: "high", daysAgo: 0, status: "pending" },
    { key: "high", daysAgo: 1, status: "confirmed_scam" },
    { key: "medium", daysAgo: 1, status: "pending" },
    { key: "medium", daysAgo: 2, status: "escalated" },
    { key: "low", daysAgo: 2, status: "false_positive" },
    { key: "low", daysAgo: 3, status: "pending" },
    { key: "high", daysAgo: 3, status: "confirmed_scam" },
    { key: "medium", daysAgo: 4, status: "pending" },
  ];

  seeds.forEach(({ key, daysAgo }, i) => {
    const r = getMockReport(key);
    const offset = daysAgo * 86400000 + i * 3600000;
    r.id = `demo-${i}-${Date.now()}`;
    r.createdAt = new Date(Date.now() - offset).toISOString();
    appendRecord(r);
  });

  const all = loadRecords();
  seeds.forEach(({ status }, i) => {
    if (status !== "pending" && all[seeds.length - 1 - i]) {
      updateRecord(all[seeds.length - 1 - i].id, { status });
    }
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("analytics");
  const [records, setRecords] = useState<ReviewRecord[]>([]);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");

  const refresh = useCallback(() => setRecords(loadRecords()), []);

  useEffect(() => {
    seedDemoIfEmpty();
    refresh();
  }, [refresh]);

  const handleUpdate = (id: string, patch: { status?: ReviewStatus; note?: string }) => {
    updateRecord(id, patch);
    refresh();
  };

  const handleClearAll = () => {
    clearRecords();
    refresh();
  };

  const filtered =
    queueFilter === "all" ? records : records.filter((r) => r.status === queueFilter);

  const pendingCount = records.filter((r) => r.status === "pending").length;

  return (
    <main className="min-h-[calc(100dvh-64px)] pb-16">
      {/* HEADER */}
      <section className="border-b border-rule bg-white">
        <div className="mx-auto max-w-6xl px-5 md:px-8 py-10 md:py-14">
          <div className="text-xs uppercase tracking-[0.18em] text-blue mb-3">
            Analyst dashboard
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-[32px] sm:text-4xl md:text-5xl text-ink leading-[1.02]">
                Fraud intelligence{" "}
                <span className="italic">overview.</span>
              </h1>
              <p className="mt-3 text-ink-muted max-w-xl leading-relaxed">
                Analytics and review queue for all scans submitted through the
                fraud check flow.
              </p>
            </div>
            <Link
              to="/check"
              className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-full bg-blue text-white font-medium text-sm hover:bg-[#004a9e] transition-colors touch-manipulation shrink-0"
            >
              New scan
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <StatsStrip records={records} />

      {/* TABS */}
      <div className="border-b border-rule bg-white sticky top-16 z-20">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="flex gap-1">
            {(
              [
                { id: "analytics" as Tab, label: "Analytics", Icon: BarChart2 },
                {
                  id: "queue" as Tab,
                  label: `Review queue${pendingCount > 0 ? ` · ${pendingCount}` : ""}`,
                  Icon: ListChecks,
                },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors touch-manipulation",
                  tab === id
                    ? "border-blue text-ink"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 md:px-8 py-8">
        <AnimatePresence mode="wait">
          {tab === "analytics" ? (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
            >
              <AnalyticsPanel records={records} />
            </motion.div>
          ) : (
            <motion.div
              key="queue"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
            >
              <ReviewQueuePanel
                records={filtered}
                allRecords={records}
                filter={queueFilter}
                onFilter={setQueueFilter}
                onUpdate={handleUpdate}
                onClearAll={handleClearAll}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Stats strip
// ---------------------------------------------------------------------------

function StatsStrip({ records }: { records: ReviewRecord[] }) {
  const total = records.length;
  const high = records.filter((r) => r.report.overall === "high").length;
  const highPct = total === 0 ? 0 : Math.round((high / total) * 100);
  const avgScore =
    total === 0
      ? 0
      : Math.round(records.reduce((s, r) => s + r.report.score, 0) / total);
  const pending = records.filter((r) => r.status === "pending").length;

  const stats = [
    { label: "Total scans", value: total, mono: true },
    { label: "High risk rate", value: `${highPct}%`, mono: true },
    { label: "Avg risk score", value: `${avgScore}/100`, mono: true },
    { label: "Pending review", value: pending, mono: true, accent: pending > 0 },
  ];

  return (
    <div className="border-b border-rule bg-surface/50">
      <div className="mx-auto max-w-6xl px-5 md:px-8 py-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-rule bg-white p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-1">
                {s.label}
              </div>
              <div
                className={cn(
                  "font-mono text-2xl font-semibold tabular",
                  s.accent ? "text-bad" : "text-ink",
                )}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analytics panel
// ---------------------------------------------------------------------------

function AnalyticsPanel({ records }: { records: ReviewRecord[] }) {
  if (records.length === 0) {
    return (
      <EmptyState message="No scan data yet. Run a check from the fraud check page." />
    );
  }

  const total = records.length;

  // Verdict distribution
  const verdictCounts: Record<Verdict, number> = { low: 0, medium: 0, high: 0 };
  for (const r of records) verdictCounts[r.report.overall]++;

  // Review status distribution
  const statusCounts: Record<ReviewStatus, number> = {
    pending: 0,
    confirmed_scam: 0,
    false_positive: 0,
    escalated: 0,
  };
  for (const r of records) statusCounts[r.status]++;

  // Source signal breakdown
  const sourceTotals: Record<string, { match: number; suspicious: number; clean: number; skipped: number }> = {};
  for (const r of records) {
    for (const sig of r.report.signals) {
      if (!sourceTotals[sig.source]) {
        sourceTotals[sig.source] = { match: 0, suspicious: 0, clean: 0, skipped: 0 };
      }
      sourceTotals[sig.source][sig.state]++;
    }
  }

  // Avg score by day (last 7 days)
  const now = Date.now();
  const DAY = 86400000;
  const dailyBuckets: number[][] = Array.from({ length: 7 }, () => []);
  for (const r of records) {
    const age = now - new Date(r.report.createdAt).getTime();
    const dayIdx = Math.floor(age / DAY);
    if (dayIdx < 7) dailyBuckets[6 - dayIdx].push(r.report.score);
  }
  const dailyAvg = dailyBuckets.map((b) =>
    b.length === 0 ? null : Math.round(b.reduce((s, v) => s + v, 0) / b.length),
  );

  return (
    <div className="space-y-6">
      {/* Row 1: Verdict + Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartCard title="Verdict distribution" subtitle={`${total} scans`}>
          <div className="space-y-3">
            {(["high", "medium", "low"] as Verdict[]).map((v) => {
              const count = verdictCounts[v];
              const pct = total === 0 ? 0 : (count / total) * 100;
              const meta = VERDICT_META[v];
              return (
                <div key={v}>
                  <div className="flex items-center justify-between mb-1.5 text-xs">
                    <span className="text-ink font-medium">{meta.label}</span>
                    <span className="tabular font-mono text-ink-muted">
                      {count} · {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-surface overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1], delay: 0.1 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: meta.barColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>

        <ChartCard title="Review status" subtitle="Queue breakdown">
          <div className="space-y-3">
            {(Object.keys(STATUS_META) as ReviewStatus[]).map((s) => {
              const count = statusCounts[s];
              const pct = total === 0 ? 0 : (count / total) * 100;
              const meta = STATUS_META[s];
              return (
                <div key={s}>
                  <div className="flex items-center justify-between mb-1.5 text-xs">
                    <span className="text-ink font-medium">{meta.label}</span>
                    <span className="tabular font-mono text-ink-muted">
                      {count} · {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-surface overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1], delay: 0.15 }}
                      className="h-full rounded-full bg-blue"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>

      {/* Row 2: Signal breakdown */}
      <ChartCard title="Signal breakdown" subtitle="Per source hit rate">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(["nfp", "semak_mule", "link_scrape", "behavior"] as const).map((src) => {
            const counts = sourceTotals[src] ?? { match: 0, suspicious: 0, clean: 0, skipped: 0 };
            const srcTotal = counts.match + counts.suspicious + counts.clean + counts.skipped;
            const hitPct =
              srcTotal === 0
                ? 0
                : Math.round(((counts.match + counts.suspicious) / srcTotal) * 100);
            const matchPct = srcTotal === 0 ? 0 : Math.round((counts.match / srcTotal) * 100);
            const Icon = sourceIcon(src);
            return (
              <div key={src} className="rounded-xl border border-rule bg-surface/60 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-white border border-rule flex items-center justify-center">
                    <Icon className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.75} />
                  </div>
                  <span className="text-[11px] font-medium text-ink leading-tight">
                    {SOURCE_LABEL[src]}
                  </span>
                </div>
                <div className="tabular font-mono text-2xl font-semibold text-ink mb-1">
                  {hitPct}%
                </div>
                <div className="text-[10px] text-ink-muted mb-2">flagged</div>
                <div className="h-1.5 rounded-full bg-rule overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${matchPct}%` }}
                    transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1], delay: 0.2 }}
                    className="h-full rounded-full bg-bad"
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[9px] text-ink-muted uppercase tracking-wide">
                  <span>{counts.match} match</span>
                  <span>{counts.skipped} skip</span>
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>

      {/* Row 3: 7-day score trend */}
      <ChartCard title="7-day risk score trend" subtitle="Average daily score">
        <ScoreTrendChart dailyAvg={dailyAvg} />
      </ChartCard>
    </div>
  );
}

function ScoreTrendChart({ dailyAvg }: { dailyAvg: (number | null)[] }) {
  const max = 100;
  const days = ["6d ago", "5d ago", "4d ago", "3d ago", "2d ago", "Yesterday", "Today"];

  return (
    <div className="flex items-end gap-3 h-28">
      {dailyAvg.map((avg, i) => {
        const hasData = avg !== null;
        const heightPct = hasData ? (avg! / max) * 100 : 0;
        const color =
          !hasData ? "#E4E7EC"
          : avg! >= 60 ? "#FFCD00"
          : avg! >= 30 ? "#005ABE"
          : "#0BA66C";

        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full flex items-end justify-center" style={{ height: "80px" }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${heightPct}%` }}
                transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1], delay: i * 0.05 }}
                className="w-full rounded-t-md min-h-[2px]"
                style={{ backgroundColor: color }}
              />
            </div>
            <div className="text-[9px] text-ink-muted text-center leading-tight">
              {days[i]}
            </div>
            {hasData && (
              <div className="text-[9px] font-mono tabular text-ink">{avg}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review queue panel
// ---------------------------------------------------------------------------

function ReviewQueuePanel({
  records,
  allRecords,
  filter,
  onFilter,
  onUpdate,
  onClearAll,
}: {
  records: ReviewRecord[];
  allRecords: ReviewRecord[];
  filter: QueueFilter;
  onFilter: (f: QueueFilter) => void;
  onUpdate: (id: string, patch: { status?: ReviewStatus; note?: string }) => void;
  onClearAll: () => void;
}) {
  const filterTabs: { id: QueueFilter; label: string }[] = [
    { id: "all", label: `All (${allRecords.length})` },
    { id: "pending", label: `Pending (${allRecords.filter((r) => r.status === "pending").length})` },
    { id: "confirmed_scam", label: "Confirmed" },
    { id: "false_positive", label: "False +ve" },
    { id: "escalated", label: "Escalated" },
  ];

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          {filterTabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => onFilter(id)}
              className={cn(
                "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation",
                filter === id
                  ? "bg-blue text-white"
                  : "bg-surface text-ink-muted hover:text-ink border border-rule",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {allRecords.length > 0 && (
          <button
            onClick={onClearAll}
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-bad transition-colors touch-manipulation min-h-[36px]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear all
          </button>
        )}
      </div>

      {records.length === 0 ? (
        <EmptyState message="No records match this filter." />
      ) : (
        <div className="space-y-3">
          {records.map((rec) => (
            <ReviewCard key={rec.id} record={rec} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review card
// ---------------------------------------------------------------------------

function ReviewCard({
  record,
  onUpdate,
}: {
  record: ReviewRecord;
  onUpdate: (id: string, patch: { status?: ReviewStatus; note?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(record.note);
  const { report } = record;
  const verdictMeta = VERDICT_META[report.overall];
  const statusMeta = STATUS_META[record.status];
  const StatusIcon = statusMeta.icon;

  const links = report.inputs.links ?? [];
  const bankAccount = report.inputs.bankAccount;
  const transaction = report.inputs.transaction;
  const chat = report.inputs.chat;

  const saveNote = () => {
    if (note !== record.note) onUpdate(record.id, { note });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
      className="rounded-2xl border border-rule bg-white overflow-hidden"
    >
      {/* CARD HEADER */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Verdict badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                verdictMeta.badgeCls,
              )}
            >
              {report.overall === "high" ? (
                <ShieldAlert className="w-3.5 h-3.5" strokeWidth={2.2} />
              ) : report.overall === "medium" ? (
                <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2.2} />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" strokeWidth={2.2} />
              )}
              {verdictMeta.label}
            </span>

            {/* Score pill */}
            <span className="inline-flex items-center font-mono text-xs text-ink-muted bg-surface border border-rule rounded-full px-2.5 py-1 tabular">
              Score: {report.score}
            </span>

            {/* Status badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                statusMeta.cls,
              )}
            >
              <StatusIcon className="w-3 h-3" strokeWidth={2.2} />
              {statusMeta.label}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-ink-muted">
            <Clock className="w-3 h-3" />
            {timeAgo(report.createdAt)}
          </div>
        </div>

        {/* Inputs summary */}
        <div className="mt-3 flex flex-wrap gap-2">
          {links.map((l) => (
            <InputChip key={l} icon={<LinkIcon className="w-3 h-3" />} text={l} mono />
          ))}
          {bankAccount && (
            <InputChip
              icon={<Landmark className="w-3 h-3" />}
              text={`${bankAccount.bank} · ${bankAccount.account}`}
              mono
            />
          )}
          {chat && (
            <InputChip icon={<MessageSquare className="w-3 h-3" />} text={chat.label} mono />
          )}
          {transaction && (
            <InputChip
              icon={<ArrowUpRight className="w-3 h-3" />}
              text={`RM ${transaction.amount} · ${transaction.transaction_type.replace("_", " ")}`}
            />
          )}
        </div>

        {/* Summary line */}
        <p className="mt-3 text-sm text-ink leading-relaxed line-clamp-2">{report.summary}</p>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-blue hover:underline underline-offset-4 min-h-[36px] touch-manipulation"
          >
            <FileText className="w-3.5 h-3.5" />
            {open ? "Hide detail" : "View full report"}
            <ChevronDown
              className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")}
            />
          </button>
        </div>
      </div>

      {/* REVIEW ACTIONS */}
      <div className="border-t border-rule bg-surface/50 px-5 py-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-ink-muted">
              Mark as:
            </span>
            {(["confirmed_scam", "false_positive", "escalated", "pending"] as ReviewStatus[]).map(
              (s) => {
                const meta = STATUS_META[s];
                const Icon = meta.icon;
                const isActive = record.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => onUpdate(record.id, { status: s })}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all touch-manipulation",
                      isActive
                        ? meta.cls + " ring-2 ring-offset-1 ring-current/30"
                        : "bg-white text-ink-muted border-rule hover:border-ink/30",
                    )}
                  >
                    <Icon className="w-3 h-3" strokeWidth={2.2} />
                    {meta.label}
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* Note field */}
        <div className="mt-3 flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
            placeholder="Add reviewer note…"
            className="flex-1 rounded-xl border border-rule bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-muted/50 outline-none focus:border-blue"
          />
          {note !== record.note && (
            <button
              onClick={saveNote}
              className="px-3 py-2 rounded-xl bg-blue text-white text-xs font-medium touch-manipulation"
            >
              Save
            </button>
          )}
        </div>
        {record.reviewedAt && (
          <div className="mt-1.5 text-[10px] text-ink-muted">
            Last reviewed {timeAgo(record.reviewedAt)}
          </div>
        )}
      </div>

      {/* EXPANDED SIGNAL DETAIL */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
            className="overflow-hidden border-t border-rule"
          >
            <div className="p-5 space-y-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2">
                Signal breakdown
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {report.signals.map((sig) => {
                  const Icon = sourceIcon(sig.source);
                  const chipCls =
                    sig.state === "match"
                      ? "bg-yellow/25 text-ink border border-yellow"
                      : sig.state === "suspicious"
                      ? "bg-blue-soft text-blue"
                      : sig.state === "clean"
                      ? "bg-good/10 text-good"
                      : "bg-surface text-ink-muted";
                  const chipLabel =
                    sig.state === "match"
                      ? "High risk"
                      : sig.state === "suspicious"
                      ? "Suspicious"
                      : sig.state === "clean"
                      ? "Clean"
                      : "Skipped";

                  return (
                    <div
                      key={sig.source}
                      className="rounded-xl border border-rule bg-surface/60 p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-white border border-rule flex items-center justify-center">
                            <Icon className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.75} />
                          </div>
                          <span className="text-xs font-medium text-ink">
                            {SOURCE_LABEL[sig.source]}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                            chipCls,
                          )}
                        >
                          {chipLabel}
                        </span>
                      </div>
                      <p className="text-xs text-ink-muted leading-relaxed">
                        {sig.headline}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="pt-2 border-t border-rule">
                <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2">
                  Recommended action
                </div>
                <p className="text-sm text-ink leading-relaxed">{report.recommendation}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-rule bg-white p-6">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.2em] text-blue mb-1">{subtitle}</div>
        <h3 className="font-display text-xl text-ink">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InputChip({
  icon,
  text,
  mono,
}: {
  icon: React.ReactNode;
  text: string;
  mono?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-rule bg-surface px-2.5 py-1 text-[11px] text-ink max-w-[240px] truncate",
        mono ? "font-mono" : "",
      )}
    >
      <span className="text-ink-muted shrink-0">{icon}</span>
      {text}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-rule bg-white p-12 flex flex-col items-center text-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center">
        <Activity className="w-5 h-5 text-ink-muted" strokeWidth={1.75} />
      </div>
      <p className="text-sm text-ink-muted max-w-xs">{message}</p>
      <Link
        to="/check"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue text-white text-xs font-medium hover:bg-[#004a9e] transition-colors touch-manipulation"
      >
        Run a check
        <ArrowUpRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

function sourceIcon(src: string): typeof Landmark {
  switch (src) {
    case "nfp": return Landmark;
    case "semak_mule": return ShieldAlert;
    case "link_scrape": return LinkIcon;
    case "behavior":
    case "chat_model":
    default:
      return Activity;
  }
}
