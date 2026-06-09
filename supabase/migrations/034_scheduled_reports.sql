-- ============================================================
-- 034_scheduled_reports.sql
-- Scheduled report configuration.
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  report_type     TEXT NOT NULL,  -- 'broadcasts' | 'inbox' | 'contacts' | 'full'
  frequency       TEXT NOT NULL,  -- 'weekly' | 'monthly'
  email           TEXT NOT NULL,  -- recipient email
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_at    TIMESTAMPTZ,
  next_send_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own scheduled reports" ON scheduled_reports;
CREATE POLICY "Users manage own scheduled reports" ON scheduled_reports
  FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next ON scheduled_reports(next_send_at, is_active);
