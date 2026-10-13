import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* ==========================================================================
   Enums
   ========================================================================== */

export const movieStatusEnum = pgEnum("movie_status", ["draft", "published", "archived"]);

export const reviewStatusEnum = pgEnum("review_status", ["draft", "published", "archived"]);

/**
 * `rating_source` exists so an editorial score can never be silently confused
 * with a community score or a third-party aggregate (spec §8, reviews).
 */
export const ratingSourceEnum = pgEnum("rating_source", [
  "editorial",
  "community",
  "external_aggregate",
]);

export const linkStatusEnum = pgEnum("link_status", [
  "pending_review",
  "active",
  "disabled",
  "reported",
]);

/**
 * The recorded legal basis for distributing or linking to a file.
 * A link may not go live without one of these (enforced in the service layer
 * and by `download_links_active_requires_authorization`).
 */
export const authorizationBasisEnum = pgEnum("authorization_basis", [
  "public_domain",
  "open_license",
  "distribution_agreement",
  "written_permission",
  "publisher_authorized_page",
  "other_documented",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "new",
  "under_review",
  "resolved",
  "rejected",
]);

export const reportReasonEnum = pgEnum("report_reason", [
  "broken_link",
  "copyright",
  "unauthorized_distribution",
  "malware_or_unsafe",
  "misleading_listing",
  "metadata_error",
  "other",
]);

export const adminRoleEnum = pgEnum("admin_role", ["owner", "admin", "editor"]);

/* ==========================================================================
   Identity
   ========================================================================== */

/**
 * Admin credentials live here; authorisation lives in `admin_profiles`.
 * Splitting them keeps the role record replaceable without touching secrets.
 */
export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Emails are stored lower-cased, so a plain unique index is sufficient
    // (avoids depending on the citext extension).
    uniqueIndex("admin_users_email_key").on(t.email),
  ],
);

export const adminProfiles = pgTable(
  "admin_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    role: adminRoleEnum("role").notNull().default("editor"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_profiles_role_idx").on(t.role)],
);

/* ==========================================================================
   Catalogue
   ========================================================================== */

export const movies = pgTable(
  "movies",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    title: varchar("title", { length: 300 }).notNull(),
    slug: varchar("slug", { length: 320 }).notNull(),
    originalTitle: varchar("original_title", { length: 300 }),
    releaseYear: integer("release_year"),
    releaseDate: timestamp("release_date", { withTimezone: false, mode: "string" }),
    runtimeMinutes: integer("runtime_minutes"),
    synopsis: text("synopsis"),
    /** Original editorial copy only — never copied from another site. */
    editorialNote: text("editorial_note"),
    posterUrl: text("poster_url"),
    backdropUrl: text("backdrop_url"),
    /** Attribution for the poster/backdrop asset, shown in the admin UI. */
    imageCredit: varchar("image_credit", { length: 300 }),
    languageCode: varchar("language_code", { length: 12 }),
    country: varchar("country", { length: 80 }),
    contentRating: varchar("content_rating", { length: 24 }),
    status: movieStatusEnum("status").notNull().default("draft"),
    featured: boolean("featured").notNull().default(false),
    /** Manual ordering weight for curated rails; higher sorts first. */
    curationWeight: integer("curation_weight").notNull().default(0),
    metaTitle: varchar("meta_title", { length: 200 }),
    metaDescription: varchar("meta_description", { length: 320 }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("movies_slug_key").on(t.slug),
    index("movies_status_published_at_idx").on(t.status, t.publishedAt),
    index("movies_release_year_idx").on(t.releaseYear),
    index("movies_featured_idx").on(t.featured, t.curationWeight),
    // Supports case-insensitive title search without a functional index on the
    // whole expression; the query layer lower-cases both sides.
    index("movies_title_idx").on(t.title),
    check(
      "movies_release_year_range",
      sql`${t.releaseYear} is null or (${t.releaseYear} between 1888 and 2200)`,
    ),
    check("movies_runtime_positive", sql`${t.runtimeMinutes} is null or ${t.runtimeMinutes} > 0`),
    check("movies_title_not_blank", sql`length(btrim(${t.title})) > 0`),
  ],
);

