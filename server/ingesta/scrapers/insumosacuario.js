/**
 * server/ingesta/scrapers/insumosacuario.js
 * Scraper para insumosacuario.com.ar/hardware/
 * Extrae productos desde JSON-LD embebido en el HTML.
 * Ejecutar: node server/ingesta/scrapers/insumosacuario.js [--dry-run]
 * Importar: node server/ingesta/scrapers/insumosacuario.js --import
 */

const BASE = 'https://insumosacuario.com.ar/hardware/'
const SUBCATS = [
  'coolers', 'gabinetes', 'pasta-termica', 'discos-solidos-pci-e-m2',
  'memorias-ram-dimm', 'memorias-ram-sodimm', 'discos-solidos-sata',
  'procesadores-amd', 'gabinetes-con-fuente-'
]

const CAT_MAP = {
  coolers: 'accesorios',
  gabinetes: 'accesorios',
  'pasta-termica': 'accesorios',
  'discos-solidos-pci-e-m2': 'accesorios',
  'memorias-ram-dimm': 'accesorios',
  'memorias-ram-sodimm': 'accesorios',
  'discos-solidos-sata': 'accesorios',
  'procesadores-amd': 'accesorios',
  'gabinetes-con-fuente-': 'accesorios'
}

async function fetchPage(url) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`)
  return resp.text()
}

function extractJsonLd(html) {
  const products = []
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
  let m
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1])
      if (data['@type'] === 'CollectionPage' && data.mainEntity?.itemListElement) {
        for (const item of data.mainEntity.itemListElement) {
          const p = item.item
          if (p?.['@type'] === 'Product' && p.sku) {
            products.push({
              sku: p.sku,
              name: p.name,
              price: parseFloat(p.offers?.price) || 0,
              currency: p.offers?.priceCurrency || 'ARS',
              image: p.image || null,
              url: item.url,
              inStock: (p.offers?.availability || '').includes('InStock')
            })
          }
        }
      }
    } catch {}
  }
  return products
}

async function scrapeAll() {
  const all = new Map()
  for (const subcat of SUBCATS) {
    try {
      const html = await fetchPage(BASE + subcat + '/')
      const items = extractJsonLd(html)
      for (const item of items) {
        if (!all.has(item.sku)) {
          all.set(item.sku, { ...item, category: subcat })
        }
      }
      console.log(`  ${subcat}: +${items.length} (total unique: ${all.size})`)
    } catch (e) {
      console.error(`  ${subcat}: FAILED - ${e.message}`)
    }
  }
  return [...all.values()]
}

function normalizeForStore(products) {
  return products.map(p => ({
    sku: p.sku,
    nombre: p.name,
    precio: p.price,
    marca: 'insumosacuario',
    categoria: CAT_MAP[p.category] || 'accesorios',
    stock: p.inStock ? 10 : 0,
    tipo_venta: p.inStock ? 'directa' : 'directa',
    descripcion: p.name,
    imagenes: p.image ? [p.image] : [],
    fuente_origen: 'scraping_insumosacuario'
  }))
}

function diff(existingProducts, scrapedProducts) {
  const existingMap = new Map(existingProducts.map(p => [p.sku, p]))
  const scrapedMap = new Map(scrapedProducts.map(p => [p.sku, p]))

  const news = []
  const priceChanges = []
  const stockChanges = []
  const removed = []

  for (const [sku, scraped] of scrapedMap) {
    const ex = existingMap.get(sku)
    if (!ex) {
      news.push(scraped)
    } else {
      if (Math.abs((ex.precio || 0) - scraped.precio) > 1) {
        priceChanges.push({ sku, name: scraped.nombre, old: ex.precio, new: scraped.precio })
      }
      if ((ex.stock > 0) !== (scraped.stock > 0)) {
        stockChanges.push({ sku, name: scraped.nombre, oldStock: ex.stock, newStock: scraped.stock })
      }
    }
  }

  for (const [sku] of existingMap) {
    if (!scrapedMap.has(sku)) removed.push(sku)
  }

  return { news, priceChanges, stockChanges, removed }
}

// --- CLI mode ---
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const doImport = args.includes('--import')

  console.log('[insumosacuario] Scraping...')
  const scraped = await scrapeAll()
  console.log(`\n[insumosacuario] Total scraped: ${scraped.length}`)

  if (dryRun) {
    const normalized = normalizeForStore(scraped)
    console.log('\n[dry-run] Sample (first 5):')
    normalized.slice(0, 5).forEach(p => console.log(`  ${p.sku} | ${p.nombre} | ARS ${p.precio}`))
    return
  }

  if (doImport) {
    // Import via API
    const { mockStore } = await import('../../mock-store.js')
    const existing = mockStore.getProducts().filter(p => p.fuente_origen === 'scraping_insumosacuario' || p.marca === 'insumosacuario')
    const normalized = normalizeForStore(scraped)
    const changes = diff(existing, normalized)

    console.log(`\n[diff] New: ${changes.news.length} | Price changes: ${changes.priceChanges.length} | Stock changes: ${changes.stockChanges.length} | Removed: ${changes.removed.length}`)

    if (changes.news.length) {
      for (const p of changes.news) {
        mockStore.createProduct({
          sku: p.sku, nombre: p.nombre, precio: p.precio, marca: 'insumosacuario',
          categoria: p.categoria, stock: p.stock, tipo_venta: 'directa',
          descripcion: p.descripcion, imagenes: p.imagenes, fuente_origen: 'scraping_insumosacuario'
        })
      }
      console.log(`  Created ${changes.news.length} new products`)
    }

    for (const c of changes.priceChanges) {
      const p = existing.find(x => x.sku === c.sku) || mockStore.getProducts().find(x => x.sku === c.sku)
      if (p) mockStore.updateProduct(p.id, { precio: c.new })
    }
    for (const c of changes.stockChanges) {
      const p = existing.find(x => x.sku === c.sku) || mockStore.getProducts().find(x => x.sku === c.sku)
      if (p) mockStore.updateProduct(p.id, { stock: c.newStock })
    }

    console.log(`  Applied ${changes.priceChanges.length} price updates, ${changes.stockChanges.length} stock updates`)
  } else {
    console.log('\nTo import: node server/ingesta/scrapers/insumosacuario.js --import')
    console.log('Dry run only: node server/ingesta/scrapers/insumosacuario.js --dry-run')
  }
}

// Only run CLI when executed directly (not when imported as module)
const isMainModule = process.argv[1]?.endsWith('insumosacuario.js')
if (isMainModule) {
  main().catch(e => { console.error('[insumosacuario] Fatal:', e); process.exit(1) })
}

export { scrapeAll, normalizeForStore, diff, BASE, SUBCATS, CAT_MAP }
