import { describe, expect, it } from "vitest";

import { slugify, slugifyWithSuffix } from "@/lib/utils";

describe("slugify", () => {
  it("lower-cases and hyphenates a plain title", () => {
    expect(slugify("The Quiet Harbour")).toBe("the-quiet-harbour");
  });

  it("collapses runs of punctuation and whitespace into a single hyphen", () => {
    expect(slugify("Blade   Runner — 2049!!")).toBe("blade-runner-2049");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  ...Heat...  ")).toBe("heat");
  });

  it("strips Latin diacritics rather than dropping the letters", () => {
    expect(slugify("Amélie")).toBe("amelie");
    expect(slugify("Bāhubali")).toBe("bahubali");
  });

  it("preserves non-Latin scripts instead of emptying the slug", () => {
    // The catalogue carries Burmese, Thai and CJK titles. Stripping them would
    // produce an empty slug and an unusable URL, so letters are kept.
    const burmese = slugify("ရုပ်ရှင်");
    expect(burmese.length).toBeGreaterThan(0);
    expect(burmese).not.toContain("-");

    const japanese = slugify("七人の侍");
    expect(japanese).toBe("七人の侍");

    const thai = slugify("ภาพยนตร์");
    expect(thai.length).toBeGreaterThan(0);
  });

  it("keeps digits", () => {
    expect(slugify("1917")).toBe("1917");
  });

  it("returns an empty string for input with no usable characters", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  it("respects the maximum length", () => {
    const long = "a".repeat(200);
    expect(slugify(long, 20)).toHaveLength(20);
  });

  it("does not leave a trailing hyphen after truncation", () => {
    // Truncating mid-word would otherwise produce "some-title-here-".
    const value = slugify("some title here and more words", 15);
    expect(value.endsWith("-")).toBe(false);
  });
});

describe("slugifyWithSuffix", () => {
  it("appends the suffix with a separator", () => {
    expect(slugifyWithSuffix("Heat", "2")).toBe("heat-2");
  });

  it("uses the suffix alone when the base slug is empty", () => {
    expect(slugifyWithSuffix("!!!", "film")).toBe("film");
  });

  it("keeps the combined result within the length budget", () => {
    const result = slugifyWithSuffix("a".repeat(120), "999", 40);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result.endsWith("-999")).toBe(true);
  });

  it("produces a distinct value from the unsuffixed slug", () => {
    expect(slugifyWithSuffix("Heat", "2")).not.toBe(slugify("Heat"));
  });
});
