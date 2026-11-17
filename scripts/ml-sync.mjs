/**
 * CLI del conector MLA (sincronización, cola de webhooks, OAuth).
 *   node scripts/ml-sync.mjs --dry-run --batch 50
 *   node scripts/ml-sync.mjs --job webhooks
 *   node scripts/ml-sync.mjs --exchange-code <code>
 */
import { isPgConfigured, getPgPool, closePgPool } from '../server/hub/pg.js'
import { createMlRepository } from '../server/ml/mlRepository.js'
import { createMlClient } from '../server/ml/mlClient.js'
import { syncHubToMercadoLibre } from '../server/ml/mlPricingAndSync.js'
import { processPendingWebhooks } from '../server/ml/mlWebhooks.js'

const argv = process.argv.slice(2)
const flag = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback)
const dryRun = argv.includes('--dry-run')
const job = flag('--job', 'sync')

if (!isPgConfigured()) {
  console.error('Falta DATABASE_URL. Ejecutá con: node --env-file=.env scripts/ml-sync.mjs ...')
  process.exit(1)
}

const pool = getPgPool()
const repo = createMlRepository(pool)
const client = createMlClient({ repo })
try {
  if (argv.includes('--exchange-code')) {
    const code = flag('--exchange-code', '')
    console.log('[ml] OAuth:', JSON.stringify(await client.exchangeCode(code)))
  } else if (job === 'webhooks') {
    console.log('[ml] webhooks:', JSON.stringify(await processPendingWebhooks({ repo, mlClient: client, limit: Number(flag('--limit', 20)) })))
  } else {
    const summary = await syncHubToMercadoLibre({
      repo, mlClient: client, dryRun,
      batchSize: Number(flag('--batch', 50)),
      offset: Number(flag('--offset', 0)),
    })
    console.log('[ml] sync:', JSON.stringify(summary))
  }
} catch (e) {
  console.error('[ml] error:', e)
  process.exitCode = 1
} finally {
  await closePgPool()
}
