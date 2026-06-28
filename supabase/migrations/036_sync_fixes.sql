-- ============================================================
-- 036_sync_fixes.sql
-- Fix messaging sync issues:
--   1. Partial unique index on messages(message_id) for dedup
--   2. Unique constraint on conversations(user_id, contact_id)
--   3. Composite index on messages(conversation_id, created_at)
--   4. pg_trgm GIN index on contacts(phone) for ILIKE search
--   5. Enable realtime for message_reactions table
-- ============================================================

-- 1. Partial unique index on messages(message_id) — message_id can be
--    NULL for local-only temp messages, but when Meta provides one it
--    must be unique within a user's scope. A standard UNIQUE constraint
--    would collide on NULLs (Postgres treats NULL != NULL for unique,
--    so multiple NULLs are fine), but Meta itself never sends duplicate
--    message_ids for the same message. This index catches webhook
--    replays before they produce duplicate bubbles in the UI.
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_message_id_unique
  ON messages(message_id)
  WHERE message_id IS NOT NULL;

-- 2. Unique constraint on conversations(user_id, contact_id) — prevents
--    the webhook race condition where two concurrent inbound messages
--    from the same contact each try SELECT → null → INSERT and create
--    duplicate conversations. The application code should use upsert;
--    this constraint is the safety net.
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_user_contact_unique
  ON conversations(user_id, contact_id);

-- 3. Composite covering index for the most common message query:
--    "get messages for conversation X ordered by created_at".
--    The single-column idx_messages_conversation only covers the WHERE;
--    the ORDER BY requires a separate sort pass. This index covers both
--    and eliminates the sort for the common case.
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at
  ON messages(conversation_id, created_at);

-- 4. Enable pg_trgm extension if not already enabled (needed for GIN
--    trigram index on contacts.phone used in findOrCreateContact's
--    ILIKE query). Safe to run multiple times.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 5. GIN trigram index on contacts(phone) — speeds up the ILIKE '%...%'
--    pattern matching in findOrCreateContact. Without this, the ILIKE
--    forces a full table scan on every inbound message.
CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm
  ON contacts USING GIN (phone gin_trgm_ops);

-- 6. Index for the unread_count reset query — conversations filtered by
--    user_id and sorted by last_message_at is the primary conversation
--    list query. This covering index avoids a separate sort.
CREATE INDEX IF NOT EXISTS idx_conversations_user_last_message
  ON conversations(user_id, last_message_at DESC);

-- 7. Enable realtime for message_reactions so reaction subscriptions work
--    (reactions realtime channel was added in message-thread.tsx but the
--    table might not be in the publication).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
  END IF;
END $$;

-- 8. Atomic unread_count increment function — used by the webhook to
--    avoid the read-modify-write race condition where two concurrent
--    webhooks for the same conversation both read the old value, add 1,
--    and one overwrites the other. Using `UPDATE ... SET unread_count =
--    unread_count + 1` is atomic in Postgres.
CREATE OR REPLACE FUNCTION increment_unread(conv_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET unread_count = unread_count + 1
  WHERE id = conv_id;
END;
$$;
