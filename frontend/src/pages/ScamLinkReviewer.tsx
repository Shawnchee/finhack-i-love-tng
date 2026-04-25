import { useState, useCallback, useEffect } from "react";
import {
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  ExternalLink,
  Globe,
  Loader2,
  Search,
  ShieldAlert,
  Trash2,
  X,
  ChevronDown,
  Tag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { scanUrl, type ScanResponse, type ScamVerdict } from "../lib/api";
import { cn } from "../lib/cn";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HistoryEntry {
  id: string;
  url: string;
  verdict: ScamVerdict | null;
  scannedAt: number;
  result: ScanResponse;
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "scamreview_history";
const MAX_HISTORY = 20;

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

// ---------------------------------------------------------------------------
// Text highlighting (same algorithm as Report.tsx)
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function splitWithHighlights(
  body: string,
  quotes: string[],
): { text: string; highlight: boolean }[] {
  if (!body) return [];
  const cleaned = Array.from(
    new Set(quotes.map(normalize).filter((q) => q.length >= 4 && q.length <= 300)),
  );
  if (cleaned.length === 0) return [{ text: body, highlight: false }];

  const lower = body.toLowerCase();
  type Range = { start: number; end: number };
  const ranges: Range[] = [];

  for (const q of cleaned) {
    const target = q.toLowerCase();
    let from = 0;
    let hits = 0;
    while (hits < 3) {
      const idx = lower.indexOf(target, from);
      if (idx === -1) break;
      ranges.push({ start: idx, end: idx + target.length });
      from = idx + target.length;
      hits++;
    }
  }
  if (ranges.length === 0) return [{ text: body, highlight: false }];

  ranges.sort((a, b) => a.start - b.start);
  const merged: Range[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }

  const out: { text: string; highlight: boolean }[] = [];
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) out.push({ text: body.slice(cursor, r.start), highlight: false });
    out.push({ text: body.slice(r.start, r.end), highlight: true });
    cursor = r.end;
  }
  if (cursor < body.length) out.push({ text: body.slice(cursor), highlight: false });
  return out;
}

// ---------------------------------------------------------------------------
// Verdict helpers
// ---------------------------------------------------------------------------

const VERDICT_META: Record<
  ScamVerdict,
  { label: string; icon: typeof AlertOctagon; ringCls: string; badgeCls: string; barColor: string }
> = {
  SCAM: {
    label: "Scam detected",
    icon: AlertOctagon,
    ringCls: "border-2 border-bad shadow-[0_0_0_4px_#D1434314]",
    badgeCls: "bg-bad text-white",
    barColor: "#D14343",
  },
  NOT_SCAM: {
    label: "Looks safe",
    icon: CheckCircle2,
    ringCls: "border-2 border-good shadow-[0_0_0_4px_#0BA66C14]",
    badgeCls: "bg-good/15 text-good",
    barColor: "#0BA66C",
  },
  NEEDS_REVIEW: {
    label: "Needs review",
    icon: AlertTriangle,
    ringCls: "border-2 border-yellow shadow-[0_0_0_4px_#FFCD0020]",
    badgeCls: "bg-yellow/30 text-ink",
    barColor: "#FFCD00",
  },
};

