import { describe, expect, it } from "vitest";

import {
  escapeLikePattern,
  normalisePlainText,
  sanitizeRichText,
  toParagraphs,
} from "@/lib/security/sanitize";
import { formatFileSize, formatRating, formatRuntime, humaniseEnum, truncate } from "@/lib/utils";

describe("sanitizeRichText", () => {
  it("removes script tags and their contents", () => {
    const result = sanitizeRichText('<p>Hello</p><script>alert("xss")</script>');
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert");
    expect(result).toContain("<p>Hello</p>");
  });

  it("removes event-handler attributes", () => {
    const result = sanitizeRichText('<p onclick="steal()">Click</p>');
    expect(result).not.toContain("onclick");
  });

  it("strips javascript: hrefs but keeps the text", () => {
    const result = sanitizeRichText('<a href="javascript:alert(1)">Tap</a>');
    expect(result).not.toContain("javascript:");
    expect(result).toContain("Tap");
  });

  it("drops iframes, objects and embeds entirely", () => {
    const result = sanitizeRichText(
      '<iframe src="https://evil.test"></iframe><object data="x"></object><embed src="y">',
    );
    expect(result).not.toContain("<iframe");
    expect(result).not.toContain("<object");
    expect(result).not.toContain("<embed");
  });

  it("keeps an ordinary paragraph with emphasis", () => {
    const result = sanitizeRichText("<p>A <strong>good</strong> <em>film</em>.</p>");
    expect(result).toBe("<p>A <strong>good</strong> <em>film</em>.</p>");
  });

  it("adds rel=noopener to external links", () => {
    const result = sanitizeRichText('<a href="https://archive.org">Archive</a>');
    expect(result).toContain("noopener");
    expect(result).toContain("noreferrer");
  });

  it("keeps mailto links", () => {
    const result = sanitizeRichText('<a href="mailto:hello@example.com">Mail</a>');
    expect(result).toContain("mailto:hello@example.com");
  });

  it("does not allow img tags, which could be used to leak a visitor's address", () => {
    const result = sanitizeRichText('<img src="https://tracker.test/pixel.gif">');
    expect(result).not.toContain("<img");
  });
});

describe("normalisePlainText", () => {
  it("converts CRLF to LF", () => {
    expect(normalisePlainText("a\r\nb")).toBe("a\nb");
  });

  it("collapses three or more newlines into a paragraph break", () => {
    expect(normalisePlainText("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("trims trailing whitespace on each line", () => {
    expect(normalisePlainText("a   \nb\t")).toBe("a\nb");
  });

  it("trims the overall value", () => {
    expect(normalisePlainText("\n\n  hello  \n\n")).toBe("hello");
  });

  it("caps the length", () => {
    expect(normalisePlainText("x".repeat(500), 100)).toHaveLength(100);
  });
});

describe("toParagraphs", () => {
  it("splits on blank lines", () => {
    expect(toParagraphs("One.\n\nTwo.")).toEqual(["One.", "Two."]);
  });

  it("joins single newlines within a paragraph", () => {
    expect(toParagraphs("One\ncontinues.")).toEqual(["One continues."]);
  });

  it("returns an empty array for empty input", () => {
    expect(toParagraphs(null)).toEqual([]);
    expect(toParagraphs("   ")).toEqual([]);
  });

  it("ignores runs of blank lines", () => {
    expect(toParagraphs("One.\n\n\n\nTwo.")).toEqual(["One.", "Two."]);
  });
});

describe("escapeLikePattern", () => {
  it("escapes the percent wildcard", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
  });

  it("escapes the underscore wildcard", () => {
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
  });

  it("escapes a literal backslash", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });

  it("leaves an ordinary term untouched", () => {
    expect(escapeLikePattern("blade runner")).toBe("blade runner");
  });
});

describe("formatRuntime", () => {
  it.each([
    [90, "1h 30m"],
    [120, "2h"],
    [45, "45m"],
    [61, "1h 1m"],
  ])("formats %i minutes as %s", (minutes, expected) => {
    expect(formatRuntime(minutes)).toBe(expected);
  });

  it("returns null for missing or invalid values", () => {
    expect(formatRuntime(null)).toBeNull();
    expect(formatRuntime(0)).toBeNull();
    expect(formatRuntime(-5)).toBeNull();
    expect(formatRuntime(undefined)).toBeNull();
  });
});

describe("formatFileSize", () => {
  it("formats bytes, kilobytes and megabytes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1_572_864)).toBe("1.5 MB");
  });

  it("accepts the string form that Postgres numeric columns return", () => {
    expect(formatFileSize("2048")).toBe("2 KB");
  });

  it("returns null for unusable values", () => {
    expect(formatFileSize(null)).toBeNull();
    expect(formatFileSize("")).toBeNull();
    expect(formatFileSize(0)).toBeNull();
    expect(formatFileSize("abc")).toBeNull();
  });
});

describe("formatRating", () => {
  it("always shows the scale alongside the score", () => {
    expect(formatRating("8.5", "10.0")).toBe("8.5 / 10");
  });

  it("drops the decimal for whole numbers", () => {
    expect(formatRating("8", "10")).toBe("8 / 10");
  });

  it("respects a non-ten scale", () => {
    expect(formatRating("4", "5")).toBe("4 / 5");
  });

  it("returns null when there is no score", () => {
    expect(formatRating(null)).toBeNull();
    expect(formatRating("")).toBeNull();
    expect(formatRating(undefined)).toBeNull();
  });
});

describe("truncate", () => {
  it("collapses whitespace", () => {
    expect(truncate("a   b\n\nc", 100)).toBe("a b c");
  });

  it("adds an ellipsis when cutting", () => {
    expect(truncate("abcdefghij", 5)).toBe("abcd…");
  });

  it("leaves short text alone", () => {
    expect(truncate("short", 20)).toBe("short");
  });
});

describe("humaniseEnum", () => {
  it("turns an enum value into a readable label", () => {
    expect(humaniseEnum("pending_review")).toBe("Pending review");
    expect(humaniseEnum("published")).toBe("Published");
  });
});
