-- ============================================================================
-- SCRIBA ADMIN SCHEMA
-- ============================================================================
-- Admin access control and system administration
-- This schema handles:
--   - Admin role assignments (references users table)
--   - Role-based access control
--   - Admin activity tracking
--
-- Note: This is independent and can be applied separately
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Admin Roles (references users table by user_id)
CREATE TABLE IF NOT EXISTS admin_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin', 'moderator')),
    granted_by UUID REFERENCES users(id), -- Who granted admin access (NULL for system grants)
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id), -- One role per user
    FOREIGN KEY (granted_by) REFERENCES users(id)
);

-- Create indexes for admin_roles
CREATE INDEX idx_admin_roles_user_id ON admin_roles(user_id);
CREATE INDEX idx_admin_roles_active ON admin_roles(is_active);
CREATE INDEX idx_admin_roles_role ON admin_roles(role);

-- Add your admin email here (create user if they don't exist, then grant admin role)
INSERT INTO users (email, name)
VALUES ('raitsu11@gmail.com', 'Admin User')
ON CONFLICT (email) DO NOTHING;

INSERT INTO admin_roles (user_id, role)
SELECT u.id, 'admin'
FROM users u
WHERE u.email = 'raitsu11@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
