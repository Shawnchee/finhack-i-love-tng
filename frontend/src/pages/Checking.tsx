import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Check,
  Landmark,
  Link as LinkIcon,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "../lib/cn";
import {
  BANK_SWIFT_CODES,
  checkNFP,
  checkSemakMule,
  checkTransaction,
  scanUrl,
  type CheckTransactionRequest,
  type CheckTransactionResponse,
  type NFPCheckResponse,
  type ScanResponse,
  type SemakMuleCheckResponse,
} from "../lib/api";
import { buildReportFromBackends } from "../lib/mockReport";
import type { CheckSubmitPayload } from "./Check";

function useDiamondRadius() {
  const [r, setR] = useState<number>(() =>
    typeof window !== "undefined" && window.innerWidth >= 768 ? 160 : 110,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setR(mq.matches ? 160 : 110);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return r;
}

type WaypointId = "nfp" | "semak" | "scrape" | "behavior";
type WaypointState = "queued" | "checking" | "done" | "skipped" | "error";
/**
 * The outcome classification of a completed check, drives the colour
 * treatment on the waypoint and on the streaming event log:
 *   clean — backend ran and returned no concerning signal
 *   warn  — backend ran and returned a soft / suspicious signal
 *   match — backend ran and returned a confirmed hit (the eye-catching one)
 */
type WaypointResult = "clean" | "match" | "warn";

type Waypoint = {
  id: WaypointId;
  label: string;
  angle: number;
  state: WaypointState;
  result?: WaypointResult;
  /** Short status badge shown under the waypoint label after it resolves. */
  detail?: string;
  /** Wall-clock latency in ms, captured locally on the frontend. */
  elapsedMs?: number;
};

type EventKind = "info" | "clean" | "match" | "warn" | "error";

type EventEntry = {
  id: string;
  ts: number; // ms since the page loaded
  source: WaypointId | "system";
  kind: EventKind;
  message: string;
};

const INITIAL_WAYPOINTS: Waypoint[] = [
  { id: "nfp", label: "NFP", angle: -90, state: "queued" },
  { id: "semak", label: "Semak Mule", angle: 0, state: "queued" },
  { id: "scrape", label: "Link scan", angle: 90, state: "queued" },
  { id: "behavior", label: "Behavior", angle: 180, state: "queued" },
];

const SOURCE_ICON: Record<WaypointId, typeof Landmark> = {
  nfp: Landmark,
  semak: ShieldAlert,
  scrape: LinkIcon,
  behavior: Activity,
};

const SOURCE_LABEL: Record<WaypointId | "system", string> = {
  nfp: "NFP",
  semak: "Semak Mule",
  scrape: "Link scan",
  behavior: "Behavior",
  system: "Cross-check",
};

/** Pull the first http(s) URL out of a free-form smart input. */
function extractUrl(text: string): string | null {
  const m = /https?:\/\/[^\s]+/i.exec(text);
  if (m) return m[0];
  // bare domain like "offer.my/foo"
  const m2 = /(?:^|\s)([a-z0-9-]+\.[a-z]{2,}(?:\/[^\s]*)?)/i.exec(text);
  if (m2) return `https://${m2[1]}`;
  return null;
}

export default function Checking() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const state = (location.state as CheckSubmitPayload | null) ?? null;
  const mockParam = params.get("mock");

  // Mock mode if explicitly requested OR no state was passed in.
  const isMockMode = mockParam !== null || state === null;
  const mockKey = (mockParam ?? "high").toLowerCase();

  const [waypoints, setWaypoints] = useState<Waypoint[]>(INITIAL_WAYPOINTS);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const radius = useDiamondRadius();
  const startedAt = useRef(performance.now());

  const total = waypoints.length;
  const skipped = useMemo(
    () => waypoints.filter((w) => w.state === "skipped").length,
    [waypoints],
  );
  const done = useMemo(
    () =>
      waypoints.filter(
        (w) =>
          w.state === "done" || w.state === "skipped" || w.state === "error",
      ).length,
    [waypoints],
  );
  const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);

  const runOnce = useRef(false);

  const addEvent = useMemo(
    () =>
      (source: EventEntry["source"], kind: EventKind, message: string) => {
        setEvents((prev) => [
          ...prev,
          {
            id: `${source}-${prev.length}-${Math.random().toString(36).slice(2, 8)}`,
            ts: Math.round(performance.now() - startedAt.current),
            source,
            kind,
            message,
          },
        ]);
      },
    [],
  );

  useEffect(() => {
    if (runOnce.current) return;
    runOnce.current = true;

    addEvent("system", "info", "Fanning out parallel checks…");

    if (isMockMode) {
      runMockSequence({
        mockKey,
        setWaypoints,
        addEvent,
        navigate,
      });
      return;
    }

    runLiveChecks({
      input: state as CheckSubmitPayload,
      setWaypoints,
      addEvent,
      navigate,
    });
  }, [isMockMode, mockKey, state, navigate, addEvent]);

  return (
    <main
      className="fixed inset-0 bg-white overflow-auto"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="absolute inset-0 bg-dotgrid opacity-[0.15] pointer-events-none" />

      <div className="relative min-h-full flex flex-col items-center justify-start px-5 py-10 md:py-14">
        {/* Header — progress bar replaces the bare "X of N" counter */}
        <div className="w-full max-w-xl">
          <div className="flex items-end justify-between mb-2">
            <div className="text-[10px] uppercase tracking-[0.24em] text-ink-muted">
              Cross-checking
            </div>
            <div className="text-xs tabular text-ink-muted">
              <span className="text-ink font-medium">{done}</span> of {total}
              {skipped > 0 && (
                <span className="text-ink-muted/70"> · {skipped} skipped</span>
              )}
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden">
            <motion.div
              className="h-full bg-blue rounded-full"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
            />
          </div>
        </div>

        {/* Diamond visualisation */}
        <div className="relative mt-10 md:mt-14 w-[280px] h-[280px] md:w-[460px] md:h-[460px]">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-blue/15 blur-xl animate-[pulse-dot_1.8s_ease-in-out_infinite]" />
              <span className="relative block w-4 h-4 rounded-full bg-blue" />
            </div>
          </div>

          <svg
            viewBox="-220 -220 440 440"
            className="absolute inset-0 w-full h-full"
          >
            {waypoints.map((w) => {
              const rad = (w.angle * Math.PI) / 180;
              // Stop the ray just outside the central pulse and just before
              // the waypoint dot edge — keeps the line off the label text.
              const innerOffset = 12;
              const outerOffset = 44; // dotR
              const x1 = Math.cos(rad) * innerOffset;
              const y1 = Math.sin(rad) * innerOffset;
              const x2 = Math.cos(rad) * (radius - outerOffset);
              const y2 = Math.sin(rad) * (radius - outerOffset);
              const stroke = strokeColor(w);
              return (
                <line
                  key={w.id}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={stroke}
                  strokeWidth={1.5}
                  strokeDasharray={w.state === "checking" ? "4 4" : "0"}
                  className="transition-all duration-500"
                />
              );
            })}
          </svg>

          {waypoints.map((w) => {
            const rad = (w.angle * Math.PI) / 180;
            const dotR = 44;
            const cx = Math.cos(rad) * radius;
            const cy = Math.sin(rad) * radius;
            const Icon = SOURCE_ICON[w.id];
            return (
              <div
                key={w.id}
                className="absolute"
                style={{
                  left: `calc(50% + ${cx}px - ${dotR}px)`,
                  top: `calc(50% + ${cy}px - ${dotR}px)`,
                  width: dotR * 2,
                  height: dotR * 2,
                }}
              >
                <WaypointDot waypoint={w} Icon={Icon} />
                <div
                  className={cn(
                    "absolute top-full left-1/2 -translate-x-1/2 mt-2 md:mt-3 text-center whitespace-nowrap",
                    "bg-white/95 backdrop-blur-[2px] px-2 py-0.5 rounded-md",
                    w.state === "skipped" ? "opacity-50" : "",
                  )}
                >
                  <div className="text-[11px] md:text-xs font-medium text-ink">
                    {w.label}
                  </div>
                  <WaypointDetail waypoint={w} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Streaming event log replaces the cycling commentary line */}
        <EventLog events={events} />
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

const RESULT_COLOR_HEX: Record<WaypointResult, string> = {
  clean: "#0BA66C", // green
  match: "#D14343", // red
  warn: "#FFCD00",  // yellow
};

function strokeColor(w: Waypoint): string {
  if (w.state === "done" && w.result) return RESULT_COLOR_HEX[w.result];
  if (w.state === "error") return "#D14343";
  if (w.state === "skipped") return "#EEF0F3";
  if (w.state === "checking") return "#005ABE";
  return "#E4E7EC";
}

function WaypointDetail({ waypoint }: { waypoint: Waypoint }) {
  const { state, result, detail, elapsedMs } = waypoint;

  if (state === "queued") return null;

  if (state === "checking") {
    return (
      <div className="text-[10px] mt-0.5 text-blue inline-flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-blue animate-pulse" />
        checking…
      </div>
    );
  }

  if (state === "skipped") {
    return (
      <div className="text-[10px] mt-0.5 text-ink-muted/60">skipped</div>
    );
  }

  if (state === "error") {
    return (
      <div className="text-[10px] mt-0.5 text-bad">failed</div>
    );
  }

  // done
  const colorCls =
    result === "match"
      ? "text-bad"
      : result === "warn"
        ? "text-ink"
        : "text-good";
  return (
    <div className={cn("text-[10px] mt-0.5 inline-flex items-center gap-1", colorCls)}>
      <span className="font-medium">{detail ?? "done"}</span>
      {typeof elapsedMs === "number" && (
        <span className="text-ink-muted/60 tabular">
          · {(elapsedMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}

function EventLog({ events }: { events: EventEntry[] }) {
  if (events.length === 0) return null;
  return (
    <div className="mt-12 md:mt-16 w-full max-w-xl">
      <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted mb-3">
        Activity
      </div>
      <ul className="space-y-1.5">
        <AnimatePresence initial={false}>
          {events.map((e) => {
            const Icon = eventIcon(e.kind);
            return (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="flex items-start gap-3 text-[12px] md:text-[13px]"
              >
                <span
                  className={cn(
                    "shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full mt-0.5",
                    eventBgClass(e.kind),
                  )}
                >
                  <Icon
                    className={cn("w-3 h-3", eventIconColorClass(e.kind))}
                    strokeWidth={2.4}
                  />
                </span>
                <span className="font-mono tabular text-[11px] text-ink-muted/70 w-12 shrink-0 mt-1">
                  {(e.ts / 1000).toFixed(1)}s
                </span>
                <span className="text-ink-muted shrink-0 mt-0.5 w-[68px] text-[11px] md:text-[12px]">
                  {SOURCE_LABEL[e.source]}
                </span>
                <span
                  className={cn(
                    "leading-relaxed text-ink",
                    e.kind === "match" && "text-bad font-medium",
                    e.kind === "error" && "text-bad",
                    e.kind === "warn" && "text-ink font-medium",
                  )}
                >
                  {e.message}
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function eventIcon(kind: EventKind): typeof Check {
  switch (kind) {
    case "clean":
      return ShieldCheck;
    case "match":
      return AlertOctagon;
    case "warn":
      return AlertTriangle;
    case "error":
      return X;
    case "info":
    default:
      return Activity;
  }
}

function eventBgClass(kind: EventKind): string {
  switch (kind) {
    case "clean":
      return "bg-good/10";
    case "match":
      return "bg-bad/10";
    case "warn":
      return "bg-yellow/20";
    case "error":
      return "bg-bad/10";
    case "info":
    default:
      return "bg-blue/10";
  }
}

function eventIconColorClass(kind: EventKind): string {
  switch (kind) {
    case "clean":
      return "text-good";
    case "match":
      return "text-bad";
    case "warn":
      return "text-ink";
    case "error":
      return "text-bad";
    case "info":
    default:
      return "text-blue";
  }
}

// ---------------------------------------------------------------------------
// Mock sequence (kept so /checking?mock=high|medium|low still works for demo)
// ---------------------------------------------------------------------------

function runMockSequence({
  mockKey,
  setWaypoints,
  addEvent,
  navigate,
}: {
  mockKey: string;
  setWaypoints: React.Dispatch<React.SetStateAction<Waypoint[]>>;
  addEvent: (
    source: EventEntry["source"],
    kind: EventKind,
    message: string,
  ) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const checkings = [300, 900, 1500, 2300];
  const timings = [600, 1200, 1900, 2700];

  // Mock outcomes match the verdict bucket the user is demoing.
  const mockResult: WaypointResult =
    mockKey === "high" ? "match" : mockKey === "medium" ? "warn" : "clean";
  const mockDetail =
    mockResult === "match" ? "Match" : mockResult === "warn" ? "Soft hit" : "Clean";

  const ids: WaypointId[] = ["nfp", "semak", "scrape", "behavior"];

  ids.forEach((id, i) => {
    setTimeout(() => {
      setWaypoints((prev) =>
        prev.map((w) => (w.id === id ? { ...w, state: "checking" } : w)),
      );
      addEvent(id, "info", `Calling ${SOURCE_LABEL[id]}…`);
    }, checkings[i]);

    setTimeout(() => {
      setWaypoints((prev) =>
        prev.map((w) =>
          w.id === id
            ? {
                ...w,
                state: "done",
                result: mockResult,
                detail: mockDetail,
                elapsedMs: timings[i] - checkings[i],
              }
            : w,
        ),
      );
      addEvent(
        id,
        mockResult,
        `${SOURCE_LABEL[id]} — ${mockDetail.toLowerCase()}.`,
      );
    }, timings[i]);
  });

  setTimeout(() => navigate(`/report/${mockKey}?mock=${mockKey}`), 3300);
}

// ---------------------------------------------------------------------------
// Live sequence — call real backends in parallel and assemble a Report.
// ---------------------------------------------------------------------------

async function runLiveChecks({
  input,
  setWaypoints,
  addEvent,
  navigate,
}: {
  input: CheckSubmitPayload;
  setWaypoints: React.Dispatch<React.SetStateAction<Waypoint[]>>;
  addEvent: (
    source: EventEntry["source"],
    kind: EventKind,
    message: string,
  ) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  // Resolve a scrapeable URL from any of:
  //   1. a URL in the smart input (link)
  //   2. a Telegram handle in the smart input (@channelname)
  //   3. the dedicated "Add Telegram channel" disclosure
  // Telegram inputs are normalised to https://t.me/{handle}, which the
  // fraud_detect_api scraper handles via Telethon.
  const tgFromSmart =
    input.detectedKind === "telegram" ? input.smart.trim() : null;
  const tgFromDisclosure = input.tgHandle?.trim() || null;
  const tgHandleRaw = tgFromSmart || tgFromDisclosure;
  const tgUrl = tgHandleRaw
    ? `https://t.me/${tgHandleRaw.replace(/^@/, "")}`
    : null;

  const url =
    input.detectedKind === "link"
      ? extractUrl(input.smart)
      : tgUrl;

  const willRunNfp = !!(input.idType && input.idNo);
  const willRunSemak = !!(input.bank && input.account);
  const willRunScrape = !!url;
  const willRunBehavior = !!input.account; // build a default tx when account exists
  const transactionPayload: CheckTransactionRequest | null = willRunBehavior
    ? {
        user_id: input.userId ?? "user_001",
        recipient_account: input.account!,
        recipient_name: input.recipientName ?? "Unknown",
        amount: input.amount ?? 100,
        transaction_type: input.transactionType ?? "duitnow_transfer",
        timestamp: new Date().toISOString(),
      }
    : null;

  // Initialize waypoint states up-front: skipped where we won't run.
  setWaypoints((prev) =>
    prev.map((w) => {
      let willRun = false;
      if (w.id === "nfp") willRun = willRunNfp;
      else if (w.id === "semak") willRun = willRunSemak;
      else if (w.id === "scrape") willRun = willRunScrape;
      else if (w.id === "behavior") willRun = willRunBehavior;
      return { ...w, state: willRun ? "checking" : "skipped" };
    }),
  );

  // Log skips immediately so the activity panel shows the full plan.
  if (!willRunNfp) addEvent("nfp", "info", "Skipped — no ID provided.");
  if (!willRunSemak) addEvent("semak", "info", "Skipped — no bank account.");
  if (!willRunScrape) addEvent("scrape", "info", "Skipped — no URL.");
  if (!willRunBehavior)
    addEvent("behavior", "info", "Skipped — no bank account.");

  // If everything is skipped, fall back to a low mock — absence of evidence
  // shouldn't render as alarming. Demo escape hatch is `mock=high|medium|low`
  // pasted into the smart input on /check.
  if (!willRunNfp && !willRunSemak && !willRunScrape && !willRunBehavior) {
    console.log("[checking] no inputs to check — falling back to mock=low");
    navigate(`/report/low?mock=low`);
    return;
  }

  console.log("[checking] start", {
    willRunNfp,
    willRunSemak,
    willRunScrape,
    willRunBehavior,
    input,
  });

  // Per-source start timestamps for elapsed-time calc on completion.
  const starts: Partial<Record<WaypointId, number>> = {};
  const begin = (id: WaypointId, msg: string) => {
    starts[id] = performance.now();
    addEvent(id, "info", msg);
  };

  const markDoneOk = (
    id: WaypointId,
    result: WaypointResult,
    detail: string,
    eventKind: EventKind,
    eventMessage: string,
  ) => {
    const elapsedMs = starts[id] ? Math.round(performance.now() - starts[id]!) : undefined;
    setWaypoints((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, state: "done", result, detail, elapsedMs } : w,
      ),
    );
    addEvent(id, eventKind, eventMessage);
  };

  const markErr = (id: WaypointId, err: unknown) => {
    const elapsedMs = starts[id] ? Math.round(performance.now() - starts[id]!) : undefined;
    setWaypoints((prev) =>
      prev.map((w) => (w.id === id ? { ...w, state: "error", elapsedMs } : w)),
    );
    addEvent(
      id,
      "error",
      `${SOURCE_LABEL[id]} failed — ${(err as Error)?.message ?? "network error"}`,
    );
  };

  const nfpPromise: Promise<NFPCheckResponse | null> = willRunNfp
    ? (begin("nfp", `Querying NFP for ${input.idType?.toUpperCase()} ${input.idNo}…`),
      checkNFP({ idType: input.idType!, idNo: input.idNo! })
        .then((r) => {
          const tier = r.muleCheck?.muleTier;
          if (tier !== null && tier !== undefined) {
            markDoneOk(
              "nfp",
              "match",
              `Tier ${tier}`,
              "match",
              `NFP — confirmed mule (tier ${tier}).`,
            );
          } else {
            markDoneOk("nfp", "clean", "Clean", "clean", "NFP — no mule tier.");
          }
          return r;
        })
        .catch((err) => {
          console.error("[checking] nfp failed", err);
          markErr("nfp", err);
          return null;
        }))
    : Promise.resolve(null);

  const semakPromise: Promise<SemakMuleCheckResponse | null> = willRunSemak
    ? (begin("semak", `Checking SemakMule for ${input.bank} · ${input.account}…`),
      checkSemakMule({
        bankSwiftCode:
          BANK_SWIFT_CODES[input.bank as keyof typeof BANK_SWIFT_CODES] ??
          input.bank!,
        bankAccountNo: input.account!,
      })
        .then((r) => {
          if (r.isMule) {
            markDoneOk(
              "semak",
              "match",
              "Match!",
              "match",
              "SemakMule — account is on the BNM registry.",
            );
          } else {
            markDoneOk(
              "semak",
              "clean",
              "Clean",
              "clean",
              "SemakMule — not on the registry.",
            );
          }
          return r;
        })
        .catch((err) => {
          console.error("[checking] semak failed", err);
          markErr("semak", err);
          return null;
        }))
    : Promise.resolve(null);

  const scrapePromise: Promise<ScanResponse | null> = willRunScrape
    ? (begin("scrape", `Scraping ${url} via classifier…`),
      scanUrl(url!)
        .then((r) => {
          if (r.verdict === "SCAM") {
            const cat = r.scam_type?.category;
            const catLabel = cat && cat !== "UNKNOWN" ? ` (${cat.toLowerCase().replace("_", " ")})` : "";
            markDoneOk(
              "scrape",
              "match",
              "SCAM",
              "match",
              `Link scan — classified as scam${catLabel}.`,
            );
          } else if (r.verdict === "NOT_SCAM") {
            markDoneOk(
              "scrape",
              "clean",
              "Not scam",
              "clean",
              "Link scan — page looks clean.",
            );
          } else {
            // NEEDS_REVIEW or null verdict (no LLM)
            const matched = r.keywords_matched?.length ?? 0;
            const isWarn = matched > 0;
            markDoneOk(
              "scrape",
              isWarn ? "warn" : "clean",
              isWarn ? "Soft hit" : "No flags",
              isWarn ? "warn" : "clean",
              isWarn
                ? `Link scan — ${matched} scam-pattern keyword${matched === 1 ? "" : "s"} matched.`
                : "Link scan — no flags found.",
            );
          }
          return r;
        })
        .catch((err) => {
          console.error("[checking] scan failed", err);
          markErr("scrape", err);
          return null;
        }))
    : Promise.resolve(null);

  const behaviorPromise: Promise<CheckTransactionResponse | null> =
    willRunBehavior && transactionPayload
      ? (begin(
          "behavior",
          `Scoring ${transactionPayload.user_id} for RM${transactionPayload.amount}…`,
        ),
        checkTransaction(transactionPayload)
          .then((r) => {
            const decision = r.decision;
            if (decision === "BLOCK" || decision === "CHALLENGE") {
              markDoneOk(
                "behavior",
                "match",
                `${decision} · ${r.risk_score}`,
                "match",
                `Behavior — ${decision} (risk ${r.risk_score}).`,
              );
            } else if (decision === "NOTIFY") {
              markDoneOk(
                "behavior",
                "warn",
                `NOTIFY · ${r.risk_score}`,
                "warn",
                `Behavior — soft anomaly (risk ${r.risk_score}).`,
              );
            } else {
              markDoneOk(
                "behavior",
                "clean",
                `ALLOW · ${r.risk_score}`,
                "clean",
                `Behavior — looks normal (risk ${r.risk_score}).`,
              );
            }
            return r;
          })
          .catch((err) => {
            console.error("[checking] behavior failed", err);
            markErr("behavior", err);
            return null;
          }))
      : Promise.resolve(null);

  const settled = await Promise.allSettled([
    nfpPromise,
    semakPromise,
    scrapePromise,
    behaviorPromise,
  ]);

  const [nfpRes, semakRes, scrapeRes, behaviorRes] = settled.map((s) =>
    s.status === "fulfilled" ? s.value : null,
  ) as [
    NFPCheckResponse | null,
    SemakMuleCheckResponse | null,
    ScanResponse | null,
    CheckTransactionResponse | null,
  ];

  console.log("[checking] done", {
    nfp: nfpRes,
    semak: semakRes,
    scrape: scrapeRes,
    behavior: behaviorRes,
  });

  const report = buildReportFromBackends({
    nfp: nfpRes ?? undefined,
    semak: semakRes ?? undefined,
    scrape: scrapeRes ?? undefined,
    layer3: behaviorRes ?? undefined,
  });

  // Final "verdict assembled" line so the activity log has a clear endpoint.
  const overallKind: EventKind =
    report.overall === "high"
      ? "match"
      : report.overall === "medium"
        ? "warn"
        : "clean";
  addEvent(
    "system",
    overallKind,
    `Verdict: ${report.overall.toUpperCase()} RISK · score ${report.score}/100.`,
  );

  // Attach inputs the Report page can render in its sidebar.
  report.inputs = {
    bankAccount:
      input.bank && input.account
        ? { bank: input.bank, account: input.account }
        : undefined,
    links: url ? [url] : undefined,
    idCheck:
      input.idType && input.idNo
        ? { idType: input.idType, idNo: input.idNo }
        : undefined,
    transaction: transactionPayload ?? undefined,
    chat: input.tgHandle
      ? { source: "telegram", label: input.tgHandle, messageCount: 0 }
      : undefined,
  };

  try {
    sessionStorage.setItem("lastReport", JSON.stringify(report));
  } catch (err) {
    console.error("[checking] sessionStorage failed", err);
  }

  try {
    const { appendRecord } = await import("../lib/dashboardStore");
    appendRecord(report);
  } catch (err) {
    console.error("[checking] dashboard store failed", err);
  }

  // Small delay so the user sees the final waypoint flip to done.
  setTimeout(() => navigate(`/report/live`), 450);
}

function WaypointDot({
  waypoint,
  Icon,
}: {
  waypoint: Waypoint;
  Icon: typeof Landmark;
}) {
  const { state, result } = waypoint;

  // After a successful run we colour the ring/fill based on the *result*
  // rather than the generic "done" state. Match → red, Warn → yellow,
  // Clean → green. Skipped/Error/Checking handled separately.
  const cls = (() => {
    if (state === "queued") return "border-rule bg-white text-ink-muted/60";
    if (state === "checking") return "border-blue bg-white text-blue";
    if (state === "skipped")
      return "border-rule/60 bg-white opacity-50 text-ink-muted";
    if (state === "error") return "border-bad bg-white text-bad";
    // done
    if (result === "match") return "border-bad bg-bad text-white";
    if (result === "warn") return "border-yellow bg-yellow text-ink";
    return "border-good bg-good text-white"; // clean default
  })();

  return (
    <motion.div
      className={cn(
        "absolute inset-0 rounded-full border-2 flex items-center justify-center transition-colors",
        cls,
      )}
      animate={state === "checking" ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={
        state === "checking"
          ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.3 }
      }
    >
      {state === "done" ? (
        result === "match" ? (
          <AlertOctagon className="w-5 h-5" strokeWidth={2.4} />
        ) : result === "warn" ? (
          <AlertTriangle className="w-5 h-5" strokeWidth={2.4} />
        ) : (
          <Check className="w-5 h-5" strokeWidth={2.5} />
        )
      ) : state === "error" ? (
        <X className="w-5 h-5" strokeWidth={2.4} />
      ) : (
        <Icon className="w-4 h-4" strokeWidth={1.75} />
      )}
    </motion.div>
  );
}
