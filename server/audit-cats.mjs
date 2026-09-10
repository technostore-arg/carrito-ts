import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, '.mock-data.json')
const data = JSON.parse(fs.readFileSync(file, 'utf8'))

const VALID = ['celulares', 'notebooks', 'computadoras', 'gpus', 'memorias', 'workstations', 'accesorios', 'coolers', 'ram', 'ram-sodimm', 'ssd-nvme', 'ssd-sata', 'gabinetes', 'watercooling', 'procesadores']

const cats = {}
for (const p of data.products || []) {
  const c = String(p.categoria || p.category || '(vacia)').toLowerCase()
  cats[c] = (cats[c] || 0) + 1
}
console.log('== distribución ==')
for (const [k, v] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${v}x ${k}${VALID.includes(k) ? '' : '  <-- NO VALIDA'}`)
}

// sospechosos: workstations a borrar, categorías raras, sin nombre/sku
console.log('== workstations ==')
for (const p of data.products.filter(p => String(p.categoria || '').toLowerCase() === 'workstations')) {
  console.log(`  ${p.sku} | ${p.nombre}`)
}
console.log('total:', data.products.length)
