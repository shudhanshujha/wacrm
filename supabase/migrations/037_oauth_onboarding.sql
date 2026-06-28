-- ============================================================
-- 037_oauth_onboarding.sql
-- Add OAuth onboarding support:
--   1. Widen whatsapp_config.status to accept 'pending_oauth'
--   2. Add waba_name to whatsapp_config
--   3. Create oauth_phone_options table for phone number picker
-- ============================================================

-- 1. Widen the status CHECK constraint to include 'pending_oauth'
ALTER TABLE whatsapp_config
  DROP CONSTRAINT IF EXISTS whatsapp_config_status_check;

ALTER TABLE whatsapp_config
  ADD CONSTRAINT whatsapp_config_status_check
  CHECK (status IN ('connected', 'disconnected', 'pending_oauth'));

-- 2. Add waba_name column for display purposes
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS waba_name TEXT;

-- 3. Create oauth_phone_options table for the phone number picker
--    Stores available phone numbers from the user's WABA during
--    the OAuth flow. Rows are cleaned up once the user makes a
--    selection.
CREATE TABLE IF NOT EXISTS oauth_phone_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  waba_id TEXT,
  display_phone_number TEXT NOT NULL,
  verified_name TEXT,
  quality_rating TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phone_number_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_phone_options_user
  ON oauth_phone_options(user_id);
