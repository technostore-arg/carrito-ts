-- Fase 4/5 — Unificación de órdenes web con el Hub Central.
-- Requiere 001, 002 y 003 aplicadas previamente.

CREATE TABLE IF NOT EXISTS hub_orders (
  id              BIGSERIAL PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,
  channel         TEXT NOT NULL CHECK (channel IN ('web','ml')),
  customer_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
  items_json      JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  shipping        NUMERIC(14,2) NOT NULL DEFAULT 0,
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method  TEXT,
  status          TEXT NOT NULL DEFAULT 'confirmed',
  supplier_orders JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_orders_created ON hub_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_orders_status ON hub_orders (status);
