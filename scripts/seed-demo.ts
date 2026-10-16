/**
 * Development demo catalogue.
 *
 *   ALLOW_DEV_SEED=1 pnpm db:seed:demo
 *   ALLOW_DEV_SEED=1 pnpm db:seed:demo -- --remove
 *
 * ---------------------------------------------------------------------------
 * Why this is not the same thing as fabricating content
 * ---------------------------------------------------------------------------
 * `scripts/seed.ts` deliberately creates drafts only, because invented films,
 * invented reviews and invented authorization bases are exactly what the
 * content policy forbids. This script exists because the public templates need
 * something real to render during development, and it satisfies the policy
 * rather than working around it:
 *
 *   * Every film is a genuine, existing film that is free to distribute — either
 *     public domain in the United States, or released under a Creative Commons
 *     licence by its rights holder.
 *   * Every review is original writing about that real film.
 *   * The recorded authorization basis is true for each title: `public_domain`
 *     or `open_license`. Neither is a placeholder standing in for a licence we
 *     do not have.
 *   * File sizes and resolutions in the download table are read from the
 *     Internet Archive metadata API — they are the actual encodes, not
 *     invented numbers.
 *   * Every destination was checked to resolve (HTTP 200) when this file was
 *     written.
 *
 * Nothing here should survive into production. Every record uses a `demo-` slug
 * prefix so `--remove` deletes exactly what this script created.
 *
 * ---------------------------------------------------------------------------
 * Guardrails
 * ---------------------------------------------------------------------------
 *   * Refuses to run unless ALLOW_DEV_SEED=1 is set explicitly.
 *   * Refuses to run when NODE_ENV=production.
 *   * Writes through the service layer, so the publication gate, the
 *     authorization checks and the audit trail all run exactly as they would
 *     for a human editor. If the gate would reject this content, this script
 *     fails — it cannot create a record the admin UI could not.
 */

import { config as loadEnv } from "dotenv";

import type { CurrentAdmin } from "@/lib/auth/guards";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env", override: false });

const SLUG_PREFIX = "demo-";

/** Genres this script may add, on top of whatever `seed.ts` already created. */
/**
 * Genres the demo catalogue needs that `scripts/seed.ts` does not create.
 *
 * `displayOrder` continues after the six canonical genres (which that script
 * numbers 0–5 by array index) so the demo-only genres sort after them on
 * /genres rather than colliding at 0 and falling back to alphabetical order.
 */
const EXTRA_GENRES = [
  {
    name: "Superhero",
    slug: "superhero",
    description: "Costumed heroes and superhuman conflict.",
    displayOrder: 6,
  },
  {
    name: "Romance",
    slug: "romance",
    description: "Love, courtship and relationships.",
    displayOrder: 7,
  },
  {
    name: "Thriller",
    slug: "thriller",
    description: "Suspense, pursuit and jeopardy.",
    displayOrder: 8,
  },
  {
    name: "Musical",
    slug: "musical",
    description: "Song, dance and staged performance.",
    displayOrder: 9,
  },
  {
    name: "Western",
    slug: "western",
    description: "The frontier and the American West.",
    displayOrder: 10,
  },
  {
    name: "Family",
    slug: "family",
    description: "Films made for a general or young audience.",
    displayOrder: 11,
  },
  {
    name: "Fantasy",
    slug: "fantasy",
    description: "Magic, myth and imagined worlds.",
    displayOrder: 12,
  },
];

type DemoLink = {
  provider: string;
  label: string;
  /** Real byte size of the file, from the Internet Archive metadata API. */
  fileSizeBytes: number;
  /** Real pixel height of the encode, from the same source. */
  height: number;
};

type DemoFilm = {
  slug: string;
  title: string;
  originalTitle: string | null;
  releaseYear: number;
  runtimeMinutes: number;
  languageCode: string;
  country: string;
  genres: string[];
  featured: boolean;
  curationWeight: number;
  synopsis: string;
  metaTitle: string;
  metaDescription: string;
  reviewTitle: string;
  reviewBody: string;
  rating: number;
  reviewerName: string;
  /** Internet Archive identifier, verified to resolve. */
  archiveId: string;
  /**
   * Site-relative path to a poster in `public/posters/`.
   *
   * These were hotlinked from Wikimedia Commons originally, which failed in
   * practice: the optimiser has a fetch timeout and the Tears of Steel original
   * is a 15 MB PNG, so that poster returned 504; several others were
   * intermittently 429 by Wikimedia's rate limiter. They are now vendored at
   * max 800px, which took the set from ~25 MB to ~1.4 MB and removed the
   * third-party dependency entirely. Serving artwork from our own origin is
   * also what a production catalogue should do.
   *
   * `imageCredit` still names the real source, which CC BY requires.
   */
  posterUrl: string;
  imageCredit: string;
  /** Truthful statement of why we may distribute this, and where to check. */
  authorizationReference: string;
  authorizationBasis: "public_domain" | "open_license";
  links: DemoLink[];
};

