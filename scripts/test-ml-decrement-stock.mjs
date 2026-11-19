/**
 * Test: condición de carrera en repo.decrementStock (server/ml/mlRepository.js).
 * Antes de la corrección: dos descensos concurrentes con stock 2 y qty 2 → 2 "local" (overselling).
 * Después: 1 "local", 1 "supplier".
 */
import assert from 'node:assert/strict'
import { createMlRepository } from '../server/ml/mlRepository.js'

let stock = 2
const pool = {
  async query(sql) {
    if (sql.includes('UPDATE')) {
      const can = stock >= 2
      if (can) stock -= 2
      return { rows: can ? [{ raw_stock: stock }] : [] }
    }
    // SELECT: lectura concurrente estaleada ve stock 2
    return { rows: [{ supplier_code: 'LOCAL', raw_stock: 2 }] }
  },
}
const repo = createMlRepository(pool)
const calls = [repo.decrementStock({ masterProductId: 1, quantity: 2 }), repo.decrementStock({ masterProductId: 1, quantity: 2 })]
const results = await Promise.allSettled(calls)
const local = results.filter(r => r.status === 'fulfilled' && r.value?.fulfillmentSource === 'local').length
assert.equal(local, 1, `Fallo: ${local} órdenes con fulfillmentSource 'local' con stock 2 y qty 2 (se espera 1; race)`)
assert.equal(stock, 0, `Fallo: stock final ${stock} (se espera 0)`)
console.log('TEST ml-decrement-stock OK — local:', local, 'stock final:', stock)
