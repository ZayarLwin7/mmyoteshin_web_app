import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Button primitives.
 *
 * Every variant is a real, working control — there are no decorative buttons
 * in this codebase. `LinkButton` renders an anchor styled identically so a
 * navigation action is never faked with a click handler.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type Size = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  "transition duration-150 ease-out " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  /*
   * Three states, three visibly different answers.
   *
   * `hover:` — "this is interactive": the fill lifts and gains a coloured ring.
   * `active:` — "your press registered": the lift is cancelled, the fill goes
   * *darker* than its resting state, and the control shrinks. The contrast
   * between hover and active is the point: a control that looks the same when
   * pressed feels broken, and on a touch screen there is no hover to fall back
   * on, so a missing or muted active state reads as a dead button.
   *
   * `duration-150` is fast enough that the press feels immediate, and the
   * scale is a real 0.96 rather than a token 0.98 — at the size these render,
   * 2% is not perceptible.
   */
  "active:scale-[0.96]";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink shadow-sm " +
    "hover:bg-accent-strong hover:shadow-accent/25 hover:-translate-y-px hover:shadow-lg " +
    "active:bg-accent-dim active:text-ink active:-translate-y-0 active:shadow-none " +
    "active:ring-2 active:ring-accent/70 active:ring-offset-2 active:ring-offset-canvas",
  secondary:
    "bg-surface-raised text-ink border border-line-strong " +
    "hover:border-accent hover:bg-accent/15 hover:text-accent hover:-translate-y-px " +
    "active:border-accent active:bg-accent/30 active:text-accent active:-translate-y-0 " +
    "active:ring-2 active:ring-accent/60 active:ring-offset-2 active:ring-offset-canvas",
  ghost:
    "text-ink-muted " +
    "hover:bg-accent/15 hover:text-accent " +
    "active:bg-accent/30 active:text-accent active:ring-2 active:ring-accent/50 active:ring-offset-2 active:ring-offset-canvas",
  danger:
    "bg-danger text-ink-inverse shadow-sm " +
    "hover:brightness-110 hover:-translate-y-px hover:shadow-lg " +
    "active:brightness-90 active:-translate-y-0 active:shadow-none " +
    "active:ring-2 active:ring-danger/70 active:ring-offset-2 active:ring-offset-canvas",
  quiet:
    "text-ink-muted underline underline-offset-4 " +
    "hover:text-accent hover:decoration-accent " +
    "active:text-accent active:decoration-2 active:decoration-accent active:scale-[0.98]",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button {...props} className={buttonClasses(variant, size, className)} />;
}

export type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link {...props} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}
