import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  checkTransaction,
  getUserProfile,
  type CheckTransactionArgs,
  type CheckTransactionResponse,
  type Layer3Decision,
  type ReasonCode,
  type ReasonSeverity,
  type TransactionType,
  type UserProfileResponse,
} from "../lib/api";
import { cn } from "../lib/cn";

const TX_TYPES: { code: TransactionType; name: string }[] = [
  { code: "qr_payment", name: "QR payment" },
  { code: "duitnow_transfer", name: "DuitNow transfer" },
  { code: "bill_payment", name: "Bill payment" },
];

/**
 * Returns a string formatted like "2026-04-25T14:30:00+08:00" for the given
 * Date, suitable for the layer3 backend timestamp field.
 */
function toMyt(d: Date): string {
  // Build a +08:00 ISO string. Use the user's local time as the "wall clock"
  // value but force the offset to MYT so the demo has a stable timezone.
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+08:00`
  );
}

const SEVERITY_CHIP: Record<ReasonSeverity, string> = {
  LOW: "bg-surface text-ink-muted",
  MEDIUM: "bg-blue-soft text-blue",
  HIGH: "bg-yellow/25 text-ink border border-yellow",
  CRITICAL: "bg-bad/10 text-bad border border-bad/40",
};

const DECISION_META: Record<
  Layer3Decision,
  {
    label: string;
    cls: string;
    barCls: string;
    Icon: typeof CheckCircle2;
  }
> = {
  ALLOW: {
    label: "Allow",
    cls: "border-good/40 bg-good/5 text-ink",
    barCls: "bg-good",
    Icon: ShieldCheck,
  },
  NOTIFY: {
    label: "Notify",
    cls: "border-blue/30 bg-blue-soft text-ink",
    barCls: "bg-blue",
    Icon: AlertTriangle,
  },
  CHALLENGE: {
    label: "Challenge",
    cls: "border-yellow bg-yellow/10 text-ink",
    barCls: "bg-yellow",
    Icon: AlertTriangle,
  },
  BLOCK: {
    label: "Block",
    cls: "border-bad/40 bg-bad/5 text-ink",
    barCls: "bg-bad",
    Icon: ShieldAlert,
  },
};

export default function TransactionCheck() {
  const [userId, setUserId] = useState("user_001");
  const [recipientAccount, setRecipientAccount] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [amount, setAmount] = useState("100");
  const [txType, setTxType] = useState<TransactionType>("duitnow_transfer");
  const [timestamp, setTimestamp] = useState<string>(() => toMyt(new Date()));

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CheckTransactionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Debounced fetch of getUserProfile when userId changes (500ms after last keystroke).
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!userId.trim()) {
      setProfile(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setProfileLoading(true);
      setProfileError(null);
      getUserProfile(userId.trim())
        .then((p) => {
          console.log("[transaction-check] profile loaded", p);
          setProfile(p);
        })
        .catch((err) => {
          console.error("[transaction-check] profile failed", err);
          setProfileError(
            err instanceof Error ? err.message : "Failed to load profile.",
          );
          setProfile(null);
        })
        .finally(() => setProfileLoading(false));
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [userId]);

  const amountNum = useMemo(() => Number(amount), [amount]);

  const canSubmit =
    !submitting &&
    userId.trim().length > 0 &&
    recipientAccount.trim().length > 0 &&
    recipientName.trim().length > 0 &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    timestamp.trim().length > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setResult(null);

    const payload: CheckTransactionArgs = {
      user_id: userId.trim(),
      recipient_account: recipientAccount.trim(),
      recipient_name: recipientName.trim(),
      amount: amountNum,
      transaction_type: txType,
      timestamp: timestamp.trim(),
    };

    console.log("[transaction-check] submit →", payload);

    try {
      const res = await checkTransaction(payload);
      console.log("[transaction-check] result", res);
      setResult(res);
    } catch (err) {
      console.error("[transaction-check] failed", err);
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-5 md:px-8 py-12 md:py-16 pb-24">
      <div className="text-xs uppercase tracking-[0.22em] text-blue mb-4">
        Layer 3 · behavioral
      </div>
      <h1 className="font-display text-[40px] sm:text-5xl md:text-6xl text-ink leading-[1.02]">
        Check a <span className="italic">transaction.</span>
      </h1>
      <p className="mt-5 text-ink-muted leading-relaxed max-w-xl">
        Score a TNG payment against your behavioral baseline. We score the
        candidate transfer using rules + ML and explain why.
      </p>

      {/* FORM */}
      <form
        onSubmit={onSubmit}
        className="mt-10 rounded-2xl border border-rule bg-white p-5 md:p-6 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="User ID">
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="user_001"
              className={inputCls}
            />
          </Field>
          <Field label="Transaction type">
            <div className="relative">
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value as TransactionType)}
                className={cn(inputCls, "pr-9 appearance-none")}
              >
                {TX_TYPES.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-3.5 text-ink-muted pointer-events-none" />
            </div>
          </Field>
          <Field label="Recipient account">
            <input
              value={recipientAccount}
              onChange={(e) =>
                setRecipientAccount(e.target.value.replace(/[^\d\s-]/g, ""))
              }
              inputMode="numeric"
              placeholder="e.g. 512298443712"
              className={cn(inputCls, "font-mono tabular")}
            />
          </Field>
          <Field label="Recipient name">
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g. Alice Tan"
              className={inputCls}
            />
          </Field>
          <Field label="Amount (RM)">
            <input
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^\d.]/g, ""))
              }
              inputMode="decimal"
              placeholder="100"
              className={cn(inputCls, "font-mono tabular")}
            />
          </Field>
          <Field label="Timestamp (with tz)">
            <input
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              placeholder="2026-04-25T14:30:00+08:00"
              className={cn(inputCls, "font-mono text-xs")}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="text-xs text-ink-muted">
            Calls <code className="font-mono">/api/check_transaction</code>.
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-full font-medium transition-colors touch-manipulation",
              canSubmit
                ? "bg-blue text-white hover:bg-[#004a9e] shadow-card"
                : "bg-surface text-ink-muted cursor-not-allowed",
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scoring…
              </>
            ) : (
              <>
                Score transaction
                <ArrowUpRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* ERROR */}
      {error && (
        <div className="mt-4 rounded-xl border border-bad/40 bg-bad/5 px-4 py-3 text-sm text-bad">
          {error}
        </div>
      )}

      {/* RESULT */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
            className="mt-8"
          >
            <ResultCard result={result} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* PROFILE */}
      <ProfilePanel
        profile={profile}
        loading={profileLoading}
        error={profileError}
        userId={userId}
      />
    </main>
  );
}

const inputCls =
  "w-full rounded-xl border border-rule bg-white px-4 py-3 text-sm text-ink outline-none focus:border-blue";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.16em] text-ink-muted mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function ResultCard({ result }: { result: CheckTransactionResponse }) {
  const meta = DECISION_META[result.decision] ?? DECISION_META.NOTIFY;
  const Icon = meta.Icon;
  const score = Math.max(0, Math.min(100, Math.round(result.risk_score)));

  return (
    <div className={cn("rounded-2xl border bg-white p-6 md:p-8", meta.cls)}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-white border border-rule flex items-center justify-center">
          <Icon className="w-5 h-5 text-ink" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted">
            Decision
          </div>
          <div className="mt-1 font-display text-3xl md:text-4xl text-ink leading-tight">
            {meta.label}
          </div>
          {result.user_friendly_warning && (
            <p className="mt-3 text-ink leading-relaxed max-w-2xl">
              {result.user_friendly_warning}
            </p>
          )}
          {result.recommended_action && (
            <p className="mt-2 text-sm text-ink-muted leading-relaxed max-w-2xl">
              <span className="text-ink font-medium">Action:</span>{" "}
              {result.recommended_action}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-end justify-between mb-2 text-xs text-ink-muted">
          <span className="uppercase tracking-wider">Risk score</span>
          <span className="font-mono tabular text-ink">
            {score} <span className="text-ink-muted">/ 100</span>
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-surface overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
            className={cn("h-full", meta.barCls)}
          />
        </div>
        <div className="mt-2 text-[10px] tabular text-ink-muted uppercase tracking-wider">
          ML anomaly: {result.ml_anomaly_score.toFixed(2)}
        </div>
      </div>

      {result.reason_codes && result.reason_codes.length > 0 && (
        <div className="mt-6">
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted mb-3">
            Why
          </div>
          <ul className="space-y-2">
            {result.reason_codes.map((rc) => (
              <ReasonRow key={rc.code} reason={rc} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReasonRow({ reason }: { reason: ReasonCode }) {
  return (
    <li className="rounded-xl border border-rule bg-white px-4 py-3 flex items-start gap-3 text-sm">
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider shrink-0",
          SEVERITY_CHIP[reason.severity] ?? SEVERITY_CHIP.LOW,
        )}
      >
        {reason.severity}
      </span>
      <div className="flex-1">
        <div className="font-mono text-xs text-ink-muted">{reason.code}</div>
        <div className="text-ink mt-0.5">{reason.message}</div>
      </div>
    </li>
  );
}

function ProfilePanel({
  profile,
  loading,
  error,
  userId,
}: {
  profile: UserProfileResponse | null;
  loading: boolean;
  error: string | null;
  userId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-8 rounded-2xl border border-rule bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 min-h-[56px] text-left touch-manipulation"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center">
            <User className="w-4 h-4 text-ink" strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-sm font-medium text-ink">
              Your normal pattern
            </div>
            <div className="text-xs text-ink-muted mt-0.5">
              Layer3 baseline for{" "}
              <span className="font-mono">{userId || "—"}</span>
            </div>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-ink-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
            className="overflow-hidden border-t border-rule"
          >
            <div className="p-5 md:p-6">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-ink-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading profile…
                </div>
              ) : error ? (
                <div className="text-sm text-bad">{error}</div>
              ) : !profile ? (
                <div className="text-sm text-ink-muted">
                  Enter a user ID to load their baseline.
                </div>
              ) : (
                <ProfileGrid profile={profile} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ProfileGrid({ profile }: { profile: UserProfileResponse }) {
  const total = pickNumber(profile, "total_transactions");
  const avg = pickNumber(profile, "avg_transaction_amount");
  const typicalHours = pickArray(profile, "typical_hours");
  const typicalDays = pickArray(profile, "typical_days");
  const frequentRecipients = pickArray(profile, "frequent_recipients");
  const txDist = pickRecord(profile, "transaction_types_distribution");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      <Stat
        label="Total transactions"
        value={total !== null ? String(total) : "—"}
      />
      <Stat
        label="Avg amount (RM)"
        value={avg !== null ? avg.toFixed(2) : "—"}
      />
      <Stat
        label="Typical hours"
        value={
          typicalHours.length ? typicalHours.slice(0, 8).join(", ") : "—"
        }
      />
      <Stat
        label="Typical days"
        value={typicalDays.length ? typicalDays.join(", ") : "—"}
      />
      <Stat
        label="Frequent recipients"
        value={
          frequentRecipients.length
            ? frequentRecipients.slice(0, 4).join(", ")
            : "—"
        }
        wide
      />
      <Stat
        label="Type distribution"
        value={
          Object.keys(txDist).length
            ? Object.entries(txDist)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")
            : "—"
        }
        wide
      />
      <div className="sm:col-span-2 mt-2 flex items-center gap-2 text-[11px] text-ink-muted">
        <Activity className="w-3 h-3" />
        Returned by <code className="font-mono">/api/user_profile/…</code>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("rounded-xl bg-surface p-4", wide && "sm:col-span-2")}>
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">
        {label}
      </div>
      <div className="mt-1.5 font-mono tabular text-sm text-ink break-words">
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile field pickers — the layer3 backend returns a flexible shape, so we
// look up each field defensively.
// ---------------------------------------------------------------------------

function pickNumber(p: UserProfileResponse, key: string): number | null {
  const v = p[key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return null;
}

function pickArray(p: UserProfileResponse, key: string): (string | number)[] {
  const v = p[key];
  if (Array.isArray(v)) {
    return v.filter(
      (x): x is string | number => typeof x === "string" || typeof x === "number",
    );
  }
  return [];
}

function pickRecord(
  p: UserProfileResponse,
  key: string,
): Record<string, string | number> {
  const v = p[key];
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const out: Record<string, string | number> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "string" || typeof val === "number") out[k] = val;
    }
    return out;
  }
  return {};
}
