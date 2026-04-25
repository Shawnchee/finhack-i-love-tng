import { Link } from "react-router-dom";
import { ArrowLeft, Landmark, Link as LinkIcon, MessageSquare, ShieldAlert } from "lucide-react";

export default function About() {
  return (
    <main className="mx-auto max-w-3xl px-5 md:px-8 py-16 md:py-24">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink mb-10"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <div className="text-xs uppercase tracking-[0.22em] text-blue mb-4">
        About
      </div>
      <h1 className="font-display text-4xl md:text-6xl text-ink leading-[1.02]">
        A consumer <span className="italic">fraud check,</span> not a bank.
      </h1>

      <section className="mt-12 space-y-5 text-ink leading-relaxed">
        <p>
          Semak is a hackathon prototype. It takes any combination of a bank
          account, a suspicious link, or a chat transcript, and cross-checks
          them against the sources that already exist to protect Malaysian
          consumers from scams.
        </p>
        <p className="text-ink-muted">
          We built it for the five seconds you spend staring at your screen,
          wondering if you're about to transfer money to a mule account.
        </p>
      </section>

      <Section title="What we check">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {[
            {
              icon: Landmark,
              name: "National Fraud Portal",
              body: "Malaysia's consolidated fraud reporting registry.",
            },
            {
              icon: ShieldAlert,
              name: "BNM Semak Mule",
              body: "Bank Negara Malaysia's official mule account database.",
            },
            {
              icon: LinkIcon,
              name: "Live web scrape",
              body: "We visit the URL, pull its title, body, and outbound links.",
            },
            {
              icon: MessageSquare,
              name: "Behaviour ML",
              body: "A model trained to flag scam-conversation patterns.",
            },
          ].map(({ icon: Icon, name, body }) => (
            <div
              key={name}
              className="rounded-xl border border-rule p-5 bg-white"
            >
              <Icon className="w-5 h-5 text-blue" strokeWidth={1.75} />
              <div className="font-medium text-ink mt-3">{name}</div>
              <div className="text-sm text-ink-muted mt-1 leading-relaxed">
                {body}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="What happens to your data">
        <ul className="space-y-3 text-ink-muted">
          {[
            "Everything is processed in-memory. We do not persist submissions.",
            "No third-party analytics run on the check or report pages.",
            "Telegram scraping pulls only public messages we could access manually.",
            "WhatsApp exports stay in your browser until the moment we score them.",
          ].map((x) => (
            <li key={x} className="flex gap-3">
              <span className="mt-2 h-1 w-1 rounded-full bg-blue shrink-0" />
              <span className="text-ink">{x}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="How the score works">
        <p className="text-ink-muted mb-5">
          A weighted sum across sources, with any hard hit forcing high.
        </p>
        <dl className="divide-y divide-rule border-y border-rule">
          {[
            ["Semak Mule hit", "automatic high"],
            ["NFP report", "+40 points"],
            ["Link scraper flag", "+20 each, max +40"],
            ["Chat model probability", "up to +40"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex items-center justify-between py-4 text-sm"
            >
              <dt className="text-ink">{k}</dt>
              <dd className="font-mono tabular text-ink-muted">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 text-xs text-ink-muted tabular">
          0–29 low · 30–59 medium · 60+ high
        </div>
      </Section>

      <Section title="If you've been scammed">
        <div className="rounded-2xl border border-rule bg-surface p-6">
          <p className="text-ink leading-relaxed">
            Call the National Fraud Hotline at{" "}
            <a href="tel:997" className="text-blue font-medium">
              997
            </a>
            . File a report with{" "}
            <a
              href="https://www.bnm.gov.my/bnmlink"
              target="_blank"
              rel="noreferrer"
              className="text-blue font-medium"
            >
              BNMLINK
            </a>
            . If funds have already moved, contact your bank immediately —
            they can freeze the receiving account within the first hour.
          </p>
        </div>
      </Section>

      <div className="mt-20 flex items-center justify-between border-t border-rule pt-8 text-xs text-ink-muted">
        <span>Not affiliated with BNM, PDRM, or Touch 'n Go.</span>
        <Link to="/check" className="text-blue hover:underline">
          Run a check →
        </Link>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16">
      <h2 className="font-display text-2xl md:text-3xl text-ink mb-5">
        {title}
      </h2>
      {children}
    </section>
  );
}
