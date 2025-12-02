-- ============================================================================
-- SCRIBA DOCUMENTS SCHEMA
-- ============================================================================
-- Core document management, collaboration, and file storage
-- This schema handles:
--   - Document storage (text, HTML, JSON content)
--   - Document pages (OCR results, page-level editing)
--   - Source files (uploaded images, PDFs)
--   - Document sharing and permissions
--   - Real-time collaboration (sessions, operational transformation)
-- ============================================================================

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(36) PRIMARY KEY,  -- UUID length
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content TEXT,
  content_html TEXT,
  content_json TEXT, -- Editor JSON content for preserving all elements
  has_been_entered BOOLEAN DEFAULT FALSE,
  is_temporary BOOLEAN DEFAULT FALSE, -- Whether this is a temporary document for unauthenticated users
  anonymous_session_id VARCHAR(255), -- Session ID for temporary documents
  claimed_at TIMESTAMP WITH TIME ZONE, -- When the document was claimed by a user
  expires_at TIMESTAMP WITH TIME ZONE, -- Expiration time for temporary documents
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (title != ''),
  CHECK (NOT (is_temporary AND user_id IS NOT NULL)), -- Temporary docs shouldn't have user_id
  CHECK (expires_at > created_at) -- Expiration should be after creation
);

-- Create source_files table for uploaded files
CREATE TABLE IF NOT EXISTS source_files (
  id VARCHAR(36) PRIMARY KEY,  -- UUID length
  document_id VARCHAR(36) REFERENCES documents(id) ON DELETE CASCADE,
  file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('image', 'pdf', 'document')),
  file_name VARCHAR(500) NOT NULL,
  file_size INTEGER CHECK (file_size > 0),
  mime_type VARCHAR(100),
  file_path TEXT, -- Local file path or data URL
  drive_file_id VARCHAR(100), -- For Google Drive files (shorter)
  sections TEXT[], -- Array of position ranges like ["0-3", "14-21"]
  highlight_color VARCHAR(7), -- Hex color codes are 7 chars (#RRGGBB)
  web_view_link TEXT,
  web_content_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (file_name != ''),
  CHECK (char_length(highlight_color) = 7 AND highlight_color ~ '^#[0-9A-Fa-f]{6}$')
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at);
CREATE INDEX IF NOT EXISTS idx_source_files_document_id ON source_files(document_id);
-- Indexes for temporary document cleanup and lookup
CREATE INDEX IF NOT EXISTS idx_documents_temporary_expires ON documents(is_temporary, expires_at) WHERE is_temporary = TRUE;
CREATE INDEX IF NOT EXISTS idx_documents_anonymous_session ON documents(anonymous_session_id) WHERE is_temporary = TRUE;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_source_files_updated_at
    BEFORE UPDATE ON source_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create document_shares table for sharing documents with other users
CREATE TABLE IF NOT EXISTS document_shares (
  id VARCHAR(36) PRIMARY KEY,  -- UUID length
  document_id VARCHAR(36) REFERENCES documents(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Document owner
  shared_user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- User being shared with (NULL for guest access)
  permission VARCHAR(10) NOT NULL DEFAULT 'viewer' CHECK (permission IN ('owner', 'editor', 'viewer')), -- Permission levels
  allow_guest_access BOOLEAN DEFAULT FALSE, -- Whether to allow unauthenticated access
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(document_id, shared_user_id), -- Prevent duplicate shares
  CHECK (NOT (shared_user_id IS NULL AND allow_guest_access = FALSE)) -- Must have either user_id or guest access
);

-- Create document_sessions table for real-time collaboration
CREATE TABLE IF NOT EXISTS document_sessions (
  id VARCHAR(36) PRIMARY KEY,  -- UUID length
  document_id VARCHAR(36) REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name VARCHAR(255),
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cursor_position JSONB, -- Store cursor position and selection
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document_changes table for operational transformation
CREATE TABLE IF NOT EXISTS document_changes (
  id VARCHAR(36) PRIMARY KEY,  -- UUID length
  document_id VARCHAR(36) REFERENCES documents(id) ON DELETE CASCADE,
  session_id VARCHAR(36) REFERENCES document_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version BIGINT NOT NULL, -- Version number for ordering
  operation JSONB NOT NULL, -- The operation data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (version >= 0),
  UNIQUE(document_id, version) -- Ensure version uniqueness per document
);

-- Create indexes for sharing and collaboration
CREATE INDEX IF NOT EXISTS idx_document_shares_document_id ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_shared_user_id ON document_shares(shared_user_id);

CREATE INDEX IF NOT EXISTS idx_document_sessions_document_id ON document_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_sessions_last_active ON document_sessions(last_active_at);
CREATE INDEX IF NOT EXISTS idx_document_changes_document_id ON document_changes(document_id);
CREATE INDEX IF NOT EXISTS idx_document_changes_version ON document_changes(document_id, version);

-- Create triggers for new tables
CREATE TRIGGER update_document_shares_updated_at
    BEFORE UPDATE ON document_shares
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_sessions_updated_at
    BEFORE UPDATE ON document_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration: Update version field to BIGINT for document_changes table
-- This handles the case where the table already exists with INTEGER version
DO $$
BEGIN
    -- Check if the version column is still INTEGER (not BIGINT)
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'document_changes'
        AND column_name = 'version'
        AND data_type = 'integer'
    ) THEN
        -- Alter the column to BIGINT
        ALTER TABLE document_changes ALTER COLUMN version TYPE BIGINT;
        RAISE NOTICE 'Updated document_changes.version from INTEGER to BIGINT';
    ELSE
        RAISE NOTICE 'document_changes.version is already BIGINT or table does not exist';
    END IF;
END $$; 