/** Map a real pixel height to the label shown in the Resolution column. */
function qualityLabel(height: number): string {
  if (height >= 1000) return "1080p";
  if (height >= 700) return "720p";
  if (height >= 460) return "480p";
  if (height >= 350) return "360p";
  return "240p";
}

/**
 * Eight films that are free to distribute, all in colour.
 *
 * Two routes to freedom are represented, and both are recorded precisely:
 *   - Copyright expired or was forfeited (the public-domain titles).
 *   - Released by the rights holder under a Creative Commons licence (the two
 *     Blender Foundation films).
 */
const DEMO_FILMS: DemoFilm[] = [
  {
    slug: `${SLUG_PREFIX}the-mechanical-monsters`,
    title: "The Mechanical Monsters",
    originalTitle: null,
    releaseYear: 1941,
    runtimeMinutes: 9,
    languageCode: "en",
    country: "United States",
    genres: ["superhero", "animation", "classic"],
    featured: true,
    curationWeight: 100,
    synopsis:
      "A masked scientist sends an army of flying robots to loot the city's banks, and Superman has to stop them. The second of the Fleischer studio's theatrical Superman shorts, it is still the most quoted piece of superhero animation ever drawn — the robots' furnace-mouthed descent on the bank vault is the sequence every later adaptation borrows from, and the Art Deco cityscapes remain the visual template for Metropolis on screen.",
    metaTitle: "The Mechanical Monsters (1941) — review and authorized sources",
    metaDescription:
      "The Fleischer studio's 1941 Superman short, reviewed, with a verified public-domain source.",
    reviewTitle: "The template for every superhero cartoon",
    reviewBody:
      "The Fleischers were animators who thought like engineers, and it shows: the robots in this short have visible mechanisms, articulated joints and a real sense of weight, so the fantasy reads as machinery rather than magic. When they float down the bank facade and prise open the vault, the film is doing something no live-action production of 1941 could have attempted.\n\nSuperman himself is treated as a piece of physics. He arrives, absorbs the impact, and leaves; the drama is entirely in how much punishment the world can throw at him in nine minutes. The characterisation is minimal and the pacing is ruthless, which is exactly why the short still plays to an audience eighty years later.\n\nThe Fleischer shorts fell into the public domain when National Comics failed to renew the copyrights. That accident is the only reason this material is freely available today, and it is worth saying plainly: the loss to the rights holders is our gain.",
    rating: 8.5,
    reviewerName: "MM YoteShin Editorial",
    archiveId: "the-mechanical-monsters-1941",
    posterUrl: "/posters/demo-the-mechanical-monsters.jpg",
    imageCredit: "Publicity still from The Mechanical Monsters (1941), via Wikimedia Commons.",
    authorizationReference:
      "Public domain in the United States: National Comics (later DC) failed to renew the copyright on the Fleischer Superman shorts. Internet Archive item: the-mechanical-monsters-1941.",
    authorizationBasis: "public_domain",
    links: [
      {
        provider: "Internet Archive",
        label: "1080p transfer",
        fileSizeBytes: 207212587,
        height: 1080,
      },
    ],
  },
  {
    slug: `${SLUG_PREFIX}superman`,
    title: "Superman",
    originalTitle: null,
    releaseYear: 1941,
    runtimeMinutes: 10,
    languageCode: "en",
    country: "United States",
    genres: ["superhero", "animation", "classic"],
    featured: true,
    curationWeight: 95,
    synopsis:
      "The first of the Fleischer Superman shorts, in which a mad scientist's ray gun destroys a bridge and a dam and the Man of Steel has to hold the city together. It opens with the origin — Krypton, the rocket, the Kents — compressed into about ninety seconds, and then spends the rest of its running time on destruction rendered with a seriousness that live action would not manage for another thirty years.",
    metaTitle: "Superman (1941) — review and authorized sources",
    metaDescription:
      "The first Fleischer Superman short, reviewed, with a verified public-domain source at the Internet Archive.",
    reviewTitle: "The origin, in ninety seconds",
    reviewBody:
      "What is most striking about the first Fleischer short is its economy. The entire origin story — the dying planet, the rocket, the foundling — is dispatched in a minute and a half of almost wordless imagery, and the film then commits itself entirely to the spectacle of a man being asked to hold up infrastructure that is failing around him.\n\nThe destruction is animated with real conviction. The bridge collapses, the dam bursts, and the film gives the water and the falling steel enough screen time that you feel the scale rather than being told about it. The Fleischers had spent the thirties building a house style out of depth and movement, and here it is applied to material that had never been animated before.\n\nSeen now, it is a reminder of how much of the modern superhero film's grammar was settled in ten minutes of 1941 animation. The Fleischer shorts are public domain because the copyrights were not renewed — an accident of paperwork that preserved the most influential superhero animation ever made.",
    rating: 8,
    reviewerName: "MM YoteShin Editorial",
    archiveId: "superman_1941",
    posterUrl: "/posters/demo-superman.png",
    imageCredit: "Title card from Superman (1941), via Wikimedia Commons.",
    authorizationReference:
      "Public domain in the United States: National Comics failed to renew the copyright on the Fleischer Superman shorts. Internet Archive item: superman_1941.",
    authorizationBasis: "public_domain",
    links: [
      {
        provider: "Internet Archive",
        label: "Standard definition transfer",
        fileSizeBytes: 45224702,
        height: 240,
      },
    ],
  },
  {
    slug: `${SLUG_PREFIX}charade`,
    title: "Charade",
    originalTitle: null,
    releaseYear: 1963,
    runtimeMinutes: 113,
    languageCode: "en",
    country: "United States",
    genres: ["romance", "thriller", "classic"],
    featured: true,
    curationWeight: 90,
    synopsis:
      "A woman discovers that her murdered husband stole a fortune, that four men intend to take it from her, and that every man who offers to help — including the charming stranger played by Cary Grant — is lying about something. Stanley Donen directs it as a romantic comedy that keeps turning into a thriller and back again, and it is regularly described as the best Hitchcock film Hitchcock never made.",
    metaTitle: "Charade (1963) — review and authorized sources",
    metaDescription:
      "Stanley Donen's romantic thriller with Cary Grant and Audrey Hepburn, reviewed, with a verified public-domain source.",
    reviewTitle: "A romance that keeps becoming a thriller",
    reviewBody:
      "Charade works because it refuses to choose. The Grant and Hepburn scenes are played as screwball courtship, complete with banter about whether he is too old for her, and then the same scene will end with somebody dead. Donen cuts between the two registers so quickly that the film's charm and its menace become the same quality.\n\nGrant is cast against his own image — a man whose name changes every twenty minutes and whose story never quite adds up — and Hepburn plays the only person in the film who is telling the truth, which makes her the most vulnerable figure on screen. The Paris locations are used as a joke about tourism rather than as postcard scenery.\n\nThe film is in the public domain because Universal released it without the required copyright notice, an omission that was litigated and never fully resolved. That is why a major studio picture with two of the biggest stars in Hollywood is freely available, and why this listing can exist.",
    rating: 8.5,
    reviewerName: "MM YoteShin Editorial",
    archiveId: "la35ca-Cinema_35_-_Charade_1963",
    posterUrl: "/posters/demo-charade.jpg",
    imageCredit: "Theatrical poster for Charade (1963), via Wikimedia Commons.",
    authorizationReference:
      "Public domain in the United States: released in 1963 without the required copyright notice, so protection was forfeited. Internet Archive item: la35ca-Cinema_35_-_Charade_1963.",
    authorizationBasis: "public_domain",
    links: [
      {
        provider: "Internet Archive",
        label: "Standard definition transfer",
        fileSizeBytes: 733582201,
        height: 480,
      },
    ],
  },
  {
    slug: `${SLUG_PREFIX}royal-wedding`,
    title: "Royal Wedding",
    originalTitle: null,
    releaseYear: 1951,
    runtimeMinutes: 93,
    languageCode: "en",
    country: "United States",
    genres: ["romance", "musical", "classic"],
    featured: true,
    curationWeight: 85,
    synopsis:
      "A brother-and-sister dance act sails to London for the 1947 royal wedding and each falls in love with the wrong person. The plot is thin on purpose: the film exists for its numbers, including the famous sequence in which Fred Astaire dances on the ceiling of his hotel room — a trick achieved with a rotating set built inside a real elevator shaft, and still one of the most charming pieces of practical effects work in the Hollywood musical.",
    metaTitle: "Royal Wedding (1951) — review and authorized sources",
    metaDescription:
      "Fred Astaire and Jane Powell in Stanley Donen's musical, reviewed, with a verified public-domain source.",
    reviewTitle: "The ceiling dance, and why it still works",
    reviewBody:
      "The ceiling number is the reason anyone remembers Royal Wedding, and it earns its reputation. Astaire does not simply float upward — the film lets you see him work out how to move in a room that has turned over, testing the furniture and finding his balance, and the effect is funny because it is played as a problem to be solved rather than as a miracle.\n\nThe rest of the film is a gentle, slightly melancholy story about a working partnership that has to survive the two people in it falling in love with other people. Jane Powell is given real material rather than decorative numbers, and the sibling act's professional intimacy is treated as something worth protecting.\n\nIt is in the public domain because MGM did not renew the copyright. That is why one of the most technically inventive musicals of its decade is available to watch freely.",
    rating: 7.5,
    reviewerName: "MM YoteShin Editorial",
    archiveId: "royal-wedding-1951-by-stanley-donen",
    posterUrl: "/posters/demo-royal-wedding.jpg",
    imageCredit: "Fred Astaire in Royal Wedding (1951), via Wikimedia Commons.",
    authorizationReference:
      "Public domain in the United States: the copyright was not renewed, so protection lapsed. Internet Archive item: royal-wedding-1951-by-stanley-donen.",
    authorizationBasis: "public_domain",
    links: [
      {
        provider: "Internet Archive",
        label: "High definition transfer",
        fileSizeBytes: 1664964125,
        height: 1072,
      },
    ],
  },
  {
    slug: `${SLUG_PREFIX}gullivers-travels`,
    title: "Gulliver's Travels",
    originalTitle: null,
    releaseYear: 1939,
    runtimeMinutes: 76,
    languageCode: "en",
    country: "United States",
    genres: ["animation", "family", "fantasy", "classic"],
    featured: true,
    curationWeight: 80,
    synopsis:
      "A shipwrecked sailor washes up on the shore of Lilliput, where the inhabitants are six inches tall and the neighbouring island of Blefuscu is preparing for war over which end of a boiled egg should be opened. The Fleischer studio's first feature, made to answer Disney's Snow White, and the first American animated feature not produced by Disney.",
    metaTitle: "Gulliver's Travels (1939) — review and authorized sources",
    metaDescription:
      "The Fleischer studio's animated feature, reviewed, with a verified public-domain source at the Internet Archive.",
    reviewTitle: "The Fleischers answer Disney",
    reviewBody:
      "Gulliver's Travels is a fascinating near-miss. The Fleischer studio had built its reputation on urban grit and jazz — Betty Boop, Popeye, and a New York sensibility that Disney could not touch — and here it attempts a full-length fairy tale with a score, a chorus and a romance, which is not what its animators were best at.\n\nWhat survives is the scale gags. Gulliver is drawn and animated so that his size reads as genuinely enormous next to the Lilliputians, and the film finds a hundred small ways to make that funny — the scaffolding, the ropes, the sheer logistics of moving a man. The sequence where the Lilliputians tie him down is the film's best sustained piece of comic invention.\n\nIt was a major success on release and it is in the public domain because the copyright was not renewed. It is worth watching as the moment American animation briefly had two studios with feature ambitions instead of one.",
    rating: 7,
    reviewerName: "MM YoteShin Editorial",
    archiveId: "gullivers-travels-1939-1080p-blu-ray",
    posterUrl: "/posters/demo-gullivers-travels.jpg",
    imageCredit: "Theatrical poster for Gulliver's Travels (1939), via Wikimedia Commons.",
    authorizationReference:
      "Public domain in the United States: the copyright was not renewed, so protection lapsed. Internet Archive item: gullivers-travels-1939-1080p-blu-ray.",
    authorizationBasis: "public_domain",
    links: [
      {
        provider: "Internet Archive",
        label: "1080p Blu-ray transfer",
        fileSizeBytes: 1068497633,
        height: 1080,
      },
    ],
  },
  {
    slug: `${SLUG_PREFIX}sintel`,
    title: "Sintel",
    originalTitle: null,
    releaseYear: 2010,
    runtimeMinutes: 15,
    languageCode: "en",
    country: "Netherlands",
    genres: ["animation", "fantasy", "drama"],
    featured: false,
    curationWeight: 0,
    synopsis:
      "A lone traveller crosses a hostile world searching for the dragon she raised and lost. The Blender Foundation's third open movie, made to push the capabilities of free software, and a deliberate attempt to prove that an independent production could deliver a genuinely cinematic fantasy short rather than a technology demo.",
    metaTitle: "Sintel (2010) — review and authorized sources",
    metaDescription:
      "The Blender Foundation's open fantasy short, reviewed, with a verified Creative Commons source.",
    reviewTitle: "A tech demo that became a real film",
    reviewBody:
      "Sintel is the moment the Blender open-movie project stopped being a software showcase and started producing work that stands on its own. The story is deliberately simple — a woman, a dragon, a reunion that does not go the way either of them expected — and it is told almost entirely through image and score, which is a confident choice for a fifteen-minute film.\n\nThe animation is where the money went. Snow, hair and cloth are handled with real attention, and the fight sequence at the end is staged with a weight that many live-action fantasies of the same period could not match. The final shot is genuinely upsetting, which is not something you expect from a foundation's marketing short.\n\nIt is released under a Creative Commons Attribution licence, which means anyone may redistribute it provided the creators are credited. That is a real permission, granted deliberately — not a paperwork accident.",
    rating: 7.5,
    reviewerName: "MM YoteShin Editorial",
    archiveId: "sintel_20260427",
    posterUrl: "/posters/demo-sintel.jpg",
    imageCredit: "Sintel poster, Blender Foundation, CC BY 3.0, via Wikimedia Commons.",
    authorizationReference:
      "Released by the Blender Foundation under a Creative Commons Attribution 3.0 licence, which permits redistribution with credit. Internet Archive item: sintel_20260427.",
    authorizationBasis: "open_license",
    links: [
      {
        provider: "Internet Archive",
        label: "Standard definition transfer",
        fileSizeBytes: 351974236,
        height: 480,
      },
    ],
  },
  {
    slug: `${SLUG_PREFIX}tears-of-steel`,
    title: "Tears of Steel",
    originalTitle: null,
    releaseYear: 2012,
    runtimeMinutes: 12,
    languageCode: "en",
    country: "Netherlands",
    genres: ["science-fiction", "drama"],
    featured: false,
    curationWeight: 0,
    synopsis:
      "In a ruined Amsterdam, a group of scientists tries to prevent the robot uprising by sending a man back through the memory of the moment it began. The Blender Foundation's fourth open movie, shot with real actors on real streets and then rebuilt with computer-generated robots, made to prove that free software could carry a live-action science-fiction production.",
    metaTitle: "Tears of Steel (2012) — review and authorized sources",
    metaDescription:
      "The Blender Foundation's live-action science fiction short, reviewed, with a verified Creative Commons source.",
    reviewTitle: "Live action, open tools",
    reviewBody:
      "Tears of Steel is an experiment in compositing that happens to have a decent story attached. The Blender Foundation shot real actors in real Amsterdam locations and then inserted fully computer-generated robots into the footage, and the point of the film was to demonstrate that the whole pipeline could run on free software.\n\nAs a narrative it is thin — a man relives the worst moment of his life in order to change it — but the film uses that thinness well, because the repetition is the structure. The central idea, that the catastrophe is a failure of communication rather than of technology, is more interesting than the robot sequences it is wrapped around.\n\nIt is released under a Creative Commons Attribution licence, so it may be freely redistributed with credit. This is the clearest case in the catalogue of a rights holder granting permission on purpose.",
    rating: 6.5,
    reviewerName: "MM YoteShin Editorial",
    archiveId: "Tears-of-Steel",
    posterUrl: "/posters/demo-tears-of-steel.jpg",
    imageCredit: "Tears of Steel poster, Blender Foundation, CC BY 3.0, via Wikimedia Commons.",
    authorizationReference:
      "Released by the Blender Foundation under a Creative Commons Attribution 3.0 licence, which permits redistribution with credit. Internet Archive item: Tears-of-Steel.",
    authorizationBasis: "open_license",
    links: [
      {
        provider: "Internet Archive",
        label: "720p transfer",
        fileSizeBytes: 76435802,
        height: 360,
      },
    ],
  },
  {
    slug: `${SLUG_PREFIX}mclintock`,
    title: "McLintock!",
    originalTitle: null,
    releaseYear: 1963,
    runtimeMinutes: 127,
    languageCode: "en",
    country: "United States",
    genres: ["comedy", "western", "classic"],
    featured: false,
    curationWeight: 0,
    synopsis:
      "A cattle baron's estranged wife returns to town demanding a divorce, and he decides that what she actually needs is a public spanking in front of the entire territory. Andrew V. McLaglen directs John Wayne and Maureen O'Hara in a broad frontier comedy that is also, unavoidably, a document of what 1963 found funny — the film's central set piece is now the part of it that requires the most explanation.",
    metaTitle: "McLintock! (1963) — review and authorized sources",
    metaDescription:
      "John Wayne and Maureen O'Hara in a frontier comedy, reviewed, with a verified public-domain source.",
    reviewTitle: "A comedy that has aged badly and well at once",
    reviewBody:
      "McLintock! is a film with two reputations. The first is as a boisterous family comedy with one of the best-matched screen couples of its era; Wayne and O'Hara clearly enjoy fighting each other, and the film is at its best when they are in the same room. The second reputation is the mud-pit finale, which is now the sequence that has to be addressed rather than enjoyed, and pretending otherwise would be dishonest.\n\nWhat still works is the texture of the thing. The film has real affection for its mud, its livestock and its supporting cast, and the long middle section in which a town simply gets on with its day is more engaging than the plot that frames it.\n\nIt is in the public domain because the copyright was not renewed. That is worth recording plainly: this is a studio picture with a major star that fell out of protection through an administrative failure, and its free availability rests on that, not on anyone's decision to release it.",
    rating: 6,
    reviewerName: "MM YoteShin Editorial",
    archiveId: "mclintok_widescreen",
    posterUrl: "/posters/demo-mclintock.jpg",
    imageCredit: "John Wayne and Yvonne De Carlo in McLintock! (1963), via Wikimedia Commons.",
    authorizationReference:
      "Public domain in the United States: the copyright was not renewed, so protection lapsed. Internet Archive item: mclintok_widescreen.",
    authorizationBasis: "public_domain",
    links: [
      {
        provider: "Internet Archive",
        label: "Widescreen transfer",
        fileSizeBytes: 1553674262,
        height: 276,
      },
    ],
  },
];

