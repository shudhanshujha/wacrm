-- ============================================================
-- 023_canned_replies.sql
-- Saved quick-reply templates per user.
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS canned_replies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,          -- short label e.g. "Greeting", "Order Shipped"
  shortcut    TEXT,                   -- optional slash-command e.g. "/shipped"
  content     TEXT NOT NULL,          -- the message body
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_canned_replies_user_id ON canned_replies(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_canned_replies_shortcut 
  ON canned_replies(user_id, shortcut) WHERE shortcut IS NOT NULL;

ALTER TABLE canned_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS canned_replies_select ON canned_replies;
CREATE POLICY canned_replies_select ON canned_replies FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS canned_replies_insert ON canned_replies;
CREATE POLICY canned_replies_insert ON canned_replies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS canned_replies_update ON canned_replies;
CREATE POLICY canned_replies_update ON canned_replies FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS canned_replies_delete ON canned_replies;
CREATE POLICY canned_replies_delete ON canned_replies FOR DELETE
  USING (auth.uid() = user_id);
