-- Migration: Add sequence branches table and new columns for advanced sequence features

-- Add blocks column to sequence_steps for storing email content directly
ALTER TABLE sequence_steps ADD COLUMN IF NOT EXISTS blocks JSONB;

-- Add button tracking columns to sequence_actions
ALTER TABLE sequence_actions ADD COLUMN IF NOT EXISTS button_id TEXT;
ALTER TABLE sequence_actions ADD COLUMN IF NOT EXISTS branch_target TEXT;

-- Add trigger data to enrollments
ALTER TABLE sequence_enrollments ADD COLUMN IF NOT EXISTS trigger_data JSONB;

-- Create sequence_branches table
CREATE TABLE IF NOT EXISTS sequence_branches (
  id TEXT NOT NULL,
  sequence_id INTEGER NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  parent_branch_id TEXT,
  trigger_step_id INTEGER REFERENCES sequence_steps(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL DEFAULT 'action_click',
  trigger_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, sequence_id)
);

-- Index for branch lookups
CREATE INDEX IF NOT EXISTS idx_sequence_branches_sequence ON sequence_branches(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_branches_trigger_step ON sequence_branches(trigger_step_id);

-- Migrate existing branch data
INSERT INTO sequence_branches (id, sequence_id, name, trigger_type, trigger_config, color)
SELECT DISTINCT 'action', s.sequence_id, 'Action Path', 'action_click', '{}', '#10b981'
FROM sequence_steps s WHERE s.branch_id = 'action'
ON CONFLICT DO NOTHING;

INSERT INTO sequence_branches (id, sequence_id, name, trigger_type, trigger_config, color)
SELECT DISTINCT 'default', s.sequence_id, 'Default Path', 'no_engagement', '{}', '#6366f1'
FROM sequence_steps s WHERE s.branch_id = 'default'
ON CONFLICT DO NOTHING;
