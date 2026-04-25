import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ChevronDown,
  Plus,
  X,
  Lock,
  CheckCircle2,
  Info,
} from "lucide-react";
import { detectInput, MALAYSIAN_BANKS, type DetectedKind } from "../lib/detect";
import { cn } from "../lib/cn";
import { AnimatePresence, motion } from "framer-motion";
import Magnet from "../components/Magnet";
import { LAYER3_PERSONAS, type IdType, type TransactionType } from "../lib/api";

const TX_TYPES: { code: TransactionType; name: string }[] = [
  { code: "duitnow_transfer", name: "DuitNow transfer" },
  { code: "qr_payment", name: "QR payment" },
  { code: "bill_payment", name: "Bill payment" },
];

const KIND_LABEL: Record<DetectedKind, string> = {
  bank: "Bank account",
  link: "Link",
  telegram: "Telegram channel",
  unknown: "",
};

const ID_TYPES: { code: IdType; name: string }[] = [
  { code: "mykad", name: "MyKad" },
  { code: "bric", name: "BRIC" },
  { code: "police", name: "Police ID" },
  { code: "army", name: "Army ID" },
  { code: "unhcr", name: "UNHCR" },
  { code: "passport", name: "Passport" },
];

/** Pick a mock= verdict if the smart input contains one of the demo strings. */
function detectMockOverride(smart: string): "high" | "medium" | "low" | null {
  const m = /mock=(high|medium|low)/i.exec(smart);
  if (!m) return null;
  return m[1].toLowerCase() as "high" | "medium" | "low";
}

export interface CheckSubmitPayload {
  smart: string;
  bank: string | null;
  account: string | null;
  idType: IdType | null;
  idNo: string | null;
  tgHandle: string | null;
  /** Optional layer3 transaction overrides; null falls back to defaults in Checking. */
  userId: string | null;
  amount: number | null;
  transactionType: TransactionType | null;
  recipientName: string | null;
  detectedKind: DetectedKind;
}

