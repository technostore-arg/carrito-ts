# INFORME EXHAUSTIVO — TechnoStore + Futuro Hard

> Generado: 2026-08-27 · Rama `main` · 6 commits sobre `f2ca33c` · Build Vite OK
> Estado git: 11 archivos modificados sin commitear (fase ingesta + checkout en progreso)

---

## 1. Visión y Reglas

**Ecosistema monorepo con un solo backend y dos vidrieras:**

| Marca | Enfoque | Ruta | Puerto dev |
|---|---|---|---|
| **TechnoStore** | Electrónica general (celulares, notebooks, hardware consumo) | `/` | 5173 |
| **Futuro Hard** | Vertical IA (GPUs, RAM, SSD + instalación modelos locales) | `/futurohard/` | 5174 |
| **Admin** | Panel único — catálogo, pedidos, métricas, ingesta | `/admin/` | 5175 |
| **API** | Express + Firebase Admin (Firestore) | `/api/*` | 3001 |

**Regla crítica `tipo_venta`:**
- `directa` → checkout real (Mercado Pago Checkout Pro), descuenta `stock` en transacción, crea `pedidos` con `status: pagado`
- `encargo` → `wa.me/<n>?text=Hola, quiero consultar por [nombre] (SKU: [sku])` + registro `consultas`/`consulta_encargo` para métricas

**Diseño:** premium minimalista, gradientes acento (`--gradient-accent`), Space Grotesk headlines, microinteracciones Framer Motion, fotos grandes, 100% responsive (375/768/1440/1440+).

---

## 2. Stack y Workspaces

```
technostore-ecosystem (npm workspaces)
├── apps/technostore       Vite+React (entry oficial)
├── apps/futurohard        Vite+React (entry oficial)
├── apps/admin             Vite+React (5175)
├── packages/ui            @technostore/ui (format, Badge, Button, tokens)
├── packages/catalog-schema @technostore/catalog-schema (esquema canónico)
├── server/                Express + firebase-admin (node:sqlite legacy migrado)
├── functions/             Firebase Functions v2 — normalizeCatalogFile
└── (raíz) vite.config.js eliminado — cada app con su vite.config.js
```

**Deps clave:** `express@5`, `firebase-admin@14`, `firebase-functions@6`, `xlsx@0.18`, `pdf-parse@2.4`, `busboy@1.6`, `framer-motion@13`, `react@18`, `vite@5`, `concurrently@10`

**Scripts:**
```
npm run dev                  → server + 3 frontends concurrentes
npm run dev:technostore      → 5173  dev:futurohard 5174  dev:admin 5175  server 3001
npm run build                → build 3 apps (dist en apps/*/dist, servidas por Express)
npm run migrate:firestore    → SQLite → Firestore (one-shot, FORCE=1 para re-escribir)
```

---

## 3. Esquema Canónico (`packages/catalog-schema`)

**Enums:** `MARCAS[technostore,futurohard]`, `TIPOS_VENTA[directa,encargo]`, `ESTADOS[activo,pausado,agotado]`, `FUENTES[manual,archivo_normalizado,scraping]`, `MONEDAS[ARS,USD]`, `CATEGORIAS{technostore:[celulares,notebooks,computadoras,accesorios], futurohard:[gpus,memorias,workstations,accesorios]}`

**Producto (selección):** `sku*`, `nombre*`, `descripcion`, `marca`, `categoria`, `subcategoria?`, `tipo_venta`, `precio` (0 solo si encargo), `moneda`, `stock` (null si encargo), `especificaciones{}`, `imagenes[]`, `fuente_origen`, `estado`, `vram/cuda/tflops/frameworks?`, `rating/reviews?`, `createdAt/updatedAt`

**Helpers:** `normalizarProducto(raw)` (tolera alias en/es, defaults), `validarProducto(p)→string[]`, `productoConverter` (Firestore), `resumirIngesta({existentes,normalizados})→{altas,bajas,cambiosPrecio,sinCambios,ejemplos}`, `crearProductoDirecta/Encargo`

---

## 4. Firestore — Colecciones

