import { parseFile } from './parse.js'
import { normalizeWithLLM, normalizeWithRules } from './llm.js'
import { listExistentesForDiff, createBorrador, computeDiff } from './borradores.js'
import { applyPricing } from './pricing.js'
import { createHash } from 'node:crypto'

function heuristicTextToRows(text) {
  if (!text || !String(text).trim()) return []
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  // Si parece CSV con headers (primera línea con sku/nombre/precio) ya habría sido kind=rows, acá es texto libre
  const rows = []
  for (const line of lines) {
    // Ignorar líneas muy cortas o separators
    if (line.length < 4) continue
    // Intentar extraer precio: $ 1.200.000 , 1200000, 1,200.00, USD 500 — tomar el ÚLTIMO número grande (el precio está al final)
    let precio = 0
    let tipo_venta = 'directa'
    let priceMatch = null
    let lastPriceIdx = -1
    // Heurística: si línea contiene "a pedido" | "consultar" | "encargo" => encargo sin precio
    if (/a\s*pedido|consultar|encargo|a\s*confirmar/i.test(line)) {
      tipo_venta = 'encargo'
      precio = 0
    } else {
      // Buscar todos los números y quedarse con el último que parezca precio (>50)
      // Detectar si precio está en USD (U$S, USD, U$S) para convertir luego a ARS
      const isUSD = /U\s*\$S|USD|U\$S/i.test(line)
      const allNums = [...line.matchAll(/[\d][\d.,]*/g)]
      if (allNums.length) {
        for (let i = allNums.length - 1; i >= 0; i--) {
          const m = allNums[i]
          let raw = m[0]
          if (raw.includes('.') && raw.includes(',')) raw = raw.replace(/\./g, '').replace(',', '.')
          else if (raw.includes(',')) {
            if (/,\d{2}$/.test(raw)) raw = raw.replace(/\./g, '').replace(',', '.')
            else raw = raw.replace(/[.,]/g, '')
          } else if (raw.includes('.')) {
            if (/\.\d{2}$/.test(raw) && raw.split('.').length === 2) raw = raw.replace(',', '.')
            else raw = raw.replace(/\./g, '')
          }
          const n = Number(raw)
          if (!Number.isNaN(n) && n > 50 && n < 100000000) {
            // Si es USD y n < 5000, es USD, convertir a ARS con USD_ARS_RATE (default 1550)
            precio = Math.round(n)
            if (isUSD && n < 5000) {
              // Marcar como USD para que pricing lo convierta; por ahora dejamos n y guardamos flag
              // Guardamos precio en USD, luego si pricing.esCosto lo convertirá; si no, lo dejamos como está pero anotamos
              // Para heurística sin pricing, convertimos ya a ARS
              const RATE = Number(process.env.USD_ARS_RATE) || 1550
              precio = Math.round(n * RATE)
            }
            priceMatch = m
            lastPriceIdx = m.index ?? line.lastIndexOf(m[0])
            break
          }
        }
        if (!precio && allNums.length) {
          const m = allNums[allNums.length - 1]
          let raw = m[0].replace(/[.,]/g, '')
          const n = Number(raw)
          if (!Number.isNaN(n) && n > 10) { precio = Math.round(n); priceMatch = m; lastPriceIdx = m.index ?? -1 }
        }
      }
    }
    // Inferir categoría por palabras clave
    let categoria = 'accesorios'
    const lower = line.toLowerCase()
    if (/iphone|celular|samsung|pixel|moto|galaxy|redmi|xiaomi|poco|note\s*\d|mi\s*\d|mix\s*flip/.test(lower)) categoria = 'celulares'
    else if (/notebook|macbook|lenovo|dell|xps|zenbook|yoga/.test(lower)) categoria = 'notebooks'
    else if (/pc gamer|ryzen|intel i\d|computadora|desktop/.test(lower)) categoria = 'computadoras'
    else if (/rtx|gtx|radeon|gpu|placa.*video|vram/.test(lower)) categoria = 'gpus'
    else if (/ddr|ram|memoria/.test(lower)) categoria = 'memorias'
    else if (/workstation|threadripper|xeon/.test(lower)) categoria = 'workstations'

    // sku: si la línea contiene algo tipo TS-XXX o SKU: xxx, usarlo, si no generar determinístico único
    let sku = ''
    const skuMatch = line.match(/(?:sku\s*[:\-]?\s*)([A-Z0-9\-_]{3,20})/i)
    if (skuMatch) sku = skuMatch[1].toUpperCase()
    else {
      const base = line.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'TXT'
      // hash de 6 hex chars de la línea + índice para garantizar unicidad entre líneas similares
      const h = createHash('sha256').update(line + '#' + rows.length).digest('hex').slice(0, 6).toUpperCase()
      sku = `TXT-${base}-${h}`
    }

    // Nombre: primera parte hasta precio (usar último precio encontrado)
    let nombre = line
    if (priceMatch && lastPriceIdx > 3) {
      nombre = line.slice(0, lastPriceIdx).trim()
    } else if (priceMatch) {
      const idx = line.indexOf(priceMatch[0])
      if (idx > 3) nombre = line.slice(0, idx).trim()
    }
    nombre = nombre.replace(/^[\-\*\•\d\.\)\s]+/, '').trim()
    // Sacar el indicador de moneda que queda pegado al final (ej. "... RAM – U$S", "... 128GB - USD")
    nombre = nombre.replace(/[\-–—:]?\s*(U\s*\$\s*S|USD|ARS|\$)\s*$/i, '').trim()
    nombre = nombre.slice(0, 80)
    if (nombre.length < 3) nombre = line.slice(0, 40)

    // Saltar líneas que son headers/separadores sin precio (ej. "LISTADO COMPLETO XIAOMI", "REDMI🔴", "---")
    if (precio === 0 && tipo_venta !== 'encargo') {
      // Solo conservar si parece producto con GB/RAM
      if (!/GB|RAM|U\$S|USD/i.test(line)) continue
      // Si no tiene precio y no es encargo, igual lo saltamos para no generar error
      continue
    }
    if (/^LISTADO|^GAMMA|^REDMI\s*🔴|^\*NOTE/i.test(line) && precio === 0) continue

    rows.push({
      sku,
      nombre,
      descripcion: line.slice(0, 120),
      categoria,
      precio,
      stock: tipo_venta === 'encargo' ? null : 1,
      tipo_venta,
      marca: 'technostore',
      fuente_origen: 'archivo_normalizado',
      estado: 'activo',
    })
    if (rows.length >= 120) break // limitar a 120 productos por texto libre sin LLM (suficiente para celulares.txt)
  }
  return rows
}

