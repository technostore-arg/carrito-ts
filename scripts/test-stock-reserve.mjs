/**
 * Test: condición de carrera en repo.reserveStock (server/agent/agentRepository.js).
 * Antes de la corrección: dos reserves concurrentes con stock=2 y qty=2 → 2 éxitos (overselling).
 * Después: solo 1 éxito.
 */
import assert from 'node:assert/strict'
import { createAgentRepository } from '../server/agent/agentRepository.js'

let stock = 2
const pool = {
  async query(sql, params = []) {
    if (sql.includes('SELECT raw_stock')) {
      // Lecturas concurrentes ven 2 (gancho del TOCTOU: check y update no son atómicos).
      return { rows: [{ raw_stock: 2 }] }
    }
    if (sql.includes('UPDATE supplier_listings')) {
      const can = stock >= params[1]
      if (can) stock -= params[1]
      return { rows: can ? [{ raw_stock: stock }] : [] }
    }
    throw new Error('SQL inesperado: ' + sql.slice(0, 80))
  },
}
const repo = createAgentRepository(pool)
const calls = [
  repo.reserveStock({ masterProductId: 1, quantity: 2, preferredSource: 'local' }),
  repo.reserveStock({ masterProductId: 1, quantity: 2, preferredSource: 'local' }),
]
const results = await Promise.allSettled(calls)
const ok = results.filter(r => r.status === 'fulfilled').length
const rejection = results.find(r => r.status === 'rejected')?.reason?.message || ''
assert.equal(ok, 1, `Fallo: ${ok} reservas exitosas con stock 2 y qty 2 (se espera 1; race: ${rejection})`)
assert.equal(stock, 0, `Fallo: stock final ${stock} (se espera 0)`)
console.log('TEST stock-reserve OK — reservas exitosas:', ok, 'stock final:', stock)