| Colección | Docs | Clave | Notas |
|---|---|---|---|
| `productos` | docs con `sku` único (upper) | auto o `p{N}` legacy | `productToDoc/docToProduct` mapea legacy↔canónico |
| `pedidos` | `{code:TS-XXXXXX, items:[{producto_id,nombre,qty,precio_unitario}], subtotal,shipping,total,status}` | auto | status: pendiente/pagado/enviado/entregado/cancelado |
| `consultas` | `{sku,nombre,marca,telefono,mensaje,origen:whatsapp,createdAt}` | auto | desde botón encargo |
| `mp_payments` | auditoría MP `{order_code,payment_id,status,detalle}` | auto | webhook log |
| `pending_checkouts` | `{customer,items,createdAt,expiresAt}` | `TS-XXXXXX` | TTL 1h, borrado al pagar |
| `borradores_catalogo` | borrador ingesta (ver §6) | auto | origen archivo|scraping |

**Init (`server/firebase.js`):** 4 estrategias en orden: `FIRESTORE_EMULATOR_HOST` → `GOOGLE_APPLICATION_CREDENTIALS` → `FIREBASE_PROJECT_ID+CLIENT_EMAIL+PRIVATE_KEY` (con `\\n` fix) → `./firebase-service-account.json` (gitignoreado). Si nada: `FIREBASE_NO_CONFIG` 503 (no crashea).

**.gitignore ampliado:** `firebase-service-account.json`, `firebase-config.js`, `.env*` (excepto `.env.example`), `server/*.db*`

---

## 5. Server — Endpoints (`server/index.js` :3001)

### Auth
- `POST /api/admin/login` `{password}` → `{token}` (timingSafeEqual, `ADMIN_PASSWORD` env default `technostore2026`, mapeado a `sessions:Map`)

### Productos
- `GET  /api/products` → [] filtrado `activeOnly`
- `GET  /api/products/:id`
- `POST /api/products` (auth)
- `PUT  /api/products/:id` (auth)
- `DELETE /api/products/:id` (auth)

### Ingesta — Borradores (`server/ingesta/*`)
- `POST /api/ingesta/upload` (auth) body `{fileBase64,fileName,mimeType}` (20mb json, 12mb decoded check) → crea borrador vía `handleNormalizeCatalogFile` (parse→LLM→diff→Firestore)
- `GET  /api/borradores` (auth) `?estado=pendiente|aplicado|descartado`
- `GET  /api/borradores/:id` (auth) — precios de costo, requiere auth
- `POST /api/borradores` (auth) genérico para scraping externo `{origen,propuestas[]}`
- `POST /api/borradores/:id/aplicar` (auth) `{skus?:string[]}` → batch upsert por `sku` + log `{por,en,skus}` + `aplicadoEn/Por`
- `POST /api/borradores/:id/descartar` (auth)

### Consultas
- `POST /api/consultas` (público) `{sku,nombre,marca,telefono,mensaje}` → Firestore `consultas`

### Pedidos (legacy, pendiente→pagado)
- `POST /api/orders` (público) — aún existe pero nuevo flujo usa checkout
- `GET  /api/orders` (auth) + `PATCH /api/orders/:id`

### Checkout — Mercado Pago (`server/checkout.js`) ⏳ en progreso
- `POST /api/checkout/crear-preferencia` (público) `{customer,items:[{id,qty}]}` → verifica stock, crea `pending_checkouts`, genera preferencia MP `{items:[title,qty,unit_price ARS], external_reference:TS-XXXXXX, back_urls:{success,pending,failure}→/gracias?pedido=&estado=, auto_return:approved}` → retorna `{init_point,sandbox_init_point,id,code}`
- `POST /api/checkout/webhook` (público) recibe notificación MP, fetchea `v1/payments/{id}?access_token`, si `approved` → transacción: descuenta `stock`, crea `pedidos` con `status:pagado`, borra `pending_checkouts`, logea `mp_payments`. `paid`→ ignorado/idempotente. Siempre 200.
- Legacy `POST /api/mp/*` retenido para compatibilidad.

### Estático
- `GET /` → `apps/technostore/dist` (o fallback)
- `GET /futurohard/*` → `apps/futurohard/dist`
- `GET /admin/*` → `apps/admin/dist`
- `Cache-Control: no-store` para `*.html`

### Config
- `express.json({limit:'20mb'})` (permite base64 overhead, límite real 12MB decoded)
- 12MB validado también en `functions/index.js` (multipart y base64 → 413)
- `FREE_SHIPPING_THRESHOLD 300000`, `SHIPPING_COST 15000`

---

## 6. Pipeline de Ingesta — Detalle

