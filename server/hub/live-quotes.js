/**
 * Adaptador del hub PostgreSQL para `/api/products/live`.
 * Devuelve `null` si el hub no está configurado, para que el endpoint
 * siga usando Firestore/mock sin romper el deployed actual.
 */
import { isPgConfigured } from './pg.js'
import { getPricingConfig, getQuoteInputs } from './repository.js'
import { computeQuote, toLegacyQuote } from './pricingEngine.js'

export async function getLiveQuotesFromHub(skus) {
  if (!isPgConfigured()) return null
  const config = await getPricingConfig()
  const inputs = await getQuoteInputs(skus, config)
  /** @type {Record<string, object>} */
  const quotes = {}
  for (const input of inputs) {
    const q = computeQuote(input)
    quotes[q.sku] = {
      ...q,
      ...toLegacyQuote(q),
      updatedAt: new Date().toISOString(),
    }
  }
  return { quotes, source: 'hub-postgres', configVersion: config.usdArsRate }
}
