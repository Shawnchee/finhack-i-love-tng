import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  ChevronDown,
  Info,
  Phone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Link as LinkIcon,
  MessageSquare,
  Landmark,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import BlurText from "../components/BlurText";
import CountUp from "../components/CountUp";
import {
  getMockReport,
  SOURCE_LABEL,
  type Report as ReportType,
  type SourceSignal,
  type Verdict,
} from "../lib/mockReport";
import type { ScanResponse } from "../lib/api";
import { cn } from "../lib/cn";

const VERDICT_COPY: Record<Verdict, { word: string; label: string }> = {
  low: { word: "Low Risk", label: "Looks okay" },
  medium: { word: "Medium Risk", label: "Slow down" },
  high: { word: "High Risk", label: "Do not transfer" },
};

export default function Report() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const mockParam = params.get("mock");

  const report = useMemo<ReportType>(() => {
    // Live report: route id is "live" and there's no ?mock= override.
    if (id === "live" && !mockParam) {
      try {
        const raw = sessionStorage.getItem("lastReport");
        if (raw) return JSON.parse(raw) as ReportType;
      } catch (err) {
        console.error("[report] failed to read lastReport", err);
      }
      // No live report stored (e.g. user navigated to /report/live directly,
      // or sessionStorage was cleared). Fall back to a low mock — absence of
      // evidence shouldn't render as a HIGH RISK verdict.
      return getMockReport("low");
    }
    return getMockReport(mockParam || id);
  }, [id, mockParam]);

  const v = report.overall;

  return (
    <main className="pb-24">
      <VerdictBand
        verdict={v}
        score={report.score}
        summary={report.summary}
        inputs={report.inputs}
      />

      <section className="mx-auto max-w-6xl px-5 md:px-8 mt-16 md:mt-20">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-blue mb-2">
              Evidence
            </div>
            <h2 className="font-display text-3xl md:text-4xl text-ink">
              What each source said
            </h2>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-ink-muted">
            <Clock className="w-3.5 h-3.5" />
            Ran just now · {report.signals.filter((s) => s.state !== "skipped").length} sources
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.signals.map((s) => (
            <SignalCard key={s.source} signal={s} />
          ))}
        </div>
      </section>

      <Recommendation verdict={v} text={report.recommendation} />

      <section className="mx-auto max-w-6xl px-5 md:px-8 mt-12 flex flex-wrap items-center gap-4">
        <Link
          to="/check"
          className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-full bg-blue text-white font-medium hover:bg-[#004a9e] transition-colors touch-manipulation"
        >
          <RefreshCw className="w-4 h-4" strokeWidth={2} />
          Check another
        </Link>
        <HowScoredLink />
        <span className="ml-auto text-xs text-ink-muted">
          Report #{report.id} · ephemeral
        </span>
      </section>
    </main>
  );
}

