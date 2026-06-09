-- ============================================================
-- 035_agency_mode.sql
-- White-label branding and agency multi-account support.
-- ============================================================

-- Branding config per account (also used for white-label)
CREATE TABLE IF NOT EXISTS account_branding (
  account_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  app_name      TEXT NOT NULL DEFAULT 'wacrm',
  logo_url      TEXT,
  primary_color TEXT NOT NULL DEFAULT '#7c3aed',  -- CSS hex colour
  favicon_url   TEXT,
  support_email TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE account_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own branding" ON account_branding;
CREATE POLICY "Users manage own branding" ON account_branding
  FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

-- Agency -> sub-account relationships
CREATE TABLE IF NOT EXISTS agency_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- the agency
  client_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,  -- the sub-account user
  client_name     TEXT NOT NULL,   -- friendly label for the agency dashboard
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_id, client_id)
);

ALTER TABLE agency_accounts ENABLE ROW LEVEL SECURITY;

-- Agency can see and manage their own client relationships
DROP POLICY IF EXISTS "Agency manages own clients" ON agency_accounts;
CREATE POLICY "Agency manages own clients" ON agency_accounts
  FOR ALL USING (agency_id = auth.uid()) WITH CHECK (agency_id = auth.uid());

-- Sub-account can see which agency manages them
DROP POLICY IF EXISTS "Client views own agency relationship" ON agency_accounts;
CREATE POLICY "Client views own agency relationship" ON agency_accounts
  FOR SELECT USING (client_id = auth.uid());

-- Track which account an agency is currently "acting as"
CREATE TABLE IF NOT EXISTS agency_session_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       UUID NOT NULL,
  client_id       UUID NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ
);

ALTER TABLE agency_session_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agency views own sessions" ON agency_session_log;
CREATE POLICY "Agency views own sessions" ON agency_session_log
  FOR SELECT USING (agency_id = auth.uid());
