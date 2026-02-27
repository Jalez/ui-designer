-- ============================================================================
-- UI DESIGNER PROJECTS SCHEMA (snake_case to match Scriba)
-- ============================================================================
-- Project management for user progress tracking
-- ============================================================================

-- Projects table (user-owned saved progress on maps)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- References users.id
  map_name TEXT NOT NULL, -- References maps.name - will be added after ui-designer-schema.sql
  title TEXT NOT NULL CHECK (title <> '' AND char_length(title) <= 500),
  progress_data JSONB NOT NULL DEFAULT '{}', -- User's progress, completed levels, scores, etc.
  is_public BOOLEAN NOT NULL DEFAULT false,
  share_token TEXT UNIQUE,
  thumbnail_url TEXT,
  hide_sidebar BOOLEAN NOT NULL DEFAULT false,
  access_window_enabled BOOLEAN NOT NULL DEFAULT false,
  access_starts_at TIMESTAMP WITH TIME ZONE,
  access_ends_at TIMESTAMP WITH TIME ZONE,
  access_key_required BOOLEAN NOT NULL DEFAULT false,
  access_key TEXT,
  collaboration_mode TEXT NOT NULL DEFAULT 'individual' CHECK (collaboration_mode IN ('individual', 'group')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_collaborators (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  added_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

-- Ensure new columns exist when table was created by older schema versions
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS hide_sidebar BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_window_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_starts_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS access_ends_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS access_key_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_key TEXT,
  ADD COLUMN IF NOT EXISTS collaboration_mode TEXT NOT NULL DEFAULT 'individual';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_map_name ON projects(map_name);
CREATE INDEX IF NOT EXISTS idx_projects_user_map ON projects(user_id, map_name);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
CREATE INDEX IF NOT EXISTS idx_projects_is_public ON projects(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_projects_share_token ON projects(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_access_window_enabled ON projects(access_window_enabled);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_project_id ON project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_user_id ON project_collaborators(user_id);

-- Trigger to update updated_at timestamp for projects
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_updated_at_trigger ON projects;
CREATE TRIGGER projects_updated_at_trigger
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_projects_updated_at();

-- Add foreign key constraint to maps (must be done after maps table exists)
-- This is safe to run multiple times due to IF NOT EXISTS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'projects_map_name_fkey' 
    AND table_name = 'projects'
  ) THEN
    ALTER TABLE projects 
      ADD CONSTRAINT projects_map_name_fkey 
      FOREIGN KEY (map_name) REFERENCES maps(name) ON DELETE CASCADE;
  END IF;
END$$;

-- Comments for documentation
COMMENT ON TABLE projects IS 'User projects - saved progress on game maps';
COMMENT ON TABLE project_collaborators IS 'Additional users with creator access to a project';
