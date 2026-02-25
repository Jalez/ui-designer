-- ============================================================================
-- UI DESIGNER GROUPS SCHEMA
-- ============================================================================
-- Groups for collaborative gameplay and LTI integration
-- ============================================================================

-- Groups table (collaborative game groups)
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (name <> '' AND char_length(name) <= 255),
  lti_context_id TEXT UNIQUE,
  lti_context_title TEXT,
  resource_link_id TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Group members table
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('instructor', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_groups_lti_context_id ON groups(lti_context_id);
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);

-- Trigger to update updated_at timestamp for groups
CREATE OR REPLACE FUNCTION update_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS groups_updated_at_trigger ON groups;
CREATE TRIGGER groups_updated_at_trigger
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION update_groups_updated_at();

-- Trigger to update updated_at timestamp for group_members
CREATE OR REPLACE FUNCTION update_group_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS group_members_updated_at_trigger ON group_members;
CREATE TRIGGER group_members_updated_at_trigger
  BEFORE UPDATE ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION update_group_members_updated_at();

-- Comments for documentation
COMMENT ON TABLE groups IS 'Collaborative game groups - can be created via LTI or manually';
COMMENT ON TABLE group_members IS 'Group membership - links users to groups with roles';