**Módulos (`server/ingesta/`):**
- `parse.js` — `parseFile({buffer,fileName,mime})` → `{kind:'rows'|'text',rows:[],text}`. XLSX via `xlsx` `sheet_to_json`, CSV autodetecta `,;|\t` + headers, PDF via `pdf-parse` (fallback a texto). Base64→Buffer en handler.
- `llm.js` — `normalizeWithLLM({rawText,fileName,mime})` configurable por `LLM_PROVIDER (openai|anthropic|generic)`, `LLM_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY`, `LLM_MODEL` (default `gpt-4o-mini`/`claude-3-haiku`), `LLM_BASE_URL`. Prompt exige SOLO JSON array según `catalog-schema` (`fuente_origen:archivo_normalizado`, sku determinístico si falta, marca por categoría, sin URLs inventadas). `normalizeWithRules({rawRows})` fallback sin LLM. Validación `validarProducto` post-LLM.
- `borradores.js` — `computeDiff`, `createBorrador`, `createBorradorGeneric`, `listBorradores`, `getBorrador`, `aplicarBorrador` (filtrado por `skusAprobados`, batch por `sku`, `merge:true`), `descartarBorrador`. `log:[{accion,en,por,skus}]`.
- `handler.js` — `handleNormalizeCatalogFile({buffer,fileName,mime,origen,fuenteId})` → hash SHA256 slice, elección LLM vs reglas (si no hay key y rows→reglas; texto libre sin LLM→error amigable), `listExistentesForDiff→computeDiff→createBorrador`

**Borrador documento (`borradores_catalogo`):**
```
{ creadoEn, origen:'archivo'|'scraping', archivoNombre, archivoHash, fuenteId?,
  estado:'pendiente'|'aplicado'|'descartado',
  propuestas:Producto[], resumen:{altas,bajas,cambiosPrecio,sinCambios},
  altas:[Producto], bajas:[Producto], modificaciones:[{sku,antes,despues,cambios:[{campo,antes,despues}]}],
  llmMeta:{usedLLM, provider, model, reason?},
  log:[{accion,en,origen|por,skus?}],
  aplicadoEn?, aplicadoPor?, skusAprobados?, descartadoEn?, descartadoPor? }
```

**Cloud Function (`functions/index.js`):**
- `normalizeCatalogFile` — `onRequest({cors:true, region:us-central1, memory:512MiB, timeout:60, secrets:[LLM_API_KEY,LLM_PROVIDER,LLM_MODEL,LLM_BASE_URL]})`
- Soporta `multipart/form-data` (busboy) y `JSON {fileBase64,fileName,mimeType}` (base64→Buffer). 12MB check en ambos, delega a `handleNormalizeCatalogFile` con `origen:'archivo'`.

**Seguridad ingesta auditada:**
1. `GET /api/borradores*` con `auth` (mismo que upload/aplicar/descartar) — precios de costo no expuestos.
2. 12MB validado server-side (`express.json 20mb` + `buffer.length>12MB→413` en `server/index.js:134` y `functions/index.js`) además de frontend (12MB input).
3. `LLM_API_KEY` solo server (`server/ingesta/llm.js` `process.env.LLM_*`, `functions/index.js` secrets), nunca `VITE_`, nunca en bundle admin (`grep VITE_/import.meta.env` vacío; único `LLM_API_KEY` en bundle es string de ayuda `<code>`).

**Sin implementar:** scraping fetch (futuro: `fuentes.json` + `cheerio/playwright`, `fetch→HTML→JSON`) — hoy el tracker externo escribe directo a `borradores_catalogo` con `origen:scraping` vía `POST /api/borradores`.

---

## 7. Checkout — Mercado Pago Checkout Pro (en progreso)

**Flujo:**
```
Carrito (directa) → CheckoutModal → POST /api/checkout/crear-preferencia
  {customer:{name,email,phone,city,address,paymentMethod}, items:[{id,qty}]}
→ verifica stock (getAll), genera TS-XXXXXX, guarda pending_checkouts (TTL 1h)
→ crea preferencia MP (items ARS, external_reference, back_urls →
  /gracias?pedido=...&estado=success|pending|failure)
→ retorna {init_point,sandbox_init_point,id,code} → redirect window.location

MP → POST /api/checkout/webhook {id|data.id}
→ fetch v1/payments/{id}?access_token (MERCADOPAGO_ACCESS_TOKEN env, nunca frontend)
→ si approved + TS-* + pending existe y no expiró
→ runTransaction: descuenta stock (docToProduct), crea pedidos {code,status:pagado,items,subtotal,shipping,total}
→ delete pending_checkouts → log mp_payments → 200
→ back_urls muestran /gracias (estado leído por query)
```

