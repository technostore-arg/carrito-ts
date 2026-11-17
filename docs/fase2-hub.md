# Fase 2 — Hub Central de Catálogo

## Arquitectura

```
Elit API ──> elitService.js ──> sync.js (workers) ──> PostgreSQL (hub)
                                                        │
React (useCatalog) ──> POST /api/products/live ──> live-quotes.js ──> pricingEngine.js
                                                        │
                                       si no hay DB ──> Firestore/mock (legacy)
```

- **Sin PostgreSQL:** el endpoint sigue igual que antes (Firestore). Cero downtime.
- **Con `DATABASE_URL`:** `/api/products/live` calcula precio y stock con el motor nuevo y devuelve **las dos nomenclaturas**: canónica (`price_transfer`, `price_list`, `stock_source`, `active_supplier`) y legacy (`precio_transferencia`, `precio_mercadopago`, `precio_lista`) para que el front actual siga funcionando sin cambios.

## Puesta en marcha

```bash
npm install
cp .env.example .env          # completar DATABASE_URL y credenciales Elit
node --env-file=.env scripts/migrate-pg.mjs
node --env-file=.env scripts/elit-sync.mjs --mode catalog --dry-run
node --env-file=.env scripts/elit-sync.mjs --mode catalog
node --env-file=.env scripts/elit-sync.mjs --mode stock
npm run test:pricing
```

El cron propuesto en `.github/workflows/elit-sync.yml` corre stock cada 15 min y catálogo diariamente. Requiere los secrets `DATABASE_URL`, `ELIT_USER_ID`, `ELIT_TOKEN` (y opcionalmente `ELIT_MODE`).

## Reglas del motor (`server/hub/pricingEngine.js`)

| Regla | Implementación |
|---|---|
| Stock local prioritario | `local.raw_stock > 0` ⇒ `stock_source: 'local'` |
| Fallback mayorista | Si local = 0 y `ELIT.raw_stock >= 3` ⇒ `stock_source: 'supplier'` |
| Stock de seguridad | `SAFETY_STOCK_THRESHOLD = 3` (configurable en `pricing_config`) |
| Sin stock | Si Elit < 3 ⇒ `stock: 0`, sin precios publicados |
| IVA 10.5% | notebooks, CPUs, mothers, RAM, almacenamiento (configurable por `vat_by_category`) |
| IVA 21% | periféricos, monitores, cables, accesorios |
| Transferencia | `costoARS × (1 + IVA) × (1 + margen categoría)` |
| Lista/tarjeta | `transferencia × (1 + recargo financiero %)` |
| Cuarentena | costo ≤ 0, moneda inválida o caída ≥ 40% vs. último costo ⇒ no se publica y se intenta el siguiente proveedor |

## Tablas

Ver `db/migrations/001_hub_catalogo.sql`: `master_products`, `supplier_listings`, `pricing_config` (fila única) y `sync_logs`.

## Tests

`npm run test:pricing` valida IVA 10.5% vs 21%, conversión USD→ARS, conmutación local→supplier, umbral `< 3`, costos 0, caída del 50% y ambos workers con un repo en memoria (sin PostgreSQL).
