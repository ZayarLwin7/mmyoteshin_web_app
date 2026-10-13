import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A safety control that is defined but never called is invisible to every
 * functional test — the code compiles, the suite is green, and nothing reports
 * a problem, because nothing ever exercises the path that was supposed to use
 * it.
 *
 * That exact failure happened here: `rateLimitSearch` existed, was documented
 * in `.env.example`, and had a unit-tested pure half, but `/search` never
 * called it. The result was a public route running `ILIKE '%term%'` — a
 * leading-wildcard scan that cannot use an index — with no throttle, against a
 * database in another region. Spec §9 requires authentication, search and
 * reporting to be rate-limited.
 *
 * These tests read the source and assert the call sites exist. They are
 * deliberately a structural check: the behaviour of the limiter itself is
 * covered by `rate-limit.test.ts` and the end-to-end suite, and only a
 * source-level assertion can catch "nobody wired it up".
 */

// Vitest runs from the project root, so `src` is reachable relative to cwd.
// (`import.meta.url` is not a file URL under the jsdom environment.)
const SRC = join(process.cwd(), "src");

function source(...segments: string[]): string {
  return readFileSync(join(SRC, ...segments), "utf8");
}

/** Strip comments so a mention in prose is not enough to satisfy these tests. */
function code(raw: string): string {
  return raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const LIMITS = [
  {
    scope: "authentication",
    call: "rateLimitAuth",
    callFile: ["lib", "actions", "auth.ts"],
    callFileLabel: "src/lib/actions/auth.ts",
  },
  {
    scope: "reporting",
    call: "rateLimitReport",
    callFile: ["lib", "actions", "report.ts"],
    callFileLabel: "src/lib/actions/report.ts",
  },
  {
    scope: "search",
    call: "rateLimitSearch",
    callFile: ["app", "search", "page.tsx"],
    callFileLabel: "src/app/search/page.tsx",
  },
];

describe("rate limiting is wired to every endpoint the specification names", () => {
  for (const limit of LIMITS) {
    it(`${limit.scope} limiter is invoked from ${limit.callFileLabel}`, () => {
      const body = code(source(...limit.callFile));

      // A bare reference is not enough — it must be called with arguments,
      // because a limiter that is imported and ignored builds just as happily.
      expect(body).toMatch(new RegExp(`${limit.call}\\s*\\(`));
    });

    it(`${limit.scope} limiter is exported by the rate-limit module`, () => {
      const rateLimitModule = code(source("lib", "security", "rate-limit.ts"));

      expect(rateLimitModule).toMatch(
        new RegExp(`export\\s+(async\\s+)?function\\s+${limit.call}\\s*\\(`),
      );
    });
  }
});

describe("the search route enforces its limit before querying", () => {
  const searchPage = code(source("app", "search", "page.tsx"));

  it("consumes the limit before the catalogue query runs", () => {
    // Order matters: if the query were started first, the damage would already
    // be done by the time the limit was checked.
    const limitIndex = searchPage.indexOf("rateLimitSearch(");
    const queryIndex = searchPage.indexOf("listPublishedMovies(");

    expect(limitIndex).toBeGreaterThan(-1);
    expect(queryIndex).toBeGreaterThan(-1);
    expect(limitIndex).toBeLessThan(queryIndex);
  });

  it("returns without issuing the catalogue query when the limit is exceeded", () => {
    // The `if (!limit.allowed) return …` short-circuit is what makes this a
    // control rather than a counter.
    expect(searchPage).toMatch(/if\s*\(!limit\.allowed\)\s*\{/);
    expect(searchPage).toMatch(/return\s*\(/);
  });
});
