-- ============================================================
-- 033_ctwa_attribution.sql
-- Click-to-WhatsApp ad attribution tracking.
-- ============================================================

-- Store raw referral data on the first inbound message from an ad
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS ctwa_source_id       TEXT,   -- Meta ad ID
  ADD COLUMN IF NOT EXISTS ctwa_source_type     TEXT,   -- 'ad' | 'post'
  ADD COLUMN IF NOT EXISTS ctwa_headline        TEXT,   -- ad headline text
  ADD COLUMN IF NOT EXISTS ctwa_body            TEXT,   -- ad body text
  ADD COLUMN IF NOT EXISTS ctwa_source_url      TEXT,   -- URL of the ad/post
  ADD COLUMN IF NOT EXISTS ctwa_media_type      TEXT,   -- image | video | etc.
  ADD COLUMN IF NOT EXISTS ctwa_first_seen_at   TIMESTAMPTZ;

-- Attribution event log (one row per ad-initiated conversation)
CREATE TABLE IF NOT EXISTS ctwa_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  ad_id           TEXT NOT NULL,
  ad_source_type  TEXT NOT NULL DEFAULT 'ad',
  headline        TEXT,
  source_url      TEXT,
  media_type      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE ctwa_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own ctwa events" ON ctwa_events;
CREATE POLICY "Users view own ctwa events" ON ctwa_events
  FOR SELECT USING (account_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ctwa_events_account ON ctwa_events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ctwa_events_ad ON ctwa_events(ad_id, created_at DESC);
