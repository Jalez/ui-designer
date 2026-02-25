-- ============================================================================
-- GAMES MIGRATION
-- Adds public/sharing fields to projects table
-- ============================================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS hide_sidebar BOOLEAN NOT NULL DEFAULT false;

-- Index for fast public game listing
CREATE INDEX IF NOT EXISTS idx_projects_is_public ON projects(is_public) WHERE is_public = true;

-- Index for share token lookups
CREATE INDEX IF NOT EXISTS idx_projects_share_token ON projects(share_token) WHERE share_token IS NOT NULL;

COMMENT ON COLUMN projects.is_public IS 'Whether the game is publicly browsable';
COMMENT ON COLUMN projects.share_token IS 'Unique token for share links (UUID)';
COMMENT ON COLUMN projects.thumbnail_url IS 'Thumbnail image URL or base64 data URL';
COMMENT ON COLUMN projects.hide_sidebar IS 'Hide the app sidebar when entering via share link';
