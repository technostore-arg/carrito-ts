/**
 * Pool PostgreSQL lazy. Si no hay DATABASE_URL el hub queda desactivado
 * y los consumidores siguen usando la capa Firestore anterior.
 */
import pg from 'pg'

let _pool = null

export function isPgConfigured() {
  return !!(process.env.DATABASE_URL || '').trim()
}

export function getPgPool() {
  if (!isPgConfigured()) throw new Error('DATABASE_URL no configurada')
  if (!_pool) {
    _pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX) || 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.PG_SSL === '0' ? undefined : { rejectUnauthorized: false },
    })
  }
  return _pool
}

export async function closePgPool() {
  if (_pool) { await _pool.end(); _pool = null }
}
