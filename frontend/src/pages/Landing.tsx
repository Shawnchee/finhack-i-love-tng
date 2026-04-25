import { Link } from "react-router-dom";
import { ArrowUpRight, ScanSearch, ShieldCheck, FileSearch } from "lucide-react";
import BlurText from "../components/BlurText";
import RotatingWord from "../components/RotatingWord";
import CountUp from "../components/CountUp";
import Magnet from "../components/Magnet";
import TiltedCard from "../components/TiltedCard";
import ParticleNet from "../components/ParticleNet";
import FloatingReportCard from "../components/FloatingReportCard";
import SourceMarquee from "../components/SourceMarquee";

const SCAM_TYPES = [
  "fake seller.",
  "mule account.",
  "romance scam.",
  "fake job.",
  "phishing link.",
];

const STATS = [
  { value: 500000, suffix: "+", label: "mule accounts on Semak Mule" },
  { value: 1.2, suffix: "B", prefix: "RM ", label: "lost to scams in 2024", decimal: true },
  { value: 4, suffix: "", label: "sources cross-checked per scan" },
];

const STEPS = [
  {
    n: "01",
    icon: ScanSearch,
    title: "Paste it in",
    body: "Bank account, suspicious link, or the chat itself. One field, any input.",
  },
  {
    n: "02",
    icon: ShieldCheck,
    title: "We cross-check",
    body: "NFP registry, BNM Semak Mule, live site scrape, and a behavioural chat model — in parallel.",
  },
  {
    n: "03",
    icon: FileSearch,
    title: "Read the verdict",
    body: "A clear low/medium/high risk score, with evidence from every source we checked.",
  },
];

export default function Landing() {
  return (
    <main>
      {/* HERO */}
      <section className="relative overflow-hidden min-h-[92vh]">
        <div className="absolute inset-0 bg-dotgrid bg-dotgrid-drift opacity-[0.18] pointer-events-none" />
        <ParticleNet className="absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent pointer-events-none" />

        <div className="relative mx-auto max-w-6xl px-5 md:px-8 pt-14 md:pt-28 pb-16 md:pb-28 grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-8 lg:gap-16 items-center">
          <div>
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-good animate-pulse" />
              <span className="tabular">Live · NFP + Semak Mule + ML model</span>
            </div>

            <h1 className="mt-6 font-display text-[38px] sm:text-[44px] md:text-[76px] leading-[0.98] tracking-tight text-ink">
              <span className="block">
                <BlurText text="Before you send" />
              </span>
              <span className="block">
                <BlurText text="the money," delay={0.18} />
              </span>
              <span className="block italic">check the</span>
              <span className="block">
                <RotatingWord words={SCAM_TYPES} className="italic text-ink" />
              </span>
            </h1>

            <p className="mt-8 max-w-xl text-base md:text-lg text-ink-muted leading-relaxed">
              Paste the bank account, the link, or the chat. We cross-check the
              National Fraud Portal, BNM Semak Mule, scrape the site, and read
              the conversation — in about five seconds.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Magnet strength={8}>
                <Link
                  to="/check"
                  className="inline-flex items-center gap-2 px-6 py-4 min-h-[44px] rounded-full bg-blue text-white font-medium hover:bg-[#004a9e] transition-colors shadow-card touch-manipulation"
                >
                  Check this now
                  <ArrowUpRight className="w-4 h-4" strokeWidth={2} />
                </Link>
              </Magnet>
              <a
                href="#how"
                className="inline-flex items-center min-h-[44px] text-sm text-ink-muted hover:text-ink underline underline-offset-4 decoration-rule touch-manipulation"
              >
                How it works →
              </a>
            </div>

            <div className="mt-16 md:mt-20 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-ink-muted">
              <span className="h-px w-10 bg-rule" />
              <span>Built for the moment you hesitate</span>
            </div>
          </div>

          <div className="relative hidden lg:block h-[520px]">
            <FloatingReportCard />
          </div>

          {/* mobile-only floating card below text */}
          <div className="relative block lg:hidden h-[380px] sm:h-[420px] -mx-5 overflow-hidden">
            <FloatingReportCard />
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="border-y border-rule bg-surface/60">
        <div className="mx-auto max-w-6xl px-5 md:px-8 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-rule">
          {STATS.map((s, i) => (
            <div key={i} className="py-10 md:py-12 px-5 md:px-8">
              <div className="font-display text-4xl sm:text-5xl md:text-6xl text-ink tabular leading-none">
                {s.prefix || ""}
                <CountUp
                  to={s.value}
                  duration={1400}
                  format={(n) =>
                    s.decimal
                      ? n.toFixed(1)
                      : Math.round(n).toLocaleString()
                  }
                />
                {s.suffix}
              </div>
              <div className="mt-3 text-sm text-ink-muted leading-snug max-w-xs">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-6xl px-5 md:px-8 py-24 md:py-32">
        <div className="flex items-end justify-between mb-12 md:mb-16">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-blue mb-4">
              How it works
            </div>
            <h2 className="font-display text-4xl md:text-5xl text-ink leading-tight max-w-2xl">
              Four real checks. <span className="italic">Five seconds.</span> One clear verdict.
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <TiltedCard key={s.n}>
                <div className="rounded-2xl border border-rule bg-white p-8 h-full min-h-[260px] flex flex-col justify-between hover:shadow-card transition-shadow">
                  <div className="flex items-start justify-between">
                    <Icon
                      className="w-7 h-7 text-blue"
                      strokeWidth={1.5}
                    />
                    <span className="font-mono text-xs text-ink-muted tabular">
                      {s.n}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display text-2xl text-ink mb-3">
                      {s.title}
                    </h3>
                    <p className="text-sm text-ink-muted leading-relaxed">
                      {s.body}
                    </p>
                  </div>
                </div>
              </TiltedCard>
            );
          })}
        </div>
      </section>

      {/* SOURCES — infinite marquee */}
      <SourceMarquee />

      {/* CLOSING CTA */}
      <section className="mx-auto max-w-6xl px-5 md:px-8 py-24 md:py-32">
        <div className="relative rounded-3xl border border-rule bg-white p-6 sm:p-10 md:p-16 overflow-hidden">
          <div className="absolute inset-0 bg-dotgrid opacity-[0.12] pointer-events-none" />
          <ParticleNet
            className="absolute inset-0 opacity-60"
            density={42}
            linkDistance={1.8}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-transparent to-white pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div>
              <h2 className="font-display text-[32px] sm:text-4xl md:text-6xl text-ink leading-[1.02] max-w-2xl">
                Still not sure?
                <br />
                <span className="italic">Run a check.</span>
              </h2>
              <p className="mt-6 text-ink-muted max-w-md">
                It's free, ephemeral, and takes about five seconds. You'll
                know before you transfer.
              </p>
            </div>
            <Magnet strength={8}>
              <Link
                to="/check"
                className="inline-flex items-center gap-2 px-6 py-4 min-h-[44px] rounded-full bg-blue text-white font-medium hover:bg-[#004a9e] transition-colors shadow-card touch-manipulation"
              >
                Start a scan
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </Magnet>
          </div>
        </div>
      </section>
    </main>
  );
}
