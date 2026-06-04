-- ============================================================
-- 022_contact_optout.sql
-- WhatsApp broadcast opt-out/opt-in tracking per contact.
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS whatsapp_opted_out BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS opted_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opted_in_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_opted_out ON contacts(user_id, whatsapp_opted_out);
