/**
 * Corrige precios de iPhone nuevos: la lista USD que dio el cliente ya era el
 * precio FINAL de venta (efectivo/transferencia) → solo convertir USD→ARS
 * (×1550). Sin fijo tramo (50/80/100) ni margen agregado.
 *
 *   precio_transferencia = usd × 1550  (= precio interno ya cargado)
 *   precio_mercadopago   = transferencia × 1.16  (recargo por medio de pago)
 *
 * Alcance: SOLO marca apple / categoría celulares con _pricing.fixedUsd > 0
 * (los usados ya estaban bien: pt = usd × 1550).
 *
 * Uso: node scripts/fix-iphone-precios.mjs [--dry-run]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const MOCK = path.join(ROOT, 'server', '.mock-data.json')
const USD_RATE = 1550
const MP_MARKUP = 0.16
const DRY = process.argv.includes('--dry-run')

const isTarget = p =>
  p.categoria === 'celulares' &&
  String(p.marca || '').toLowerCase() === 'apple' &&
  Number(p.especificaciones?._pricing?.fixedUsd) > 0

function buildPlan(p) {
  const esp = { ...(p.especificaciones && typeof p.especificaciones === 'object' ? p.especificaciones : {}) }
  esp._costo_original = undefined
  const usd = Number(esp._usd) || Math.round((Number(p.precio) || 0) / USD_RATE)
  const transferencia = Math.round(usd * USD_RATE)
  const mercadopago = Math.round(transferencia * (1 + MP_MARKUP))
  esp._usd = usd
  esp._usd_rate = USD_RATE
  esp._pricing = {
    transferencia,
    mercadopago,
    usdRate: USD_RATE,
    fixedUsd: 0,
    esPrecioFinal: true,
    nota: 'Lista USD = precio final de venta (efectivo/transferencia); solo conversión ×1550',
  }
  // JSON round-trip: descarta undefined (_costo_original) para mock y Firestore
  return { p, esp: JSON.parse(JSON.stringify(esp)), usd, transferencia, mercadopago }
}

async function main() {
  const mock = JSON.parse(fs.readFileSync(MOCK, 'utf8'))
  const targets = (mock.products || []).filter(isTarget)
  console.log(`[fix-iphone] Objetivos (apple/celulares con fijo): ${targets.length} (dry=${DRY})`)
  if (!targets.length) return

  const plans = targets.map(buildPlan)
  let deltaSum = 0
  for (const { p, usd, transferencia } of plans) {
    const old = Number(p.precio_transferencia) || 0
    const delta = transferencia - old
    deltaSum += delta
    console.log(`  ${p.sku} | ${p.nombre} | usd ${usd} | ${old} → ${transferencia} (${delta >= 0 ? '+' : ''}${delta})`)
  }
  console.log(`[fix-iphone] Delta total transferencia: ${deltaSum >= 0 ? '+' : ''}${deltaSum}`)
  if (DRY) {
    console.log('[fix-iphone] dry-run: no se escribió nada')
    return
  }

  const now = new Date().toISOString()
  const byId = new Map(mock.products.map(p => [String(p.id), p]))
  for (const { p, esp, transferencia, mercadopago } of plans) {
    byId.set(String(p.id), {
      ...p,
      precio_transferencia: transferencia,
      precio_mercadopago: mercadopago,
      especificaciones: esp,
      specs: Object.values(esp).filter(v => typeof v === 'string' || typeof v === 'number'),
      updatedAt: now,
    })
  }
  mock.products = mock.products.map(p => byId.get(String(p.id)) || p)
  fs.writeFileSync(MOCK, JSON.stringify(mock, null, 2))
  const left = mock.products.filter(isTarget).length
  console.log(`[fix-iphone] Mock ok: ${plans.length} corregidos, quedan ${left} con fijo`)

  const { getFirestoreDb, COLLECTIONS } = await import(pathToFileURL(path.join(ROOT, 'server', 'firebase.js')).href)
  const db = getFirestoreDb()
  const col = db.collection(COLLECTIONS.PRODUCTS)
  const snap = await col.get()
  const bySku = new Map()
  for (const d of snap.docs) {
    const sku = String(d.data().sku || '').toUpperCase()
    if (sku) bySku.set(sku, d.ref)
  }
  let w = 0
  for (const { p, esp, transferencia, mercadopago } of plans) {
    const ref = bySku.get(String(p.sku || '').toUpperCase())
    if (!ref) {
      console.log(`  ! sin doc en Firestore: ${p.sku}`)
      continue
    }
    await ref.set({
      precio_transferencia: transferencia,
      precio_mercadopago: mercadopago,
      especificaciones: esp,
      specs: Object.values(esp).filter(v => typeof v === 'string' || typeof v === 'number'),
      updatedAt: now,
    }, { merge: true })
    w++
  }
  console.log(`[fix-iphone] Firestore: ${w} updates`)
}

main().catch(e => {
  console.error('[fix-iphone] Fatal:', e)
  process.exit(1)
})
