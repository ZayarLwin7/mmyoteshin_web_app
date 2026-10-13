/**
 * Client-side analytics consent helpers.
 *
 * Kept separate from the banner component so both the banner and the outbound
 * click tracker read the same value from the same key.
 */

const STORAGE_KEY = "mmy.analytics-consent.v1";

export type ConsentValue = "granted" | "denied";

export function readAnalyticsConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    // Private browsing modes can throw on storage access.
    return null;
  }
}

export function writeAnalyticsConsent(value: ConsentValue): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Non-fatal: the choice simply will not persist.
  }
}