export async function handleNormalizeCatalogFile({ buffer, fileName, mime, origen = 'archivo', fuenteId = null, pricing = null, marca = null }) {
  const { kind, rows, text } = await parseFile({ buffer, fileName, mime })
  const rawText = kind === 'rows' ? JSON.stringify(rows, null, 2) : text
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16)

  let productos
  let llmMeta = null
  let errores = []

  const hasLLMKey = !!(process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)

  if (hasLLMKey) {
    try {
      const res = await normalizeWithLLM({ rawText, fileName, mime: mime || 'text/plain' })
      if (res.productos) {
        productos = res.productos
        errores = res.errores || []
        llmMeta = { provider: res.provider, model: res.model, usedLLM: true }
      } else {
        const fallback = normalizeWithRules({ rawRows: rows })
        productos = fallback.productos
        errores = fallback.errores
        llmMeta = { usedLLM: false, reason: res.reason }
      }
    } catch (e) {
      const fallback = normalizeWithRules({ rawRows: rows.length ? rows : [{ nombre: 'parse_error', sku: 'ERR', categoria: 'accesorios', precio: 0 }] })
      productos = fallback.productos
      errores = [...(fallback.errores || []), { sku: '_llm', errores: [e.message] }]
      llmMeta = { usedLLM: false, error: e.message }
    }
  } else {
    if (kind === 'rows' && rows.length) {
      const res = normalizeWithRules({ rawRows: rows })
      productos = res.productos
      errores = res.errores
      llmMeta = { usedLLM: false, reason: 'sin LLM_API_KEY, fallback por reglas' }
    } else {
      // Sin LLM y sin filas: intentar heurística local para texto libre
      const heuristic = heuristicTextToRows(text)
      if (heuristic.length) {
        const res = normalizeWithRules({ rawRows: heuristic })
        if (res.productos.length) {
          productos = res.productos
          errores = res.errores
          llmMeta = { usedLLM: false, reason: 'sin LLM_API_KEY, heurística texto libre (sin IA)' }
        } else {
          productos = []
          errores = [{ sku: '_parse', errores: ['No se pudo extraer productos del texto. Probá con formato CSV con headers sku,nombre,precio o agregá LLM_API_KEY para IA.'] }]
          llmMeta = { usedLLM: false, reason: 'heurística sin resultados' }
        }
      } else {
        const res = await normalizeWithLLM({ rawText, fileName, mime }).catch(async () => {
          return { productos: null, reason: 'sin LLM' }
        })
        if (res.productos) {
          productos = res.productos
          errores = res.errores || []
          llmMeta = { usedLLM: true, provider: res.provider }
        } else {
          productos = []
          errores = [{ sku: '_parse', errores: ['No se pudo parsear el archivo sin LLM. Configurá LLM_API_KEY o subí un Excel/CSV con headers.'] }]
          llmMeta = { usedLLM: false, reason: 'texto libre requiere LLM' }
        }
      }
    }
  }

  // Forzar marca si viene del selector (technostore/futurohard)
  if (marca && ['technostore','futurohard'].includes(String(marca).toLowerCase())) {
    const m = String(marca).toLowerCase()
    productos = productos.map(p => ({ ...p, marca: m }))
  }

  // Aplicar pricing si viene marcado como costo
  let pricingDetalle = null
  if (pricing && pricing.esCosto) {
    const pricingRes = applyPricing(productos, pricing)
    productos = pricingRes.productos
    pricingDetalle = pricingRes.detalle
    // Anotar en llmMeta que se aplicó pricing
    llmMeta = { ...(llmMeta || {}), pricing: { ...pricing, detalle: pricingDetalle, marcaForzada: marca || null } }
  }

  const existentes = await listExistentesForDiff().catch(() => [])
  const diff = computeDiff({ existentes, normalizados: productos })

  const borrador = await createBorrador({
    origen,
    archivoNombre: fileName,
    archivoHash: hash,
    propuestas: productos,
    diff,
    llmMeta,
    fuenteId,
  })

  return { borrador, errores, hash, pricingDetalle }
}