**Token:** `process.env.MERCADOPAGO_ACCESS_TOKEN` server-only, sandbox primero (`START` sandbox test antes de prod). No exponer en frontend.

**Página resultado:** `/gracias?pedido=TS-XXXXXX&estado=success|pending|failure` (a crear en ambas `apps/*/src/...` — muestra mensaje claro por estado + `order.code` + WhatsApp fallback).

**CheckoutModal actualizado:** `apps/technostore|futurohard/src/components/CheckoutModal.jsx` ahora POST a `/api/checkout/crear-preferencia` directo (ya no a `/api/orders` primero). Redirige si `mercadopago`. Otros medios siguen creando pedido legacy.

---

## 8. Frontends — Estructura y Comportamiento

### TechnoStore (`apps/technostore`)
- `App.jsx` — filtros `categoria|marca (getBrand)|rango|rangoMatch|q` sobre `mockProducts` (filtrado client-side, 12 mocks). `Header` (search + categoría), `Hero` (asym 1.05fr/1fr + `HeroVideo` `BASE_URL` + `poster`, tag, grad-h1, proof), `FilterBar`, `ProductGrid` (StaggerGrid skeleton, bento por `:nth-child(6n+1/6n+4)`, cross-fade), `Footer`. Motions en `hooks/motion.jsx`.
- `ProductCard` — `motion.article` hover `-4px`, media con badge/encargo/stock-warn/vram-chip, body `{sku, h3, desc, spec-line, price-row, meta, add-btn}`. `esEncargo` → `<a href={waLink(...)} target=_blank>` + `POST /api/consultas` no bloqueante, sino `Agregar al carrito` (props `onAddToCart`).
- `CartContext` + `CartDrawer` (94vw, ship bar, qty ±, remove), `CheckoutModal` (nuevo flujo MP), `CategoryFilter`, etc.
- Tokens: `--gradient-accent: linear-gradient(120deg,#FF5C00,#00D9C0)` usado en h1 grad, btn-primary, borde card destacada (borradores). Font display `--font-display:Space Grotesk`.

### Futuro Hard (`apps/futurohard`)
- Misma base, paleta `--gradient-accent: linear-gradient(120deg,#7C3AED,#22D3EE)`. `Hero` con copy IA + `logo.svg` isotipo, `ServicesSection` (instalación modelos), `GpuCompare`, `Badge` de `@technostore/ui`. Productos 8 mocks IA. Botón encargo idem + `Ver detalle` para directa (placeholder hasta carrito).

### Admin (`apps/admin`)
- `App.jsx` — `sessionStorage admin_tok`, login `POST /api/admin/login` (safeEqual), `topbar` sticky, `tabs: catalogo|pedidos|metricas|ingesta`.
- `Catalog` — `listProductos({marca,q,tipo_venta,estado})`, seg `todas|technostore|futurohard`, search, tabla `{SKU,Nombre,Marca,Categoría,Tipo,Precio,Stock,Estado,acciones}`, modal alta/edición (validación sku/nombre/categoría, precio>0 si directa), delete con confirm. Mutaciones via `adapter.js` (mock→Firestore swap sin tocar UI).
- `Orders` — sub-tabs `directas` (filtro `status`, `select` estado) + `consultas` WhatsApp (`estado_cierre` `abierta|cerrada`, `venta_cerrada` toggle, Cerrar/Reabrir).
- `Metrics` — `getMetricas()` → `{vistas(top5),abiertas,ventasPeriodo,totalVentas,porMarca:{technostore,futurohard:{productos,ventas,consultas}},totalPedidos}` → KPI grid + productos más vistos + consultas abiertas + comparación + ventas.
- `Ingesta` — nuevo: dropzone `.xlsx/.xls/.csv/.pdf` (12MB), `FileReader→base64→/api/ingesta/upload`, lista `borradores` con `BorradorCard` diff `{nuevo|campo:antes→después}`, checkboxes `Todos|fila` (`.check-wrap 44px` touch), `Aprobar seleccionados|Descartar`, log `{por,en}` y estado `pendiente|aplicado|descartado`.
- `adapter.js` — fachada desacoplada: `listProductos/createProducto/updateProducto/deleteProducto/listPedidos/updatePedido/listConsultas/updateConsulta/getVistas/getMetricas/listBorradores/aplicarBorrador/resetMocks` — hoy mock local (delay 180ms, arrays + Set sort), mañana Firestore.
- `index.css` — dark `#0b0c10`, cards `#111318`, pills por marca/tipo/estado, tablas `min-width`, kpi grid, compare, modal, login, responsive.

