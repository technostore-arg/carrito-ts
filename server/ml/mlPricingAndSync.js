/**
 * server/ml/mlPricingAndSync.js — Pricing neto MLA + sincronizador acotado.
 *
 * `computeMlListingPlan` es pura: no hace IO y es testeable en memoria.
 * `syncHubToMercadoLibre` usa un repo inyectable y un mlClient inyectable.
 */
import { computeQuote, vatRateFor } from '../hub/pricingEngine.js'

export const DEFAULT_ML_CONFIG = Object.freeze({
  listingTypeId: 'gold_special',
  commissionByListingType: { gold_special: 0.13, gold_pro: 0.16 },
  minNetMargin: 0.12,
  targetNetMargin: 0.15,
  withholdingPercent: 2,
  freeShippingThreshold: 300000,
  shippingFixedCost: 15000,
  priceRound: 100,
  defaultCategoryId: 'MLA100147', // Computación genérica; configurable por repo
})

/**
 * Calcula el plan de publicación en MLA.
 * @param {{quote:object, master_product:object, ml_config?:object}} args
 */
export function computeMlListingPlan({ quote = {}, master_product = {}, ml_config = {} } = {}) {
  const cfg = { ...DEFAULT_ML_CONFIG, ...ml_config }
  const sku = String(quote.sku || master_product.sku || master_product.sku_interno || '')
  const listingTypeId = cfg.listingTypeId
  const vatRate = Number(quote.vat_rate) > 0
    ? Number(quote.vat_rate)
    : vatRateFor(master_product.category, cfg)
  const costArs = Math.max(0, Number(quote.cost_ars) || 0)
  const stock = Math.max(0, Math.floor(Number(quote.stock) || 0))
  const source = quote.stock_source || null
  const manufacturingDays = source === 'supplier' ? 2 : 0
  const manufacturingTime = source === 'supplier' ? '2 days' : null

  const base = {
    sku,
    listing_type_id: listingTypeId,
    vat_rate: vatRate,
    cost_ars: costArs,
    stock,
    stock_source: source,
    active_supplier: quote.active_supplier || null,
    manufacturing_days: manufacturingDays,
    manufacturing_time: manufacturingTime,
    free_shipping: false,
    price: null,
    min_price: null,
    net_margin: 0,
    net_profit: 0,
    reason: null,
  }

  if (quote.quarantined || stock === 0 || costArs <= 0) {
    return {
      ...base,
      status: 'paused',
      viable: false,
      reason: quote.quarantined ? `CUARENTENA:${(quote.quarantine_reasons || []).join(',')}` : 'SIN_STOCK',
    }
  }

  const commissionRate = cfg.commissionByListingType?.[listingTypeId] ?? 0.15
  const withholding = Number(cfg.withholdingPercent) / 100
  const marginMin = Number(cfg.minNetMargin)
  // netProfit/P = (1-w)/(1+IVA) - comisión - (costo+envío)/P >= margenMínimo
  const denomBase = (1 - withholding) / (1 + vatRate) - commissionRate - marginMin
  if (denomBase <= 0) {
    return { ...base, status: 'skipped_margin', viable: false, reason: 'MARGEN_IMPOSIBLE' }
  }

  const minPriceFor = shipping => (costArs + shipping) / denomBase
  let minPrice = minPriceFor(0)
  if (minPrice >= cfg.freeShippingThreshold) {
    const withShipping = minPriceFor(cfg.shippingFixedCost)
    if (withShipping > minPrice) minPrice = withShipping
  }
  if (!Number.isFinite(minPrice) || minPrice <= 0) {
    return { ...base, status: 'skipped_margin', viable: false, reason: 'PRECIO_NO_FACTIBLE' }
  }

  const step = Number(cfg.priceRound) || 1
  const price = Math.ceil(minPrice / step) * step
  const freeShipping = price >= cfg.freeShippingThreshold
  const shippingAbsorbed = freeShipping ? cfg.shippingFixedCost : 0
  const netRevenue = price / (1 + vatRate)
  const commissionAmount = price * commissionRate
  const withholdingAmount = netRevenue * withholding
  const netProfit = netRevenue - costArs - commissionAmount - shippingAbsorbed - withholdingAmount
  const netMargin = netProfit / price

  if (netMargin + 1e-9 < marginMin) {
    return { ...base, status: 'skipped_margin', viable: false, reason: 'MARGEN_INSUFICIENTE', min_price: minPrice }
  }

  return {
    ...base,
    status: 'active',
    viable: true,
    price,
    min_price: Math.ceil(minPrice),
    free_shipping: freeShipping,
    commission_rate: commissionRate,
    commission_amount: Math.round(commissionAmount * 100) / 100,
    shipping_absorbed: shippingAbsorbed,
    withholding_amount: Math.round(withholdingAmount * 100) / 100,
    vat_amount: Math.round((price - netRevenue) * 100) / 100,
    net_profit: Math.round(netProfit * 100) / 100,
    net_margin: Math.round(netMargin * 10000) / 10000,
  }
}

