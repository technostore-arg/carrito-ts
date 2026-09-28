/** Smoke test de render (SSR) de los componentes nuevos/rediseñados. */
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const entry = path.join(ROOT, 'scripts', '.smoke-entry.jsx')
const out = path.join(ROOT, 'scripts', '.smoke-out.mjs')

fs.writeFileSync(entry, `
import { renderToString } from 'react-dom/server'
import { createElement as h } from 'react'
import FilterPanel from '../apps/technostore/src/components/FilterPanel.jsx'
import AppleSpotlight from '../apps/technostore/src/components/AppleSpotlight.jsx'
import Header from '../apps/technostore/src/components/Header.jsx'
import ProductCard from '../apps/technostore/src/components/ProductCard.jsx'
import ProductDetail from '../apps/technostore/src/components/ProductDetail.jsx'
import ProductGrid from '../apps/technostore/src/components/ProductGrid.jsx'
import { specOptions, buildRanges, specsForCat, canonCat, normText, matchQuery, matchNameSku } from '../apps/technostore/src/utils/specs.js'
import { getBrand } from '../apps/technostore/src/utils/brand.js'
import fs from 'node:fs'

const mock = JSON.parse(fs.readFileSync('server/.mock-data.json', 'utf8'))
const products = mock.products
const scoped = products.filter(p => canonCat(p.categoria) === 'celulares')
const marcas = [...new Set(scoped.map(getBrand))].sort()
const marcaCounts = {}
for (const p of scoped) marcaCounts[getBrand(p)] = (marcaCounts[getBrand(p)] || 0) + 1
const specOpts = specOptions(scoped)
const rangeOpts = buildRanges(scoped)
const counts = { todos: products.length, celulares: scoped.length }
const used = products.filter(p => p.condicion === 'usado')
if (used.length !== 73) throw new Error('usados != 73: ' + used.length)
const newIphones = products.filter(p => p.categoria === 'celulares' && /iphone/i.test(p.nombre || '') && p.condicion !== 'usado')
if (newIphones.length !== 35) throw new Error('iphone nuevos != 35: ' + newIphones.length)

const noop = () => {}
const panelHtml = renderToString(h(FilterPanel, {
  categoria: 'celulares', marcas: ['Apple'], rango: 'todos', orden: 'relevancia', cpu: '', ram: '', ssd: '',
  condicion: 'usado', calidad: 'A', batMin: 90,
  onCategoria: noop, onMarcas: noop, onRango: noop, onOrden: noop, onCpu: noop, onRam: noop, onSsd: noop,
  onCondicion: noop, onCalidad: noop, onBatMin: noop,
  marcasDisponibles: marcas, marcaCounts,
  cpuOptions: specOpts.cpus, ramOptions: specOpts.rams, ssdOptions: specOpts.ssds,
  rangeOptions: rangeOpts, visibleSpecs: specsForCat('celulares'), counts, hasUsed: true,
  chips: [{ id: 'cat', label: 'Celulares', onRemove: noop }, { id: 'm', label: 'Apple', onRemove: noop }],
  totalVisibles: 10, totalAll: products.length, hasFiltros: true, onLimpiar: noop,
  children: null }))
for (const needle of ['facet-title', 'Batería mínima', 'Calidad (usados)', 'chip', 'Batería']) {
  if (!panelHtml.includes(needle)) throw new Error('FilterPanel falta: ' + needle)
}
if (!panelHtml.includes('facet-opt active')) throw new Error('FilterPanel sin activos')

const spotHtml = renderToString(h(AppleSpotlight, { products, onOpen: noop, onVerTodos: noop }))
if (!spotHtml.includes('Apple en TechnoStore')) throw new Error('AppleSpotlight sin titulo')
if (!spotHtml.includes('Usado')) throw new Error('AppleSpotlight sin badge Usado')
if (!spotHtml.includes('Ver todo Apple')) throw new Error('AppleSpotlight sin CTA')

const hdrHtml = renderToString(h(Header, {
  search: 'iphone 13', onSearchChange: noop, onSelectCategory: noop,
  activeCategory: 'todos', activeBrand: 'Apple', cartCount: 2, onCart: noop,
  suggestions: products.slice(0, 3), onOpenProduct: noop, onSeeAllResults: noop,
}))
const hdrSrc = fs.readFileSync('apps/technostore/src/components/Header.jsx', 'utf8')
if (!hdrSrc.includes('search-suggest')) throw new Error('Header sin markup sugerencias')
if (!hdrHtml.includes('Buscar modelo')) throw new Error('Header sin input busqueda')
if (!hdrHtml.includes('nav-apple')) throw new Error('Header sin tile Apple')

const cardHtml = renderToString(h(ProductCard, { producto: used[0], onDetail: noop, onAddToCart: noop }))
if (!cardHtml.includes('Usado · 30 días')) throw new Error('ProductCard sin badge usado')
if (!cardHtml.includes('Calidad')) throw new Error('ProductCard sin chip calidad')

const detHtml = renderToString(h(ProductDetail, { producto: used[0], onClose: noop, onAddToCart: noop }))
if (!detHtml.includes('Garantía 30 días')) throw new Error('ProductDetail sin garantia')
if (detHtml.includes('_condicion')) throw new Error('ProductDetail filtra specs _')

const gridHtml = renderToString(h(ProductGrid, { products: used.slice(0, 5), totalLabel: '5 productos', onReset: noop, onDetail: noop, onAddToCart: noop }))
if (!gridHtml.includes('iPhone')) throw new Error('ProductGrid vacio')

// Lógica de filtro compuesta (réplica de App.visibles): Apple + usados + Calidad A + Bat >= 90
const vis = scoped.filter(p =>
  ['Apple'].includes(getBrand(p)) &&
  (p.condicion === 'usado' ? 'usado' : 'nuevo') === 'usado' &&
  (p.especificaciones?._calidad === 'A') &&
  ((Number(p.especificaciones?._bateria) || 0) >= 90)
)
if (vis.length === 0) throw new Error('filtro compuesto sin resultados')

// Búsqueda con sugerencias
const t = normText('iphone 17 pro')
const sug = products.filter(p => matchNameSku(p, t))
if (sug.length < 3) throw new Error('sugerencias iphone 17 pro < 3: ' + sug.length)

console.log('usados=' + used.length, 'nuevos=' + newIphones.length, 'filtroA+bat90=' + vis.length, 'sug=' + sug.length)
console.log('SMOKE OK')
`)

try {
  await build({
    entryPoints: [entry], bundle: true, outfile: out, format: 'esm', platform: 'node',
    jsx: 'automatic', loader: { '.js': 'jsx', '.jsx': 'jsx' }, packages: 'external',
    define: { 'import.meta.env.BASE_URL': '"/"' }, logLevel: 'silent',
  })
  await import(pathToFileURL(out).href)
} finally {
  for (const f of [entry, out]) { try { fs.unlinkSync(f) } catch {} }
}
