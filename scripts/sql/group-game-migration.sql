-- ============================================================================
-- GROUP GAME MIGRATION
-- ============================================================================
-- Adds group_id to projects so a single game can be shared by a group
-- ============================================================================

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_group_id ON projects(group_id);