/** Payload para POST /items y PUT /items/{id}. */
export function buildMlItemPayload(master, plan, config = {}) {
  const staticData = master.staticData || master.static_data_json || {}
  const images = staticData.imagenes || []
  return {
    title: String(staticData.title || staticData.nombre || master.title || '').slice(0, 60),
    category_id: config.defaultCategoryId || DEFAULT_ML_CONFIG.defaultCategoryId,
    price: plan.price,
    available_quantity: plan.stock,
    listing_type_id: plan.listing_type_id,
    status: plan.status === 'active' ? 'active' : 'paused',
    manufacturing_time: plan.manufacturing_time,
    pictures: images.slice(0, 8).map(url => ({ source: url })),
  }
}

/**
 * Worker acotado: procesa un lote de productos activos del Hub.
 * @param {{repo:object, mlClient:object, dryRun?:boolean, batchSize?:number, offset?:number}} deps
 */
export async function syncHubToMercadoLibre({
  repo, mlClient, dryRun = false, batchSize = 50, offset = 0,
  now = () => new Date().toISOString(),
} = {}) {
  const config = await repo.getMlConfig()
  const inputs = await repo.getHubBatch({ limit: Math.min(Math.max(1, batchSize), 100), offset })
  let processed = 0, created = 0, updated = 0, paused = 0, skipped = 0, unchanged = 0
  const errors = []

  for (const input of inputs) {
    processed++
    try {
      const quote = computeQuote(input)
      const plan = computeMlListingPlan({ quote, master_product: input.master_product, ml_config: config })
      const masterId = input.master_product.id
      const existing = await repo.getMlListing(masterId)

      if (plan.status !== 'active') {
        if (!existing || existing.status === plan.status) { skipped++; continue }
        if (existing.ml_item_id && !dryRun) await mlClient.pauseItem(existing.ml_item_id)
        await repo.upsertMlListing({
          masterProductId: masterId,
          mlItemId: existing.ml_item_id,
          listingTypeId: existing.listing_type_id || plan.listing_type_id,
          publishedPrice: existing.published_price,
          publishedStock: plan.stock,
          manufacturingDays: plan.manufacturing_days,
          status: plan.status,
          lastSyncedAt: now(),
        })
        if (plan.status === 'paused') paused++
        else skipped++
        continue
      }

      const changed = !existing ||
        Number(existing.published_price ?? existing.publishedPrice) !== plan.price ||
        Number(existing.published_stock ?? existing.publishedStock) !== plan.stock ||
        Number(existing.manufacturing_days ?? existing.manufacturingDays) !== plan.manufacturing_days ||
        (existing.status || 'active') !== 'active'
      if (!changed) { unchanged++; continue }

      let mlItemId = existing?.ml_item_id || null
      if (mlItemId) {
        if (!dryRun) await mlClient.updateItem(mlItemId, buildMlItemPayload(input.master_product, plan, config))
        updated++
      } else {
        if (!dryRun) {
          const res = await mlClient.createItem(buildMlItemPayload(input.master_product, plan, config))
          mlItemId = res?.id || null
        }
        created++
      }

      await repo.upsertMlListing({
        masterProductId: masterId,
        mlItemId,
        listingTypeId: plan.listing_type_id,
        publishedPrice: plan.price,
        publishedStock: plan.stock,
        manufacturingDays: plan.manufacturing_days,
        status: plan.status,
        lastSyncedAt: now(),
      })
    } catch (e) {
      errors.push(`${input.master_product?.sku}: ${e.message}`)
    }
  }

  const summary = {
    job: 'syncHubToMercadoLibre', processed, created, updated, paused, skipped, unchanged,
    errors, status: errors.length ? 'warning' : 'ok', dryRun, batchSize, offset,
  }
  if (typeof repo.logSync === 'function') await repo.logSync(summary)
  return summary
}
