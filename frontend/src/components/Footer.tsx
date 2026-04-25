import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-rule mt-24">
      <div className="mx-auto max-w-6xl px-5 md:px-8 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-sm text-ink-muted">
        <p className="max-w-xl leading-relaxed">
          Not affiliated with Bank Negara Malaysia, PDRM, or Touch 'n Go.
          Data is processed in-memory and not stored.
        </p>
        <div className="flex items-center gap-5">
          <Link to="/about" className="hover:text-ink">
            About
          </Link>
          <a
            href="https://www.bnm.gov.my/semakmule"
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink"
          >
            Semak Mule
          </a>
          <a
            href="tel:997"
            className="hover:text-ink"
          >
            NFCC 997
          </a>
        </div>
      </div>
    </footer>
  );
}