function VerdictBand({
  verdict,
  score,
  summary,
  inputs,
}: {
  verdict: Verdict;
  score: number;
  summary: string;
  inputs: ReportType["inputs"];
}) {
  const { word, label } = VERDICT_COPY[verdict];
  const ringColor =
    verdict === "high" ? "#FFCD00" : verdict === "medium" ? "#005ABE" : "#0BA66C";

  return (
    <section
      className={cn(
        "relative border-b border-rule",
        verdict === "medium" && "bg-blue-soft",
        verdict === "high" && "bg-white",
        verdict === "low" && "bg-white",
      )}
    >
      {verdict === "high" && (
        <div className="absolute inset-y-0 left-0 w-[6px] bg-yellow" />
      )}

      <div className="mx-auto max-w-6xl px-5 md:px-8 py-14 md:py-24 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-10 items-start">
        <div>
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-ink-muted">
            {verdict === "high" ? (
              <ShieldAlert className="w-4 h-4 text-yellow" strokeWidth={2} />
            ) : verdict === "medium" ? (
              <AlertTriangle className="w-4 h-4 text-blue" strokeWidth={2} />
            ) : (
              <ShieldCheck className="w-4 h-4 text-good" strokeWidth={2} />
            )}
            {label}
          </div>

          <h1
            aria-live="polite"
            className="mt-5 font-display text-[44px] sm:text-[56px] md:text-[112px] leading-[0.92] tracking-tight text-ink break-words"
          >
            <BlurText text={word} by="letter" delay={0.1} />
          </h1>

          <p className="mt-6 max-w-2xl text-base md:text-lg text-ink leading-relaxed">
            {summary}
          </p>

          <div className="mt-10 max-w-xl">
            <div className="flex items-end justify-between mb-2 text-xs text-ink-muted">
              <span className="uppercase tracking-wider">Risk score</span>
              <span className="tabular">
                <CountUp to={score} duration={780} trigger="mount" />{" "}
                <span className="text-ink-muted">/ 100</span>
              </span>
            </div>
            <div className="h-3 rounded-full bg-surface overflow-hidden relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 0.78, ease: [0.25, 1, 0.5, 1], delay: 0.2 }}
                className="absolute inset-y-0 left-0"
                style={{ backgroundColor: ringColor }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[10px] tabular text-ink-muted uppercase tracking-wider">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>
        </div>

        <ScanInputsSidebar inputs={inputs} />
      </div>
    </section>
  );
}

const ID_TYPE_LABEL: Record<string, string> = {
  mykad: "MyKad",
  bric: "BRIC",
  police: "Police ID",
  army: "Army ID",
  unhcr: "UNHCR",
  passport: "Passport",
};

function formatAccount(acc: string): string {
  const digits = acc.replace(/\D/g, "");
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function ScanInputsSidebar({ inputs }: { inputs: ReportType["inputs"] }) {
  const items: { icon: typeof Landmark; text: string; mono?: boolean }[] = [];

  if (inputs.bankAccount) {
    items.push({
      icon: Landmark,
      text: `${inputs.bankAccount.bank} · ${formatAccount(inputs.bankAccount.account)}`,
      mono: true,
    });
  }
  if (inputs.idCheck) {
    const label = ID_TYPE_LABEL[inputs.idCheck.idType] || inputs.idCheck.idType;
    items.push({
      icon: ShieldCheck,
      text: `${label} · ${inputs.idCheck.idNo}`,
      mono: true,
    });
  }
  if (inputs.links && inputs.links.length > 0) {
    items.push({
      icon: LinkIcon,
      text: inputs.links.length === 1 ? inputs.links[0] : `${inputs.links.length} links scanned`,
    });
  }
  if (inputs.chat) {
    const text =
      inputs.chat.source === "telegram"
        ? inputs.chat.label
        : `${inputs.chat.label} · ${inputs.chat.messageCount} messages`;
    items.push({ icon: MessageSquare, text, mono: true });
  }
  if (inputs.transaction) {
    const t = inputs.transaction;
    items.push({
      icon: ArrowUpRight,
      text: `RM ${t.amount.toFixed(2)} · ${t.transaction_type.replace("_", " ")}`,
    });
  }

  if (items.length === 0) return null;

  return (
    <aside className="rounded-2xl border border-rule bg-white p-5 min-w-[220px]">
      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">
        Scan inputs
      </div>
      <ul className="mt-4 space-y-3 text-sm">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <item.icon className="w-4 h-4 text-ink-muted mt-0.5 shrink-0" strokeWidth={1.75} />
            <div className={cn("text-xs text-ink break-all", item.mono ? "font-mono tabular" : "")}>
              {item.text}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Scraped content with red/green keyword highlighting.
//
// Splits the body into [text, match, text, match, ...] segments using the
// LLM-supplied indicator quotes. Each match is rendered with a red
// background so users can see *exactly* which phrases triggered the verdict.
// For NOT_SCAM pages we show a soft green-tinted block with a "no flagged
// phrases" note instead, which still gives a positive visual signal.
// ---------------------------------------------------------------------------

const _MAX_BODY_CHARS = 2400;

function _normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Splits `body` into alternating plain / highlighted segments. The split is
 * case-insensitive and operates on the raw text — overlapping matches are
 * resolved by greedy left-to-right scanning. Returns at most ~10 highlights.
 */
function splitWithHighlights(
  body: string,
  quotes: string[],
): { text: string; highlight: boolean }[] {
  if (!body) return [];
  // Dedupe + clean quotes, keep only those long enough to be meaningful.
  const cleaned = Array.from(
    new Set(
      quotes
        .map(_normalize)
        .filter((q) => q.length >= 4 && q.length <= 300),
    ),
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

  // Merge overlapping ranges, sort by start.
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
    if (r.start > cursor) {
      out.push({ text: body.slice(cursor, r.start), highlight: false });
    }
    out.push({ text: body.slice(r.start, r.end), highlight: true });
    cursor = r.end;
  }
  if (cursor < body.length) {
    out.push({ text: body.slice(cursor), highlight: false });
  }
  return out;
}

function ScrapedContent({ scrape }: { scrape: ScanResponse }) {
  const verdict = scrape.verdict;
  const body = scrape.body || "";
  const quotes = Object.values(scrape.scam?.indicator_evidence ?? {});
  const truncated = body.length > _MAX_BODY_CHARS;
  const trimmed = truncated ? body.slice(0, _MAX_BODY_CHARS) : body;
  const segments = splitWithHighlights(trimmed, quotes);
  const highlightCount = segments.filter((s) => s.highlight).length;

  if (!body) return null;

  const isScam = verdict === "SCAM";
  const isSafe = verdict === "NOT_SCAM";

  return (
    <div className="px-6 pb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          Page content
        </div>
        {isScam && highlightCount > 0 && (
          <div className="inline-flex items-center gap-1.5 text-[11px] text-bad font-medium">
            <AlertOctagon className="w-3 h-3" strokeWidth={2.4} />
            {highlightCount} flagged phrase{highlightCount === 1 ? "" : "s"}
          </div>
        )}
        {isSafe && (
          <div className="inline-flex items-center gap-1.5 text-[11px] text-good font-medium">
            <CheckCircle2 className="w-3 h-3" strokeWidth={2.4} />
            No flagged phrases
          </div>
        )}
      </div>
      <div
        className={cn(
          "rounded-xl border p-4 text-[13px] leading-relaxed font-mono whitespace-pre-wrap break-words max-h-[280px] overflow-y-auto",
          isScam
            ? "border-bad/30 bg-bad/5"
            : isSafe
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
            {"\n\n"}… (truncated, {(body.length - _MAX_BODY_CHARS).toLocaleString()}{" "}
            more chars)
          </span>
        )}
      </div>
    </div>
  );
}

function ScamBanner() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="bg-bad text-white px-5 py-3 flex items-center gap-2.5"
      role="alert"
      aria-live="polite"
    >
      <motion.span
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="inline-flex"
      >
        <AlertOctagon className="w-5 h-5" strokeWidth={2.4} />
      </motion.span>
      <div>
        <div className="text-sm font-semibold tracking-wide uppercase">
          Scam detected
        </div>
        <div className="text-[11px] opacity-90 leading-tight">
          Do not engage. Do not transfer money.
        </div>
      </div>
    </motion.div>
  );
}

function SafeBanner() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="bg-good/10 border-b border-good/30 text-good px-5 py-2.5 flex items-center gap-2"
    >
      <CheckCircle2 className="w-4 h-4" strokeWidth={2.4} />
      <div className="text-xs font-medium uppercase tracking-wide">
        Looks safe
      </div>
    </motion.div>
  );
}

