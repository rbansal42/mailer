ALTER TABLE sequence_enrollments ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE sequence_enrollments ADD COLUMN IF NOT EXISTS last_error TEXT;
