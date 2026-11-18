/** Aplica las migraciones SQL del hub en orden. Requiere DATABASE_URL. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { isPgConfigured } from '../server/hub/pg.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(__dirname, '..', 'db', 'migrations')

if (!isPgConfigured()) {
  console.error('Falta DATABASE_URL. Ejecutá: node --env-file=.env.local scripts/migrate-pg.mjs')
  process.exit(1)
}

// Migraciones: conexión DIRECTA (sin -pooler). Neon la expone como DATABASE_URL_UNPOOLED.
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  ssl: process.env.PG_SSL === '0' ? undefined : { rejectUnauthorized: false },
  max: 1,
})
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
try {
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    process.stdout.write(`[migrate] ${file} ... `)
    await pool.query(sql)
    console.log('OK')
  }
  console.log(`[migrate] ${files.length} migraciones aplicadas`)
} finally {
  await pool.end()
}
