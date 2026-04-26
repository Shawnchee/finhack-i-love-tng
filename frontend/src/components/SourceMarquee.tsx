import { motion } from "framer-motion";
import { Asterisk } from "lucide-react";
import { useReducedMotion } from "../lib/motion";

const SOURCES = [
  { label: "National Fraud Portal", tag: "NFP" },
  { label: "BNM Semak Mule", tag: "Semak Mule" },
  { label: "Live web scrape", tag: "Scraper" },
  { label: "Behaviour ML model", tag: "Model" },
  { label: "WhatsApp export parser", tag: "WhatsApp" },
  { label: "Telegram channel scan", tag: "Telegram" },
];

export default function SourceMarquee() {
  const reduced = useReducedMotion();

  const loop = [...SOURCES, ...SOURCES, ...SOURCES];

  return (
    <section
      aria-label="Sources we cross-check"
      className="relative border-y border-rule bg-white py-10 md:py-12 overflow-hidden"
    >
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 md:w-40 bg-gradient-to-r from-white to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 md:w-40 bg-gradient-to-l from-white to-transparent z-10" />

      <div className="relative mx-auto max-w-6xl px-5 md:px-8 mb-6 flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.22em] text-ink-muted">
          We cross-check
        </span>
        <span className="text-xs text-ink-muted tabular">
          {SOURCES.length} sources · updated daily
        </span>
      </div>

      <motion.div
        className="flex w-max items-center gap-10 md:gap-16 whitespace-nowrap will-change-transform"
        animate={reduced ? {} : { x: ["0%", "-33.3333%"] }}
        transition={{
          duration: 36,
          ease: "linear",
          repeat: Infinity,
        }}
      >
        {loop.map((s, i) => (
          <div
            key={`${s.tag}-${i}`}
            className="group flex items-center gap-6 md:gap-10"
          >
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-rule bg-white text-blue">
                <Asterisk className="w-4 h-4" strokeWidth={2} />
              </span>
              <span className="font-display text-4xl md:text-6xl text-ink leading-none tracking-tight group-hover:text-blue transition-colors">
                {s.label}
              </span>
              <span className="hidden md:inline-block font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted align-top mt-1">
                {s.tag}
              </span>
            </div>
            <span className="h-2 w-2 rotate-45 bg-yellow" />
          </div>
        ))}
      </motion.div>

      {/* secondary reverse lane */}
      <motion.div
        className="flex w-max items-center gap-8 md:gap-14 whitespace-nowrap mt-6 opacity-80"
        animate={reduced ? {} : { x: ["-33.3333%", "0%"] }}
        transition={{
          duration: 48,
          ease: "linear",
          repeat: Infinity,
        }}
      >
        {loop.map((s, i) => (
          <div key={`rev-${s.tag}-${i}`} className="flex items-center gap-8">
            <span className="font-mono text-xs uppercase tracking-[0.22em] text-ink-muted">
              Checked by ScamBusters
            </span>
            <span className="text-ink-muted">·</span>
            <span className="font-display italic text-xl md:text-2xl text-ink-muted">
              {s.label}
            </span>
            <span className="h-1 w-1 rounded-full bg-blue" />
          </div>
        ))}
      </motion.div>
    </section>
  );
}
