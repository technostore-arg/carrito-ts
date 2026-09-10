import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, '.mock-data.json')
const data = JSON.parse(fs.readFileSync(file, 'utf8'))

const before = data.products.length
data.products = data.products.filter(p => String(p.categoria || p.category || '').toLowerCase() !== 'workstations')
const removed = before - data.products.length
for (const p of data.products.filter(p => false)) { /* noop */ }

fs.writeFileSync(file, JSON.stringify(data, null, 2))
console.log(JSON.stringify({ removed, total: data.products.length }))
