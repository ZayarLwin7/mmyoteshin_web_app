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
   * Every variant gets an `active:` state that is *different* from its hover
   * state. Hover answers "is this interactive?"; active answers "did my press
   * register?" — and without the second one a control feels dead on touch,
   * where there is no hover. `brightness-90` and the accent tint both survive
   * the palette's contrast requirements because they darken or tint the fill
   * rather than swapping the text colour.
   */
  "active:scale-[0.98]";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink shadow-sm hover:bg-accent-strong active:bg-accent-strong active:brightness-90",
  secondary:
    "bg-surface-raised text-ink border border-line-strong hover:border-accent hover:text-accent " +
    "active:border-accent active:bg-accent/15 active:text-accent",
  ghost:
    "text-ink-muted hover:text-ink hover:bg-surface-raised active:bg-accent/15 active:text-accent",
  danger: "bg-danger text-ink-inverse hover:brightness-110 active:brightness-90",
  quiet:
    "text-ink-muted underline underline-offset-4 hover:text-accent active:text-accent active:decoration-2",
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
