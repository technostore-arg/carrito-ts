# Fase 4 — Agente Orquestador

## Endpoints

| Método | Ruta | Protección | Función |
|---|---|---|---|
| POST | `/api/agent/chat` | pública | Asistente web/WhatsApp (grounded en el Hub) |
| POST | `/api/agent/whatsapp` | pública | Webhook simple de WhatsApp Cloud API (`{from, text}` o `entry[].changes[]`) |
| POST | `/api/cron/agent-tasks` | `Bearer ${CRON_SECRET}` | Preguntas ML pendientes + órdenes a proveedor |
| POST | `/api/agent/approvals/:id/resolve` | token firmado en `?token=` | Aprobar / rechazar compra a Elit |

## Principio de "cero alucinaciones"

El LLM **sólo redacta**. Todas las herramientas son deterministas y leen del Hub:

- `searchCatalog` → `computeQuote` sobre `master_products` + `supplier_listings`.
- `getLiveQuote` → ficha + precios duales + `Retiro hoy` / `Despacho 24-48 hs`.
- `checkCompatibility` → socket CPU/motherboard, DDR4 vs DDR5, watts estimados vs fuente.
- `buildCartLink` → `?cart=SKU:qty,...`; **bloqueado en `ml_question`** (defensa en el tool y en el loop).

## Guardrails de Mercado Libre

`validateMlResponse` rechaza (y escala a humano sin responder) si el texto contiene:
teléfono, email, URL/dominio externo, mención de WhatsApp o dirección exacta. Además limita la respuesta a 450 caracteres. Si la pregunta es técnica y `static_data_json` no trae `compatibilidad`/`compatible_con`, se escala sin publicar.

## Human-in-the-Loop

- `total_cost_usd < AUTO_APPROVE_USD_LIMIT` (default 150) → `elitService.placeOrder()` y `auto_executed`.
- En adelante → `supplier_purchase_approvals` con token HMAC y notificación Telegram con links `?action=approve` / `?action=reject`.

## Links precargados

El front interpreta `?cart=SKU:2,SKU2:1`, agrega los items al `DrawerCart` y lo abre (`apps/technostore/src/App.jsx`), limpiando el query param.

## Tests

```bash
npm run test:agent   # 10 grupos: tool loop, guardrails, escalación, compatibilidad, compras
npm run test:ml
npm run test:pricing
npm run test:cro
npm run build
```
