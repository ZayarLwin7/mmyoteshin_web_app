-- =============================================================================
-- MM YoteShin — series as a second content kind
-- =============================================================================
-- The catalogue was films only. Series need every piece of machinery a film
-- already uses — editorial reviews, genres, download links, the authorization
-- record, the publish workflow — and `movie_genres`, `reviews` and
-- `download_links` all key off `movies.id`. A second `series` table would have
-- duplicated all of it and forced every query, sitemap, route and admin screen
-- to branch on which table it was reading.
--
-- So this adds a discriminant to the existing table instead. `content_kind`
-- defaults to 'movie', so every existing row is a film with no data migration
-- and no rewrite of the published records.
--
-- Series-specific metadata:
--   * season_count / episode_count — what a reader expects from a series
--     entry ("2 seasons · 16 episodes"). `runtime_minutes` stays null for a
--     series, exactly as season counts stay null for a film.
-- =============================================================================

create type content_kind as enum ('movie', 'series');

alter table movies
  add column content_kind  content_kind not null default 'movie',
  add column season_count  integer,
  add column episode_count integer;

-- A no-op today — the column default already covers every existing row — but
-- stated explicitly so the intent survives a future change to that default.
update movies set content_kind = 'movie' where content_kind is null;

-- Integrity rules. Drafts are exempt from the first two so an editor can save
-- work in progress; the service layer blocks publication on the same grounds
-- (see `evaluatePublicationReadiness`), and this is the database agreeing.
alter table movies
  add constraint series_requires_seasons check (
    content_kind <> 'series' or status <> 'published' or season_count is not null
  ),
  add constraint movie_has_no_seasons check (
    content_kind <> 'movie' or (season_count is null and episode_count is null)
  ),
  add constraint movies_season_count_positive check (
    season_count is null or season_count > 0
  ),
  add constraint movies_episode_count_positive check (
    episode_count is null or episode_count > 0
  );

-- Both listing routes filter on kind first, then status and recency, so the
-- leading column is `content_kind`. `published_at` is ordered descending in
-- the default sort, hence the direction here.
create index if not exists movies_content_kind_status_published_at_idx
  on movies (content_kind, status, published_at desc);