export default function Check() {
  const navigate = useNavigate();
  const [smart, setSmart] = useState("");
  const [showBank, setShowBank] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showId, setShowId] = useState(false);
  const [showTx, setShowTx] = useState(false);
  const [bank, setBank] = useState("MBB");
  const [account, setAccount] = useState("");
  const [tgHandle, setTgHandle] = useState("");
  const [idType, setIdType] = useState<IdType>("mykad");
  const [idNo, setIdNo] = useState("");
  const [userId, setUserId] = useState("user_001");
  const [amount, setAmount] = useState("100");
  const [txType, setTxType] = useState<TransactionType>("duitnow_transfer");
  const [recipientName, setRecipientName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const detected = useMemo(() => detectInput(smart), [smart]);

  const accountValid =
    !showBank || /^\d{10,17}$/.test(account.replace(/\s|-/g, ""));

  const idValid = !showId || idNo.trim().length >= 3;

  const hasAnyInput =
    detected !== "unknown" ||
    (showBank && accountValid && account.length > 0) ||
    (showChat && tgHandle.trim().length > 2) ||
    (showId && idValid && idNo.trim().length > 0);

  const onSubmit = async () => {
    if (!hasAnyInput || submitting) return;
    setSubmitting(true);
    try {
      // Demo escape hatch: if the user pasted a literal "mock=high|medium|low"
      // anywhere in the smart input, keep the old fully-mock animation.
      const mockOverride = detectMockOverride(smart);
      if (mockOverride) {
        const payload = { smart, mockOverride };
        console.log("[check] submit (mock) →", payload);
        navigate(`/checking?mock=${mockOverride}`);
        return;
      }

      const cleanedAccount = account.replace(/\s|-/g, "");

      const parsedAmount = Number(amount);
      const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

      const payload: CheckSubmitPayload = {
        smart,
        bank: showBank && cleanedAccount.length > 0 ? bank : null,
        account: showBank && cleanedAccount.length > 0 ? cleanedAccount : null,
        idType: showId && idNo.trim().length > 0 ? idType : null,
        idNo: showId && idNo.trim().length > 0 ? idNo.trim() : null,
        tgHandle:
          showChat && tgHandle.trim().length > 0 ? tgHandle.trim() : null,
        userId: showTx && userId.trim().length > 0 ? userId.trim() : null,
        amount: showTx && amountValid ? parsedAmount : null,
        transactionType: showTx ? txType : null,
        recipientName:
          showTx && recipientName.trim().length > 0
            ? recipientName.trim()
            : null,
        detectedKind: detected,
      };

      console.log("[check] submit →", payload);
      navigate("/checking", { state: payload });
    } finally {
      setSubmitting(false);
    }
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
          Account number, URL, or @telegram_channel. We'll figure out what it
          is and check the right sources.
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
            placeholder="e.g. @scamdealchannel · 512298443712 · https://offer.my/..."
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

        <SupportedPlatforms />
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
          open={showId}
          onToggle={() => setShowId((v) => !v)}
          label="Add ID for NFP check"
          hint="National Fraud Portal cross-checks an ID number against reported mules."
        >
          <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-3">
            <label className="relative">
              <span className="sr-only">ID type</span>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value as IdType)}
                className="w-full appearance-none rounded-xl border border-rule bg-white px-4 py-3 text-sm font-medium text-ink pr-9 outline-none focus:border-blue"
              >
                {ID_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-3.5 text-ink-muted pointer-events-none" />
            </label>
            <div>
              <input
                value={idNo}
                onChange={(e) => setIdNo(e.target.value)}
                placeholder="ID number"
                className={cn(
                  "w-full rounded-xl border bg-white px-4 py-3 text-sm font-mono tabular text-ink outline-none",
                  idNo && !idValid
                    ? "border-bad"
                    : "border-rule focus:border-blue",
                )}
              />
              {idNo && !idValid && (
                <p className="mt-2 text-xs text-bad">
                  ID numbers are at least 3 characters.
                </p>
              )}
            </div>
          </div>
        </Disclosure>

        <Disclosure
          open={showChat}
          onToggle={() => setShowChat((v) => !v)}
          label="Add Telegram channel"
          hint="A Telegram @channel we should look at."
        >
          <input
            value={tgHandle}
            onChange={(e) => setTgHandle(e.target.value)}
            placeholder="@channelname"
            className="w-full rounded-xl border border-rule focus:border-blue bg-white px-4 py-3 text-sm font-mono tabular text-ink outline-none"
          />
          <p className="mt-2 text-xs text-ink-muted">
            We'll fetch the latest post via Telegram's MTProto API and run it
            through the link-scan classifier.
          </p>
        </Disclosure>

        <Disclosure
          open={showTx}
          onToggle={() => setShowTx((v) => !v)}
          label="Add transaction details"
          hint="Score this against a TNG user's behavioral baseline."
        >
          <div className="space-y-3">
            <label className="relative block">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted">
                TNG user (persona)
              </span>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="mt-1 w-full appearance-none rounded-xl border border-rule bg-white px-4 py-3 pr-9 text-sm font-medium text-ink outline-none focus:border-blue"
              >
                {LAYER3_PERSONAS.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.user_id} · {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 bottom-3.5 text-ink-muted pointer-events-none" />
            </label>
            {(() => {
              const persona = LAYER3_PERSONAS.find((p) => p.user_id === userId);
              if (!persona) return null;
              return (
                <p className="text-xs text-ink-muted -mt-1">
                  <span className="text-ink font-medium">{persona.name}'s</span>{" "}
                  demo scenario: {persona.scenario}.
                </p>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted">
                  Amount (RM)
                </span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value.replace(/[^\d.]/g, ""))
                  }
                  placeholder="100"
                  className="mt-1 w-full rounded-xl border border-rule focus:border-blue bg-white px-4 py-3 text-sm font-mono tabular text-ink outline-none"
                />
              </label>
              <label className="relative block">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted">
                  Type
                </span>
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value as TransactionType)}
                  className="mt-1 w-full appearance-none rounded-xl border border-rule bg-white px-4 py-3 pr-9 text-sm font-medium text-ink outline-none focus:border-blue"
                >
                  {TX_TYPES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 bottom-3.5 text-ink-muted pointer-events-none" />
              </label>
            </div>

            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-ink-muted">
                Recipient name (optional)
              </span>
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Unknown"
                className="mt-1 w-full rounded-xl border border-rule focus:border-blue bg-white px-4 py-3 text-sm text-ink outline-none"
              />
            </label>

            <p className="text-xs text-ink-muted">
              Sent to the layer-3 behavioral scorer with the bank account
              above. Without these we use sensible defaults (user_001,
              RM100, DuitNow).
            </p>
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
              disabled={!hasAnyInput || submitting}
              onClick={onSubmit}
              className={cn(
                "inline-flex items-center gap-2 px-6 py-3.5 min-h-[48px] rounded-full font-medium transition-all touch-manipulation w-full sm:w-auto justify-center",
                hasAnyInput && !submitting
                  ? "bg-blue text-white hover:bg-[#004a9e] shadow-card"
                  : "bg-surface text-ink-muted cursor-not-allowed",
              )}
            >
              {submitting ? "Preparing…" : "Run risk check"}
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </Magnet>
        </div>
      </div>
    </main>
  );
}

// Mirrors the routing in fraud_detect_api/app/scraper.py — keep in sync if
// the backend's _PLATFORM_MAP / _BLOCKED_DOMAINS change.
const SUPPORTED_PLATFORMS: { name: string; via: string }[] = [
  { name: "Reddit posts", via: "reddit.com — OAuth API (post + top comments)" },
  { name: "Telegram", via: "t.me/{channel} or @handle — Telethon MTProto" },
  { name: "YouTube", via: "youtube.com — JS-rendered description" },
  { name: "TikTok", via: "tiktok.com — JS-rendered caption" },
  { name: "LinkedIn", via: "linkedin.com — public posts only" },
  { name: "Cari forum", via: "cari.com.my — Cloudflare bypass" },
  { name: "Lowyat", via: "lowyat.net" },
  { name: "Blogs", via: "Medium, Substack, WordPress, Blogspot" },
  { name: "Any public webpage", via: "httpx + Playwright fallback" },
];

const BLOCKED_PLATFORMS = [
  "Twitter / X",
  "Facebook",
  "Instagram",
];

function SupportedPlatforms() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink min-h-[32px] -my-1 touch-manipulation"
      >
        <Info className="w-3 h-3" strokeWidth={2} />
        {open ? "Hide supported platforms" : "What links can we scan?"}
        <ChevronDown
          className={cn("w-3 h-3 transition-transform", open && "rotate-180")}
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
            <div className="mt-3 rounded-xl border border-rule bg-surface/60 p-4 space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-2">
                  Supported
                </div>
                <ul className="space-y-1.5 text-xs text-ink">
                  {SUPPORTED_PLATFORMS.map((p) => (
                    <li key={p.name} className="flex items-baseline gap-2">
                      <CheckCircle2
                        className="w-3 h-3 text-good shrink-0 translate-y-0.5"
                        strokeWidth={2.2}
                      />
                      <span className="font-medium">{p.name}</span>
                      <span className="text-ink-muted">— {p.via}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-2">
                  Not supported (login required)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {BLOCKED_PLATFORMS.map((b) => (
                    <span
                      key={b}
                      className="inline-flex items-center rounded-full border border-rule bg-white px-2.5 py-0.5 text-[11px] text-ink-muted"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-ink-muted leading-relaxed pt-1 border-t border-rule">
                After scraping, the LLM classifier judges the page across four
                dimensions — regulatory scope, Malaysian targeting, scam
                indicators — and produces a final{" "}
                <span className="font-mono">SCAM</span> /{" "}
                <span className="font-mono">NOT_SCAM</span> verdict with
                evidence.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
