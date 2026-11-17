-- Hub central de catálogo — Fase 2
-- PostgreSQL 14+. Ejecutar con: node scripts/migrate-pg.mjs
-- Idempotente: usa IF NOT EXISTS / CREATE OR REPLACE.

CREATE TABLE IF NOT EXISTS master_products (
  id              BIGSERIAL PRIMARY KEY,
  ean             VARCHAR(13),
  mpn             VARCHAR(128),
  sku_interno     VARCHAR(64)  NOT NULL UNIQUE,
  title           TEXT         NOT NULL,
  brand           TEXT,
  category        TEXT         NOT NULL,
  vat_rate        NUMERIC(5,4) NOT NULL DEFAULT 0.1050,
  static_data_json JSONB       NOT NULL DEFAULT '{}'::jsonb,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT master_products_vat_range CHECK (vat_rate IN (0.1050, 0.2100))
);

CREATE INDEX IF NOT EXISTS idx_master_products_ean    ON master_products (ean)    WHERE ean IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_products_mpn    ON master_products (mpn)    WHERE mpn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_master_products_cat    ON master_products (category) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_master_products_static ON master_products USING GIN (static_data_json);

CREATE TABLE IF NOT EXISTS supplier_listings (
  id                  BIGSERIAL PRIMARY KEY,
  master_product_id   BIGINT       NOT NULL REFERENCES master_products(id) ON DELETE CASCADE,
  supplier_code       VARCHAR(16)  NOT NULL CHECK (supplier_code IN ('LOCAL','ELIT')),
  supplier_sku        VARCHAR(128) NOT NULL,
  cost_amount         NUMERIC(14,2),
  cost_currency       VARCHAR(3)   NOT NULL DEFAULT 'ARS' CHECK (cost_currency IN ('USD','ARS')),
  raw_stock           INTEGER      NOT NULL DEFAULT 0,
  last_synced_at      TIMESTAMPTZ,
  -- Auditoría para el motor de precios / cuarentena
  prev_cost_amount    NUMERIC(14,2),
  prev_cost_currency  VARCHAR(3),
  quarantine_reason   TEXT,
  quarantined_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_supplier_listing UNIQUE (supplier_code, supplier_sku)
);

CREATE INDEX IF NOT EXISTS idx_listings_master ON supplier_listings (master_product_id);

-- Configuración global (fila única). Los márgenes y el IVA por categoría son JSONB
-- para poder ajustarlos sin migrar.
CREATE TABLE IF NOT EXISTS pricing_config (
  id                     INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  usd_ars_rate           NUMERIC(14,2) NOT NULL DEFAULT 1550,
  list_surcharge_percent NUMERIC(5,2)  NOT NULL DEFAULT 16,
  safety_stock_threshold INTEGER       NOT NULL DEFAULT 3 CHECK (safety_stock_threshold >= 0),
  category_margins       JSONB         NOT NULL DEFAULT '{"default":0.20,"notebooks":0.18,"celulares":0.18,"ram":0.25,"ssd-nvme":0.25,"gpus":0.22,"accesorios":0.35}'::jsonb,
  vat_by_category        JSONB         NOT NULL DEFAULT '{}'::jsonb,
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT now()
);

INSERT INTO pricing_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS sync_logs (
  id                BIGSERIAL PRIMARY KEY,
  job_name          TEXT        NOT NULL,
  supplier_code     VARCHAR(16),
  status            TEXT        NOT NULL CHECK (status IN ('ok','warning','error')),
  items_processed   INTEGER     NOT NULL DEFAULT 0,
  items_quarantined INTEGER     NOT NULL DEFAULT 0,
  error_message     TEXT,
  payload_json      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at       TIMESTAMPTZ,
  duration_ms       INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_job  ON sync_logs (job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_time ON sync_logs (started_at DESC);
