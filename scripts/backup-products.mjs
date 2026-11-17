/**
 * Respaldo local antes de vaciar el catálogo (no se sube a git).
 * Lee todos los productos de Firestore y los guarda en un JSON en la carpeta del proyecto.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const { getFirestoreDb, COLLECTIONS } = await import(pathToFileURL(path.join(ROOT, 'server', 'firebase.js')).href)
const snap = await getFirestoreDb().collection(COLLECTIONS.PRODUCTS).get()
const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
const out = path.join(ROOT, `productos-backup-${new Date().toISOString().slice(0, 10)}.json`)
fs.writeFileSync(out, JSON.stringify(rows, null, 2))
console.log(`[backup] ${rows.length} productos -> ${path.basename(out)} (${Math.round(fs.statSync(out).size / 1024)} KB)`)