---

## 9. Responsive — Estado Post-Fix

**Breakpoints auditados:** 375 / 768 / 1024 / 1440

**Ambas tiendas (`apps/*/src/index.css`):**
- `1024`: `product-grid:3 col` + `grid-auto-rows:auto`, `footer 2 col`
- `768`: hide `nav--desktop/search--desktop`, show `hamburger`, `header-inner gap12 pad12`, `hero 1fr` + `hero-media 340px order-1`, `product-grid 2 col auto`, `filter-select 0 auto 140px`, `services 2 col`, `extra-filters`
- `560`: `product-grid 1 col auto`, `card 320px min` reset bento spans, `hero-media 280px r18 object-center`, `hero h1 lh0.98 sub 0.98rem`, `add-btn 100% 44px`, `hero-actions 100%`, `filter-select 100%`, `checkout-form 1 col`, `drawer 100vw`, `footer/services 1 col`
- `1440`: `container 1360`, `product-grid gap20`, `hero gap64`, `marquee-slow 45s`
- `bento` confirmado: `6n+1 span2×2 + ::after grad border-top`, `6n+4 span2`, fallback mobile.
- `add-btn` `min-height44 inline-flex centered width100@560` — WhatsApp tap ≥44×44, sin solape `badge 12|stock-warn 12|vram-chip 12`.

**Admin:**
- `900`: `kpi 1fr1fr`, `cols2 1col`, `compare 1col`, `grid2 1col`, `topbar wrap`
- `768`: `table-wrap margin -12 full-bleed`, `table 680 min`, `td 14px`
- `600`: `kpi 1col`, `toolbar col`, `search 100%`, `seg 100% flex1`, `tabs 82%`, `table 640 min`, `th/td 12px`, `checkbox 24px + check-wrap 44px`, `btn-primary/ghost 44px 100%`
- `375`: `btn-sm 36px`, `modal 10px pad16`
- `table-wrap -webkit-overflow-scrolling:touch`, `thead nowrap`, `pill` nowrap, `toast fixed`.

**Videos:** `public/assets/video/{app}-hero.mp4` + `{app}-poster.jpg` comprimidos ffmpeg, `HeroVideo.jsx` `BASE_URL`, `muted` via ref, autoplay, poster fallback, `prefers-reduced-motion: reduce` oculta video.

---

## 10. Git — Historial

```
383a2f6 fix(responsive): 375/768/1440 + tap 44px WhatsApp
0f801a6 docs: DECISIONES.md pipeline ingesta
3fc33af feat(admin): catálogo/pedidos/métricas + adapter mock
e7ca4e8 feat(server): SQLite→Firestore + migrate script
03bfd37 docs: README entry points + .gitignore Firebase
dc3619a chore(monorepo): elimina app duplicada raíz
f2ca33c feat: monorepo inicial (Apple minimal, video, marquee 300s)
```

**Uncommitted (11):**
- `M apps/admin/src/App.jsx` (añade tab Ingesta)
- `M apps/admin/src/data/adapter.js` (+ listBorradores/aplicarBorrador)
- `M apps/admin/src/index.css` (check-wrap 44px, table tweaks)
- `M apps/futurohard/src/components/CheckoutModal.jsx` (nuevo flujo MP)
- `M apps/futurohard/src/index.css` (responsive 44px)
- `M apps/technostore/src/components/CheckoutModal.jsx`
- `M apps/technostore/src/index.css`
- `M package-lock.json` (xlsx,pdf-parse)
- `M package.json` (xlsx,pdf-parse)
- `M server/firebase.js` (+PENDING_CHECKOUTS)
- `M server/index.js` (ingesta routes + checkout 20mb + webhook)
- `?? apps/admin/src/components/Ingesta.jsx`
- `?? functions/` + `server/checkout.js` + `server/ingesta/*`

**Próximo commit sugerido:**
```
feat(ingesta+checkout): pipeline archivo→borradores con LLM configurable y
Checkout Pro (pending_checkouts + webhook pagado) — pendiente /gracias
```

---

## 11. Seguridad y Env

