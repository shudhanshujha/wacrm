-- ============================================================
-- 029_companies.sql
-- Company / organisation grouping for contacts.
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  domain       TEXT,
  industry     TEXT,
  website      TEXT,
  phone        TEXT,
  address      TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own companies" ON companies;
CREATE POLICY "Users manage own companies" ON companies
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Link contacts to companies (nullable — contacts don't need a company)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_companies_user ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
