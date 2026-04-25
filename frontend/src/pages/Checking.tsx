import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "../lib/cn";

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

type Waypoint = {
  id: "nfp" | "semak" | "scrape" | "chat";
  label: string;
  angle: number;
  state: "queued" | "checking" | "done";
};

const COMMENTARY = [
  "Pulling from NFP registry…",
  "Cross-referencing Semak Mule…",
  "Fetching site titles and body…",
  "Reading 137 messages for scam patterns…",
  "Weighting signals into a verdict…",
];

export default function Checking() {
  const [params] = useSearchParams();
  const mock = params.get("mock") || "high";
  const navigate = useNavigate();

  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { id: "nfp", label: "NFP registry", angle: -90, state: "queued" },
    { id: "semak", label: "Semak Mule", angle: 0, state: "queued" },
    { id: "scrape", label: "Link scan", angle: 90, state: "queued" },
    { id: "chat", label: "Chat behaviour", angle: 180, state: "queued" },
  ]);
  const [commentIdx, setCommentIdx] = useState(0);
  const radius = useDiamondRadius();

  const total = waypoints.length;
  const done = useMemo(
    () => waypoints.filter((w) => w.state === "done").length,
    [waypoints],
  );

  useEffect(() => {
    const timings = [600, 1200, 1900, 2700];
    const checkings = [300, 900, 1500, 2300];

    checkings.forEach((t, i) => {
      setTimeout(() => {
        setWaypoints((prev) =>
          prev.map((w, idx) => (idx === i ? { ...w, state: "checking" } : w)),
        );
      }, t);
    });

    timings.forEach((t, i) => {
      setTimeout(() => {
        setWaypoints((prev) =>
          prev.map((w, idx) => (idx === i ? { ...w, state: "done" } : w)),
        );
      }, t);
    });

    const commentInt = setInterval(() => {
      setCommentIdx((i) => (i + 1) % COMMENTARY.length);
    }, 900);

    const toReport = setTimeout(() => {
      navigate(`/report/${mock}?mock=${mock}`);
    }, 3300);

    return () => {
      clearInterval(commentInt);
      clearTimeout(toReport);
    };
  }, [mock, navigate]);

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
              return (
                <line
                  key={w.id}
                  x1={0}
                  y1={0}
                  x2={x}
                  y2={y}
                  stroke={w.state === "done" ? "#005ABE" : "#E4E7EC"}
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
                    "absolute whitespace-nowrap text-[11px] md:text-xs font-medium text-ink transition-opacity",
                    "top-full left-1/2 -translate-x-1/2 mt-2 md:mt-3",
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

function WaypointDot({ state }: { state: Waypoint["state"] }) {
  return (
    <motion.div
      className={cn(
        "absolute inset-0 rounded-full border flex items-center justify-center transition-all",
        state === "queued" && "border-rule bg-white",
        state === "checking" && "border-blue bg-white",
        state === "done" && "border-blue bg-blue text-white",
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
      ) : (
        <span className="w-2 h-2 rounded-full bg-rule" />
      )}
    </motion.div>
  );
}
