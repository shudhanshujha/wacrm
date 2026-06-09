-- ============================================================
-- 032_woocommerce_integration.sql
-- WooCommerce store connection and event log.
-- ============================================================

CREATE TABLE IF NOT EXISTS woocommerce_connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_url           TEXT NOT NULL,              -- e.g. https://mystore.com
  consumer_key        TEXT NOT NULL,              -- WooCommerce REST API consumer key
  consumer_secret     TEXT NOT NULL,              -- WooCommerce REST API consumer secret
  webhook_secret      TEXT NOT NULL,              -- Shared secret set in WooCommerce webhook settings
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  order_created_template_id   UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  order_processing_template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  order_completed_template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  order_cancelled_template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  abandoned_cart_template_id  UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  abandoned_cart_delay_minutes INTEGER NOT NULL DEFAULT 60,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id)
);

ALTER TABLE woocommerce_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own woocommerce connection" ON woocommerce_connections
  FOR ALL USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());

CREATE TABLE IF NOT EXISTS woocommerce_event_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  woo_order_id    TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  customer_phone  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE woocommerce_event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own woocommerce events" ON woocommerce_event_log
  FOR SELECT USING (account_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_woo_events_account ON woocommerce_event_log(account_id, created_at DESC);
