import { Link, NavLink, useLocation } from "react-router-dom";
import { cn } from "../lib/cn";

export default function TopNav() {
  const location = useLocation();
  const onCheck = location.pathname.startsWith("/check");
  const onChecking = location.pathname === "/checking";

  if (onChecking) return null;

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-rule pt-safe"
      style={{ paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}
    >
      <div className="mx-auto max-w-6xl px-5 md:px-8 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="group flex items-baseline gap-2 touch-manipulation py-2 -my-2"
        >
          <span className="text-[10px] tracking-[0.22em] text-ink-muted uppercase">
            Semak
          </span>
          <span className="font-display text-[22px] leading-none text-ink">
            fraud.
          </span>
          <span className="ml-1 inline-block h-2 w-2 rounded-full bg-yellow" />
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5">
          <NavLink
            to="/transaction-check"
            className={({ isActive }) =>
              cn(
                "hidden sm:inline-flex items-center min-h-[44px] px-3 -mx-1 text-sm text-ink-muted hover:text-ink transition-colors touch-manipulation",
                isActive && "text-ink"
              )
            }
          >
            Check a transaction
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              cn(
                "inline-flex items-center min-h-[44px] px-3 -mx-1 text-sm text-ink-muted hover:text-ink transition-colors touch-manipulation",
                isActive && "text-ink"
              )
            }
          >
            About
          </NavLink>
          {!onCheck && (
            <Link
              to="/check"
              className="inline-flex items-center justify-center min-h-[44px] text-sm font-medium px-4 py-2 rounded-full bg-blue text-white hover:bg-[#004a9e] transition-colors touch-manipulation"
            >
              Check now
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
