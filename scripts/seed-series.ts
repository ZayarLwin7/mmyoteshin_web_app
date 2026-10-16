/**
 * Sample series catalogue.
 *
 *   ALLOW_DEV_SEED=1 pnpm db:seed:series
 *   ALLOW_DEV_SEED=1 pnpm db:seed:series -- --remove
 *
 * ---------------------------------------------------------------------------
 * What these records are, and what they are not
 * ---------------------------------------------------------------------------
 * Five genuine, existing American television series that are in the public
 * domain in the United States, each with an original editorial review written
 * for this site. They exist so `/series` and `/series/[slug]` have something
 * real to render, exactly as `scripts/seed-demo.ts` does for films.
 *
 * **There are no download links here, and that is deliberate.** A film or
 * series may be published with no link — the publication gate allows it, and
 * the editorial catalogue is the point. Inventing an authorization basis to
 * attach links to these series would be the one thing this project refuses to
 * do, so rather than fake it, these records publish cleanly without any.
 *
 * Posters are also left unset. The card falls back to a designed placeholder
 * carrying the title, which is honest about artwork we do not have the right
 * to display. Nothing here points at an image host that may 404.
 *
 * Every record uses a `demo-` slug prefix, so `pnpm db:seed:demo -- --remove`
 * deletes these alongside the demo films.
 */

import { config as loadEnv } from "dotenv";

import type { CurrentAdmin } from "@/lib/auth/guards";

// `@/db/client.ts` reads DATABASE_URL at module-evaluation time, so the
// environment has to be in place before the first import below.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env", override: false });

const SLUG_PREFIX = "demo-";

type SampleSeries = {
  slug: string;
  title: string;
  originalTitle: string | null;
  releaseYear: number;
  seasonCount: number;
  episodeCount: number;
  languageCode: string;
  country: string;
  contentRating: string | null;
  genres: string[];
  synopsis: string;
  metaTitle: string;
  metaDescription: string;
  reviewTitle: string;
  reviewBody: string;
  rating: number;
  reviewerName: string;
};

/**
 * Five public-domain American television series.
 *
 * Season and episode counts are the widely published figures for the original
 * American broadcasts. Each review is original writing about the series as a
 * piece of television — what it was trying to do, and where that succeeded or
 * failed — rather than a plot summary.
 */
