import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ShieldAlert,
  CheckCircle2,
  Landmark,
  Link as LinkIcon,
  MessageSquare,
} from "lucide-react";
import { useReducedMotion } from "../lib/motion";
import { cn } from "../lib/cn";

/**
 * A 3D-tilted mock "risk report" card that floats on the right of the hero.
 * Mouse moves tilt it; idle float bobs it gently. Behind it, two stacked
 * silhouette cards add depth. A pulsing yellow sentinel orbits top-right
 * as the semantic accent.
 */
export default function FloatingReportCard({
  className,
}: {
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const smx = useSpring(mx, { stiffness: 140, damping: 18, mass: 0.6 });
  const smy = useSpring(my, { stiffness: 140, damping: 18, mass: 0.6 });
  const rotY = useTransform(smx, [-0.5, 0.5], [-14, 14]);
  const rotX = useTransform(smy, [-0.5, 0.5], [10, -10]);
  const glareX = useTransform(smx, [-0.5, 0.5], ["20%", "80%"]);
  const glareY = useTransform(smy, [-0.5, 0.5], ["10%", "90%"]);

  return (
    <div
      ref={ref}
      className={cn(
        "relative w-full h-full flex items-center justify-center",
        className,
      )}
      style={{ perspective: "1200px" }}
      onMouseMove={(e) => {
        if (reduced || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      {/* soft ground glow */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] aspect-square rounded-full blur-3xl pointer-events-none"
        style={{
          background:
            "radial-gradient(closest-side, rgba(0,90,190,0.14), transparent 70%)",
        }}
      />

      {/* stacked depth cards */}
      <motion.div
        aria-hidden
        className="absolute w-[78%] h-[74%] rounded-2xl bg-white border border-rule shadow-card"
        style={{
          rotate: -8,
          translateX: -28,
          translateY: 36,
          zIndex: 0,
          opacity: 0.6,
        }}
        animate={reduced ? {} : { y: [36, 30, 36] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute w-[82%] h-[78%] rounded-2xl bg-white border border-rule shadow-card"
        style={{
          rotate: 5,
          translateX: 20,
          translateY: 18,
          zIndex: 1,
          opacity: 0.8,
        }}
        animate={reduced ? {} : { y: [18, 12, 18] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />

      {/* main card with 3D tilt + idle float */}
      <motion.div
        className="relative z-10 w-[86%] max-w-[420px] rounded-2xl bg-white border border-rule shadow-card"
        style={{
          rotateX: reduced ? 0 : rotX,
          rotateY: reduced ? 0 : rotY,
          transformStyle: "preserve-3d",
        }}
        animate={reduced ? {} : { y: [0, -10, 0] }}
        transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* glare overlay */}
        {!reduced && (
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-2xl pointer-events-none mix-blend-overlay"
            style={{
              background: useTransform(
                [glareX, glareY],
                ([x, y]) =>
                  `radial-gradient(220px circle at ${x} ${y}, rgba(255,255,255,0.7), transparent 60%)`,
              ),
            }}
          />
        )}

        {/* header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-rule">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-good animate-pulse" />
            <span className="text-[10px] tracking-[0.22em] uppercase text-ink-muted">
              Scan report
            </span>
          </div>
          <span className="text-[10px] tabular text-ink-muted">#SM-2025-119034</span>
        </div>

        {/* verdict block */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-ink-muted">
            <ShieldAlert className="w-3.5 h-3.5 text-yellow" strokeWidth={2} />
            Do not transfer
          </div>
          <div className="mt-2 font-display text-4xl text-ink leading-none">
            High Risk
          </div>

          {/* gauge */}
          <div className="mt-5">
            <div className="flex items-end justify-between text-[10px] text-ink-muted mb-1.5">
              <span className="uppercase tracking-wider">Risk score</span>
              <span className="tabular text-ink text-sm">88 / 100</span>
            </div>
            <div className="h-2.5 rounded-full bg-surface overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "88%" }}
                transition={{ duration: 1.1, delay: 0.6, ease: [0.25, 1, 0.5, 1] }}
                className="h-full rounded-full"
                style={{ background: "#FFCD00" }}
              />
            </div>
          </div>

          {/* signal chips */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <SignalChip
              icon={Landmark}
              label="NFP"
              value="12 reports"
              tone="alert"
            />
            <SignalChip
              icon={ShieldAlert}
              label="Semak Mule"
              value="Match"
              tone="alert"
            />
            <SignalChip
              icon={LinkIcon}
              label="Link scan"
              value="Brand clone"
              tone="alert"
            />
            <SignalChip
              icon={MessageSquare}
              label="Chat model"
              value="94% fraud"
              tone="alert"
            />
          </div>
        </div>

        {/* footer */}
        <div className="px-5 pb-4 pt-2 flex items-center justify-between border-t border-rule">
          <span className="text-[10px] text-ink-muted tabular">
            Checked 4 sources · just now
          </span>
          <div className="inline-flex items-center gap-1.5 text-[11px] text-blue">
            <CheckCircle2 className="w-3 h-3" strokeWidth={2.4} />
            Signed
          </div>
        </div>
      </motion.div>

      {/* orbiting sentinel chip */}
      <motion.div
        aria-hidden
        className="absolute z-20 top-[6%] sm:top-[10%] right-[4%] sm:right-[6%] rounded-full bg-yellow text-ink text-[10px] font-medium px-2.5 py-1 shadow-card flex items-center gap-1.5"
        style={{ transformStyle: "preserve-3d" }}
        animate={
          reduced
            ? {}
            : { y: [0, -6, 0], rotate: [-3, 3, -3] }
        }
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-ink animate-pulse" />
        Mule hit
      </motion.div>

      {/* secondary floating chip — hidden on very small screens to avoid clipping */}
      <motion.div
        aria-hidden
        className="hidden sm:flex absolute z-20 bottom-[8%] left-[2%] rounded-full bg-ink text-white text-[10px] font-medium px-2.5 py-1 shadow-card items-center gap-1.5"
        animate={reduced ? {} : { y: [0, 5, 0] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-good" />
        NFP · 12 reports
      </motion.div>
    </div>
  );
}

function SignalChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  tone: "alert" | "ok";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2 flex items-center gap-2",
        tone === "alert"
          ? "border-yellow/60 bg-yellow/10"
          : "border-rule bg-surface",
      )}
    >
      <Icon className="w-3.5 h-3.5 text-ink" strokeWidth={1.75} />
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-wider text-ink-muted truncate">
          {label}
        </div>
        <div className="text-[11px] font-medium text-ink truncate tabular">
          {value}
        </div>
      </div>
    </div>
  );
}
