"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Nav link that marks the current section with `aria-current`. */
export function AdminNavLink({
  href,
  exact = false,
  className,
  children,
}: {
  href: string;
  exact?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        className,
        active ? "bg-surface-raised text-accent" : "text-ink-muted hover:bg-surface hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
