import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GENERIC_PHONE_IMG, GENERIC_NOTEBOOK_IMG, GENERIC_WORKSTATION_IMG, isAdminUpload } from './mock-store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, '.mock-data.json')
const data = JSON.parse(fs.readFileSync(file, 'utf8'))

const GENERICS = { celulares: GENERIC_PHONE_IMG, notebooks: GENERIC_NOTEBOOK_IMG, workstations: GENERIC_WORKSTATION_IMG }

let counts = { celulares: 0, notebooks: 0, workstations: 0 }, kept = 0
for (const p of data.products || []) {
  const cat = String(p.categoria || p.category || '').toLowerCase()
  if (!GENERICS[cat]) continue
  const first = Array.isArray(p.imagenes) && p.imagenes[0] ? String(p.imagenes[0]) : (p.image ? String(p.image) : '')
  if (isAdminUpload(first)) { kept++; continue }
  p.imagenes = [GENERICS[cat]]
  p.image = GENERICS[cat]
  counts[cat]++
}

fs.writeFileSync(file, JSON.stringify(data, null, 2))
console.log(JSON.stringify({ ...counts, keptAdminUploads: kept }))
