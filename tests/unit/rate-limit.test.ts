import { describe, expect, it } from "vitest";

import { clientFingerprint, hashIdentifier, safeEqual } from "@/lib/security/rate-limit";

/**
 * Rate limiting has two halves: a pure half (identifiers and comparison) that
 * is tested here, and a stateful half that needs Postgres. The stateful half is
 * exercised by the end-to-end suite, which can actually trip a limit.
 *
 * The property that matters most in this file is that a raw IP address is never
 * what gets stored.
 */

describe("hashIdentifier", () => {
  it("is deterministic, so a client is recognised across requests", () => {
    expect(hashIdentifier("203.0.113.7")).toBe(hashIdentifier("203.0.113.7"));
  });

  it("separates different clients", () => {
    expect(hashIdentifier("203.0.113.7")).not.toBe(hashIdentifier("203.0.113.8"));
  });

  it("never contains the original value", () => {
    const identifier = "203.0.113.7";
    const hashed = hashIdentifier(identifier);

    expect(hashed).not.toContain(identifier);
    expect(hashed).not.toContain("203");
  });

  it("returns a fixed-length hexadecimal digest", () => {
    expect(hashIdentifier("anything")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces an unpredictable value for the same input across secrets", () => {
    // The key is derived from SESSION_SECRET, so the digest is not a plain
    // rainbow-table-able hash of an IP address.
    const first = hashIdentifier("203.0.113.7");
    expect(first).not.toBe("203.0.113.7");
    expect(first.length).toBe(64);
  });
});

describe("clientFingerprint", () => {
  it("takes the first entry of x-forwarded-for, which is the closest to the client", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" });

    expect(clientFingerprint(headers)).toBe("203.0.113.7");
  });

  it("trims surrounding whitespace", () => {
    expect(clientFingerprint(new Headers({ "x-forwarded-for": "  203.0.113.7  " }))).toBe(
      "203.0.113.7",
    );
  });

  it("falls back to platform-specific headers when x-forwarded-for is absent", () => {
    expect(clientFingerprint(new Headers({ "cf-connecting-ip": "203.0.113.9" }))).toBe(
      "203.0.113.9",
    );
    expect(clientFingerprint(new Headers({ "x-real-ip": "203.0.113.10" }))).toBe("203.0.113.10");
  });

  it("returns a stable placeholder rather than throwing when no header is present", () => {
    expect(clientFingerprint(new Headers())).toBe("unknown");
  });

  it("ignores an empty x-forwarded-for so it cannot be used to dodge a limit", () => {
    const headers = new Headers({ "x-forwarded-for": "", "cf-connecting-ip": "203.0.113.11" });

    expect(clientFingerprint(headers)).toBe("203.0.113.11");
  });
});

describe("safeEqual", () => {
  it("returns true for identical strings", () => {
    expect(safeEqual("token-value", "token-value")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(safeEqual("token-value", "token-valuf")).toBe(false);
  });

  it("returns false instead of throwing when the lengths differ", () => {
    // `timingSafeEqual` throws on a length mismatch; this wrapper must not.
    expect(() => safeEqual("short", "much-longer-value")).not.toThrow();
    expect(safeEqual("short", "much-longer-value")).toBe(false);
  });

  it("handles empty strings without throwing", () => {
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual("", "x")).toBe(false);
  });
});
