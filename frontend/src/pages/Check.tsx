import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ChevronDown,
  Plus,
  Upload,
  X,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { detectInput, MALAYSIAN_BANKS, type DetectedKind } from "../lib/detect";
import { cn } from "../lib/cn";
import { AnimatePresence, motion } from "framer-motion";
import Magnet from "../components/Magnet";

const KIND_LABEL: Record<DetectedKind, string> = {
  bank: "Bank account",
  link: "Link",
  telegram: "Telegram handle",
  whatsapp: "WhatsApp chat",
  unknown: "",
};

export default function Check() {
  const navigate = useNavigate();
  const [smart, setSmart] = useState("");
  const [showBank, setShowBank] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [bank, setBank] = useState("MBB");
  const [account, setAccount] = useState("");
  const [chatMode, setChatMode] = useState<"upload" | "telegram">("telegram");
  const [tgHandle, setTgHandle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const detected = useMemo(() => detectInput(smart), [smart]);

  const accountValid =
    !showBank || (/^\d{10,17}$/.test(account.replace(/\s|-/g, "")));

  const hasAnyInput =
    detected !== "unknown" ||
    (showBank && accountValid && account.length > 0) ||
    (showChat && (tgHandle.length > 2 || file));

  const onSubmit = () => {
    if (!hasAnyInput) return;
    // Pick demo mode based on the strongest signal in inputs
    const param =
      detected === "telegram" && tgHandle.includes("officer")
        ? "high"
        : showBank && account.startsWith("417")
        ? "high"
        : detected === "link" && smart.includes(".top")
        ? "medium"
        : "medium";
    navigate(`/checking?mock=${param}`);
  };

  return (
    <main className="min-h-[calc(100dvh-64px)] pb-44">
      {/* HEADING */}
      <section className="mx-auto max-w-3xl px-5 md:px-8 pt-12 md:pt-24">
        <div className="text-xs uppercase tracking-[0.18em] text-blue mb-4">
          New scan
        </div>
        <h1 className="font-display text-[32px] sm:text-4xl md:text-6xl text-ink leading-[1.02]">
          Paste anything <span className="italic">suspicious.</span>
        </h1>
        <p className="mt-5 text-ink-muted leading-relaxed max-w-xl">
          Account number, URL, WhatsApp export, or @telegram_handle. We'll
          figure out what it is and check the right sources.
        </p>
      </section>

      {/* SMART INPUT */}
      <section className="mx-auto max-w-3xl px-5 md:px-8 mt-10">
        <div
          className={cn(
            "relative rounded-2xl border bg-white transition-all",
            detected !== "unknown"
              ? "border-blue shadow-[0_0_0_4px_#005ABE14]"
              : "border-rule",
          )}
        >
          <textarea
            value={smart}
            onChange={(e) => setSmart(e.target.value)}
            placeholder="e.g. @quickdealmy · 512298443712 · https://offer.my/..."
            rows={3}
            className={cn(
              "w-full resize-none bg-transparent rounded-2xl px-5 py-5 text-base md:text-lg text-ink placeholder:text-ink-muted/60 outline-none font-mono leading-relaxed",
              detected !== "unknown" ? "pt-14 sm:pt-5 sm:pr-40" : "",
            )}
          />
          <AnimatePresence>
            {detected !== "unknown" && (
              <motion.div
                key={detected}
                initial={{ x: 12, opacity: 0, filter: "blur(6px)" }}
                animate={{ x: 0, opacity: 1, filter: "blur(0)" }}
                exit={{ x: 8, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="absolute top-3 right-3 sm:top-5 sm:right-5 inline-flex items-center gap-2 rounded-full bg-blue-soft text-blue px-3 py-1.5 text-xs font-medium pointer-events-none"
              >
                <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.2} />
                {KIND_LABEL[detected]}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-ink-muted">
          <Lock className="w-3 h-3" strokeWidth={2} />
          Ephemeral by design. We don't save what you paste.
        </div>
      </section>

      {/* TOGGLES */}
      <section className="mx-auto max-w-3xl px-5 md:px-8 mt-10 space-y-3">
        <Disclosure
          open={showBank}
          onToggle={() => setShowBank((v) => !v)}
          label="Add bank account"
          hint="If the scammer gave you an account number to transfer to."
        >
          <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-3">
            <label className="relative">
              <span className="sr-only">Bank</span>
              <select
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className="w-full appearance-none rounded-xl border border-rule bg-white px-4 py-3 text-sm font-medium text-ink pr-9 outline-none focus:border-blue"
              >
                {MALAYSIAN_BANKS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-3.5 text-ink-muted pointer-events-none" />
            </label>
            <div>
              <input
                inputMode="numeric"
                value={account}
                onChange={(e) =>
                  setAccount(e.target.value.replace(/[^\d\s-]/g, ""))
                }
                placeholder="Account number"
                className={cn(
                  "w-full rounded-xl border bg-white px-4 py-3 text-sm font-mono tabular text-ink outline-none",
                  account && !accountValid
                    ? "border-bad"
                    : "border-rule focus:border-blue",
                )}
              />
              {account && !accountValid && (
                <p className="mt-2 text-xs text-bad">
                  Account numbers are usually 10–17 digits.
                </p>
              )}
            </div>
          </div>
        </Disclosure>

        <Disclosure
          open={showChat}
          onToggle={() => setShowChat((v) => !v)}
          label="Add chat"
          hint="WhatsApp .txt export or a Telegram channel/user handle."
        >
          <div>
            <div className="inline-flex p-1 rounded-full bg-surface border border-rule mb-4 text-xs">
              {(["telegram", "upload"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setChatMode(m)}
                  className={cn(
                    "inline-flex items-center min-h-[36px] px-3 py-1.5 rounded-full font-medium transition-colors touch-manipulation",
                    chatMode === m
                      ? "bg-white text-ink shadow-sm"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  {m === "telegram" ? "Telegram handle" : "WhatsApp upload"}
                </button>
              ))}
            </div>

            {chatMode === "telegram" ? (
              <input
                value={tgHandle}
                onChange={(e) => setTgHandle(e.target.value)}
                placeholder="@channelname"
                className="w-full rounded-xl border border-rule focus:border-blue bg-white px-4 py-3 text-sm font-mono tabular text-ink outline-none"
              />
            ) : (
              <label
                className={cn(
                  "block rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors",
                  file ? "border-blue bg-blue-soft" : "border-rule hover:border-ink-muted",
                )}
              >
                <input
                  type="file"
                  accept=".txt"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <Upload className="w-5 h-5 mx-auto text-ink-muted" strokeWidth={1.75} />
                <div className="mt-2 text-sm text-ink">
                  {file ? file.name : "Drop WhatsApp export or click to choose"}
                </div>
                <div className="text-xs text-ink-muted mt-1">
                  .txt file · exported without media
                </div>
              </label>
            )}
          </div>
        </Disclosure>
      </section>

      {/* STICKY SUBMIT */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-white/85 backdrop-blur-md"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        <div className="mx-auto max-w-3xl px-5 md:px-8 py-3 md:py-4 flex items-center justify-between gap-4">
          <div className="text-xs text-ink-muted hidden sm:block">
            {hasAnyInput ? "Ready — we'll run the available checks." : "Add at least one input."}
          </div>
          <Magnet strength={6}>
            <button
              disabled={!hasAnyInput}
              onClick={onSubmit}
              className={cn(
                "inline-flex items-center gap-2 px-6 py-3.5 min-h-[48px] rounded-full font-medium transition-all touch-manipulation w-full sm:w-auto justify-center",
                hasAnyInput
                  ? "bg-blue text-white hover:bg-[#004a9e] shadow-card"
                  : "bg-surface text-ink-muted cursor-not-allowed",
              )}
            >
              Run risk check
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </Magnet>
        </div>
      </div>
    </main>
  );
}

function Disclosure({
  open,
  onToggle,
  label,
  hint,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white overflow-hidden transition-colors",
        open ? "border-ink/20" : "border-rule",
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] text-left touch-manipulation"
      >
        <div>
          <div className="text-sm font-medium text-ink flex items-center gap-2">
            {open ? <X className="w-4 h-4 text-ink-muted" /> : <Plus className="w-4 h-4 text-ink-muted" />}
            {label}
          </div>
          {!open && (
            <div className="text-xs text-ink-muted mt-1 ml-6">{hint}</div>
          )}
        </div>
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
            <div className="px-5 pb-5 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
