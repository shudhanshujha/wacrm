-- ============================================================
-- 026_ab_test_broadcasts.sql
-- Adds A/B test group tracking to broadcasts.
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS ab_test_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ab_parent_id      UUID REFERENCES broadcasts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS ab_variant        TEXT CHECK (ab_variant IN ('A', 'B')),
  ADD COLUMN IF NOT EXISTS ab_split_percent  INTEGER CHECK (ab_split_percent BETWEEN 1 AND 99);

CREATE INDEX IF NOT EXISTS idx_broadcasts_ab_parent ON broadcasts(ab_parent_id);