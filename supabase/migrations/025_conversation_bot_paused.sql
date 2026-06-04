-- ============================================================
-- 025_conversation_bot_paused.sql
-- Adds bot_paused flag to conversations.
-- When true, the flow runner skips automation processing for
-- this conversation until an agent manually resumes it.
-- ============================================================

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS bot_paused BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bot_paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bot_paused_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_conversations_bot_paused
  ON conversations(user_id, bot_paused) WHERE bot_paused = TRUE;
