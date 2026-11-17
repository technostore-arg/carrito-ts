/**
 * CLI de sincronización con Elit.
 *   node scripts/elit-sync.mjs --mode catalog|stock [--dry-run]
 *   node --env-file=.env scripts/elit-sync.mjs --mode stock
 */
import { getPgPool, isPgConfigured, closePgPool } from '../server/hub/pg.js'
import { createElitClient } from '../server/hub/elitService.js'
import { createPgRepository } from '../server/hub/pgRepository.js'
import { syncElitCatalog, syncElitStockAndPrices } from '../server/hub/sync.js'

const argv = process.argv.slice(2)
const mode = argv.includes('--mode') ? argv[argv.indexOf('--mode') + 1] : 'stock'
const dry = argv.includes('--dry-run')
if (!['catalog', 'stock'].includes(mode)) {
  console.error('Modo inválido. Usá --mode catalog o --mode stock')
  process.exit(1)
}

const client = createElitClient()
console.log(`[elit] modo API: ${client.mode} | worker: ${mode}${dry ? ' (dry-run)' : ''}`)

if (dry) {
  const items = mode === 'catalog' ? await client.getCatalog() : await client.getStockAndPrices()
  console.log(`[elit] ${items.length} items de ejemplo:`)
  for (const i of items.slice(0, 10)) {
    console.log(`  ${i.supplierSku} | ${i.category} | USD ${i.costAmount} | stock ${i.rawStock}`)
  }
  process.exit(0)
}

if (!isPgConfigured()) {
  console.error('Falta DATABASE_URL. Ejecutá con: node --env-file=.env scripts/elit-sync.mjs --mode ' + mode)
  process.exit(1)
}

const pool = getPgPool()
const repo = createPgRepository(pool)
try {
  const result = mode === 'catalog'
    ? await syncElitCatalog({ client, repo })
    : await syncElitStockAndPrices({ client, repo })
  console.log('[elit] resultado:', JSON.stringify(result))
  if (result.errors?.length) process.exitCode = 2
} catch (e) {
  console.error('[elit] error fatal:', e)
  process.exitCode = 1
} finally {
  await closePgPool()
}
