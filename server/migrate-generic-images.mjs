import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GENERIC_PHONE_IMG, GENERIC_NOTEBOOK_IMG, isAdminUpload } from './mock-store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, '.mock-data.json')
const data = JSON.parse(fs.readFileSync(file, 'utf8'))

let phones = 0, notebooks = 0, kept = 0
for (const p of data.products || []) {
  const cat = String(p.categoria || p.category || '').toLowerCase()
  if (cat !== 'celulares' && cat !== 'notebooks') continue
  const first = Array.isArray(p.imagenes) && p.imagenes[0] ? String(p.imagenes[0]) : (p.image ? String(p.image) : '')
  if (isAdminUpload(first)) { kept++; continue }
  const generic = cat === 'celulares' ? GENERIC_PHONE_IMG : GENERIC_NOTEBOOK_IMG
  p.imagenes = [generic]
  p.image = generic
  if (cat === 'celulares') phones++; else notebooks++
}

fs.writeFileSync(file, JSON.stringify(data, null, 2))
console.log(JSON.stringify({ phones, notebooks, keptAdminUploads: kept }))
