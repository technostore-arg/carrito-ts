-- Fase 3 — Conector Mercado Libre Argentina
-- Requiere 001_hub_catalogo.sql aplicado previamente.

-- Configuración específica de MLA dentro de pricing_config (fila única).
ALTER TABLE pricing_config ADD COLUMN IF NOT EXISTS ml_config_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS ml_credentials (
  user_id       BIGINT PRIMARY KEY,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ml_listings (
  id                BIGSERIAL PRIMARY KEY,
  master_product_id BIGINT NOT NULL UNIQUE REFERENCES master_products(id) ON DELETE CASCADE,
  ml_item_id        TEXT UNIQUE,
  listing_type_id   TEXT NOT NULL DEFAULT 'gold_special'
                    CHECK (listing_type_id IN ('gold_special','gold_pro')),
  published_price   NUMERIC(14,2),
  published_stock   INTEGER NOT NULL DEFAULT 0,
  manufacturing_days INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','skipped_margin')),
  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ml_listings_item ON ml_listings (ml_item_id) WHERE ml_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ml_listings_status ON ml_listings (status);

-- Idempotencia + cola de eventos. event_key único => ON CONFLICT DO NOTHING.
CREATE TABLE IF NOT EXISTS ml_webhook_events (
  id           BIGSERIAL PRIMARY KEY,
  event_key    TEXT NOT NULL UNIQUE,
  topic        TEXT NOT NULL,
  resource     TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','processed','ignored','error')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ml_webhook_pending ON ml_webhook_events (status, created_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS ml_orders (
  id                    BIGSERIAL PRIMARY KEY,
  ml_order_id           TEXT NOT NULL UNIQUE,
  master_product_id     BIGINT REFERENCES master_products(id) ON DELETE SET NULL,
  quantity              INTEGER NOT NULL DEFAULT 1,
  total_amount          NUMERIC(14,2),
  fulfillment_source    TEXT NOT NULL CHECK (fulfillment_source IN ('local','supplier')),
  supplier_order_status TEXT NOT NULL DEFAULT 'none'
                        CHECK (supplier_order_status IN ('none','pending_supplier_order','ordered','cancelled')),
  payload_json          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ml_orders_master ON ml_orders (master_product_id);
