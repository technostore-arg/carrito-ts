# DECISIONES — Pipeline de Ingesta de Productos

> Solo arquitectura. No implementado. Fecha: 2026-08-27
> Fuente de verdad del producto: `packages/catalog-schema` (`normalizarProducto`, `validarProducto`, `productoConverter`, `resumirIngesta`).

## 1. Objetivo

Unificar dos orígenes en el mismo flujo con un único punto de aprobación humana:

- (a) **Archivo** — el operador sube Excel/CSV/PDF con lista de precios/stock del proveedor.
- (b) **Scraping** — cron/job trae listados de fuentes externas (Futuro Hard, `tipo_venta: "encargo"`).

Ambos convergen en: **parseo → normalización al esquema canónico → preview de impacto → aprobación → aplicación a Firestore**. Nada se publica sin aprobación (CONTEXT.md).

---

## 2. Arquitectura por etapas

```
(a) Archivo                (b) Scraping
   │                          │
   ▼                          ▼
┌─────────┐            ┌──────────────┐
│ Upload  │            │ Fetch +      │  Reglas fijas (ver §4)
│ + valid │            │ HTML→JSON    │
│ tamaño  │            │ + anti-bot   │
└────┬────┘            └──────┬───────┘
     │                        │
     └──────────┬─────────────┘
                ▼
        ┌───────────────┐
        │  Parseo crudo │  Reglas fijas (ver §4)
        │  (filas/celdas│  xlsx, csv, pdf-table
        │   o nodos)    │
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │ Normalización │  Híbrido: reglas + LLM selectivo (ver §5)
        │ al esquema    │  `normalizarProducto()` + validación
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │ Dedupe por SKU│  Reglas fijas
        │ + enriquecer  │  colisión → sufijo / merge
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │ Preview diff  │  Reglas fijas
        │ `resumirIngesta` │ altas/bajas/cambiosPrecio/sinCambios
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │ Aprobación    │  Humano en apps/admin
        │ manual        │  selección parcial + edición inline
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │ Aplicación    │  Batch Firestore (transacción)
        │ atómica       │  + log de ingesta + rollback doc
        └───────────────┘
```

### Estados de una ingesta

`uploaded → parsed → normalized → previewed → approved|rejected → applied → (reversible 24h)`

Cada ingesta guarda: `ingestaId`, `fuente_origen` (`archivo_normalizado` | `scraping`), `archivo_hash`, `raw_rows`, `normalizados[]`, `errores[]`, `preview`, `decision`, `aplicado_en`.

---

## 3. Contratos de datos

- **Entrada** del parseo: `RawRow[]` — cada fila es `Record<string,string>` con claves tal cual vienen del archivo/página.
- **Salida** de normalización: `Producto[]` — `normalizarProducto(raw)` + `validarProducto()` debe dar 0 errores; los que no pasan van a `errores[]` y no bloquean el preview.
- **Preview**: `resumirIngesta({ existentes, normalizados })` del schema. El admin muestra una tabla diff y permite desmarcar filas / corregir campos antes de aprobar.
- **Aplicación**: upsert por `sku` (clave natural). `sku` normalizado a upper + trim; si falta, el adapter lo genera `TS-{hash}` y lo marca `requiere_revision: true`.

---

## 4. Qué va con reglas fijas (no LLM)

Para no gastar tokens donde hay estructura conocida:

| Paso | Reglas |
|---|---|
| **Upload** | Validar extensión/tamaño, hash SHA-256 para idempotencia, limitar a `.xlsx/.csv/.pdf`. |
| **XLSX/CSV parseo** | `sheet_to_json` / split por `;,\t` autodetectado, primera fila = header. Mapeo de headers por diccionario: `{"precio","price","p. lista","importe"} → precio`. Conversión de moneda/stock con regex `/$?\s*([\d.]+)[.,](\d{2})/`. |
| **PDF parseo** | `pdfjs` o `camelot`-like: extraer tablas por líneas; si no hay tabla, extraer texto y pasar solo ese caso al LLM (ver §5). |
| **Scraping fetch** | `fetch` + `cheerio` / `playwright` si requiere JS, rate-limit + ETag/If-Modified-Since, selector CSS por fuente configurado en `fuentes.json` (no inferir). |
| **Dedupe SKU** | `sku` ya existente → update; nuevo → insert; mismo `sku` duplicado en el archivo → conservar última fila y advertir. |
| **Preview diff** | Puro `resumirIngesta` — conteos y ejemplos, sin modelo. |
| **Aplicación** | `writeBatch` Firestore con `productoConverter`, `updatedAt = nowISO()`, y documento `ingestas/{id}` con el diff para auditoría/rollback. |

---

## 5. Dónde sí aporta un modelo de lenguaje (uso selectivo)

Solo para **texto no estructurado / ambiguo**. Se invoca por fila cuando las reglas no resuelven:

