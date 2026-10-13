-- =============================================================================
-- MM YoteShin — row level security
-- =============================================================================
-- How this fits together (read this before changing anything here):
--
--   * The application connects with the `postgres` role, which OWNS these
--     tables. Table owners bypass RLS unless FORCE ROW LEVEL SECURITY is set,
--     so for the application these policies are DEFENCE IN DEPTH, not the
--     primary control.
--
--   * The primary control is the server-side service layer: every public read
--     goes through src/db/queries/public.ts, which filters on
--     status = 'published' / 'active' and never selects private columns.
--
--   * These policies protect the other door: Supabase's PostgREST API, which
--     serves the `anon` and `authenticated` roles. If those keys are ever
--     exposed, or a future feature talks to PostgREST directly, the database
--     still refuses to hand out drafts, unpublished reviews, unauthorised
--     links, reports, or administrator records.
--
-- Together the two layers mean a mistake in either one is not sufficient to
-- leak unpublished content.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enable RLS everywhere
-- -----------------------------------------------------------------------------

ALTER TABLE movies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE genres           ENABLE ROW LEVEL SECURITY;
ALTER TABLE movie_genres     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews          ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_links   ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits      ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Public read access
-- -----------------------------------------------------------------------------

-- Only published films with a publication timestamp are visible.
CREATE POLICY movies_public_read ON movies
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published' AND published_at IS NOT NULL);

CREATE POLICY genres_public_read ON genres
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Genre links are only meaningful for films the caller can already see.
CREATE POLICY movie_genres_public_read ON movie_genres
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM movies m
      WHERE m.id = movie_genres.movie_id
        AND m.status = 'published'
        AND m.published_at IS NOT NULL
    )
  );

-- Reviews are public only when published *and* attached to a public film.
CREATE POLICY reviews_public_read ON reviews
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM movies m
      WHERE m.id = reviews.movie_id
        AND m.status = 'published'
        AND m.published_at IS NOT NULL
    )
  );

-- A link is public only when it is active AND carries a reviewed
-- authorization basis. This mirrors the CHECK constraint of the same intent.
CREATE POLICY download_links_public_read ON download_links
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'active'
    AND authorization_basis IS NOT NULL
    AND authorized_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM movies m
      WHERE m.id = download_links.movie_id
        AND m.status = 'published'
        AND m.published_at IS NOT NULL
    )
  );

-- Site settings are non-secret configuration and may be read publicly.
CREATE POLICY site_settings_public_read ON site_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- Explicitly closed doors
-- -----------------------------------------------------------------------------
-- No policies are defined for content_reports, audit_logs, admin_users,
-- admin_profiles or rate_limits. With RLS enabled and no policy, those roles
-- are denied entirely — which is the intended posture. The application reaches
-- them through the owner connection.
--
-- Belt and braces: revoke the default grants Supabase applies to new tables so
-- even a future permissive policy cannot accidentally widen access.
-- -----------------------------------------------------------------------------

REVOKE ALL ON content_reports FROM anon, authenticated;
REVOKE ALL ON audit_logs      FROM anon, authenticated;
REVOKE ALL ON admin_users     FROM anon, authenticated;
REVOKE ALL ON admin_profiles  FROM anon, authenticated;
REVOKE ALL ON rate_limits     FROM anon, authenticated;

-- Writes are never performed by these roles.
REVOKE INSERT, UPDATE, DELETE ON movies         FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON genres         FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON movie_genres   FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON reviews        FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON download_links FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON site_settings  FROM anon, authenticated;

-- -----------------------------------------------------------------------------
-- Maintenance helper
-- -----------------------------------------------------------------------------

-- Removes rate-limit windows that are long past. Exposed as a function so a
-- scheduled job (pg_cron or an external cron) can call it without needing
-- delete rights on the table.
CREATE OR REPLACE FUNCTION prune_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM rate_limits WHERE expires_at < now() - interval '1 hour';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;
