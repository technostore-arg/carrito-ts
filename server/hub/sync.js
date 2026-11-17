/**
 * server/hub/sync.js — Workers de sincronización con Elit.
 *
 * Ambos workers reciben un `repo` inyectable (ver pgRepository.js), lo que
 * permite testearlos con un repo en memoria sin PostgreSQL.
 */
import { vatRateFor, quarantineReason, MAX_PRICE_DROP_RATIO } from './pricingEngine.js'

/** @param {object} item @param {object} config */
function masterFromItem(item, config) {
  return {
    sku: `ELIT-${item.supplierSku}`,
    ean: item.ean,
    mpn: item.mpn,
    title: item.title || item.supplierSku,
    brand: item.brand || 'Genérica',
    category: item.category || 'accesorios',
    vatRate: vatRateFor(item.category, config),
    staticData: {
      descripcion: item.title || '',
      imagenes: item.imageUrl ? [item.imageUrl] : [],
      fuente_origen: 'elit',
    },
  }
}

/**
 * Importación / actualización de fichas, imágenes y mapeo EAN/MPN.
 * @param {{client:object, repo:object}} deps
 */
export async function syncElitCatalog({ client, repo }) {
  const started = Date.now()
  const items = await client.getCatalog()
  const config = await repo.getConfig()
  let created = 0, updated = 0, quarantined = 0
  const errors = []

  for (const item of items) {
    try {
      if (!item.supplierSku) { errors.push('item sin supplierSku'); continue }
      let master = await repo.findMaster({ ean: item.ean, mpn: item.mpn, supplierSku: item.supplierSku })
      if (!master) {
        master = await repo.upsertMaster(masterFromItem(item, config))
        created++
      } else {
        await repo.upsertMaster({ ...masterFromItem(item, config), sku: master.sku })
        updated++
      }
      const reason = quarantineReason({ ...item, prevCostAmount: master?.prevCostAmount })
      if (reason) quarantined++
      await repo.upsertListing(master.id || master.sku, {
        supplierCode: 'ELIT',
        supplierSku: item.supplierSku,
        costAmount: item.costAmount,
        costCurrency: item.costCurrency,
        rawStock: item.rawStock,
        lastSyncedAt: new Date().toISOString(),
        quarantineReason: reason,
      })
    } catch (e) {
      errors.push(`${item.supplierSku}: ${e.message}`)
    }
  }

  const summary = {
    job: 'syncElitCatalog', supplier: 'ELIT', status: errors.length ? 'warning' : 'ok',
    processed: items.length, created, updated, quarantined, errors, durationMs: Date.now() - started,
  }
  await repo.log(summary)
  return summary
}

/**
 * Actualización rápida (15 min) de costos y stock. No toca fichas ni fotos.
 * @param {{client:object, repo:object}} deps
 */
export async function syncElitStockAndPrices({ client, repo }) {
  const started = Date.now()
  const items = await client.getStockAndPrices()
  let processed = 0, updated = 0, quarantined = 0, skipped = 0
  const errors = []

  for (const item of items) {
    try {
      processed++
      const listing = await repo.findListing('ELIT', item.supplierSku)
      if (!listing) { skipped++; continue }

      const prev = listing.costAmount
      const reason = quarantineReason({
        costAmount: item.costAmount,
        costCurrency: item.costCurrency,
        rawStock: item.rawStock,
        prevCostAmount: prev,
      })
      if (reason) quarantined++
      await repo.upsertListing(listing.masterId || listing.master_product_id, {
        supplierCode: 'ELIT',
        supplierSku: item.supplierSku,
        costAmount: item.costAmount,
        costCurrency: item.costCurrency,
        rawStock: item.rawStock,
        lastSyncedAt: new Date().toISOString(),
        prevCostAmount: reason && prev > 0 ? prev : null,
        quarantineReason: reason,
      })
      updated++
    } catch (e) {
      errors.push(`${item.supplierSku}: ${e.message}`)
    }
  }

  const summary = {
    job: 'syncElitStockAndPrices', supplier: 'ELIT', status: errors.length ? 'warning' : 'ok',
    processed, updated, skipped, quarantined, errors, durationMs: Date.now() - started,
    priceDropGuard: `${Math.round(MAX_PRICE_DROP_RATIO * 100)}%`,
  }
  await repo.log(summary)
  return summary
}
