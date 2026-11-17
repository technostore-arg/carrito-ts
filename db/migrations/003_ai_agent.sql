-- Fase 4 — Agente de IA, guardrails y aprobaciones de compra
-- Requiere 002_mercadolibre.sql aplicado previamente.

CREATE TABLE IF NOT EXISTS agent_conversations (
  id                  BIGSERIAL PRIMARY KEY,
  channel             TEXT NOT NULL CHECK (channel IN ('web','whatsapp','ml_question')),
  external_session_id TEXT NOT NULL,
  messages_json       JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_agent_conversation UNIQUE (channel, external_session_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_updated ON agent_conversations (updated_at DESC);

CREATE TABLE IF NOT EXISTS agent_audit_logs (
  id                  BIGSERIAL PRIMARY KEY,
  channel             TEXT NOT NULL CHECK (channel IN ('web','whatsapp','ml_question')),
  reference_id        TEXT,
  user_input          TEXT,
  tools_called_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_response      TEXT,
  confidence_score    NUMERIC(4,3),
  escalated_to_human  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_ref ON agent_audit_logs (channel, reference_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_time ON agent_audit_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS supplier_purchase_approvals (
  id                BIGSERIAL PRIMARY KEY,
  order_source      TEXT NOT NULL CHECK (order_source IN ('ml','web')),
  external_order_id TEXT NOT NULL,
  items_json        JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_cost_usd    NUMERIC(14,2) NOT NULL,
  status            TEXT NOT NULL CHECK (status IN
                    ('auto_executed','pending_approval','approved','rejected','executed','failed')),
  approval_token    TEXT UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_approvals_status ON supplier_purchase_approvals (status);

-- Estado del agente sobre los eventos `questions` ya ingeridos por el worker de Fase 3.
ALTER TABLE ml_webhook_events ADD COLUMN IF NOT EXISTS agent_state TEXT NOT NULL DEFAULT 'none'
  CHECK (agent_state IN ('none','pending_agent','answered','escalated'));
CREATE INDEX IF NOT EXISTS idx_ml_webhook_agent ON ml_webhook_events (agent_state)
  WHERE agent_state = 'pending_agent';