| Variable | Server-only | Cliente | Notas |
|---|---|---|---|
| `LLM_API_KEY|LLM_PROVIDER|LLM_MODEL|LLM_BASE_URL` | ✅ `server/ingesta/llm.js` `process.env` + `functions` `secrets:[]` | ❌ nunca `VITE_` | Incidente `html.precios` aprendido: nunca commitear |
| `MERCADOPAGO_ACCESS_TOKEN` | ✅ `server/checkout.js:95` `server/index.js: MP_TOKEN` | ❌ solo server | Sandbox primero, prod después |
| `FIREBASE_*` | ✅ server | ❌ | 4 estrategias, `.env.example` plantilla |
| `ADMIN_PASSWORD` | ✅ | ❌ | timingSafeEqual |

**Borradores sensibles:** `GET /api/borradores*` con `auth` (precios costo), 12MB validado frontend+server (20mb json overhead + `buffer>12MB→413` en server y functions), `VITE_` vacío en admin (`vite.config.js` sin define).

---

## 12. Comandos Verificados

```bash
npm install
npm run dev                  # 3001+5173+5174+5175
npm run dev:technostore      # 5173
npm run dev:futurohard       # 5174
npm run dev:admin            # 5175
npm run server               # 3001
npm run build                # 3 apps (✓ verified 2.6-2.9s + 1.4-1.6s)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_PROJECT_ID=technostore-local npm run dev
npm run migrate:firestore    # ver README
```

**Validaciones últimas:**
- `node --check server/ingesta/*,server/checkout.js` OK
- `parseFile csv→2 rows→normalizeWithRules 2 productos` OK
- `FIRESTORE_EMULATOR_HOST=... node server/index.js` boot 200 + `FIREBASE_NO_CONFIG 503` si sin env
- `grep VITE_ apps/admin/src` vacío; `LLM_API_KEY` en bundle solo `<code>` de ayuda

---

## 13. Pendientes / Próxima Fase

1. **Página `/gracias`** en `apps/technostore|futurohard/src/App.jsx` (o `ThankYou.jsx`) que lea `?pedido=&estado=success|pending|failure` y muestre mensaje claro + `order.code` + WhatsApp fallback. Integrar con `react-router` o `window.location`.
2. **Test sandbox MP** con credenciales test y `MERCADOPAGO_ACCESS_TOKEN` test, verificar webhook local (ngrok o `mp webhook` simulado con `curl POST /api/checkout/webhook {id}`).
3. **Roles Firestore rules** — solo `admin` escribe `productos`/`ingestas`/`pending_checkouts` (pendiente).
4. **Scraping externo** — `POST /api/borradores {origen:scraping, fuenteId, propuestas[]}` ya listo, falta cron externo.
5. **README checkout section** — documentar `POST /api/checkout/crear-preferencia`, `POST /api/checkout/webhook`, `MERCADOPAGO_ACCESS_TOKEN` sandbox vs prod.
6. **Commit** de la fase en curso (ingesta+checkout) como commit separado para rollback.
7. **(Opcional)** `pdf table extraction` mejora con `pdfjs` + `camelot` para tablas sin LLM cost.

---

## 14. Archivos Clave (referencias cruzadas)

- `server/index.js:30 auth`, `32 express.json 20mb`, `128-175 ingesta`, `231-285 checkout/webhook+legacy mp`, `144-153 borradores GET con auth`
- `server/firebase.js:20 COLLECTIONS (6)`, `32-67 getFirestoreDb`
- `server/checkout.js:11 createPreference`, `80 handleWebhook`
- `server/ingesta/parse.js/llm.js/borradores.js/handler.js` — pipeline completo
- `functions/index.js:20 normalizeCatalogFile` (512MiB, secrets)
- `packages/catalog-schema/index.js:62 validar,93 normalizar,193 resumirIngesta`
- `apps/admin/src/components/Ingesta.jsx:5 BorradorCard,105 Ingesta`
- `apps/technostore|futurohard/src/index.css:21 --gradient-accent`, `218 marquee 45s`, `290-295 bento grad border`, `512-557 media 560 44px`
- `apps/technostore|futurohard/src/components/ProductCard.jsx:waLink+POST /api/consultas`
- `apps/technostore|futurohard/src/components/CheckoutModal.jsx:32 fetch /api/checkout/crear-preferencia`
- `DECISIONES.md:15 pipeline diagrama, 80 reglas vs LLM, 149 regla oro`
- `README.md:20 puertos, 77 Firebase colecciones, 93 env, 121 emulador`

---

> **Regla oro:** reglas primero, LLM solo para ambigüedad, todo bajo validación + aprobación humana, nada directo a Firestore. Pricing: sandbox MP + LLM barato batcheado + cache hash.
