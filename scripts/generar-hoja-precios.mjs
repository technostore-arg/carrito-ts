import pg from 'pg'
import fs from 'node:fs'
import { computeQuote, DEFAULT_CONFIG } from '../server/hub/pricingEngine.js'

const raw = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => l && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const pool = new pg.Pool({ connectionString: raw.DATABASE_URL, ssl: { rejectUnauthorized: false } })

const configRow = (await pool.query('SELECT * FROM pricing_config WHERE id = 1')).rows[0] || {}
const config = {
  usdArsRate: Number(configRow.usd_ars_rate) || DEFAULT_CONFIG.usdArsRate,
  // La DB todavía tiene 16%; el sitio desplegado usa el 20% del DEFAULT_CONFIG.
  listSurchargePercent: DEFAULT_CONFIG.listSurchargePercent,
  safetyStockThreshold: Number(configRow.safety_stock_threshold) || 3,
  categoryMargins: typeof configRow.category_margins === 'string' ? JSON.parse(configRow.category_margins) : (configRow.category_margins || {}),
  vatByCategory: typeof configRow.vat_by_category === 'string' ? JSON.parse(configRow.vat_by_category) : (configRow.vat_by_category || {}),
  minAbsoluteProfit: configRow.min_absolute_profit != null ? Number(configRow.min_absolute_profit) : DEFAULT_CONFIG.minAbsoluteProfit,
}
const { rows } = await pool.query(`
  SELECT p.id, p.sku_interno, p.title, p.brand, p.category, p.vat_rate, p.static_data_json,
         l.cost_amount, l.cost_currency, l.raw_stock, l.quarantine_reason
  FROM master_products p JOIN supplier_listings l ON l.master_product_id = p.id
  WHERE p.is_active AND l.raw_stock > 0 ORDER BY p.id`)

const num = n => Math.round(Number(n) || 0)
const out = []
for (const r of rows) {
  const sd = typeof r.static_data_json === 'string' ? JSON.parse(r.static_data_json) : (r.static_data_json || {})
  const q = computeQuote({
    master_product: { sku: r.sku_interno, title: r.title, brand: r.brand, category: r.category, vatRate: Number(r.vat_rate), staticData: sd },
    supplier_listings: [{ supplierCode: 'ELIT', supplierSku: r.sku_interno, costAmount: r.cost_amount, costCurrency: r.cost_currency, rawStock: r.raw_stock, quarantineReason: r.quarantine_reason }],
    pricing_config: config,
  })
  if (!q.price_transfer) continue
  const transfer = q.price_transfer
  const lista = q.price_list
  const costo = num(q.cost_ars)
  const iva = num(q.cost_with_vat) - costo
  const ganancia = transfer - num(q.cost_with_vat)
  const recargo = lista - transfer
  // Comisión estimada de la pasarela sobre lo cobrado (16,67% = 1 - 1/1,2)
  const comision = Math.round(lista * (1 - 1 / 1.2))
  out.push({
    sku: r.sku_interno, nombre: r.title, marca: r.brand, categoria: r.category, stock: r.raw_stock,
    moneda_costo: r.cost_currency, costo_original: Number(r.cost_amount) || 0,
    tipo_cambio: config.usdArsRate, costo_ars: costo, iva_porcentaje: (q.vat_rate * 100).toFixed(1) + '%',
    iva_ars: iva, costo_con_iva: num(q.cost_with_vat), margen_porcentaje: (q.margin * 100).toFixed(1) + '%',
    piso_ganancia_aplicado: q.min_profit_applied ? 'SI' : 'NO',
    precio_transferencia: transfer, ganancia_ars: ganancia, ganancia_porcentaje: ((ganancia / num(q.cost_with_vat)) * 100).toFixed(1) + '%',
    precio_tarjeta: lista, recargo_tarjeta: recargo, comision_pasarela_estimada: comision,
    neto_recibido_tarjeta: lista - comision, cuota_3: Math.round(lista / 3), cuota_6: Math.round(lista / 6),
  })
}

const header = ['SKU', 'Producto', 'Marca', 'Categoría', 'Stock', 'Moneda costo', 'Costo original', 'Tipo de cambio', 'Costo ARS', 'IVA %', 'IVA ARS', 'Costo con IVA', 'Margen %', 'Piso ganancia aplicado', 'Precio transferencia', 'Ganancia ARS', 'Ganancia %', 'Precio tarjeta', 'Recargo tarjeta', 'Comisión pasarela estimada', 'Neto recibido tarjeta', 'Cuota 3', 'Cuota 6']
const keys = Object.keys(out[0] || {})
const rules = [
  `# Análisis de precios TechnoStore — generado ${new Date().toLocaleString('es-AR')}`,
  `# Reglas: IVA 10,5% hardware / 21%general · margen por categoría · piso de ganancia $${config.minAbsoluteProfit} sobre costo con IVA`,
  `# Recargo tarjeta ${config.listSurchargePercent}% · comisión pasarela estimada 16,67% (referencia: cobro $300.000 en 3 cuotas -> acreditado ~$250.000)`,
  `# Tipo de cambio: ${config.usdArsRate} ARS por USD`,
  '',
]
const lines = [...rules, header.join(';'), ...out.map(o => keys.map(k => String(o[k] ?? '').replace(/;/g, ',')).join(';'))]
const dest = 'C:\\Users\\Usuario\\Desktop\\carrito\\analisis_precios.csv'
fs.writeFileSync(dest, '\uFEFF' + lines.join('\r\n'), 'utf8')
console.log('filas:', out.length, '->', dest)
console.log('ejemplo:', JSON.stringify(out[0]))
await pool.end()
