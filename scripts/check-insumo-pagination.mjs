import fs from 'node:fs'

async function fetchText(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url)
  return r.text()
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
          if (p?.['@type'] === 'Product' && p.sku) products.push({ sku: p.sku, name: p.name })
        }
      }
    } catch {}
  }
  return products
}

function countProductLinks(html, sub) {
  const set = new Set()
  const re = new RegExp('href="(https://insumosacuario\\.com\\.ar/hardware/' + sub + '/[^"]+\\.html)"', 'g')
  let m
  while ((m = re.exec(html)) !== null) set.add(m[1])
  return set.size
}

function findPageHints(html) {
  const out = new Set()
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const h = m[1]
    if (/page|pag=|\/p\d+|offset|start=/.test(h)) out.add(h)
  }
  // botones de paginación textuales
  if (/siguiente|next|›|»/i.test(html)) out.add('HAS_NEXT_TEXT')
  return [...out].slice(0, 15)
}

const SUBCATS = [
  'coolers', 'gabinetes', 'pasta-termica', 'discos-solidos-pci-e-m2',
  'memorias-ram-dimm', 'memorias-ram-sodimm', 'discos-solidos-sata',
  'procesadores-amd', 'gabinetes-con-fuente-', 'fuentes',
  'motherboard-amd', 'motherboard-intel', 'placas-de-video-amd',
  'placas-de-video-nvidia', 'procesadores-intel', 'discos-internos-hdd',
  'memorias-p-server',
]

const BASE = 'https://insumosacuario.com.ar/hardware/'

for (const sub of SUBCATS) {
  try {
    const html = await fetchText(BASE + sub + '/')
    const items = extractJsonLd(html)
    const links = countProductLinks(html, sub)
    const hints = findPageHints(html)
    console.log(sub + ': jsonld=' + items.length + ' links=' + links + ' hints=' + JSON.stringify(hints))
  } catch (e) {
    console.log(sub + ': FAIL ' + e.message)
  }
}
