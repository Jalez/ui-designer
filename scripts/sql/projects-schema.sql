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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_map_name ON projects(map_name);
CREATE INDEX IF NOT EXISTS idx_projects_user_map ON projects(user_id, map_name);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);

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
