# Fase 3 — Conector Mercado Libre Argentina

## Endpoints HTTP

| Método | Ruta | Protección | Función |
|---|---|---|---|
| GET | `/api/ml/auth/url` | pública | Devuelve la URL de autorización OAuth de MLA |
| GET | `/api/ml/auth/callback` | pública | Canjea `code` por tokens y los guarda en `ml_credentials` |
| POST | `/api/ml/webhooks` | pública (idempotente) | Registra el evento y responde `200` **sin procesarlo** |
| POST | `/api/cron/ml-sync` | `Bearer ${CRON_SECRET}` | Sincroniza un lote del Hub → MLA |
| POST | `/api/cron/ml-webhooks` | `Bearer ${CRON_SECRET}` | Procesa la cola de eventos pendientes |

Ejemplo de cron (Vercel Cron o scheduler HTTP):

```bash
curl -X POST https://carrito-ts-neon.vercel.app/api/cron/ml-sync \
  -H "Authorization: Bearer $CRON_SECRET" -H 'Content-Type: application/json' \
  -d '{"batchSize":50,"offset":0}'

curl -X POST https://carrito-ts-neon.vercel.app/api/cron/ml-webhooks \
  -H "Authorization: Bearer $CRON_SECRET" -H 'Content-Type: application/json' \
  -d '{"limit":20}'
```

Los lotes están acotados (máx. 100 ítems / 100 eventos) para respetar el timeout serverless.

## Regla de margen neto

`computeMlListingPlan` despeja el precio mínimo que garantiza el margen neto configurado (default 12%):

```
margen = (1 - retención)/(1 + IVA) - comisión - (costo + envío)/precio  >=  margenMínimo
```

Incluye: costo mayorista en ARS del Hub, IVA 10.5%/21%, comisión MLA (13% `gold_special`, 16% `gold_pro`), costo fijo de envío cuando el precio supera el umbral de envío gratis, y retenciones impositivas estimadas. Si el margen no se alcanza → `skipped_margin` (se omite o pausa).

## Reputación / despacho

| `stock_source` | `manufacturing_days` | `manufacturing_time` |
|---|---|---|
| `local` | 0 | `null` |
| `supplier` (Elit) | 2 | `'2 days'` |

`stock === 0` o `quarantined === true` → `status: 'paused'` automático.

## Idempotencia de webhooks

`ml_webhook_events.event_key` es `UNIQUE`; el receptor hace `INSERT ... ON CONFLICT DO NOTHING`. El procesador sólo toma eventos `pending` sin `processed_at`, por lo que un reintento de ML o un webhook duplicado no descuenta stock dos veces. `questions` queda en `pending` con `processed_at` y `agentReady` para el Agente de IA de la Fase 4.

## Configuración

- Credenciales OAuth en `ml_credentials` (auto-refresh con 10 min de anticipación y reintento en 401/429/5xx).
- Parámetros MLA en `pricing_config.ml_config_json` (sobrescriben los defaults de `DEFAULT_ML_CONFIG`): comisiones, margen mínimo, retenciones, umbral de envío gratis, categoría MLA, etc.

## Tests

```bash
npm run test:ml       # 12 grupos: márgenes, IVA, comisiones, despacho, OAuth, webhooks
npm run test:pricing  # Fase 2
npm run test:cro      # Fase 1
npm run build
```