function SignalCard({ signal }: { signal: SourceSignal }) {
  const [open, setOpen] = useState(false);
  const chip = chipMeta(signal.state);
  const Icon = sourceIcon(signal.source);

  // For link-scrape cards, pull the LLM verdict so we can render a strong
  // SCAM / NOT_SCAM banner that the eye picks up before any chip.
  const llmVerdict =
    signal.source === "link_scrape"
      ? (signal.raw as ScanResponse | undefined)?.verdict ?? null
      : null;

  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
      className={cn(
        "rounded-2xl border bg-white overflow-hidden transition-shadow",
        llmVerdict === "SCAM"
          ? "border-2 border-bad shadow-[0_0_0_4px_#D1434314]"
          : llmVerdict === "NOT_SCAM"
            ? "border-2 border-good shadow-[0_0_0_4px_#0BA66C14]"
            : "border-rule",
      )}
    >
      {llmVerdict === "SCAM" && <ScamBanner />}
      {llmVerdict === "NOT_SCAM" && <SafeBanner />}

      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center">
              <Icon className="w-4 h-4 text-ink" strokeWidth={1.75} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                {SOURCE_LABEL[signal.source]}
              </div>
              <div className="text-sm font-medium text-ink mt-0.5">
                Signal
              </div>
            </div>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              chip.cls,
            )}
          >
            <chip.icon className="w-3.5 h-3.5" strokeWidth={2.2} />
            {chip.label}
          </span>
        </div>

        <p className="mt-4 text-[15px] text-ink leading-relaxed">
          {signal.headline}
        </p>

        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-4 inline-flex items-center gap-1.5 min-h-[44px] -my-2 text-xs text-blue hover:underline underline-offset-4 touch-manipulation"
        >
          {open ? "Hide evidence" : "See evidence"}
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.25, 1, 0.5, 1] }}
            className="overflow-hidden border-t border-rule bg-surface/60"
          >
            <dl className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-xs">
              {signal.evidence.map((e) => (
                <div key={e.label} className="flex flex-col gap-0.5">
                  <dt className="uppercase tracking-wider text-ink-muted">
                    {e.label}
                  </dt>
                  <dd className="font-mono text-ink text-[13px] break-words">
                    {e.value}
                  </dd>
                </div>
              ))}
            </dl>
            {signal.source === "link_scrape" && signal.raw ? (
              <ScrapedContent scrape={signal.raw as ScanResponse} />
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Recommendation({
  verdict,
  text,
}: {
  verdict: Verdict;
  text: string;
}) {
  if (verdict === "high") {
    return (
      <section className="mx-auto max-w-6xl px-5 md:px-8 mt-12">
        <div className="rounded-2xl border border-yellow bg-yellow/10 p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex items-start gap-4">
            <ShieldAlert className="w-6 h-6 text-ink mt-0.5" strokeWidth={1.75} />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-ink-muted mb-1">
                Recommended next step
              </div>
              <p className="text-ink font-medium text-lg leading-snug max-w-2xl">
                {text}
              </p>
            </div>
          </div>
          <a
            href="tel:997"
            className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-full bg-blue text-white font-medium hover:bg-[#004a9e] transition-colors shrink-0 shadow-card touch-manipulation"
          >
            <Phone className="w-4 h-4" strokeWidth={2} />
            Call NFCC 997
          </a>
        </div>
      </section>
    );
  }
  if (verdict === "medium") {
    return (
      <section className="mx-auto max-w-6xl px-5 md:px-8 mt-12">
        <div className="rounded-2xl border border-blue/30 bg-blue-soft p-6 md:p-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-blue mt-0.5" strokeWidth={1.75} />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-ink-muted mb-1">
                Stay cautious
              </div>
              <p className="text-ink text-base md:text-lg leading-relaxed max-w-2xl">
                {text}
              </p>
              <ul className="mt-5 space-y-2 text-sm text-ink-muted">
                {[
                  "Verify the seller through an official channel.",
                  "Don't transfer until you've confirmed.",
                  "Screenshot the conversation.",
                  "Check NFCC if anything feels off.",
                ].map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-ink-muted" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="mx-auto max-w-6xl px-5 md:px-8 mt-12">
      <div className="rounded-2xl border border-rule bg-white p-6 md:p-8 flex items-start gap-4">
        <ShieldCheck className="w-6 h-6 text-good mt-0.5" strokeWidth={1.75} />
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-ink-muted mb-1">
            Looks okay
          </div>
          <p className="text-ink text-base md:text-lg leading-relaxed max-w-2xl">
            {text}
          </p>
        </div>
      </div>
    </section>
  );
}

function HowScoredLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 min-h-[44px] text-sm text-ink-muted hover:text-ink touch-manipulation"
      >
        <Info className="w-4 h-4" />
        How we scored this
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.25, 1, 0.5, 1] }}
              className="relative w-full max-w-md rounded-2xl bg-white p-6 md:p-8 shadow-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-xs uppercase tracking-[0.2em] text-blue mb-2">
                Scoring
              </div>
              <h3 className="font-display text-2xl text-ink mb-4">
                Four sources, combined like probabilities.
              </h3>
              <p className="text-sm text-ink-muted leading-relaxed mb-4">
                Each source produces a fraud probability — the more confident
                it is, the higher its score. We combine them so multiple
                independent signals reinforce each other.
              </p>
              <ul className="text-sm text-ink-muted space-y-2">
                <li>
                  <span className="text-ink font-medium">Semak Mule match</span>{" "}
                  · ~92% on its own.
                </li>
                <li>
                  <span className="text-ink font-medium">NFP tier 1</span> · 85%
                  · tier 2 · 60%.
                </li>
                <li>
                  <span className="text-ink font-medium">Link scan</span> · uses
                  the LLM scam confidence directly.
                </li>
                <li>
                  <span className="text-ink font-medium">Behavior</span> · uses
                  the layer-3 risk score (0–100) directly.
                </li>
              </ul>
              <p className="text-xs text-ink-muted mt-4 leading-relaxed">
                Combined as <span className="font-mono">1 − ∏(1 − p)</span> —
                two weak signals can compound into a strong verdict; a single
                strong signal alone is enough to flag.
              </p>
              <div className="mt-5 text-xs text-ink-muted">
                0–29 low · 30–59 medium · 60+ high. Skipped sources don't move
                the score.
              </div>
              <button
                onClick={() => setOpen(false)}
                className="mt-6 inline-flex items-center gap-2 min-h-[44px] text-sm text-blue hover:underline touch-manipulation"
              >
                Close
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function chipMeta(state: SourceSignal["state"]) {
  switch (state) {
    case "clean":
      return {
        label: "Clean",
        cls: "bg-good/10 text-good",
        icon: CheckCircle2,
      };
    case "suspicious":
      return {
        label: "Suspicious",
        cls: "bg-blue-soft text-blue",
        icon: AlertTriangle,
      };
    case "match":
      return {
        label: "High risk",
        cls: "bg-yellow/25 text-ink border border-yellow",
        icon: ShieldAlert,
      };
    case "skipped":
    default:
      return {
        label: "Skipped",
        cls: "bg-surface text-ink-muted",
        icon: Info,
      };
  }
}

function sourceIcon(s: SourceSignal["source"]) {
  switch (s) {
    case "nfp":
      return Landmark;
    case "semak_mule":
      return ShieldAlert;
    case "link_scrape":
      return LinkIcon;
    case "behavior":
      return Activity;
    // Legacy alias — keeps older signals shaped as "chat_model" rendering.
    case "chat_model":
      return Activity;
    default:
      return Info;
  }
}
