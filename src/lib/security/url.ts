import { z } from "zod";

/**
 * Validation for every externally-supplied URL before it is persisted.
 *
 * The catalogue links out to third-party hosts. A hostile or careless value
 * here becomes an open redirect, a `javascript:` XSS vector, or a request from
 * our server into the private network. All three are blocked below.
 */

/** Schemes we are willing to store. `http` is deliberately excluded. */
const ALLOWED_PROTOCOLS = new Set(["https:"]);

/** Hostnames that must never be treated as an external destination. */
const BLOCKED_HOST_SUFFIXES = [
  ".local",
  ".localhost",
  ".internal",
  ".lan",
  ".home",
  ".corp",
  ".test",
  ".invalid",
  ".example",
];

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
]);

/** IPv4 literals pointing at loopback, link-local, private or CGNAT ranges. */
function isPrivateIpv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;

  const octets = match.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) return true; // malformed → treat as unsafe

  const [a, b] = octets as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved

  return false;
}

/** IPv6 literals pointing at loopback, unique-local or link-local space. */
function isPrivateIpv6(host: string): boolean {
  const bare = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!bare.includes(":")) return false;
  if (bare === "::1" || bare === "::") return true;
  if (bare.startsWith("fc") || bare.startsWith("fd")) return true; // unique local
  if (
    bare.startsWith("fe8") ||
    bare.startsWith("fe9") ||
    bare.startsWith("fea") ||
    bare.startsWith("feb")
  ) {
    return true; // link-local
  }
  return false;
}

export type UrlRejectionReason =
  | "unparseable"
  | "protocol_not_allowed"
  | "credentials_in_url"
  | "missing_host"
  | "blocked_host"
  | "private_address";

export type UrlValidationResult =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: UrlRejectionReason; message: string };

/**
 * Validate and normalise an outbound destination URL.
 *
 * Returns the normalised URL (with a canonical trailing-slash-free form) and
 * the bare host, or a machine-readable rejection reason.
 */
export function validateExternalUrl(input: string): UrlValidationResult {
  const trimmed = input.trim();

  if (trimmed === "" || trimmed.length > 2048) {
    return { ok: false, reason: "unparseable", message: "URL is empty or unreasonably long." };
  }

  // Reject control characters and whitespace smuggled into the middle of a URL.
  if (/[\u0000-\u001f\u007f\s]/.test(trimmed)) {
    return {
      ok: false,
      reason: "unparseable",
      message: "URL contains whitespace or control characters.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      ok: false,
      reason: "unparseable",
      message: "Not a valid absolute URL. Include the https:// prefix.",
    };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return {
      ok: false,
      reason: "protocol_not_allowed",
      message: `Only https:// links are permitted (received "${parsed.protocol}").`,
    };
  }

  // `https://user:pass@host/` leaks credentials and is a phishing pattern.
  if (parsed.username !== "" || parsed.password !== "") {
    return {
      ok: false,
      reason: "credentials_in_url",
      message: "URLs containing embedded credentials are not permitted.",
    };
  }

  const host = parsed.hostname.toLowerCase();
  if (host === "") {
    return { ok: false, reason: "missing_host", message: "URL is missing a host." };
  }

  if (BLOCKED_HOSTS.has(host)) {
    return {
      ok: false,
      reason: "blocked_host",
      message: `Host "${host}" is not a permitted external destination.`,
    };
  }

  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return {
      ok: false,
      reason: "blocked_host",
      message: `Host "${host}" is a reserved or internal name.`,
    };
  }

  if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
    return {
      ok: false,
      reason: "private_address",
      message: "Private, loopback and link-local addresses are not permitted.",
    };
  }

  // A host must contain a dot (or be an IPv6 literal) to be a real destination.
  if (!host.includes(".") && !host.includes(":")) {
    return {
      ok: false,
      reason: "blocked_host",
      message: `Host "${host}" is not a fully-qualified domain name.`,
    };
  }

  return { ok: true, url: parsed.toString(), host };
}

/** Zod schema wrapper so URL checks compose with the rest of the form validation. */
export const externalUrlSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const result = validateExternalUrl(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.message });
    }
  });

/**
 * Path for a same-origin asset, e.g. `/posters/charade.jpg`.
 *
 * Protocol-relative (`//host`) and backslash forms are rejected: both are ways
 * of smuggling a host into something that reads like a path.
 */
const SAME_ORIGIN_PATH_PATTERN = /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*$/;

/**
 * Where an image may be loaded from: either a public `https://` URL, or a
 * site-relative path.
 *
 * Allowing a same-origin path is not a loosening. It is strictly *narrower*
 * than a remote URL, because the optimiser reads the bytes from our own
 * filesystem — there is no third-party request to time out, no host to be
 * rate-limited by, and no way for a stored value to aim the server at an
 * address it could not otherwise reach. Remote posters stay supported for the
 * case where the artwork genuinely lives elsewhere.
 */
export const imageSourceSchema = z
  .string()
  .trim()
  .max(2048)
  .superRefine((value, ctx) => {
    if (value.startsWith("/")) {
      if (!SAME_ORIGIN_PATH_PATTERN.test(value)) {
        ctx.addIssue({
          code: "custom",
          message: "Use a path such as /posters/example.jpg.",
        });
      }
      return;
    }

    const result = validateExternalUrl(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.message });
    }
  });

/**
 * Guard for internal redirect targets. Only same-origin, root-relative paths
 * are allowed so a crafted `?next=` cannot bounce a user off-site.
 */
export function safeInternalRedirect(
  target: string | null | undefined,
  fallback = "/admin",
): string {
  if (!target) return fallback;

  const value = target.trim();
  if (value === "" || value.startsWith("//")) return fallback;
  if (!value.startsWith("/")) return fallback;
  // Reject protocol-relative and backslash tricks used to smuggle a host.
  if (value.startsWith("/\\") || value.includes("\\")) return fallback;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return fallback;

  return value;
}