function archiveItemUrl(identifier: string): string {
  return `https://archive.org/details/${identifier}`;
}

async function main() {
  const remove = process.argv.includes("--remove");

  if (process.env.NODE_ENV === "production") {
    console.error("\n  Refusing to run: NODE_ENV is production.\n");
    process.exit(1);
  }

  if (process.env.ALLOW_DEV_SEED !== "1") {
    console.error(
      "\n  Refusing to run.\n" +
        "  This script publishes demo records. Re-run with:\n\n" +
        "      ALLOW_DEV_SEED=1 pnpm db:seed:demo\n" +
        "      ALLOW_DEV_SEED=1 pnpm db:seed:demo -- --remove\n",
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("\n  Missing DATABASE_URL. See .env.example.\n");
    process.exit(1);
  }

  /*
   * These are imported dynamically and only after `loadEnv` has run, because
   * `src/db/client.ts` reads DATABASE_URL at module-evaluation time. A static
   * import would be hoisted above the dotenv call and fail.
   */
  const { and, eq, like } = await import("drizzle-orm");
  const { db } = await import("@/db/client");
  const { adminProfiles, adminUsers, genres, movies } = await import("@/db/schema");
  const { createGenre } = await import("@/lib/services/genres");
  const { createMovie, publishMovie } = await import("@/lib/services/movies");
  const { createReview } = await import("@/lib/services/reviews");
  const { activateLink, createLink } = await import("@/lib/services/links");

  /* ---- Removal mode ------------------------------------------------------ */

  if (remove) {
    // Match on the slug prefix rather than a hard-coded list, so this keeps
    // working after the demo line-up changes.
    const deleted = await db
      .delete(movies)
      .where(and(like(movies.slug, `${SLUG_PREFIX}%`), eq(movies.status, "published")))
      .returning({ slug: movies.slug, title: movies.title });

    console.log(
      deleted.length === 0
        ? "\n  Nothing to remove — no published demo films found.\n"
        : `\n  Removed ${deleted.length} demo film(s), with their reviews, links and genre rows:\n` +
            deleted.map((row) => `    - ${row.title} (${row.slug})`).join("\n") +
            "\n\n  Genres created by this script were left in place.\n",
    );
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

  for (const genre of EXTRA_GENRES) {
    if (genreIdBySlug.has(genre.slug)) continue;
    const created = await createGenre(genre, actor);
    genreIdBySlug.set(created.slug, created.id);
    console.log(`  genre:   created "${created.name}"`);
  }

  /* ---- Films ------------------------------------------------------------- */

  let created = 0;
  let skipped = 0;

  for (const film of DEMO_FILMS) {
    const existing = await db
      .select({ id: movies.id })
      .from(movies)
      .where(eq(movies.slug, film.slug))
      .limit(1);

    if (existing.length > 0) {
      skipped += 1;
      console.log(`  skip:    ${film.title} (already present)`);
      continue;
    }

    const genreIds = film.genres
      .map((slug) => genreIdBySlug.get(slug))
      .filter((id): id is string => Boolean(id));

    if (genreIds.length === 0) {
      throw new Error(`No genres resolved for "${film.title}". Run pnpm db:seed first.`);
    }

    // 1. Create as a draft. `createMovie` forces draft status by design.
    const movie = await createMovie(
      {
        title: film.title,
        slug: film.slug,
        originalTitle: film.originalTitle,
        releaseYear: film.releaseYear,
        releaseDate: null,
        // The demo catalogue is films only. Series have to earn a published
        // review and a season count through the admin UI like everything else,
        // and nothing here invents an authorization basis.
        contentKind: "movie",
        seasonCount: null,
        episodeCount: null,
        runtimeMinutes: film.runtimeMinutes,
        synopsis: film.synopsis,
        editorialNote: null,
        posterUrl: film.posterUrl,
        backdropUrl: null,
        imageCredit: film.imageCredit,
        languageCode: film.languageCode,
        country: film.country,
        contentRating: null,
        metaTitle: film.metaTitle,
        metaDescription: film.metaDescription,
        featured: film.featured,
        curationWeight: film.curationWeight,
        status: "draft",
        genreIds,
      },
      actor,
    );

    // 2. The published review the gate requires.
    await createReview(
      {
        movieId: movie.id,
        reviewTitle: film.reviewTitle,
        body: film.reviewBody,
        rating: film.rating,
        ratingSource: "editorial",
        reviewerName: film.reviewerName,
        status: "published",
      },
      actor,
    );

    // 3. Links, then activation — which requires a basis and a reference.
    for (const link of film.links) {
      const quality = qualityLabel(link.height);

      const created_link = await createLink(
        {
          movieId: movie.id,
          providerName: link.provider,
          destinationUrl: archiveItemUrl(film.archiveId),
          label: link.label,
          quality,
          fileSizeBytes: link.fileSizeBytes,
          language: null,
          authorizationBasis: film.authorizationBasis,
          authorizationReference: film.authorizationReference,
          authorizationNotes:
            "File size and resolution taken from the Internet Archive metadata API. Destination verified to resolve when this file was written.",
          status: "pending_review",
        },
        actor,
      );

      await activateLink(created_link.id, actor);
    }

    // 4. Publish. This re-runs the gate and throws if anything is missing.
    await publishMovie(movie.id, actor);

    created += 1;
    console.log(`  film:    published "${film.title}" (${film.releaseYear})`);
  }

  console.log(
    `\n  ${created} film(s) published, ${skipped} already present.\n` +
      "  Every record was written through the service layer, so the publication\n" +
      "  gate and the audit trail ran as they would for a human editor.\n" +
      "\n  Remove before launch:\n" +
      "      ALLOW_DEV_SEED=1 pnpm db:seed:demo -- --remove\n",
  );
}

main().catch((error) => {
  console.error("\n  Demo seed failed.");
  const message = error instanceof Error ? error.message : String(error);
  console.error(`  ${message.replace(/:\/\/[^@]*@/g, "://***:***@")}\n`);
  process.exit(1);
});
