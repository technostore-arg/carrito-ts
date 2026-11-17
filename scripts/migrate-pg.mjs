/** Aplica las migraciones SQL del hub en orden. Requiere DATABASE_URL. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPgPool, isPgConfigured, closePgPool } from '../server/hub/pg.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(__dirname, '..', 'db', 'migrations')

if (!isPgConfigured()) {
  console.error('Falta DATABASE_URL. Ejecutá: node --env-file=.env scripts/migrate-pg.mjs')
  process.exit(1)
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
const pool = getPgPool()
try {
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    process.stdout.write(`[migrate] ${file} ... `)
    await pool.query(sql)
    console.log('OK')
  }
  console.log(`[migrate] ${files.length} migraciones aplicadas`)
} finally {
  await closePgPool()
}
