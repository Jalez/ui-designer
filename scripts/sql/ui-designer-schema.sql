-- UI Designer Schema
-- Tables for levels, maps, and user sessions (snake_case to match Scriba)

-- Levels table
CREATE TABLE IF NOT EXISTS levels (
  identifier UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (name <> ''),
  json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_levels_name ON levels(name);

-- Maps table
CREATE TABLE IF NOT EXISTS maps (
  name TEXT PRIMARY KEY CHECK (name <> '' AND name !~* '^names$'),
  random INTEGER NOT NULL DEFAULT 0 CHECK (random >= 0),
  can_use_ai BOOLEAN NOT NULL DEFAULT false,
  easy_level_points INTEGER NOT NULL CHECK (easy_level_points >= 1),
  medium_level_points INTEGER NOT NULL CHECK (medium_level_points >= 1),
  hard_level_points INTEGER NOT NULL CHECK (hard_level_points >= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Map-Levels junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS map_levels (
  map_name TEXT NOT NULL REFERENCES maps(name) ON DELETE CASCADE,
  level_identifier UUID NOT NULL REFERENCES levels(identifier) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (map_name, level_identifier)
);

CREATE INDEX IF NOT EXISTS idx_map_levels_map_name ON map_levels(map_name);
CREATE INDEX IF NOT EXISTS idx_map_levels_level_identifier ON map_levels(level_identifier);

-- User Sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL CHECK (key <> ''),
  value TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_key ON user_sessions(key);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at) WHERE expires_at IS NOT NULL;

-- Trigger to update updated_at timestamp for levels
CREATE OR REPLACE FUNCTION update_levels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS levels_updated_at_trigger ON levels;
CREATE TRIGGER levels_updated_at_trigger
  BEFORE UPDATE ON levels
  FOR EACH ROW
  EXECUTE FUNCTION update_levels_updated_at();

-- Trigger to update updated_at timestamp for maps
CREATE OR REPLACE FUNCTION update_maps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS maps_updated_at_trigger ON maps;
CREATE TRIGGER maps_updated_at_trigger
  BEFORE UPDATE ON maps
  FOR EACH ROW
  EXECUTE FUNCTION update_maps_updated_at();

-- Trigger to update updated_at timestamp for user_sessions
CREATE OR REPLACE FUNCTION update_user_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_sessions_updated_at_trigger ON user_sessions;
CREATE TRIGGER user_sessions_updated_at_trigger
  BEFORE UPDATE ON user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_sessions_updated_at();

-- Comments for documentation
COMMENT ON TABLE levels IS 'Game levels with configuration stored as JSON';
COMMENT ON TABLE maps IS 'Game maps that contain multiple levels';
COMMENT ON TABLE map_levels IS 'Many-to-many relationship between maps and levels';
COMMENT ON TABLE user_sessions IS 'User session data for progress tracking and temporary storage';
