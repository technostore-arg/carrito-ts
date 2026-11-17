# Auditoría pre-producción — correcciones de integración

## Discrepancias confirmadas y corregidas

| # | Discrepancia | Corrección |
|---|---|---|
| 1 | `/api/products` y `/:id` sólo leían Firestore | `server/hub/publicCatalog.js` arma el catálogo desde `master_products` + `computeQuote`; rutas lo usan primero si hay `DATABASE_URL`, con fallback a Firestore |
| 2 | Sólo existía `POST /api/agent/approvals/:id/resolve`; el link de Telegram armaba `?token=...?action=` | Nuevo `GET` con HTML de confirmación (no aprueba); links pasan a `&action=`, links de preview no ejecutan nada |
| 3 | `/api/orders` confiaba en el total del cliente y no tocaba stock | `db/migrations/004_unificacion_ordenes.sql` + `server/hub/orderService.js`: recalcula precios/IVA/cupón/envío por CP, descuenta `raw_stock` y encola `pending_supplier_order` para Elit |
| 4 | Puente `questions` → agente | Confirmado: worker marca `agent_state='pending_agent'` y `answerMlQuestions` consulta exactamente ese estado; cubierto por `test-e2e` |
| 5 | `manufacturing_time` se enviaba como campo suelto | Ahora va en `sale_terms: [{id:'MANUFACTURING_TIME', value_name:'2 días'}]`, con `value_name: null` cuando vuelve a `local` |
| 6 | El precargado `?cart=` agregaba productos antes de la cotización | `App.jsx` espera `refreshQuotes()`, fusiona cotizaciones y descarta ítems sin precio |
| 7 | Cron sin bloqueo concurrency | `server/hub/advisoryLock.js` (`pg_try_advisory_lock` + unlock en `finally`, misma conexión) en `ml-sync`, `ml-webhooks`, `agent-tasks` y CLI `elit-sync` |
| 8 | No había test de integración | `scripts/test-e2e-flow.mjs` (`npm run test:e2e`) cubre las 7 etapas del ciclo completo |

## Orden de apply migrations

```
001_hub_catalogo.sql
002_mercadolibre.sql
003_ai_agent.sql
004_unificacion_ordenes.sql
```

## Suite completa

```bash
npm run test:cro && npm run test:pricing && npm run test:ml && npm run test:agent && npm run test:e2e && npm run build
```
