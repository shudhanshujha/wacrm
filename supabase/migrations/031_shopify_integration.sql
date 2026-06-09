-- ============================================================
-- 031_shopify_integration.sql
-- Shopify store connection and event log.
-- ============================================================

CREATE TABLE IF NOT EXISTS shopify_connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_domain         TEXT NOT NULL,                -- e.g. mystore.myshopify.com
  access_token        TEXT NOT NULL,                -- Shopify Admin API token (store encrypted)
  webhook_secret      TEXT NOT NULL,                -- HMAC secret for verifying Shopify webhooks
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  order_created_template_id   UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  order_fulfilled_template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  order_cancelled_template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  abandoned_cart_template_id  UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  abandoned_cart_delay_minutes INTEGER NOT NULL DEFAULT 60,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id)  -- one Shopify store per wacrm account
);

ALTER TABLE shopify_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own shopify connection" ON shopify_connections;
CREATE POLICY "Users manage own shopify connection" ON shopify_connections
  FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

CREATE TABLE IF NOT EXISTS shopify_event_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shopify_order_id TEXT NOT NULL,
  event_type      TEXT NOT NULL,  -- order_created | order_fulfilled | order_cancelled | abandoned_cart
  customer_phone  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending | sent | failed | skipped
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shopify_event_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own shopify events" ON shopify_event_log;
CREATE POLICY "Users view own shopify events" ON shopify_event_log
  FOR SELECT USING (account_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_shopify_events_account ON shopify_event_log(account_id, created_at DESC);
