/** Test: paginación según doc de Elit (query params, limit=100, sin offset=0), uri de /categorias, descripción e imágenes. */
import assert from 'node:assert/strict'
import { createElitClient } from '../server/hub/elitService.js'

const calls = []
const total = 150
const mkItem = i => ({
  id: i,
  codigo_alfa: `SKU-${i}`,
  nombre: `Producto ${i}`,
  marca: 'Lenovo',
  categoria: 'Periféricos',
  sub_categoria: 'Mouse',
  precio: 100,
  iva: 21,
  descripcion: `Descripción real ${i}`,
  imagenes: [`https://images.elit.com.ar/${i}.jpg`, `https://images.elit.com.ar/${i}-2.jpg`],
  stock_total: 7,
})

const fetchImpl = async (url, options) => {
  const u = new URL(url)
  const body = JSON.parse(options.body)
  calls.push({ path: u.pathname, query: Object.fromEntries(u.searchParams), user_id: body.user_id })
  const json = data => ({ ok: true, status: 200, text: async () => JSON.stringify(data) })
  if (u.pathname.endsWith('/categorias')) {
    return json({
      codigo: 200,
      categorias: [{ nombre: 'Periféricos', uri: 'perifericos', sub_categorias: [{ nombre: 'Mouse', uri: 'mouse' }] }],
      marcas: ['Lenovo'],
    })
  }
  if (u.pathname.endsWith('/productos')) {
    const offset = Number(u.searchParams.get('offset') || 0)
    const page = Array.from({ length: Math.min(100, total - offset) }, (_, j) => mkItem(offset + j + 1))
    return json({ codigo: 200, paginador: { total, limit: 100, offset }, resultado: page })
  }
  throw new Error('Unexpected ' + u.pathname)
}

const client = createElitClient({ userId: 'test', token: 'test', fetchImpl })
const items = await client.getCatalog()
assert.equal(items.length, total, `Se esperaban ${total} productos`)
assert.equal(items[0].description, 'Descripción real 1')
assert.equal(items[0].category, 'perifericos', 'Debe usar el uri oficial de /categorias')
assert.equal(items[0].categoryRaw, 'Periféricos')
assert.equal(items[0].images.length, 2)

const prodCalls = calls.filter(c => c.path.endsWith('/productos'))
assert.equal(prodCalls.length, 2, 'Deben ser 2 páginas (100 + 50)')
assert.equal(prodCalls[0].query.offset, undefined, 'La primera página NO debe enviar offset')
assert.equal(prodCalls[0].query.limit, '100')
assert.equal(prodCalls[0].query.imagenes, 'all')
assert.equal(prodCalls[1].query.offset, '100', 'El offset debe ser múltiplo de limit')
assert.ok(calls.some(c => c.path.endsWith('/categorias')), 'Debe consultar /categorias')

// Sync incremental: actualizacion como query param.
calls.length = 0
await client.getStockAndPrices({ since: '2026-11-01 00:00' })
const stockCalls = calls.filter(c => c.path.endsWith('/productos'))
assert.equal(stockCalls[0].query.actualizacion, '2026-11-01 00:00')

console.log('TEST elit-api-pagination OK')
