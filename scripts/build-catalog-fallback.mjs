/**
 * Genera server/catalog-fallback.json: el catálogo público de contingencia.
 *
 * Se usa SOLO si Firestore falla (caída o cuota excedida). Lo arma a partir de
 * server/.mock-data.json, que se mantiene sincronizado con producción.
 *
 * Uso: node scripts/build-catalog-fallback.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const MOCK = path.join(ROOT, 'server', '.mock-data.json')
const OUT = path.join(ROOT, 'server', 'catalog-fallback.js')

const mock = JSON.parse(fs.readFileSync(MOCK, 'utf8'))
const rows = (mock.products || [])
  .filter(p => p.active !== false && p.visibleEnTienda !== false)
  .map(p => {
    const { createdAt, updatedAt, ...rest } = p
    return rest
  })

// Módulo ESM: así el bundler de Vercel lo incluye siempre en la función.
const body = `// GENERADO por scripts/build-catalog-fallback.mjs — no editar a mano.\n// Catálogo público de contingencia (se usa solo si Firestore no responde).\nexport default ${JSON.stringify({ generatedAt: new Date().toISOString(), products: rows })}\n`
fs.writeFileSync(OUT, body)
const kb = Math.round(fs.statSync(OUT).size / 1024)
console.log(`[fallback] ${rows.length} productos visibles -> ${path.basename(OUT)} (${kb} KB)`)