const DEMO_SERIES: SampleSeries[] = [
  {
    slug: `${SLUG_PREFIX}the-cisco-kid`,
    title: "The Cisco Kid",
    originalTitle: null,
    releaseYear: 1950,
    seasonCount: 4,
    episodeCount: 156,
    languageCode: "en",
    country: "United States",
    contentRating: "PG",
    genres: ["western", "classic"],
    synopsis:
      "Duncan Renaldo plays the wandering caballero Cisco, with Leo Carrillo as his garrulous sidekick Pancho, in a half-hour western produced for the new medium of syndicated television. Cisco is a bandit in name only: he helps the wronged, outwits corrupt officials and, across four seasons and one hundred and fifty-six episodes, almost never fires a shot that matters. The series ran from 1950 to 1956 and reached an audience the theatrical western had largely stopped making films for.",
    metaTitle: "The Cisco Kid (1950) — series review",
    metaDescription:
      "A review of The Cisco Kid, the 1950s syndicated western starring Duncan Renaldo and Leo Carrillo.",
    reviewTitle: "A western whose hero talked his way out",
    reviewBody:
      "The Cisco Kid arrived at a strange moment for the western. The theatrical B-picture that had carried the genre for twenty years was dying on the vine, and television needed something cheap, cheerful and unambiguously good-natured to fill half an hour. What it got, over four seasons and one hundred and fifty-six episodes, was a hero who solved problems by talking.\n\nThat is the series' real invention, and it is easy to miss because the show itself never draws attention to it. Cisco carries a gun and wears the costume, but the resolution of almost every episode arrives through persuasion, bluff or Pancho's comic timing. Renaldo played him as genuinely warm rather than merely charming, and Carrillo's Pancho — fond of grandchildren, food and tall stories — is the rare sidekick with an inner life. The two of them argue like an old married couple, and the show is at its best when it simply lets them.\n\nIt is also, quietly, one of the more decent things American television did about Mexico in the 1950s. Cisco is the protagonist, not the obstacle; the villains are the gringo land-grabbers and the corrupt local officials far more often than they are anyone else, and the Spanish dialogue is treated as language rather than decoration. That was not a given in the period, and the show did not make a fuss of it.\n\nThe production is thin, as syndicated television of the era always was. Sets recur, guest casts recycle, and several episodes could be swapped with each other without anybody noticing. But the leads are relaxed and likeable, the moral temperature is kind, and a genre that had built itself on ambush and retribution here consistently chooses conversation instead. That is worth more than it sounds.",
    rating: 7.8,
    reviewerName: "MM YoteShin Editorial",
  },
  {
    slug: `${SLUG_PREFIX}science-fiction-theatre`,
    title: "Science Fiction Theatre",
    originalTitle: null,
    releaseYear: 1955,
    seasonCount: 2,
    episodeCount: 78,
    languageCode: "en",
    country: "United States",
    contentRating: "PG",
    genres: ["science-fiction", "classic"],
    synopsis:
      "An anthology series hosted by Truman Bradley, running from 1955 to 1957 across two seasons and seventy-eight episodes. Each instalment takes a single speculative idea — a machine that reads dreams, a plant that grows too fast, a sound that kills — and treats it as plausible near-future engineering rather than fantasy. The producers consulted working scientists, and the credit sequence said so.",
    metaTitle: "Science Fiction Theatre (1955) — series review",
    metaDescription:
      "A review of Science Fiction Theatre, the 1955 anthology hosted by Truman Bradley that treated speculative science as near-future engineering.",
    reviewTitle: "Science fiction that took itself seriously",
    reviewBody:
      "Science Fiction Theatre is the show that got there first and is rarely credited for it. It ran for two seasons and seventy-eight episodes between 1955 and 1957, and it made a bet that the rest of the genre took another two decades to make seriously: that speculative science is most frightening when it is presented as ordinary engineering that has simply gone one step too far.\n\nThe structure is rigid and the show knew it. Truman Bradley introduces each episode from a laboratory set, the story runs about twenty-five minutes, and somebody's experiment goes wrong in the last five. What distinguishes it is the research posture. The producers consulted practising scientists and put their names in the credits, so a story about a machine that amplifies brainwaves is built around the actual state of EEG work rather than around whatever sounded alarming. The result is a series that reads today as an odd hybrid: pulp plotting wearing the costume of a technical briefing.\n\nThat combination produces some genuinely strange television. An episode about a device that photographs dreams plays as a straightforward procedural about instrumentation. Another, about a sound frequency that causes illness, is effectively a period horror story that refuses to admit it is one. The best instalments use the anthology's brevity as a scalpel — one idea, one consequence, no time for the story to become comfortable.\n\nIt fails in the ways low-budget television always failed. Locations are handfuls of standing sets, the guest casts are drawn from a very small pool, and more than a few episodes resolve by revealing that the impossible thing was a hoax, which is a cheat the series leans on often enough to become predictable. But the ambition is real and it was unusual, and a great deal of what we now think of as the tone of serious science fiction on television starts here.",
    rating: 7.2,
    reviewerName: "MM YoteShin Editorial",
  },
  {
    slug: `${SLUG_PREFIX}sea-hunt`,
    title: "Sea Hunt",
    originalTitle: null,
    releaseYear: 1958,
    seasonCount: 4,
    episodeCount: 155,
    languageCode: "en",
    country: "United States",
    contentRating: "PG",
    genres: ["thriller", "drama", "classic"],
    synopsis:
      "Lloyd Bridges stars as Mike Nelson, a former Navy frogman turned independent diver, in a series that ran for four seasons and one hundred and fifty-five episodes between 1958 and 1961. Each episode sends Nelson underwater to recover something — a crashed aircraft, a lost payload, a body, a fortune — and the show's distinction is that it shot its action for real, in open water, with the cameras in the water too.",
    metaTitle: "Sea Hunt (1958) — series review",
    metaDescription:
      "A review of Sea Hunt, the 1958 series starring Lloyd Bridges as the diver Mike Nelson, and the syndication model it helped prove.",
    reviewTitle: "Four seasons underwater, and it looks it",
    reviewBody:
      "The first thing to say about Sea Hunt is that nobody faked anything. Lloyd Bridges, as Mike Nelson, spent four seasons and one hundred and fifty-five episodes actually underwater, and the series is a working demonstration of what that costs and what it buys. In an era when most television water was a tank and a back projection, Sea Hunt put cameras in the sea, and the difference is visible in every frame: the light behaves, the visibility degrades, and Nelson's movements have the careful, expensive slowness of somebody who cannot afford to hurry.\n\nThat physical honesty is the series' whole argument for itself. A show built on recovery work — a crashed aircraft, a sunken yacht, a lost payload — is inherently repetitive, and the writers knew it, so the interest is transferred from the plot to the doing. Bridges, who had trained as a diver for the part and continued to dive across the run, sells the work convincingly, and the show's willingness to let a sequence run long and quiet is more sophisticated than its reputation suggests.\n\nIt also quietly proved a business model. Sea Hunt was sold into syndication rather than to a network, and its success demonstrated that an action series with a repeatable format could be profitable market by market rather than through a single national slot. That is a less glamorous legacy than the diving, but it shaped what television looked like for the next twenty years.\n\nThe weaknesses are the usual ones for syndicated production: plots thin out, guest casts repeat, and the recurring female characters exist mainly to be in peril or to ask Nelson to explain what he is doing. But the central proposition — a man, a regulator, and the actual ocean — holds up, and the photography remains genuinely impressive. It is one of the few series of its decade you can watch and think, without being told, that somebody was risking something to make it.",
    rating: 7.5,
    reviewerName: "MM YoteShin Editorial",
  },
  {
    slug: `${SLUG_PREFIX}ramar-of-the-jungle`,
    title: "Ramar of the Jungle",
    originalTitle: null,
    releaseYear: 1952,
    seasonCount: 2,
    episodeCount: 52,
    languageCode: "en",
    country: "United States",
    contentRating: "PG",
    genres: ["thriller", "family", "classic"],
    synopsis:
      "Jon Hall stars as Dr. Tom Reynolds, a physician working in an unnamed African territory who is known to the local population as Ramar. Across two seasons and fifty-two episodes, from 1952 to 1954, he treats disease, defuses local conflicts and repeatedly rescues a small group of westerners who have come to the jungle with no idea how to survive in it.",
    metaTitle: "Ramar of the Jungle (1952) — series review",
    metaDescription:
      "A review of Ramar of the Jungle, the 1952 series starring Jon Hall as the physician known to locals as Ramar.",
    reviewTitle: "A jungle serial that mostly wanted to treat people",
    reviewBody:
      "Ramar of the Jungle is a show with a genuinely interesting hero and almost no idea what to do with him. Jon Hall plays Dr. Tom Reynolds, a physician in an unnamed African territory who is called Ramar by the people he treats, and across two seasons and fifty-two episodes the series keeps returning to its best idea: that the doctor's authority comes from competence rather than from a gun.\n\nWhen it commits to that, it is better than the genre's reputation allows. Episodes built around a disease, a difficult delivery or a local dispute that the western characters are making worse have a shape and a point of view. Ramar's medical knowledge is the plot, and Hall — who had played this kind of role before and knew the physical register — is credible doing it.\n\nBut the series cannot sustain it. The adventure format demands a rescue every week, so a large share of episodes devolve into Ramar extricating some visiting American from a situation that visiting American created, and the show's budget cannot support the scale those stories want. Stock footage sits uncomfortably next to location shooting, and the jungle itself is often a painted backdrop within arm's reach of a paved road.\n\nIt is also a period artefact, and a specific kind of one. The colonial frame is not incidental — the entire premise is a western doctor operating with authority in somebody else's country, and the local population is written almost entirely as grateful, superstitious or in need. That is not something the show interrogates, and it should not be watched as though it were innocent.\n\nWhat survives is the protagonist. A jungle hero whose first instinct is to treat rather than to shoot was unusual in 1952, and the episodes that trust that instinct are still worth seeing. The ones that do not are the reason the series is a curio rather than a classic.",
    rating: 6.4,
    reviewerName: "MM YoteShin Editorial",
  },
  {
    slug: `${SLUG_PREFIX}highway-patrol`,
    title: "Highway Patrol",
    originalTitle: null,
    releaseYear: 1955,
    seasonCount: 4,
    episodeCount: 156,
    languageCode: "en",
    country: "United States",
    contentRating: "PG",
    genres: ["crime", "drama", "classic"],
    synopsis:
      "Broderick Crawford stars as Dan Mathews, the commander of a state highway patrol, in a series that ran for four seasons and one hundred and fifty-six episodes between 1955 and 1959. Each episode follows an investigation from the initial report through pursuit to arrest, and the show's distinguishing feature is its procedural rigour: the work is shown as work.",
    metaTitle: "Highway Patrol (1955) — series review",
    metaDescription:
      "A review of Highway Patrol, the 1955 series starring Broderick Crawford as highway patrol commander Dan Mathews.",
    reviewTitle: "The procedural before there were procedurals",
    reviewBody:
      "Highway Patrol is one of those series whose influence is easier to describe than to watch, and that is unfair to it. Broderick Crawford plays Dan Mathews, the commander of a state highway patrol, across four seasons and one hundred and fifty-six episodes, and the show's method is essentially the one every police procedural has used since: a case opens, the work is shown, and the case closes with an arrest.\n\nWhat makes it more than a historical footnote is how seriously it takes that method. The episodes are built from the actual logistics of police work — radio traffic, coordinating cars, canvassing a stretch of road, waiting for a lab result — and the show is willing to spend long stretches on the dull part. Crawford's Mathews is a commander rather than a street officer, which gives the series an unusual second gear: he can be in the operations room directing a pursuit and in the field an hour later, and the show uses that to show the same case from both ends.\n\nThe car chases are the reason most people remember it, and they are good — genuinely good, shot on real roads with real speed, in an era when that meant something. But they are the exception rather than the rule, and the series is more interested in the pursuit than in the catch, which is a more modern instinct than anything else in it.\n\nIt has the problems of its moment and its budget. The criminals are types, the dialogue is functional, and the show's view of policing is unambiguous in a way that reads very differently now. What holds up is the craft of the format: the confidence that a case told in order, with the tedious parts included, is more interesting than a case told for effect. We are still watching the consequences of that idea.",
    rating: 7.6,
    reviewerName: "MM YoteShin Editorial",
  },
];

