import { describe, expect, it } from "vitest";

import { safeInternalRedirect, validateExternalUrl } from "@/lib/security/url";

/**
 * These are the checks that stop an operator — or a compromised admin account —
 * from turning the catalogue into an open redirect or an XSS vector. They run on
 * every save, and again on every activation.
 */
describe("validateExternalUrl", () => {
  it("accepts an ordinary https URL", () => {
    const result = validateExternalUrl("https://archive.org/details/example-film");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.host).toBe("archive.org");
      expect(result.url).toBe("https://archive.org/details/example-film");
    }
  });

  it("rejects http, because only https destinations are permitted", () => {
    const result = validateExternalUrl("http://archive.org/film");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("protocol_not_allowed");
  });

  it.each([
    ["javascript:alert(1)"],
    ["data:text/html;base64,PHNjcmlwdD4="],
    ["file:///etc/passwd"],
    ["ftp://example.com/file"],
    ["vbscript:msgbox(1)"],
  ])("rejects the dangerous scheme %s", (candidate) => {
    const result = validateExternalUrl(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("protocol_not_allowed");
  });

  it("rejects a URL carrying embedded credentials", () => {
    const result = validateExternalUrl("https://user:secret@example.com/file");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("credentials_in_url");
  });

  it.each([
    "https://localhost/file",
    "https://127.0.0.1/file",
    "https://10.0.0.5/file",
    "https://192.168.1.1/file",
    "https://172.16.0.1/file",
    "https://169.254.169.254/latest/meta-data/",
    "https://100.64.0.1/file",
    "https://0.0.0.0/file",
  ])("rejects the internal or private destination %s", (candidate) => {
    const result = validateExternalUrl(candidate);
    expect(result.ok).toBe(false);
  });

  it.each([
    "https://metadata.google.internal/computeMetadata/v1/",
    "https://printer.local/file",
    "https://service.internal/file",
    "https://example.invalid/file",
  ])("rejects the reserved host %s", (candidate) => {
    const result = validateExternalUrl(candidate);
    expect(result.ok).toBe(false);
  });

  it("rejects whitespace smuggled into the middle of a URL", () => {
    expect(validateExternalUrl("https://example.com/a b").ok).toBe(false);
    expect(validateExternalUrl("https://exa mple.com/a").ok).toBe(false);
  });

  it("rejects a bare hostname with no dot", () => {
    const result = validateExternalUrl("https://intranet/file");
    expect(result.ok).toBe(false);
  });

  it("rejects an empty or absurdly long value", () => {
    expect(validateExternalUrl("").ok).toBe(false);
    expect(validateExternalUrl(`https://example.com/${"a".repeat(3000)}`).ok).toBe(false);
  });

  it("rejects something that is not a URL at all", () => {
    const result = validateExternalUrl("not a url");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unparseable");
  });

  it("preserves query strings and paths for legitimate URLs", () => {
    const result = validateExternalUrl("https://archive.org/details/film?tab=about");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toContain("tab=about");
  });
});

describe("safeInternalRedirect", () => {
  it("allows a same-origin absolute path", () => {
    expect(safeInternalRedirect("/admin/movies")).toBe("/admin/movies");
  });

  it("falls back when the value is missing", () => {
    expect(safeInternalRedirect(null)).toBe("/admin");
    expect(safeInternalRedirect(undefined, "/elsewhere")).toBe("/elsewhere");
    expect(safeInternalRedirect("")).toBe("/admin");
  });

  it.each([
    ["https://evil.example/steal"],
    ["//evil.example/steal"],
    ["/\\evil.example"],
    ["/admin\\..\\..\\etc"],
    ["javascript:alert(1)"],
    ["/path:with:colons"],
  ])("refuses to redirect to %s", (candidate) => {
    expect(safeInternalRedirect(candidate)).toBe("/admin");
  });

  it("keeps a legitimate nested admin path", () => {
    expect(safeInternalRedirect("/admin/reports/abc-123")).toBe("/admin/reports/abc-123");
  });
});
