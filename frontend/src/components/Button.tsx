import { forwardRef, type ButtonHTMLAttributes, type AnchorHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { cn } from "../lib/cn";

/**
 * Canonical button styles. Always use this — never hand-roll Tailwind on
 * buttons/links elsewhere, so the theme stays consistent.
 *
 *   primary  → filled blue, white text — the ONE CTA on any screen
 *   ghost    → transparent, blue text — secondary actions
 *   subtle   → outlined on surface — tertiary
 *   disabled → gray, non-interactive (applied via `disabled` prop on button)
 */

export type ButtonVariant = "primary" | "ghost" | "subtle";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-full transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-blue text-white hover:bg-[#004a9e] shadow-card disabled:bg-surface disabled:text-ink-muted disabled:shadow-none",
  ghost:
    "bg-transparent text-blue hover:bg-blue-soft",
  subtle:
    "bg-surface text-ink border border-rule hover:border-ink/30",
};

const sizes: Record<ButtonSize, string> = {
  sm: "text-xs px-3.5 py-2",
  md: "text-sm px-5 py-3",
  lg: "text-base px-6 py-4",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
) {
  return cn(base, variants[variant], sizes[size], extra);
}

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & CommonProps;

export const Button = forwardRef<HTMLButtonElement, BtnProps>(
  ({ variant = "primary", size = "md", className, ...rest }, ref) => (
    <button
      ref={ref}
      className={buttonClass(variant, size, className)}
      {...rest}
    />
  ),
);
Button.displayName = "Button";

type LinkBtnProps = LinkProps & CommonProps;

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: LinkBtnProps) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}

type AnchorBtnProps = AnchorHTMLAttributes<HTMLAnchorElement> & CommonProps;

export function AnchorButton({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: AnchorBtnProps) {
  return <a className={buttonClass(variant, size, className)} {...rest} />;
}
