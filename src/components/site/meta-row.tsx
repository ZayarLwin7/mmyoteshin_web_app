import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A wrapping row of short metadata facts separated by interpuncts.
 *
 * The separator is rendered **inside** the same flex item as the value it
 * introduces, rather than as a sibling of it. That matters because the row
 * wraps: with the separator as its own flex child, a narrow viewport could
 * break the line between a `·` and its value, leaving a dangling bullet at the
 * end of the previous line (and, worse, an orphaned one when the *last* value
 * wrapped on its own).
 *
 * Each item is therefore an atomic `inline-flex` unit, so a separator and its
 * value always move together. The interpunct is `aria-hidden` — it is
 * punctuation for the eye, and a screen reader reading "1941 9m" is clearer
 * than "1941 dot 9m".
 *
 * The gap is driven by a `--meta-gap` custom property rather than a literal
 * utility, because the separator sits inside the item: with a hard-coded inner
 * gap, a caller that tightened the outer gap (the catalogue card uses a smaller
 * one than the hero) would get a lopsided `·` — 8px before it, 12px after. Both
 * gaps read the same variable, so they cannot drift apart.
 */

export type MetaItem = {
  /** Stable React key. Also the natural identity of the fact. */
  key: string;
  /**
   * The fact itself. Falsy values (`null`, `undefined`, `false`, `""`) drop the
   * item — and, because the separator is derived from position, they drop the
   * separator with it. Callers can therefore pass a conditional expression
   * without having to build a filtered array by hand.
   */
  content: ReactNode;
  /** Extra classes for the value only — never the separator. */
  valueClassName?: string;
};

export function MetaRow({ items, className }: { items: MetaItem[]; className?: string }) {
  const shown = items.filter(
    (item) =>
      item.content !== null &&
      item.content !== undefined &&
      item.content !== false &&
      item.content !== "",
  );

  if (shown.length === 0) return null;

  return (
    <div
      className={cn(
        "text-ink-muted flex flex-wrap items-center gap-x-(--meta-gap) gap-y-2 [--meta-gap:0.75rem]",
        className,
      )}
    >
      {shown.map((item, index) => (
        <span key={item.key} className="inline-flex items-center gap-x-(--meta-gap)">
          {index > 0 ? <span aria-hidden="true">·</span> : null}
          <span className={item.valueClassName}>{item.content}</span>
        </span>
      ))}
    </div>
  );
}