export const genres = pgTable(
  "genres",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 96 }).notNull(),
    description: text("description"),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("genres_slug_key").on(t.slug),
    uniqueIndex("genres_name_key").on(t.name),
    index("genres_display_order_idx").on(t.displayOrder),
  ],
);

export const movieGenres = pgTable(
  "movie_genres",
  {
    movieId: uuid("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    genreId: uuid("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.movieId, t.genreId] }),
    index("movie_genres_genre_idx").on(t.genreId),
  ],
);

/* ==========================================================================
   Editorial reviews
   ========================================================================== */

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    movieId: uuid("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    reviewTitle: varchar("review_title", { length: 240 }),
    /** Plain text with paragraph breaks. Rendered as text nodes, never raw HTML. */
    body: text("body").notNull(),
    rating: numeric("rating", { precision: 3, scale: 1 }),
    /** Documents what the number means, e.g. 10 = a 0–10 editorial scale. */
    ratingScale: numeric("rating_scale", { precision: 4, scale: 1 }).notNull().default("10.0"),
    ratingSource: ratingSourceEnum("rating_source").notNull().default("editorial"),
    reviewerName: varchar("reviewer_name", { length: 120 }).notNull(),
    reviewerId: uuid("reviewer_id").references(() => adminUsers.id, { onDelete: "set null" }),
    status: reviewStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One published review per film keeps the detail page unambiguous.
    uniqueIndex("reviews_movie_published_key")
      .on(t.movieId)
      .where(sql`${t.status} = 'published'`),
    index("reviews_status_idx").on(t.status),
    index("reviews_movie_idx").on(t.movieId),
    check(
      "reviews_rating_range",
      sql`${t.rating} is null or (${t.rating} >= 0 and ${t.rating} <= ${t.ratingScale})`,
    ),
    check("reviews_body_not_blank", sql`length(btrim(${t.body})) > 0`),
  ],
);

/* ==========================================================================
   Authorized external distribution links
   ========================================================================== */

