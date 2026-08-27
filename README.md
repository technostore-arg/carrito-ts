# TechnoStore + Futuro Hard — Monorepo

Ecosistema ecommerce con un solo backend (Express + SQLite) y dos marcas
frontend que comparten catálogo, carrito y admin.

## Estructura

```
apps/technostore   → Tienda general de electrónica (punto de entrada oficial)
apps/futurohard    → Vertical IA: GPUs/RAM/SSD + instalación de modelos (punto de entrada oficial)
apps/admin         → Panel único: catálogo, pedidos y métricas
packages/ui        → Componentes compartidos (@technostore/ui)
packages/catalog-schema → Tipos y normalización (@technostore/catalog-schema)
server/            → Express API + servidor estático (puerto 3001)
```

Cada app tiene su **propio `vite.config.js`** y es un punto de entrada
independiente. No existe una app en la raíz del repo.

## Puertos en desarrollo

| App            | Puerto | Comando                    |
|----------------|--------|----------------------------|
| API (server)   | 3001   | `npm run server`           |
| TechnoStore    | 5173   | `npm run dev:technostore`  |
| Futuro Hard    | 5174   | `npm run dev:futurohard`   |
| Admin          | 5175   | `npm run dev:admin`        |

## Levantar en desarrollo

**Opción A — todo junto (recomendado):**
```bash
npm install
npm run dev
```
Levanta server + las 3 apps con `concurrently`.

**Opción B — una app por vez:**
```bash
# TechnoStore
npm run dev:technostore

# Futuro Hard
npm run dev:futurohard

# Admin
npm run dev:admin

# API por separado (si no usás `npm run dev`)
npm run server
```

Abrir en el navegador:
- TechnoStore: http://localhost:5173
- Futuro Hard:  http://localhost:5174
- Admin:        http://localhost:5175

## Build de producción

```bash
npm run build                 # build de las 3 apps
npm run build:technostore
npm run build:futurohard
npm run build:admin
```

El server Express (`server/index.js`) sirve las apps compiladas en
`apps/*/dist` y la API bajo `/api`.

## Reglas de negocio

- `tipo_venta: "directa"` → checkout con descuento de stock y cobro (MercadoPago).
- `tipo_venta: "encargo"` → botón WhatsApp + registro de `consulta_encargo`.

---

## Backend: Firebase (Firestore)

El backend es un servidor Express fino (`server/index.js`) que ya **no usa SQLite**:
toda la persistencia va a **Firestore** mediante la capa `server/db.js` + `server/firebase.js`
(Firebase Admin). Los endpoints HTTP son idénticos a la versión anterior, por lo que
los frontends y el admin no requieren cambios.

### Colecciones

| Colección        | Contenido                                                |
|------------------|----------------------------------------------------------|
| `productos`      | Catálogo, según `packages/catalog-schema`                |
| `pedidos`        | Compras directas (con `items` anidados)                  |
| `consultas`      | Registros de "encargo" generados desde WhatsApp          |
| `mp_payments`    | Auditoría de preferencias/webhooks de MercadoPago        |

### Credenciales (NUNCA se commitean claves)

Las claves se proveen por **variables de entorno** o **Secret Manager**, nunca en el repo
(lección del incidente de `html.precios`). `server/firebase.js` las resuelve en este orden:

1. **Emulador local** (dev sin proyecto):
   ```bash
   export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
   export FIREBASE_PROJECT_ID=technostore-local
   ```
2. **Service Account como archivo** (gitignoreado):
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=./server/firebase-service-account.json
   ```
3. **Variables sueltas** (lo que inyecta Secret Manager en producción):
   ```bash
   export FIREBASE_PROJECT_ID=tu-project-id
   export FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxx@tu-project-id.iam.gserviceaccount.com
   export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
4. Fallback local: `./server/firebase-service-account.json` (gitignoreado).

`.gitignore` excluye `firebase-service-account.json`, `firebase-config.js` y `.env*`
(salvo `.env.example`). Ver `.env.example` para la plantilla.

> Si no hay configuración, la API arranca pero los endpoints devuelven
> `503` con el mensaje `FIREBASE_NO_CONFIG` (no crashea).

### Emulador local (la forma más rápida de dev)

```bash
# terminal 1 — Firestore emulator (requiere Java)
firebase emulators:start --only firestore

# terminal 2 — app
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_PROJECT_ID=technostore-local
npm run dev
```

### Migrar datos de SQLite a Firestore (una sola vez)

El script `server/migrate-to-firestore.mjs` lee `server/technova.db` (SQLite) y vuelca
`products` → `productos` (doc id `p{N}`, sku `LEGACY-N`) y `orders`+`order_items` →
`pedidos` (doc id `o{N}`, items anidados). **No borra** el SQLite original.

```bash
# con el emulador o credenciales configurados en el entorno:
npm run migrate:firestore
# para forzar re-escritura si ya hay datos:
FORCE=1 npm run migrate:firestore
```

### Variables de entorno (resumen)

| Variable                        | Uso                                          |
|---------------------------------|----------------------------------------------|
| `FIRESTORE_EMULATOR_HOST`       | Apunta al emulador local (dev)               |
| `FIREBASE_PROJECT_ID`           | ID del proyecto Firebase                     |
| `FIREBASE_CLIENT_EMAIL`         | Email del service account (modo variables)   |
| `FIREBASE_PRIVATE_KEY`          | Clave privada del service account            |
| `GOOGLE_APPLICATION_CREDENTIALS`| Ruta a un archivo service account JSON       |
| `ADMIN_PASSWORD`                | Password del admin (default `technostore2026`)|
| `MERCADOPAGO_ACCESS_TOKEN`      | Token de MercadoPago (opcional)              |
