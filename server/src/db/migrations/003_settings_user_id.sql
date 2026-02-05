-- Migration: Add user_id to settings for per-user settings with system defaults
-- user_id = NULL means system default, user_id = <uuid> means user-specific setting

-- Drop the existing primary key constraint on 'key'
-- and create a new composite unique constraint on (key, user_id)
-- Note: PostgreSQL UNIQUE constraint allows multiple NULLs by default, but we need
-- to use a unique index with COALESCE to treat NULL user_id as a single value

-- First, add an id column to serve as the new primary key
ALTER TABLE settings ADD COLUMN IF NOT EXISTS id SERIAL;

-- Drop the old primary key
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;

-- Add the new primary key on id
ALTER TABLE settings ADD PRIMARY KEY (id);

-- Create a unique index that treats NULL user_id as a single value (for system defaults)
-- This allows: ('key1', NULL), ('key1', 'user-uuid-1'), ('key1', 'user-uuid-2')
-- But prevents: ('key1', NULL), ('key1', NULL) - duplicate system defaults
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_key_user_id ON settings (key, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'));
