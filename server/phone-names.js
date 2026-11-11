/**
 * server/phone-names.js — Normalización de nombres de celulares nuevos.
 *
 * Los nombres importados del proveedor venían sucios ("NOTE 14S 256GB 8GB RAM
 * - U$S", todo en mayúsculas, sin marca). Esta función los deja presentables:
 *
 *   NOTE 14S 256GB 8GB RAM - U$S        -> Xiaomi Redmi Note 14S 256GB 8GB RAM
 *   POCO X7 PRO 256GB 12GB RAM - U$S    -> Xiaomi Poco X7 Pro 256GB 12GB RAM
 *   MOTOROLA EDGE 60 PRO 5G 256GB...    -> Motorola Edge 60 Pro 5G 256GB...
 *   Samsung Galaxy A16 4GB 128GB        -> Samsung Galaxy A16 128GB 4GB RAM
 *   Iphone 18 Pro 256GB                 -> iPhone 18 Pro 256GB
 *
 * Es idempotente: aplicarla dos veces da el mismo resultado.
 */

const BRAND_BY_SKU = [
  [/^IPH-/, 'Apple'],
  [/^MOT-/, 'Motorola'],
  [/^SAM-/, 'Samsung'],
  [/^TXT-(MI|NOTE|REDMI|POCO|MIXFLIP|XIAOMI)/, 'Xiaomi'],
]

const ACRONYMS = new Set(['5G', '4G', 'LTE', 'GT', 'FE', 'RAM', 'ROM', 'SIM', 'NFC', 'USB', 'AI'])
const KEEP_LOWER = {
  pro: 'Pro', max: 'Max', plus: 'Plus', ultra: 'Ultra', lite: 'Lite', neo: 'Neo',
  power: 'Power', fusion: 'Fusion', core: 'Core', edge: 'Edge', note: 'Note',
  flip: 'Flip', fold: 'Fold', galaxy: 'Galaxy', leica: 'Leica', dual: 'Dual',
  sin: 'Sin', cargador: 'Cargador',
}

function titleWord(w) {
  if (!w) return w
  if (ACRONYMS.has(w.toUpperCase())) return w.toUpperCase()
  if (/^iphone$/i.test(w)) return 'iPhone'
  // Códigos de modelo: A03, E13, G04S, X3, Z8, 14S, 15C, 1TB, 512GB, 5G...
  if (/^[A-Z]\d/i.test(w) || /^\d/.test(w)) return w.toUpperCase()
  if (/^[A-Z]$/.test(w)) return w
  const lower = w.toLowerCase()
  if (KEEP_LOWER[lower]) return KEEP_LOWER[lower]
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function titleCase(text) {
  return text.split('/').map(part => part.split(/\s+/).map(titleWord).join(' ')).join('/')
}

export function brandOfSku(sku) {
  const up = String(sku || '').toUpperCase()
  for (const [re, brand] of BRAND_BY_SKU) if (re.test(up)) return brand
  return null
}

export function cleanPhoneName(raw, sku) {
  let n = String(raw || '').trim()
  if (!n) return n

  // Basura de importación
  n = n.replace(/\s*-\s*U\$S\s*$/i, '')
  n = n.replace(/\s*-\s*U\$S\s*/gi, ' ')
  n = n.replace(/\s*\(sin\s+fuente\)\s*/gi, ' ')
  n = n.replace(/\s+/g, ' ').trim()

  const brand = brandOfSku(sku)
  const up = String(sku || '').toUpperCase()

  let prefix = ''
  if (brand === 'Xiaomi') {
    // Saco cualquier prefijo ya presente (así la limpieza es idempotente).
    n = n.replace(/^Xiaomi\s+/i, '')
    if (/^TXT-NOTE/.test(up)) { prefix = 'Xiaomi Redmi Note '; n = n.replace(/^Redmi\s+/i, '').replace(/^Note\s+/i, '') }
    else if (/^TXT-REDMI/.test(up)) { prefix = 'Xiaomi Redmi '; n = n.replace(/^Redmi\s+/i, '') }
    else if (/^TXT-POCO/.test(up)) { prefix = 'Xiaomi Poco '; n = n.replace(/^Poco\s+/i, '') }
    else if (/^TXT-MIXFLIP/.test(up)) { prefix = 'Xiaomi Mix Flip '; n = n.replace(/^Mix\s+Flip\s+/i, '') }
    else if (/^TXT-MI/.test(up)) { prefix = 'Xiaomi Mi '; n = n.replace(/^Mi\s+/i, '') }
    else { prefix = 'Xiaomi ' }
  } else if (brand === 'Motorola') {
    prefix = 'Motorola '
    n = n.replace(/^Motorola\s+/i, '')
  } else if (brand === 'Samsung') {
    prefix = 'Samsung '
    n = n.replace(/^Samsung\s+/i, '')
  } else if (brand === 'Apple') {
    n = n.replace(/^iphone/i, 'iPhone')
  }

  // Orden capacidad + RAM: "4GB 128GB" -> "128GB 4GB RAM"
  n = n.replace(/(\d+(?:\.\d+)?(?:GB|TB))\s+(\d+(?:\.\d+)?(?:GB|TB))(?!\s*RAM)/i, (m, a, b) => {
    const num = s => parseFloat(s)
    const toGb = s => /TB/i.test(s) ? num(s) * 1024 : num(s)
    if (toGb(a) < toGb(b)) return `${b} ${a} RAM`
    return m
  })

  n = titleCase(n).replace(/\s+/g, ' ').trim()
  // Variantes entre paréntesis: "(black, Blue)" -> "(Black, Blue)"
  n = n.replace(/\(([^)]*)\)/g, (m, inner) => `(${inner.split(',').map(s => titleCase(s.trim())).join(', ')})`)

  if (brand === 'Apple') {
    n = n.replace(/^iphone/i, 'iPhone')
    n = n.replace(/^(iPhone\s+\d+)E\b/, '$1e')
    return n
  }
  if (brand === 'Samsung' && !/^Galaxy\s/i.test(n)) return `${prefix}Galaxy ${n}`
  return `${prefix}${n}`.trim()
}

/** ¿Este producto es un celular nuevo al que hay que normalizarle el nombre? */
export function isNewPhone(categoria, condicion) {
  return String(categoria || '').toLowerCase() === 'celulares' && String(condicion || 'nuevo') !== 'usado'
}