| Caso | Qué hace el LLM | Por qué no reglas |
|---|---|---|
| Descripción libre → `especificaciones` (ej. `"RTX 4090 24GB GDDR6X 16384 CUDA"`) | Extrae `vram/cuda/tflops/frameworks` como `Record<string,string|number>` | Gramática abierta, sin columna dedicada |
| Categoría/subcategoría faltante o texto comercial (`"placa de video gamer"`) | Clasifica a `CATEGORIAS[marca]` + sugiere `subcategoria` | Requiere conocimiento de taxonomía |
| Marca/tipo_venta ambiguos (`"a pedido"`, `"consultar"`) | Infiere `marca` (`technostore` vs `futurohard`) y `tipo_venta` (`encargo` si sin precio/stock) | Señales dispersas en varias columnas |
| PDF sin tabla (foto de lista escaneada / texto corrido) | OCR → filas estructuradas (solo ese documento) | Sin estructura tabular |
| Detección de `fuente_origen` y `moneda` cuando no hay columna | Infiere `ARS` vs `USD` por símbolo/contexto | Heurística frágil |

### Cómo contener el costo

- **Prefiltro por reglas**: si la fila ya mapeó `sku/nombre/precio/categoría` por headers conocidos, no se llama al LLM para esa fila.
- **Batching**: agrupar hasta ~20 filas ambiguas en un solo prompt con `response_format: json_array` y `max_tokens` acotado.
- **Modelo barato para el 95%** (ej. `gpt-4o-mini` / `claude-haiku`); modelo mayor solo para PDFs escaneados.
- **Cache por hash** de fila cruda → resultado normalizado; re-ingestas del mismo archivo con un precio cambiado solo re-evalúan filas distintas.
- **Validación post-LLM**: todo lo que devuelve el modelo pasa por `validarProducto()`; si falla, se marca `requiere_revision` y no se auto-aprueba.
- **Aprobación siempre humana**: el LLM nunca escribe directo a Firestore.

---

## 6. Flujo de aprobación (apps/admin)

Nueva sección **Ingesta** (no implementada) con tres vistas:

1. **Subir archivo** — dropzone + selector de `marca` destino + botón "Parsear".
2. **Preview** — tabla diff con filtros `altas | bajas | cambiosPrecio | errores | requiere_revision`. Cada fila editable inline (precio, stock, categoría) y checkbox para excluir de la aplicación. Muestra `altas/bajas/cambiosPrecio/sinCambios` de `resumirIngesta`.
3. **Historial** — lista de ingestas con estado, quién aprobó y botón rollback (restaura snapshot previo por `sku`).

Scraping usa la misma vista de preview, con un badge `scraping · {fuente}` y programación visible (cron).

---

## 7. Persistencia y auditoría

- Colección `ingestas` — un doc por corrida con `raw_rows` (o referencia a Storage si >1MB), `normalizados`, `preview`, `decision`, `aplicado_en`, `actor`.
- Colección `productos` — upsert por `sku` vía `productoConverter`; `fuente_origen` preserva `archivo_normalizado` vs `scraping`.
- Storage (opcional) — archivo original subido (`ingestas/{id}/original.xlsx`) para trazabilidad.
- Rollback — `ingestas/{id}.snapshot_antes` guarda los `Producto` previos por `sku`; un batch inverso los restaura.

---

## 8. Errores y bordes

- Archivo sin headers reconocibles → LLM de clasificación de headers (una sola llamada por archivo) + confirmación del operador.
- `sku` duplicado con distinto `nombre` → conflicto: se muestra en preview como `conflicto_sku` y exige resolución manual.
- Scraping caído / HTML cambiado → job marca `failed`, guarda HTML de debug, no toca Firestore; alerta al admin.
- Precios en USD sin tipo de cambio → se guarda `moneda: "USD"` y el admin decide conversión; no se convierte automáticamente.

---

## 9. Criterio de costo (regla de oro)

> **Reglas primero, LLM solo para ambigüedad.** Si el dato ya está en una columna con header conocido, no se gasta token. El modelo se usa como "parser de texto libre" por fila, con cache y batching, y siempre bajo validación + aprobación humana.

---

## 10. Próximos pasos (cuando se implemente)

1. `server/ingesta/parse/*` — parsers por formato (xlsx/csv/pdf) con mapeo de headers.
2. `server/ingesta/normalize/*` — `normalizarProducto` + `validarProducto` + capa LLM batcheada y cacheada.
3. `server/ingesta/scrape/*` — fetchers por fuente con `fuentes.json` y scheduler.
4. `apps/admin/src/.../Ingesta.jsx` — UI de upload/preview/historial sobre `adapter.js`.
5. `firestore.rules` — solo admin puede escribir `ingestas` y `productos` vía ingesta aprobada.
