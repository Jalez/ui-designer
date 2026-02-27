-- ============================================================================
-- GAME COLLABORATION + ACCESS CONTROL MIGRATION
-- ============================================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS access_window_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_starts_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS access_ends_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS access_key_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_key TEXT,
  ADD COLUMN IF NOT EXISTS collaboration_mode TEXT NOT NULL DEFAULT 'individual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_collaboration_mode_check'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_collaboration_mode_check
      CHECK (collaboration_mode IN ('individual', 'group'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_projects_access_window_enabled
  ON projects(access_window_enabled);

CREATE TABLE IF NOT EXISTS project_collaborators (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  added_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_collaborators_project_id
  ON project_collaborators(project_id);

CREATE INDEX IF NOT EXISTS idx_project_collaborators_user_id
  ON project_collaborators(user_id);

COMMENT ON COLUMN projects.access_window_enabled IS 'Whether a time window gate is enforced for share-token play access';
COMMENT ON COLUMN projects.access_starts_at IS 'Optional UTC timestamp when play access becomes active';
COMMENT ON COLUMN projects.access_ends_at IS 'Optional UTC timestamp when play access ends';
COMMENT ON COLUMN projects.access_key_required IS 'Whether entering via share token requires the special access key';
COMMENT ON COLUMN projects.access_key IS 'Special access key required for share-token access when enabled';
COMMENT ON COLUMN projects.collaboration_mode IS 'individual => solo instances, group => shared group workspace';
COMMENT ON TABLE project_collaborators IS 'Additional creator users with edit access to games';
