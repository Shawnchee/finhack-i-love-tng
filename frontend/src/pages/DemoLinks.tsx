// Mock chat-style page with pre-curated scam messages. Click any link → the
// Semak extension's link-guard intercepts it via the global click handler
// (no integration code lives here; this page is just dressing).
//
// HOW TO TUNE FOR YOUR PITCH:
//   Replace each entry's `url` with a link you've confirmed returns SCAM
//   from POST /api/scan. The text/title can stay generic — only the URL
//   matters for the extension's verdict.

interface Message {
  sender: string;
  avatar: string;
  avatarBg: string;
  time: string;
  body: string;
  link: { url: string; preview?: string };
  badge?: string;
}

const messages: Message[] = [
  {
    sender: "💎 VIP Signals Group",
    avatar: "TG",
    avatarBg: "from-sky-500 to-blue-700",
    time: "09:42",
    badge: "INVITE",
    body: "Welcome to our exclusive Telegram channel! Daily profit signals, payouts proof inside. Join before slots close 👇",
    link: {
      url: "https://t.me/bsoxhdn/5371",
      preview: "t.me/bsoxhdn · Private signals channel · Post #5371",
    },
  },
  {
    sender: "Aiman 🎮",
    avatar: "AM",
    avatarBg: "from-orange-500 to-red-600",
    time: "10:15",
    body: "Bro baca ni, mamat Belanda kena spam call pasal AI trading. Sama gak macam kat sini 😩",
    link: {
      url: "https://www.reddit.com/r/thenetherlands/comments/1ll61t7/word_610_keer_per_dag_gebeld_over_ai_trading/",
      preview: "reddit.com · r/thenetherlands · AI trading scam discussion",
    },
  },
];

export default function DemoLinks() {
  return (
    <div className="min-h-screen bg-[#0e1621] text-slate-100">
      <header className="bg-[#17212b] border-b border-[#0f1620] sticky top-0 z-10">
        <div className="mx-auto max-w-3xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="text-slate-400 hover:text-white text-xl leading-none">
              ←
            </button>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center font-bold">
              🇲🇾
            </div>
            <div>
              <div className="text-sm font-semibold">Malaysia Deals & Tips</div>
              <div className="text-[11px] text-slate-400">42,318 members</div>
            </div>
          </div>
          <button className="text-slate-400 hover:text-white">⋮</button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">
        <div className="text-center mb-6">
          <span className="inline-block px-3 py-1 rounded-full bg-[#17212b] text-[11px] text-slate-400">
            Today
          </span>
        </div>

        <div className="space-y-4">
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}
        </div>

        <div className="mt-10 rounded-xl bg-[#17212b]/60 border border-slate-700/50 px-5 py-4 text-xs text-slate-400 leading-relaxed">
          <strong className="font-semibold text-slate-300">
            Demo notice.
          </strong>{" "}
          This page imitates a Telegram-style group chat for the Semak extension
          demo. Each message contains a link with a different scam pattern —
          click any one and the extension intercepts before navigation. No real
          messages, no real senders, no money moves.
        </div>
      </main>
    </div>
  );
}

function MessageBubble({ message: m }: { message: Message }) {
  return (
    <div className="flex gap-3">
      <div
        className={`shrink-0 h-9 w-9 rounded-full bg-gradient-to-br ${m.avatarBg} flex items-center justify-center text-sm font-bold`}
      >
        {m.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-[#182533] rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-sky-300">
              {m.sender}
            </span>
            {m.badge && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wide ${
                  m.badge === "SAFE"
                    ? "bg-emerald-900/50 text-emerald-300"
                    : "bg-rose-900/50 text-rose-300"
                }`}
              >
                {m.badge}
              </span>
            )}
          </div>
          <p className="text-[14px] leading-relaxed text-slate-200 whitespace-pre-wrap">
            {m.body}
          </p>
          <a
            href={m.link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-3 rounded-lg border-l-4 border-sky-500 bg-[#0f1924] hover:bg-[#13202d] px-3 py-2 transition"
          >
            <div className="text-[11px] text-sky-400 font-semibold uppercase tracking-wide">
              {new URL(m.link.url).hostname}
            </div>
            {m.link.preview && (
              <div className="text-[12px] text-slate-300 mt-0.5">
                {m.link.preview}
              </div>
            )}
            <div className="text-[11px] text-slate-500 mt-1 font-mono break-all">
              {m.link.url}
            </div>
          </a>
          <div className="text-[10px] text-slate-500 mt-1.5 text-right">
            {m.time}
          </div>
        </div>
      </div>
    </div>
  );
}