function verdictMeta(v: ScamVerdict | null) {
  return v ? VERDICT_META[v] : null;
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname !== "/" ? u.pathname : "");
  } catch {
    return url.length > 50 ? url.slice(0, 50) + "…" : url;
  }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ScamLinkReviewer() {
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<HistoryEntry | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  useEffect(() => {
    if (history.length > 0 && !active) setActive(history[0]);
  }, []);

  const handleScan = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed || scanning) return;

    setScanning(true);
    setError(null);

    try {
      const result = await scanUrl(trimmed);
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        url: trimmed,
        verdict: result.verdict,
        scannedAt: Date.now(),
        result,
      };
      const next = [entry, ...history];
      setHistory(next);
      saveHistory(next);
      setActive(entry);
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed. Check the URL and try again.");
    } finally {
      setScanning(false);
    }
  }, [url, scanning, history]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleScan();
  };

  const removeEntry = (id: string) => {
    const next = history.filter((h) => h.id !== id);
    setHistory(next);
    saveHistory(next);
    if (active?.id === id) setActive(next[0] ?? null);
  };

  const clearAll = () => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    setActive(null);
  };

  return (
    <main className="min-h-[calc(100dvh-64px)] pb-16">
      {/* PAGE HEADER */}
      <section className="border-b border-rule bg-white">
        <div className="mx-auto max-w-6xl px-5 md:px-8 py-10 md:py-14">
          <div className="text-xs uppercase tracking-[0.18em] text-blue mb-3">
            Scam link reviewer
          </div>
          <h1 className="font-display text-[32px] sm:text-4xl md:text-5xl text-ink leading-[1.02]">
            Paste a link. Get the{" "}
            <span className="italic">truth.</span>
          </h1>
          <p className="mt-4 text-ink-muted leading-relaxed max-w-xl">
            Scrapes the page, runs it through SC Malaysia's scam playbook, and
            flags Malaysian-targeted fraud — Manglish included.
          </p>
        </div>
      </section>

      {/* URL INPUT BAR */}
      <section className="border-b border-rule bg-surface/50">
        <div className="mx-auto max-w-6xl px-5 md:px-8 py-4">
          <div className="flex gap-3 items-center">
            <div
              className={cn(
                "flex-1 flex items-center gap-3 rounded-2xl border bg-white px-4 py-3 transition-all",
                scanning
                  ? "border-rule opacity-60"
                  : url.trim()
                  ? "border-blue shadow-[0_0_0_4px_#005ABE14]"
                  : "border-rule",
              )}
            >
              {scanning ? (
                <Loader2 className="w-4 h-4 text-ink-muted animate-spin shrink-0" />
              ) : (
                <Globe className="w-4 h-4 text-ink-muted shrink-0" />
              )}
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={scanning}
                placeholder="https://suspicious-investment.com/guaranteed-profit"
                className="flex-1 bg-transparent text-sm font-mono text-ink placeholder:text-ink-muted/50 outline-none"
              />
              {url && !scanning && (
                <button
                  onClick={() => setUrl("")}
                  className="shrink-0 text-ink-muted hover:text-ink touch-manipulation"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={handleScan}
              disabled={!url.trim() || scanning}
              className={cn(
                "inline-flex items-center gap-2 px-5 py-3 min-h-[48px] rounded-full font-medium text-sm transition-all touch-manipulation shrink-0",
                url.trim() && !scanning
                  ? "bg-blue text-white hover:bg-[#004a9e] shadow-card"
                  : "bg-surface text-ink-muted cursor-not-allowed",
              )}
            >
              {scanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning…
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Scan link
                </>
              )}
            </button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 flex items-center gap-2 text-sm text-bad"
              >
                <AlertOctagon className="w-4 h-4 shrink-0" strokeWidth={2.2} />
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* BODY: history + result */}
      <div className="mx-auto max-w-6xl px-5 md:px-8 py-8">
        {history.length === 0 && !scanning ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* HISTORY SIDEBAR */}
            {history.length > 0 && (
              <aside className="w-full md:w-72 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                    History · {history.length}
                  </div>
                  <button
                    onClick={clearAll}
                    className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-bad transition-colors min-h-[32px] touch-manipulation"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear all
                  </button>
                </div>
                <ul className="space-y-2">
                  {history.map((entry) => (
                    <HistoryItem
                      key={entry.id}
                      entry={entry}
                      isActive={active?.id === entry.id}
                      onSelect={() => setActive(entry)}
                      onRemove={() => removeEntry(entry.id)}
                    />
                  ))}
                </ul>
              </aside>
            )}

            {/* RESULT PANEL */}
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                {scanning && !active && (
                  <motion.div
                    key="scanning"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded-2xl border border-rule bg-white p-12 flex flex-col items-center gap-4 text-ink-muted"
                  >
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm">Scraping and analysing…</p>
                  </motion.div>
                )}
                {active && (
                  <motion.div
                    key={active.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.25, 1, 0.5, 1] }}
                  >
                    <ResultPanel entry={active} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// History item
// ---------------------------------------------------------------------------

function HistoryItem({
  entry,
  isActive,
  onSelect,
  onRemove,
}: {
  entry: HistoryEntry;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const meta = verdictMeta(entry.verdict);

  return (
    <li
      className={cn(
        "group relative rounded-xl border bg-white transition-all cursor-pointer overflow-hidden",
        isActive ? "border-blue shadow-[0_0_0_4px_#005ABE14]" : "border-rule hover:border-ink/20",
      )}
      onClick={onSelect}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide shrink-0",
              meta ? meta.badgeCls : "bg-surface text-ink-muted",
            )}
          >
            {meta ? <meta.icon className="w-2.5 h-2.5" strokeWidth={2.4} /> : null}
            {entry.verdict ?? "—"}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-muted hover:text-bad touch-manipulation min-h-[24px] min-w-[24px] flex items-center justify-center shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        <div className="mt-2 text-xs font-mono text-ink break-all leading-relaxed line-clamp-2">
          {shortUrl(entry.url)}
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-ink-muted">
          <Clock className="w-2.5 h-2.5" />
          {timeAgo(entry.scannedAt)}
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Result panel
// ---------------------------------------------------------------------------

function ResultPanel({ entry }: { entry: HistoryEntry }) {
  const { result } = entry;
  const meta = verdictMeta(result.verdict);
  const confidence = result.scam?.confidence ?? 0;
  const quotes = Object.values(result.scam?.indicator_evidence ?? {});
  const MAX_BODY = 3000;
  const body = result.body ?? "";
  const truncated = body.length > MAX_BODY;
  const trimmed = truncated ? body.slice(0, MAX_BODY) : body;
  const segments = splitWithHighlights(trimmed, quotes);

  return (
    <div className={cn("rounded-2xl border bg-white overflow-hidden", meta?.ringCls ?? "border-rule")}>
      {/* VERDICT BANNER */}
      {result.verdict === "SCAM" && (
        <div className="bg-bad text-white px-5 py-3 flex items-center gap-2.5" role="alert">
          <motion.span
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <AlertOctagon className="w-5 h-5" strokeWidth={2.4} />
          </motion.span>
          <div>
            <div className="text-sm font-semibold tracking-wide uppercase">Scam detected</div>
            <div className="text-[11px] opacity-90">Do not engage. Do not transfer money.</div>
          </div>
        </div>
      )}
      {result.verdict === "NOT_SCAM" && (
        <div className="bg-good/10 border-b border-good/30 text-good px-5 py-2.5 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" strokeWidth={2.4} />
          <div className="text-xs font-medium uppercase tracking-wide">Looks safe</div>
        </div>
      )}
      {result.verdict === "NEEDS_REVIEW" && (
        <div className="bg-yellow/15 border-b border-yellow/40 text-ink px-5 py-2.5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-ink" strokeWidth={2.4} />
          <div className="text-xs font-medium uppercase tracking-wide">Needs manual review</div>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* URL + platform */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-1">
              Scanned URL
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-ink break-all">{result.url}</span>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-blue hover:underline shrink-0 touch-manipulation"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            {result.platform && (
              <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-muted">
                <Globe className="w-3 h-3" />
                {result.platform}
              </div>
            )}
          </div>
        </div>

        {/* CONFIDENCE BAR */}
        {result.scam && (
          <div>
            <div className="flex items-end justify-between mb-2 text-xs text-ink-muted">
              <span className="uppercase tracking-wider">Scam confidence</span>
              <span className="tabular font-mono">
                {Math.round(confidence * 100)}%
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-surface overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${confidence * 100}%` }}
                transition={{ duration: 0.72, ease: [0.25, 1, 0.5, 1], delay: 0.1 }}
                className="h-full rounded-full"
                style={{ backgroundColor: meta?.barColor ?? "#005ABE" }}
              />
            </div>
          </div>
        )}

        {/* EVIDENCE SUMMARY */}
        {result.evidence_summary && (
          <div className="rounded-xl border border-rule bg-surface/60 p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2">
              Evidence summary
            </div>
            <p className="text-sm text-ink leading-relaxed">{result.evidence_summary}</p>
          </div>
        )}

        {/* SCAM INDICATORS */}
        {result.scam && result.scam.indicators_found.length > 0 && (
          <IndicatorsSection scam={result.scam} />
        )}

        {/* KEYWORD MATCHES */}
        {result.keywords_matched.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2 flex items-center gap-1.5">
              <Tag className="w-3 h-3" />
              Keywords matched · {result.keywords_matched.length}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.keywords_matched.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center rounded-full bg-bad/10 text-bad border border-bad/20 px-2.5 py-0.5 text-[11px] font-medium"
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ANALYSIS CARDS: regulatory + localisation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {result.regulatory && (
            <AnalysisCard title="Regulatory analysis">
              <Row label="Capital market" value={result.regulatory.is_capital_market ? "Yes" : "No"} highlight={result.regulatory.is_capital_market} />
              {result.regulatory.product_types.length > 0 && (
                <Row label="Product types" value={result.regulatory.product_types.join(", ")} />
              )}
              <Row label="Intent" value={result.regulatory.intent} />
              {result.regulatory.reasoning && (
                <Row label="Reasoning" value={result.regulatory.reasoning} />
              )}
            </AnalysisCard>
          )}
          {result.localisation && (
            <AnalysisCard title="Malaysian targeting">
              <Row
                label="Targets Malaysians"
                value={result.localisation.targets_malaysians ? "Yes" : "No"}
                highlight={result.localisation.targets_malaysians}
              />
              {result.localisation.languages_detected.length > 0 && (
                <Row label="Languages" value={result.localisation.languages_detected.join(", ")} />
              )}
              {result.localisation.localisation_cues.length > 0 && (
                <Row label="Cues" value={result.localisation.localisation_cues.join("; ")} />
              )}
              {result.localisation.reasoning && (
                <Row label="Reasoning" value={result.localisation.reasoning} />
              )}
            </AnalysisCard>
          )}
        </div>

        {/* SCRAPED CONTENT */}
        {body && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                Page content
              </div>
              {result.verdict === "SCAM" && quotes.length > 0 && (
                <div className="inline-flex items-center gap-1 text-[11px] text-bad font-medium">
                  <AlertOctagon className="w-3 h-3" strokeWidth={2.4} />
                  {quotes.length} flagged phrase{quotes.length === 1 ? "" : "s"}
                </div>
              )}
              {result.verdict === "NOT_SCAM" && (
                <div className="inline-flex items-center gap-1 text-[11px] text-good font-medium">
                  <CheckCircle2 className="w-3 h-3" strokeWidth={2.4} />
                  No flagged phrases
                </div>
              )}
            </div>
            <div
              className={cn(
                "rounded-xl border p-4 text-[13px] leading-relaxed font-mono whitespace-pre-wrap break-words max-h-[280px] overflow-y-auto",
                result.verdict === "SCAM"
                  ? "border-bad/30 bg-bad/5"
                  : result.verdict === "NOT_SCAM"
                  ? "border-good/30 bg-good/5"
                  : "border-rule bg-white",
              )}
            >
              {segments.map((seg, i) =>
                seg.highlight ? (
                  <mark
                    key={i}
                    className="bg-bad/20 text-bad font-semibold rounded px-1 -mx-0.5 ring-1 ring-bad/40"
                  >
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
              {truncated && (
                <span className="text-ink-muted">
                  {"\n\n"}… ({(body.length - MAX_BODY).toLocaleString()} more chars)
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Indicators accordion
// ---------------------------------------------------------------------------

function IndicatorsSection({ scam }: { scam: NonNullable<ScanResponse["scam"]> }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between min-h-[44px] -my-1 text-left touch-manipulation"
      >
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-bad" strokeWidth={2} />
          Scam indicators · {scam.indicators_found.length} found
        </div>
        <ChevronDown
          className={cn("w-4 h-4 text-ink-muted transition-transform", open && "rotate-180")}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
            className="overflow-hidden"
          >
            <ul className="mt-3 space-y-2">
              {scam.indicators_found.map((ind) => {
                const evidence = scam.indicator_evidence[ind];
                return (
                  <li
                    key={ind}
                    className="rounded-xl border border-bad/20 bg-bad/5 p-3 text-sm"
                  >
                    <div className="flex items-center gap-2 font-medium text-bad">
                      <AlertOctagon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.4} />
                      {ind.replace(/_/g, " ")}
                    </div>
                    {evidence && (
                      <div className="mt-1.5 font-mono text-[12px] text-ink leading-relaxed pl-5 break-words">
                        "{evidence}"
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analysis card + row
// ---------------------------------------------------------------------------

function AnalysisCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-rule bg-surface/60 p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-3">{title}</div>
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "text-xs font-mono break-words mt-0.5",
          highlight ? "text-bad font-semibold" : "text-ink",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.25, 1, 0.5, 1] }}
      className="rounded-2xl border-2 border-dashed border-rule bg-white p-12 md:p-20 flex flex-col items-center text-center gap-4"
    >
      <div className="w-14 h-14 rounded-2xl bg-blue-soft flex items-center justify-center">
        <Search className="w-6 h-6 text-blue" strokeWidth={1.75} />
      </div>
      <div>
        <h2 className="font-display text-2xl text-ink">No scans yet</h2>
        <p className="mt-2 text-sm text-ink-muted max-w-xs">
          Paste a suspicious link above — Telegram groups, investment sites,
          Lowyat threads, anything.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center mt-2">
        {["t.me/channel", "offer.my/invest", "cari.com.my/thread"].map((ex) => (
          <span
            key={ex}
            className="inline-flex items-center gap-1 rounded-full border border-rule bg-surface px-3 py-1 text-xs font-mono text-ink-muted"
          >
            <ArrowUpRight className="w-3 h-3" />
            {ex}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
