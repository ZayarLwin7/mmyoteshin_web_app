import sanitizeHtml from "sanitize-html";

/**
 * Content sanitisation.
 *
 * Default posture: editorial copy is stored as *plain text* and rendered as
 * React text nodes, which is XSS-safe by construction. `sanitizeRichText` is
 * only for the narrow case where an operator deliberately supplies markup
 * (policy pages stored in `site_settings`), and it runs a strict allowlist.
 */

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "ul",
    "ol",
    "li",
    "blockquote",
    "h2",
    "h3",
    "h4",
    "a",
    "hr",
  ],
  allowedAttributes: {
    // `rel` and `target` are listed because `transformTags` adds them below and
    // sanitize-html filters the *transformed* attributes through this
    // allowlist. Omitting them silently dropped the tabnabbing defence from
    // every external link.
    a: ["href", "title", "rel", "target"],
  },
  // Only http(s) and mailto links survive; `javascript:` and `data:` are dropped.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  // Strip any tag not on the allowlist together with its attributes.
  parser: {
    lowerCaseTags: true,
  },
  transformTags: {
    // External links must not hand the opener to the destination.
    a: (tagName, attribs) => {
      const isExternal = typeof attribs.href === "string" && /^https?:\/\//i.test(attribs.href);
      return {
        tagName,
        attribs: isExternal
          ? { ...attribs, rel: "noopener noreferrer nofollow", target: "_blank" }
          : attribs,
      };
    },
  },
};

export function sanitizeRichText(input: string): string {
  return sanitizeHtml(input, RICH_TEXT_OPTIONS);
}

/**
 * Normalise a plain-text block: collapse runs of blank lines, trim trailing
 * whitespace per line, and cap the overall length.
 */
export function normalisePlainText(input: string, maxLength = 20_000): string {
  return input
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

/** Split a plain-text body into paragraphs for rendering as separate <p> nodes. */
export function toParagraphs(input: string | null | undefined): string[] {
  if (!input) return [];
  return input
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0);
}

/**
 * Escape the wildcards used by SQL `LIKE`/`ILIKE` so a search for "100%" does
 * not become a wildcard scan. Pair with `ESCAPE '\'` in the query.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Remove characters that would break a `Content-Disposition` header value. */
export function sanitizeFilename(input: string): string {
  return input.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
}
