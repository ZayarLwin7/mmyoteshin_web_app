import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Form primitives.
 *
 * Each control is wired to a label and, when there is an error, to
 * `aria-describedby` — so a screen reader announces the message rather than
 * leaving the user to guess what went wrong.
 */

const CONTROL =
  "w-full rounded-lg border bg-surface-sunken px-3 py-2 text-sm text-ink " +
  "placeholder:text-ink-subtle transition-colors duration-150 " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const CONTROL_OK = "border-line-strong hover:border-line-strong";
const CONTROL_ERROR = "border-danger";

export type FieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function Field({ label, htmlFor, hint, error, required, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-ink text-sm font-medium">
        {label}
        {required ? (
          <span className="text-accent ml-1" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>

      {hint ? (
        <p id={`${htmlFor}-hint`} className="text-ink-subtle text-xs">
          {hint}
        </p>
      ) : null}

      {children}

      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-danger text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

export type InputProps = ComponentProps<"input"> & {
  id: string;
  hint?: string;
  error?: string;
};

export function Input({ id, hint, error, className, ...props }: InputProps) {
  return (
    <input
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, hint, error)}
      {...props}
      className={cn(CONTROL, error ? CONTROL_ERROR : CONTROL_OK, className)}
    />
  );
}

export type TextareaProps = ComponentProps<"textarea"> & {
  id: string;
  hint?: string;
  error?: string;
};

export function Textarea({ id, hint, error, className, ...props }: TextareaProps) {
  return (
    <textarea
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, hint, error)}
      {...props}
      className={cn(CONTROL, "min-h-28 resize-y", error ? CONTROL_ERROR : CONTROL_OK, className)}
    />
  );
}

export type SelectProps = ComponentProps<"select"> & {
  id: string;
  hint?: string;
  error?: string;
};

export function Select({ id, hint, error, className, children, ...props }: SelectProps) {
  return (
    <select
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, hint, error)}
      {...props}
      className={cn(CONTROL, "appearance-none pr-8", error ? CONTROL_ERROR : CONTROL_OK, className)}
    >
      {children}
    </select>
  );
}

export type CheckboxProps = ComponentProps<"input"> & {
  id: string;
  label: string;
  hint?: string;
};

export function Checkbox({ id, label, hint, className, ...props }: CheckboxProps) {
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...props}
        className={cn(
          "border-line-strong bg-surface-sunken mt-0.5 size-4 shrink-0 rounded accent-[var(--color-accent)]",
          className,
        )}
      />
      <div className="flex flex-col">
        <label htmlFor={id} className="text-ink text-sm">
          {label}
        </label>
        {hint ? (
          <span id={`${id}-hint`} className="text-ink-subtle text-xs">
            {hint}
          </span>
        ) : null}
      </div>
    </div>
  );
}
