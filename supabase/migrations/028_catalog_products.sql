-- ============================================================
-- 028_catalog_products.sql
-- Product catalog for WhatsApp catalog messages.
-- ============================================================

CREATE TABLE IF NOT EXISTS catalog_products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  price           NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'INR',
  image_url       TEXT,
  retailer_id     TEXT NOT NULL,  -- must match Meta catalog product ID
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE catalog_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own catalog" ON catalog_products
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_catalog_products_user ON catalog_products(user_id, is_active);
