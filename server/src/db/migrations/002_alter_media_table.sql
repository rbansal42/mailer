-- Migration: Add original_filename, remove uploadthing_key
-- For existing installations that have the old schema

-- Add original_filename column if it doesn't exist
ALTER TABLE media ADD COLUMN original_filename TEXT;

-- Copy filename to original_filename for any existing records
UPDATE media SET original_filename = filename WHERE original_filename IS NULL;

-- Remove uploadthing_key column (no longer needed)
ALTER TABLE media DROP COLUMN uploadthing_key;
