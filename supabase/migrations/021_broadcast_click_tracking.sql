-- ============================================================
-- 021_broadcast_click_tracking.sql
-- Track CTA button clicks in broadcasts.
-- Each broadcast_recipients row gets a click_count and clicked_at.
-- A separate broadcast_clicks table logs each individual click event.
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE broadcast_recipients
  ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;

ALTER TABLE broadcasts
  ADD COLUMN IF NOT EXISTS clicked_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS broadcast_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES broadcast_recipients(id) ON DELETE SET NULL,
  short_code TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_clicks_broadcast ON broadcast_clicks(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_clicks_short_code ON broadcast_clicks(short_code);

ALTER TABLE broadcast_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS broadcast_clicks_select ON broadcast_clicks;
CREATE POLICY broadcast_clicks_select ON broadcast_clicks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM broadcasts b WHERE b.id = broadcast_clicks.broadcast_id
    AND b.user_id = auth.uid()
  ));

-- Short-link lookup table (no RLS — service role only)
CREATE TABLE IF NOT EXISTS broadcast_short_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_code TEXT NOT NULL UNIQUE,
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES broadcast_recipients(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  destination_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_short_links_code ON broadcast_short_links(short_code);

CREATE OR REPLACE FUNCTION public.increment_recipient_click(recipient_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE broadcast_recipients
  SET click_count = click_count + 1, clicked_at = NOW()
  WHERE id = recipient_id;

  UPDATE broadcasts b
  SET clicked_count = clicked_count + 1
  FROM broadcast_recipients br
  WHERE br.id = recipient_id AND br.broadcast_id = b.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