async function main() {
  const { db, sql } = await import("@/db/client");
  const { and, eq, like } = await import("drizzle-orm");
  const { adminProfiles, adminUsers, genres, movies } = await import("@/db/schema");
  const { createMovie, publishMovie } = await import("@/lib/services/movies");
  const { createReview } = await import("@/lib/services/reviews");

  /*
   * Close the pool on the way out, whichever branch we leave by.
   *
   * The session pooler caps the whole Supabase project at 15 connections, and a
   * script that exits without closing leaves an idle backend holding one of
   * them for minutes. That has already broken a build here with EMAXCONNSESSION.
   */
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      void sql.end({ timeout: 5 }).finally(() => process.exit(1));
    });
  }

  const remove = process.argv.includes("--remove");

  if (process.env.NODE_ENV === "production") {
    console.error("\n  Refusing to seed: NODE_ENV is production.\n");
    process.exit(1);
  }

  if (process.env.ALLOW_DEV_SEED !== "1") {
    console.error(
      "\n  Refusing to seed.\n" +
        "  This script writes published records. Set ALLOW_DEV_SEED=1 to confirm:\n\n" +
        "      ALLOW_DEV_SEED=1 pnpm db:seed:series\n",
    );
    process.exit(1);
  }

  /* ---- Removal mode ------------------------------------------------------ */

  if (remove) {
    // Matched on the slug prefix plus the content kind, so this removes exactly
    // the series this script created and never touches the demo films, which
    // share the prefix. `--remove` on the film script has the same guarantee
    // from the other side.
    const deleted = await db
      .delete(movies)
      .where(and(like(movies.slug, `${SLUG_PREFIX}%`), eq(movies.contentKind, "series")))
      .returning({ slug: movies.slug, title: movies.title });

    console.log(
      deleted.length === 0
        ? "\n  Nothing to remove — no demo series found.\n"
        : `\n  Removed ${deleted.length} demo series, with their reviews and genre rows:\n` +
            deleted.map((row) => `    - ${row.title} (${row.slug})`).join("\n") +
            "\n",
    );
    await sql.end({ timeout: 5 });
    return;
  }

  /* ---- The actor every write is attributed to ---------------------------- */

  const ownerRows = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      displayName: adminUsers.displayName,
      role: adminProfiles.role,
    })
    .from(adminUsers)
    .innerJoin(adminProfiles, eq(adminProfiles.userId, adminUsers.id))
    .where(and(eq(adminProfiles.role, "owner"), eq(adminUsers.isActive, true)))
    .limit(1);

  const actor = ownerRows[0] as CurrentAdmin | undefined;
  if (!actor) {
    console.error(
      "\n  No active owner account found.\n" +
        "  Create one first:\n\n" +
        '      pnpm run admin:create -- --name "Site Owner" --role owner\n',
    );
    process.exit(1);
  }

  console.log(`\n  Acting as ${actor.email} (${actor.role}).`);

  /* ---- Genres ------------------------------------------------------------ */

  const genreRows = await db.select({ id: genres.id, slug: genres.slug }).from(genres);
  const genreIdBySlug = new Map(genreRows.map((row) => [row.slug, row.id]));

  /* ---- Series ------------------------------------------------------------ */

  let created = 0;
  let skipped = 0;
  let resumed = 0;

  const { reviews } = await import("@/db/schema");

  for (const series of DEMO_SERIES) {
    const existing = await db
      .select({ id: movies.id, status: movies.status })
      .from(movies)
      .where(eq(movies.slug, series.slug))
      .limit(1);

    /*
     * Resume rather than skip a half-finished record.
     *
     * A previous run can leave a draft behind — the pooler runs out of
     * connections, or the run is interrupted — and a plain "already present"
     * check would leave that series stuck as a draft forever, invisible on the
     * public site. If the record exists but is not published, the script picks
     * up where it stopped: it makes sure the review is there, then publishes.
     */
    if (existing.length > 0 && existing[0].status === "published") {
      skipped += 1;
      console.log(`  skip:    ${series.title} (already published)`);
      continue;
    }

    const genreIds = series.genres
      .map((slug) => genreIdBySlug.get(slug))
      .filter((id): id is string => Boolean(id));

    if (genreIds.length === 0) {
      throw new Error(`No genres resolved for "${series.title}". Run pnpm db:seed first.`);
    }

    // An interrupted run may have written the record but not the review.
    const movieId = existing.length > 0 ? existing[0].id : null;
    if (movieId) {
      const reviewRows = await db
        .select({ id: reviews.id })
        .from(reviews)
        .where(eq(reviews.movieId, movieId))
        .limit(1);

      if (reviewRows.length === 0) {
        await createReview(
          {
            movieId,
            reviewTitle: series.reviewTitle,
            body: series.reviewBody,
            rating: series.rating,
            ratingSource: "editorial",
            reviewerName: series.reviewerName,
            status: "published",
          },
          actor,
        );
        console.log(`  review:  wrote the missing review for "${series.title}"`);
      }
    }

    // 1. Create as a draft. `createMovie` forces draft status by design.
    const movie = movieId
      ? { id: movieId }
      : await createMovie(
          {
            title: series.title,
            slug: series.slug,
            originalTitle: series.originalTitle,
            releaseYear: series.releaseYear,
            releaseDate: null,
            contentKind: "series",
            seasonCount: series.seasonCount,
            episodeCount: series.episodeCount,
            // No runtime: this is a series, and the count of seasons and episodes
            // is the honest description of its length.
            runtimeMinutes: null,
            synopsis: series.synopsis,
            editorialNote: null,
            // No poster and no backdrop. There is no artwork here that we have the
            // right to display, and an invented URL would render as a broken image.
            // The card falls back to a designed placeholder carrying the title.
            posterUrl: null,
            backdropUrl: null,
            imageCredit: null,
            languageCode: series.languageCode,
            country: series.country,
            contentRating: series.contentRating,
            metaTitle: series.metaTitle,
            metaDescription: series.metaDescription,
            featured: false,
            curationWeight: 0,
            status: "draft",
            genreIds,
          },
          actor,
        );

    // 2. The published review the gate requires, at least 200 characters.
    if (!movieId) {
      await createReview(
        {
          movieId: movie.id,
          reviewTitle: series.reviewTitle,
          body: series.reviewBody,
          rating: series.rating,
          ratingSource: "editorial",
          reviewerName: series.reviewerName,
          status: "published",
        },
        actor,
      );
    }

    // 3. No download links. A series may publish with none, and nothing here
    // invents an authorization basis.

    // 4. Publish. This re-runs the gate and throws if anything is missing.
    await publishMovie(movie.id, actor);

    if (movieId) {
      resumed += 1;
      console.log(`  resumed: published the unfinished draft "${series.title}"`);
    } else {
      created += 1;
    }
    console.log(
      `  series:  published "${series.title}" (${series.releaseYear}) — ` +
        `${series.seasonCount} season${series.seasonCount === 1 ? "" : "s"}, ` +
        `${series.episodeCount} episodes, score ${series.rating}/10`,
    );
  }

  console.log(
    `\n  ${created} series published, ${resumed} resumed from a previous run, ` +
      `${skipped} already published.\n` +
      "  Every record was written through the service layer, so the publication\n" +
      "  gate and the audit trail ran as they would for a human editor.\n" +
      "\n  These carry no download links, by design. Remove before launch:\n" +
      "      ALLOW_DEV_SEED=1 pnpm db:seed:series -- --remove\n",
  );

  await sql.end({ timeout: 5 });
}

main().catch((error) => {
  console.error("\n  Series seed failed.");
  const message = error instanceof Error ? error.message : String(error);
  console.error(`  ${message.replace(/:\/\/[^@]*@/g, "://***:***@")}\n`);

  // Surface the underlying database error, which Drizzle otherwise hides
  // behind the query text. Without this a constraint violation and a syntax
  // error look identical from a script.
  const cause = (error as { cause?: unknown }).cause;
  if (cause) {
    console.error(`  Cause: ${String((cause as Error)?.message ?? cause)}\n`);
  }

  /*
   * Close the pool before exiting.
   *
   * `process.exit` tears the process down without letting `postgres.js` return
   * its connections, and every leaked idle backend holds one of the session
   * pooler's fifteen slots until Supavisor reclaims it. Enough failed runs in a
   * row will exhaust the cap and the *next* build fails with EMAXCONNSESSION —
   * which is exactly how this was found.
   */
  void (async () => {
    const { sql } = await import("@/db/client");
    await sql.end({ timeout: 5 }).catch(() => {});
    process.exit(1);
  })();
});
