-- Media library table for uploaded images
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  uploadthing_key TEXT NOT NULL,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  alt_text TEXT DEFAULT '',
  size_bytes INTEGER,
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT DEFAULT NULL
);

-- Index for listing non-deleted media
CREATE INDEX IF NOT EXISTS idx_media_deleted_at ON media(deleted_at);
