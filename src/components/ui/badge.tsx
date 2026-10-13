import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Small status pill. Colour is never the only signal — the label always says it. */

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "border-line-strong bg-surface-raised text-ink-muted",
  accent: "border-accent-dim bg-accent/10 text-accent",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
  info: "border-info/40 bg-info/10 text-info",
};

export type BadgeProps = ComponentProps<"span"> & { tone?: Tone };

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={cn(
        "text-2xs inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium tracking-wide uppercase",
        TONES[tone],
        className,
      )}
    />
  );
}

/** Map a database status value onto a tone, in one place. */
export function statusTone(status: string): Tone {
  switch (status) {
    case "published":
    case "active":
    case "resolved":
      return "success";
    case "draft":
    case "pending_review":
    case "new":
      return "warning";
    case "archived":
    case "disabled":
    case "rejected":
      return "neutral";
    case "reported":
    case "under_review":
      return "danger";
    default:
      return "neutral";
  }
}
