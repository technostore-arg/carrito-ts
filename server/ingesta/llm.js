import { normalizarProducto, validarProducto } from '../../packages/catalog-schema/index.js'

export function buildPrompt({ rawText, fileName, mime, pricing = null }) {
  const pricingHint = pricing && pricing.esCosto
    ? `
IMPORTANTE — PRECIOS DE COSTO:
Los valores numéricos en el archivo son PRECIOS DE COSTO, no de venta.
Para calcular el precio de venta por producto:
- Si categoria es celulares, notebooks o computadoras: precio_venta = (costo + ${pricing.fixedUsd || 100} USD × tipo_cambio ${pricing.usdRate || 1200} ARS) gross-up MercadoPago ${pricing.mpFeePercent || 6.5}% → fórmula: (costo + fijo) / (1 - ${((pricing.mpFeePercent||6.5)/100).toFixed(3)})
- Para otras categorías (gpus, memorias, workstations, accesorios): precio_venta = costo gross-up MP ${pricing.mpFeePercent || 6.5}% → costo / (1 - fee)
- Si margenExtraPercent ${pricing.margenExtraPercent || 0}% >0, aplicar al final: × (1 + margenExtra)
- Devolvé precio_venta redondeado en ARS y guardá costo original en especificaciones._costo_original
- Si no tenés tipo de cambio, usá ${pricing.usdRate || 1200} ARS por USD.
CONSULTA: Si no estás seguro del margen, devolvé el array con precio=costo y agregá en la respuesta un campo _consulta_margen con tu duda para que el humano confirme.
`
    : ''
  return `Sos un normalizador de catálogo para TechnoStore + Futuro Hard.
Entrada: contenido extraído de un archivo "${fileName}" (${mime}).
Tarea: devolver SOLO un JSON válido (sin markdown, sin texto adicional) con un array de objetos, cada uno según el esquema de producto canónico:${pricingHint}

Campos obligatorios por objeto:
- sku (string, único, ej "TS-XXXX" o "FH-XXXX")
- nombre (string, >=3 chars)
- descripcion (string)
- marca ("technostore" | "futurohard")
- categoria (para technostore: celulares|notebooks|computadoras|accesorios; para futurohard: gpus|memorias|workstations|accesorios)
- tipo_venta ("directa" | "encargo") — "encargo" si sin precio o "a pedido"/"consultar"
- precio (number, 0 permitido solo si encargo)
- moneda ("ARS" | "USD", default "ARS")
- stock (number >=0 o null si encargo)
- especificaciones (objeto clave-valor, ej {vram:"24GB", ram:"16GB"})
- imagenes (array de URLs, puede ser vacío)
- fuente_origen: "archivo_normalizado"
- estado ("activo" | "pausado" | "agotado", default "activo")

Reglas:
- Si falta sku, generá uno determinístico a partir del nombre.
- Inferí marca por categoría/nombre si no está explícita.
- No inventes URLs de imágenes; si no hay, dejá [].
- Devolvé SOLO el JSON array. Ejemplo: [{"sku":"TS-IPH15-128","nombre":"iPhone 15 128GB", ...}]

Contenido crudo:
---
${rawText.slice(0, 12000)}
---
`
}

function extractJsonArray(text) {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1] : trimmed
  const start = candidate.indexOf('[')
  const end = candidate.lastIndexOf(']')
  if (start === -1 || end === -1) throw new Error('LLM no devolvió un JSON array')
  return JSON.parse(candidate.slice(start, end + 1))
}

async function callOpenAI({ apiKey, model, baseUrl, prompt }) {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 8192,
    }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`LLM ${r.status}: ${data.error?.message || JSON.stringify(data).slice(0, 400)}`)
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('LLM respuesta vacía')
  return content
}

async function callAnthropic({ apiKey, model, baseUrl, prompt }) {
  const url = `${baseUrl.replace(/\/$/, '')}/v1/messages`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 8192, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`LLM ${r.status}: ${data.error?.message || JSON.stringify(data).slice(0, 400)}`)
  const content = data.content?.[0]?.text
  if (!content) throw new Error('LLM respuesta vacía (anthropic)')
  return content
}

async function callGeneric({ apiKey, model, baseUrl, prompt }) {
  return callOpenAI({ apiKey, model, baseUrl, prompt })
}

export async function normalizeWithLLM({ rawText, fileName, mime, pricing = null }) {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase()
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || ''
  const model = process.env.LLM_MODEL || (provider === 'anthropic' ? 'claude-3-haiku-20240307' : 'gpt-4o-mini')
  const baseUrl = process.env.LLM_BASE_URL || (provider === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1')

  if (!apiKey) {
    return { usedLLM: false, reason: 'LLM_API_KEY no configurada — se usa fallback por reglas', productos: null }
  }

  const prompt = buildPrompt({ rawText, fileName, mime, pricing })
  let raw
  if (provider === 'anthropic') raw = await callAnthropic({ apiKey, model, baseUrl, prompt })
  else if (provider === 'openai') raw = await callOpenAI({ apiKey, model, baseUrl, prompt })
  else raw = await callGeneric({ apiKey, model, baseUrl, prompt })

  const arr = extractJsonArray(raw)
  if (!Array.isArray(arr)) throw new Error('LLM no devolvió array')

  const productos = []
  const errores = []
  for (const item of arr) {
    const p = normalizarProducto({ ...item, fuente_origen: 'archivo_normalizado' })
    const errs = validarProducto(p)
    if (errs.length) errores.push({ sku: p.sku, errores: errs })
    else productos.push(p)
  }
  return { usedLLM: true, provider, model, productos, errores, rawLength: rawText.length }
}

export function normalizeWithRules({ rawRows }) {
  const productos = []
  const errores = []
  for (const row of rawRows) {
    const p = normalizarProducto({ ...row, fuente_origen: 'archivo_normalizado' })
    const errs = validarProducto(p)
    if (errs.length) errores.push({ sku: p.sku || '(sin sku)', errores: errs })
    else productos.push(p)
  }
  return { usedLLM: false, productos, errores }
}