export const downloadLinks = pgTable(
  "download_links",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    movieId: uuid("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    providerName: varchar("provider_name", { length: 160 }).notNull(),
    destinationUrl: text("destination_url").notNull(),
    /** Normalised host, stored so reviews and audits can group by provider. */
    destinationHost: varchar("destination_host", { length: 255 }).notNull(),
    label: varchar("label", { length: 200 }).notNull(),
    quality: varchar("quality", { length: 40 }),
    fileSizeBytes: numeric("file_size_bytes", { precision: 20, scale: 0 }),
    language: varchar("language", { length: 60 }),
    authorizationBasis: authorizationBasisEnum("authorization_basis").notNull(),
    /**
     * Private evidence: contract reference, permission email ID, licence URL.
     * NEVER returned to a public client — the public query layer omits it.
     */
    authorizationReference: text("authorization_reference"),
    authorizationNotes: text("authorization_notes"),
    authorizedBy: uuid("authorized_by").references(() => adminUsers.id, { onDelete: "set null" }),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastCheckedBy: uuid("last_checked_by").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    status: linkStatusEnum("status").notNull().default("pending_review"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("download_links_movie_status_idx").on(t.movieId, t.status),
    index("download_links_status_idx").on(t.status),
    index("download_links_host_idx").on(t.destinationHost),
    // Defence in depth: the database refuses to hold an "active" link that has
    // no recorded authorization basis or has never been reviewed.
    check(
      "download_links_active_requires_authorization",
      sql`${t.status} <> 'active' or (${t.authorizationBasis} is not null and ${t.authorizedAt} is not null)`,
    ),
  ],
);

/* ==========================================================================
   Content / link reports
   ========================================================================== */

export const contentReports = pgTable(
  "content_reports",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    movieId: uuid("movie_id").references(() => movies.id, { onDelete: "set null" }),
    downloadLinkId: uuid("download_link_id").references(() => downloadLinks.id, {
      onDelete: "set null",
    }),
    /** Optional — reports may be anonymous. */
    reporterContact: varchar("reporter_contact", { length: 320 }),
    reason: reportReasonEnum("reason").notNull(),
    details: text("details").notNull(),
    status: reportStatusEnum("status").notNull().default("new"),
    /** Internal moderation notes. Never exposed publicly. */
    resolutionNotes: text("resolution_notes"),
    resolvedBy: uuid("resolved_by").references(() => adminUsers.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    /** Salted hash of the reporter IP — used only for abuse control. */
    reporterIpHash: varchar("reporter_ip_hash", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("content_reports_status_idx").on(t.status, t.createdAt),
    index("content_reports_movie_idx").on(t.movieId),
    index("content_reports_link_idx").on(t.downloadLinkId),
    check("content_reports_details_not_blank", sql`length(btrim(${t.details})) > 0`),
    check(
      "content_reports_target_present",
      sql`${t.movieId} is not null or ${t.downloadLinkId} is not null`,
    ),
  ],
);

/* ==========================================================================
   Audit trail
   ========================================================================== */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    actorId: uuid("actor_id").references(() => adminUsers.id, { onDelete: "set null" }),
    actorEmail: varchar("actor_email", { length: 320 }),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: uuid("entity_id"),
    summary: text("summary").notNull(),
    /** Sanitised, non-sensitive context only. Never store secrets or evidence. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_created_at_idx").on(t.createdAt),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_actor_idx").on(t.actorId),
  ],
);

/* ==========================================================================
   Site settings (no secrets)
   ========================================================================== */

export const siteSettings = pgTable("site_settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedBy: uuid("updated_by").references(() => adminUsers.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ==========================================================================
   Durable rate limiting
   ========================================================================== */

/**
 * Backs the rate limiter so limits survive a cold start and hold across
 * serverless instances (an in-memory counter would not).
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: varchar("key", { length: 200 }).primaryKey(),
    hitCount: integer("hit_count").notNull().default(0),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limits_expires_at_idx").on(t.expiresAt)],
);

/* ==========================================================================
   Relations
   ========================================================================== */

export const moviesRelations = relations(movies, ({ many }) => ({
  movieGenres: many(movieGenres),
  reviews: many(reviews),
  downloadLinks: many(downloadLinks),
}));

export const genresRelations = relations(genres, ({ many }) => ({
  movieGenres: many(movieGenres),
}));

export const movieGenresRelations = relations(movieGenres, ({ one }) => ({
  movie: one(movies, { fields: [movieGenres.movieId], references: [movies.id] }),
  genre: one(genres, { fields: [movieGenres.genreId], references: [genres.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  movie: one(movies, { fields: [reviews.movieId], references: [movies.id] }),
}));

export const downloadLinksRelations = relations(downloadLinks, ({ one }) => ({
  movie: one(movies, { fields: [downloadLinks.movieId], references: [movies.id] }),
}));

export const adminUsersRelations = relations(adminUsers, ({ one }) => ({
  profile: one(adminProfiles, {
    fields: [adminUsers.id],
    references: [adminProfiles.userId],
  }),
}));

/* ==========================================================================
   Inferred types
   ========================================================================== */

export type Movie = typeof movies.$inferSelect;
export type NewMovie = typeof movies.$inferInsert;
export type Genre = typeof genres.$inferSelect;
export type NewGenre = typeof genres.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type DownloadLink = typeof downloadLinks.$inferSelect;
export type NewDownloadLink = typeof downloadLinks.$inferInsert;
export type ContentReport = typeof contentReports.$inferSelect;
export type NewContentReport = typeof contentReports.$inferInsert;
export type AdminUser = typeof adminUsers.$inferSelect;
export type AdminProfile = typeof adminProfiles.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type MovieStatus = (typeof movieStatusEnum.enumValues)[number];
export type LinkStatus = (typeof linkStatusEnum.enumValues)[number];
export type ReviewStatus = (typeof reviewStatusEnum.enumValues)[number];
export type ReportStatus = (typeof reportStatusEnum.enumValues)[number];
export type AdminRole = (typeof adminRoleEnum.enumValues)[number];
export type AuthorizationBasis = (typeof authorizationBasisEnum.enumValues)[number];
