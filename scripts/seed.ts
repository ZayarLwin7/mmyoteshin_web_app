/**
 * Development seed.
 *
 *   ALLOW_DEV_SEED=1 pnpm db:seed
 *
 * Guardrails, because seed data must never reach production:
 *
 *   * Refuses to run unless ALLOW_DEV_SEED=1 is set explicitly.
 *   * Refuses to run when NODE_ENV=production.
 *   * Creates ONLY genres and sample films in `draft` status.
 *   * Creates NO reviews and NO download links — fabricated editorial copy and
 *     invented "authorized" links are exactly what the content policy forbids.
 *     Because a published film requires a review, nothing seeded here can
 *     become publicly visible without a human writing real content first.
 *
 * Every seeded film is prefixed "[Sample]" so it is unmistakable in the admin
 * list, and uses a placeholder image host that is not in the image allowlist —
 * the card falls back to the built-in placeholder, which is the intended look
 * for a record with no licensed artwork.
 */

import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env", override: false });

const GENRES = [
  { name: "Drama", slug: "drama", description: "Character-driven stories and human conflict." },
  {
    name: "Documentary",
    slug: "documentary",
    description: "Non-fiction filmmaking and reportage.",
  },
  {
    name: "Animation",
    slug: "animation",
    description: "Drawn, modelled and computer-generated film.",
  },
  {
    name: "Science Fiction",
    slug: "science-fiction",
    description: "Speculative futures and imagined technology.",
  },
  { name: "Crime", slug: "crime", description: "Investigations, heists and the criminal world." },
  { name: "Classic", slug: "classic", description: "Landmark films whose influence endures." },
];

const SAMPLE_MOVIES = [
  {
    title: "[Sample] The Quiet Harbour",
    slug: "sample-the-quiet-harbour",
    original_title: null,
    release_year: 1974,
    runtime_minutes: 118,
    language_code: "en",
    country: "United Kingdom",
    content_rating: "PG",
    synopsis:
      "Placeholder synopsis. Replace this text with original editorial copy before publishing. This record exists only so the admin workflow and the public templates have something to render during development.",
    genres: ["drama", "classic"],
  },
  {
    title: "[Sample] Northern Lights, Recorded",
    slug: "sample-northern-lights-recorded",
    original_title: null,
    release_year: 2019,
    runtime_minutes: 92,
    language_code: "en",
    country: "Canada",
    content_rating: "U",
    synopsis:
      "Placeholder synopsis. Replace this text with original editorial copy before publishing. This record exists only so the catalogue filters, search and pagination have data to work with.",
    genres: ["documentary"],
  },
  {
    title: "[Sample] Paper Cities",
    slug: "sample-paper-cities",
    original_title: null,
    release_year: 2021,
    runtime_minutes: 104,
    language_code: "en",
    country: "Japan",
    content_rating: "12",
    synopsis:
      "Placeholder synopsis. Replace this text with original editorial copy before publishing. This record exists only to exercise the genre and year collection pages during development.",
    genres: ["animation", "science-fiction"],
  },
  {
    title: "[Sample] The Long Ledger",
    slug: "sample-the-long-ledger",
    original_title: null,
    release_year: 1998,
    runtime_minutes: 131,
    language_code: "en",
    country: "United States",
    content_rating: "15",
    synopsis:
      "Placeholder synopsis. Replace this text with original editorial copy before publishing. This record exists only to exercise the admin draft-to-publish workflow during development.",
    genres: ["crime", "drama"],
  },
];

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("\n  Refusing to seed: NODE_ENV is production.\n");
    process.exit(1);
  }

  if (process.env.ALLOW_DEV_SEED !== "1") {
    console.error(
      "\n  Refusing to seed.\n" +
        "  This script writes sample records. Re-run with:\n\n" +
        "      ALLOW_DEV_SEED=1 pnpm db:seed\n",
    );
    process.exit(1);
  }

  const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("\n  Missing DATABASE_URL. See .env.example.\n");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1, prepare: false, ssl: "require", onnotice: () => {} });

  try {
    let genreCount = 0;
    for (const [index, genre] of GENRES.entries()) {
      const result = await sql`
        insert into genres (name, slug, description, display_order)
        values (${genre.name}, ${genre.slug}, ${genre.description}, ${index})
        on conflict (slug) do nothing
        returning id
      `;
      genreCount += result.length;
    }
    console.log(`  genres:  ${genreCount} created, ${GENRES.length - genreCount} already present`);

    let movieCount = 0;
    for (const movie of SAMPLE_MOVIES) {
      const inserted = await sql<{ id: string }[]>`
        insert into movies (
          title, slug, original_title, release_year, runtime_minutes,
          language_code, country, content_rating, synopsis, status
        )
        values (
          ${movie.title}, ${movie.slug}, ${movie.original_title}, ${movie.release_year},
          ${movie.runtime_minutes}, ${movie.language_code}, ${movie.country},
          ${movie.content_rating}, ${movie.synopsis}, 'draft'
        )
        on conflict (slug) do nothing
        returning id
      `;

      const movieId = inserted[0]?.id;
      if (!movieId) continue;
      movieCount += 1;

      for (const genreSlug of movie.genres) {
        await sql`
          insert into movie_genres (movie_id, genre_id)
          select ${movieId}, id from genres where slug = ${genreSlug}
          on conflict do nothing
        `;
      }
    }
    console.log(`  movies:  ${movieCount} created as drafts (no reviews, no links)`);

    console.log(
      "\n  Sample data seeded. Nothing here is publicly visible — publishable\n" +
        "  films need real metadata, an original review and authorized links.\n",
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("\nSeeding failed.");
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/:\/\/[^@]*@/g, "://***:***@"));
  process.exit(1);
});
