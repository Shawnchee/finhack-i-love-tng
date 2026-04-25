import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
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

type Waypoint = {
  id: WaypointId;
  label: string;
  angle: number;
  state: WaypointState;
};

const COMMENTARY = [
  "Pulling from NFP registry…",
  "Cross-referencing Semak Mule…",
  "Fetching site titles and body…",
  "Scoring against the user's behavioral baseline…",
  "Weighting signals into a verdict…",
];

const INITIAL_WAYPOINTS: Waypoint[] = [
  { id: "nfp", label: "NFP", angle: -90, state: "queued" },
  { id: "semak", label: "Semak Mule", angle: 0, state: "queued" },
  { id: "scrape", label: "Link scan", angle: 90, state: "queued" },
  { id: "behavior", label: "Behavior", angle: 180, state: "queued" },
];

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
  const [commentIdx, setCommentIdx] = useState(0);
  const radius = useDiamondRadius();

  const total = waypoints.length;
  const done = useMemo(
    () =>
      waypoints.filter((w) => w.state === "done" || w.state === "skipped")
        .length,
    [waypoints],
  );

  const runOnce = useRef(false);

  useEffect(() => {
    const commentInt = setInterval(() => {
      setCommentIdx((i) => (i + 1) % COMMENTARY.length);
    }, 900);
    return () => clearInterval(commentInt);
  }, []);

  useEffect(() => {
    if (runOnce.current) return;
    runOnce.current = true;

    if (isMockMode) {
      runMockSequence({
        mockKey,
        setWaypoints,
        navigate,
      });
      return;
    }

    runLiveChecks({
      input: state as CheckSubmitPayload,
      setWaypoints,
      navigate,
    });
  }, [isMockMode, mockKey, state, navigate]);

  return (
    <main
      className="fixed inset-0 bg-white overflow-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <div className="absolute inset-0 bg-dotgrid opacity-[0.15] pointer-events-none" />

      <div className="relative h-full flex flex-col items-center justify-center px-5">
        <div className="text-xs uppercase tracking-[0.22em] text-ink-muted mb-2">
          Cross-checking
        </div>
        <div className="text-sm tabular text-ink">
          {done} of {total}
        </div>

        <div className="relative mt-12 md:mt-16 w-[260px] h-[260px] md:w-[440px] md:h-[440px]">
          {/* Central pulse */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-blue/15 blur-xl animate-[pulse-dot_1.8s_ease-in-out_infinite]" />
              <span className="relative block w-4 h-4 rounded-full bg-blue" />
            </div>
          </div>

          {/* SVG rays */}
          <svg
            viewBox="-220 -220 440 440"
            className="absolute inset-0 w-full h-full"
          >
            {waypoints.map((w) => {
              const rad = (w.angle * Math.PI) / 180;
              const x = Math.cos(rad) * radius;
              const y = Math.sin(rad) * radius;
              const stroke =
                w.state === "done"
                  ? "#005ABE"
                  : w.state === "skipped"
                    ? "#EEF0F3"
                    : "#E4E7EC";
              return (
                <line
                  key={w.id}
                  x1={0}
                  y1={0}
                  x2={x}
                  y2={y}
                  stroke={stroke}
                  strokeWidth={1.5}
                  strokeDasharray={w.state === "checking" ? "4 4" : "0"}
                  className="transition-all duration-500"
                />
              );
            })}
          </svg>

          {/* Waypoints */}
          {waypoints.map((w) => {
            const rad = (w.angle * Math.PI) / 180;
            const dotR = 40;
            const cx = Math.cos(rad) * radius;
            const cy = Math.sin(rad) * radius;
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
                <WaypointDot state={w.state} />
                <div
                  className={cn(
                    "absolute whitespace-nowrap text-[11px] md:text-xs font-medium transition-opacity",
                    "top-full left-1/2 -translate-x-1/2 mt-2 md:mt-3",
                    w.state === "skipped" ? "text-ink-muted/50" : "text-ink",
                  )}
                >
                  {w.label}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-14 md:mt-20 h-6 text-ink-muted italic font-display text-base md:text-lg text-center px-4">
          <AnimatePresence mode="wait">
            <motion.span
              key={commentIdx}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {COMMENTARY[commentIdx]}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Mock sequence (kept so /checking?mock=high|medium|low still works for demo)
// ---------------------------------------------------------------------------

function runMockSequence({
  mockKey,
  setWaypoints,
  navigate,
}: {
  mockKey: string;
  setWaypoints: React.Dispatch<React.SetStateAction<Waypoint[]>>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const checkings = [300, 900, 1500, 2300];
  const timings = [600, 1200, 1900, 2700];

  const checkingTimers = checkings.map((t, i) =>
    setTimeout(() => {
      setWaypoints((prev) =>
        prev.map((w, idx) => (idx === i ? { ...w, state: "checking" } : w)),
      );
    }, t),
  );

  const doneTimers = timings.map((t, i) =>
    setTimeout(() => {
      setWaypoints((prev) =>
        prev.map((w, idx) => (idx === i ? { ...w, state: "done" } : w)),
      );
    }, t),
  );

  const toReport = setTimeout(() => {
    navigate(`/report/${mockKey}?mock=${mockKey}`);
  }, 3300);

  // No cleanup: this is a one-shot transition out of the page.
  void checkingTimers;
  void doneTimers;
  void toReport;
}

// ---------------------------------------------------------------------------
// Live sequence — call real backends in parallel and assemble a Report.
// ---------------------------------------------------------------------------

async function runLiveChecks({
  input,
  setWaypoints,
  navigate,
}: {
  input: CheckSubmitPayload;
  setWaypoints: React.Dispatch<React.SetStateAction<Waypoint[]>>;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const url =
    input.detectedKind === "link" ? extractUrl(input.smart) : null;

  const willRunNfp = !!(input.idType && input.idNo);
  const willRunSemak = !!(input.bank && input.account);
  const willRunScrape = !!url;
  const willRunBehavior = !!input.account; // build a default tx when account exists
  const transactionPayload: CheckTransactionRequest | null = willRunBehavior
    ? {
        user_id: "user_001",
        recipient_account: input.account!,
        recipient_name: "Unknown",
        amount: 100,
        transaction_type: "duitnow_transfer",
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

  // If everything is skipped, fall back to mock=high so the demo still flows.
  if (!willRunNfp && !willRunSemak && !willRunScrape && !willRunBehavior) {
    console.log("[checking] no inputs to check — falling back to mock=high");
    navigate(`/report/high?mock=high`);
    return;
  }

  console.log("[checking] start", {
    willRunNfp,
    willRunSemak,
    willRunScrape,
    willRunBehavior,
    input,
  });

  const markDone = (id: WaypointId, ok: boolean) => {
    setWaypoints((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, state: ok ? "done" : "error" } : w,
      ),
    );
  };

  const nfpPromise: Promise<NFPCheckResponse | null> = willRunNfp
    ? checkNFP({ idType: input.idType!, idNo: input.idNo! })
        .then((r) => {
          markDone("nfp", true);
          return r;
        })
        .catch((err) => {
          console.error("[checking] nfp failed", err);
          markDone("nfp", false);
          return null;
        })
    : Promise.resolve(null);

  const semakPromise: Promise<SemakMuleCheckResponse | null> = willRunSemak
    ? checkSemakMule({
        bankSwiftCode:
          BANK_SWIFT_CODES[input.bank as keyof typeof BANK_SWIFT_CODES] ??
          input.bank!,
        bankAccountNo: input.account!,
      })
        .then((r) => {
          markDone("semak", true);
          return r;
        })
        .catch((err) => {
          console.error("[checking] semak failed", err);
          markDone("semak", false);
          return null;
        })
    : Promise.resolve(null);

  const scrapePromise: Promise<ScanResponse | null> = willRunScrape
    ? scanUrl(url!)
        .then((r) => {
          markDone("scrape", true);
          return r;
        })
        .catch((err) => {
          console.error("[checking] scan failed", err);
          markDone("scrape", false);
          return null;
        })
    : Promise.resolve(null);

  const behaviorPromise: Promise<CheckTransactionResponse | null> =
    willRunBehavior && transactionPayload
      ? checkTransaction(transactionPayload)
          .then((r) => {
            markDone("behavior", true);
            return r;
          })
          .catch((err) => {
            console.error("[checking] behavior failed", err);
            markDone("behavior", false);
            return null;
          })
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

  // Small delay so the user sees the final waypoint flip to done.
  setTimeout(() => navigate(`/report/live`), 450);
}

function WaypointDot({ state }: { state: WaypointState }) {
  return (
    <motion.div
      className={cn(
        "absolute inset-0 rounded-full border flex items-center justify-center transition-all",
        state === "queued" && "border-rule bg-white",
        state === "checking" && "border-blue bg-white",
        state === "done" && "border-blue bg-blue text-white",
        state === "skipped" && "border-rule/60 bg-white opacity-50",
        state === "error" && "border-bad bg-white text-bad",
      )}
      animate={state === "checking" ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={
        state === "checking"
          ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.3 }
      }
    >
      {state === "done" ? (
        <Check className="w-5 h-5" strokeWidth={2.5} />
      ) : state === "checking" ? (
        <span className="w-2 h-2 rounded-full bg-blue" />
      ) : state === "skipped" ? (
        <span className="w-2 h-2 rounded-full bg-rule/60" />
      ) : state === "error" ? (
        <span className="w-2 h-2 rounded-full bg-bad" />
      ) : (
        <span className="w-2 h-2 rounded-full bg-rule" />
      )}
    </motion.div>
  );
}
