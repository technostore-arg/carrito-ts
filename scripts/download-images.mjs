import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '..', 'apps', 'technostore', 'public', 'images', 'celulares')

// Cada entrada: regex sobre nombre en mayúsculas -> slug GSMArena bigpic
const MAP = [
  // Xiaomi POCO F - más específicos primero
  { re: /POCO F7 ULTRA/i, slug: 'xiaomi-poco-f7-ultra' },
  { re: /POCO F8 ULTRA/i, slug: 'xiaomi-poco-f8-ultra' },
  { re: /POCO F8 PRO/i, slug: 'xiaomi-poco-f8-pro' },
  { re: /POCO F5 PRO/i, slug: 'xiaomi-poco-f5-pro-2' },
  { re: /POCO F7 PRO/i, slug: 'xiaomi-poco-f7-pro' },
  { re: /POCO F7\b/i, slug: 'xiaomi-poco-f7' },
  { re: /POCO F5\b/i, slug: 'xiaomi-poco-f5-2' },
  { re: /POCO F1/i, slug: 'xiaomi-pocophone-f1-' },
  // POCO X
  { re: /POCO X8 PRO MAX/i, slug: 'xiaomi-poco-x8-pro' },
  { re: /POCO X8 PRO/i, slug: 'xiaomi-poco-x8-pro' },
  { re: /POCO X7 PRO/i, slug: 'xiaomi-poco-x7-pro' },
  { re: /POCO X7\b/i, slug: 'xiaomi-poco-x7' },
  { re: /POCO X6 PRO/i, slug: 'xiaomi-poco-x6-pro' },
  { re: /POCO X4 PRO/i, slug: 'xiaomi-poco-x4-pro' },
  { re: /POCO X3 GT/i, slug: 'xiaomi-poco-x3' },
  // POCO M
  { re: /POCO M8 PRO/i, slug: 'xiaomi-poco-m8-pro' },
  { re: /POCO M8\b/i, slug: 'xiaomi-poco-m8' },
  { re: /POCO M7 PRO/i, slug: 'xiaomi-poco-m7-pro-5g' },
  { re: /POCO M7\b/i, slug: 'xiaomi-poco-m7-5g' },
  { re: /POCO M6\b/i, slug: 'xiaomi-poco-m6-pro-5g' },
  { re: /POCO M3/i, slug: 'xiaomi-poco-m3' },
  // POCO C
  { re: /POCO C85/i, slug: 'xiaomi-poco-c85' },
  { re: /POCO C71/i, slug: 'xiaomi-poco-c71' },
  { re: /POCO C65/i, slug: 'xiaomi-poco-c65' },
  // Xiaomi MI
  { re: /MI 17 ULTRA/i, slug: 'xiaomi-17-ultra' },
  { re: /MI 17T PRO/i, slug: 'xiaomi-17t-pro' },
  { re: /MI 17T\b/i, slug: 'xiaomi-17t' },
  { re: /MI 17\b/i, slug: 'xiaomi-17' },
  { re: /MI 15T PRO/i, slug: 'xiaomi-15t-pro' },
  { re: /MI 15T\b/i, slug: 'xiaomi-15t' },
  { re: /MI 13T PRO/i, slug: 'xiaomi-13t-pro' },
  { re: /MI 13 LITE/i, slug: 'xiaomi-13-lite' },
  { re: /MI 12 LITE/i, slug: 'xiaomi-12-lite-5g' },
  { re: /MIX FLIP/i, slug: 'xiaomi-mix-flip' },
  // REDMI NOTE 15
  { re: /NOTE 15 PRO PLUS/i, slug: 'xiaomi-redmi-note-15-pro-plus-5g' },
  { re: /NOTE 15 PRO/i, slug: 'xiaomi-redmi-note-15-pro-5g' },
  { re: /NOTE 15\b/i, slug: 'xiaomi-redmi-note-15-pro-5g' },
  // XIAOMI NOTE 15 PRO PLUS (prefijo XIAOMI)
  { re: /XIAOMI NOTE 15 PRO PLUS/i, slug: 'xiaomi-redmi-note-15-pro-plus-5g' },
  // REDMI NOTE 14
  { re: /NOTE 14 PRO PLUS/i, slug: 'xiaomi-redmi-note-14-pro-plus-5g' },
  { re: /NOTE 14 PRO/i, slug: 'xiaomi-redmi-note-14-pro-5g' },
  { re: /NOTE 14S/i, slug: 'xiaomi-redmi-note-14-5g' },
  { re: /NOTE 14\b/i, slug: 'xiaomi-redmi-note-14-5g' },
  // REDMI NOTE 13
  { re: /NOTE 13 PRO PLUS/i, slug: 'xiaomi-redmi-note-13-pro-plus' },
  { re: /NOTE 13 PRO/i, slug: 'xiaomi-redmi-note-13-pro' },
  // REDMI NOTE 12
  { re: /NOTE 12 PRO PLUS/i, slug: 'xiaomi-redmi-note-12-pro-plus' },
  { re: /NOTE 12 PRO/i, slug: 'xiaomi-redmi-note-12-pro' },
  { re: /NOTE 12\b/i, slug: 'xiaomi-redmi-note-12-5g' },
  // REDMI NOTE 11
  { re: /NOTE 11S 5G/i, slug: 'xiaomi-redmi-note-11s-5g' },
  { re: /NOTE 11\b/i, slug: 'xiaomi-redmi-note-11-4g' },
  // NOTE 9S
  { re: /NOTE 9S/i, slug: 'xiaomi-redmi-note-9-pro' },
  // REDMI genérico
  { re: /REDMI A5/i, slug: 'xiaomi-redmi-a5-4g' },
  { re: /REDMI 1[45]C/i, slug: 'xiaomi-redmi-14c' },
  { re: /REDMI 13\b/i, slug: 'xiaomi-redmi-13' },
  { re: /REDMI 15\b/i, slug: 'xiaomi-redmi-14c' },
  { re: /REDMI 17\b/i, slug: 'xiaomi-redmi-14c' },
  { re: /REDMI/i, slug: 'xiaomi-redmi-14c' },
  // XIAOMI A7 PRO (no existe, usar A3)
  { re: /XIAOMI A7 PRO/i, slug: 'xiaomi-redmi-a3' },
  // Samsung S25/S26/Z Fold - algunos no existen aún, usar closest
  { re: /S26 ULTRA/i, slug: 'samsung-galaxy-s26-ultra' },
  { re: /S26 PLUS/i, slug: 'samsung-galaxy-s26-plus' },
  { re: /S26\b/i, slug: 'samsung-galaxy-s26' },
  { re: /S25 ULTRA/i, slug: 'samsung-galaxy-s25-ultra-sm-s938' },
  { re: /S25 FE/i, slug: 'samsung-galaxy-s25-fe' },
  { re: /S24 FE/i, slug: 'samsung-galaxy-s24-fe-5g' },
  { re: /Z FOLD 8 ULTRA/i, slug: 'samsung-galaxy-z-fold7' },
  { re: /Z FOLD 8\b/i, slug: 'samsung-galaxy-z-fold6' },
  { re: /SAMSUNG A07/i, slug: 'samsung-galaxy-a07' },
  { re: /SAMSUNG A06/i, slug: 'samsung-galaxy-a06-5g' },
  { re: /SAMSUNG A05S/i, slug: 'samsung-galaxy-a05s' },
  { re: /SAMSUNG A04S/i, slug: 'samsung-galaxy-a04s' },
  { re: /SAMSUNG A04E/i, slug: 'samsung-galaxy-a04e' },
  { re: /SAMSUNG A04\b/i, slug: 'samsung-galaxy-a04' },
  { re: /SAMSUNG A03 CORE/i, slug: 'samsung-galaxy-a03-core' },
  { re: /SAMSUNG A03/i, slug: 'samsung-galaxy-a03' },
  { re: /SAMSUNG A14/i, slug: 'samsung-galaxy-a14-5g' },
  { re: /SAMSUNG A12/i, slug: 'samsung-galaxy-a12-nacho' },
  { re: /SAMSUNG/i, slug: 'samsung-galaxy-a14-5g' },
]

function slugFor(nombre) {
  for (const { re, slug } of MAP) if (re.test(nombre)) return slug
  return 'xiaomi-redmi-note-13-pro'
}

const prods = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', '.mock-data.json'), 'utf8').replace(/^\uFEFF/, '')).products

// Agrupar por nombre único
const byNombre = new Map()
for (const p of prods) {
  if (!byNombre.has(p.nombre)) byNombre.set(p.nombre, { nombre: p.nombre, slug: slugFor(p.nombre), skus: [] })
  byNombre.get(p.nombre).skus.push(p.sku)
}

console.log(`Modelos únicos: ${byNombre.size}`)
for (const [nombre, info] of byNombre) {
  console.log(`  ${nombre} -> ${info.slug} (${info.skus.length} variantes)`)
}

// Descargar cada slug único
const uniqueSlugs = [...new Set([...byNombre.values()].map(v => v.slug))]
console.log(`\nSlugs únicos a descargar: ${uniqueSlugs.length}`)
console.log(uniqueSlugs.join('\n'))

fs.mkdirSync(OUT, { recursive: true })

// Descargar en paralelo (límite 6 concurrentes)
async function download(slug) {
  const url = `https://fdn2.gsmarena.com/vv/bigpic/${slug}.jpg`
  const dest = path.join(OUT, `${slug}.jpg`)
  if (fs.existsSync(dest) && fs.statSync(dest).size > 5000) {
    console.log(`  skip ${slug} (ya existe)`)
    return slug
  }
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 3000) throw new Error(`muy chico: ${buf.length}`)
    fs.writeFileSync(dest, buf)
    console.log(`  OK ${slug} (${(buf.length/1024).toFixed(0)}KB)`)
    return slug
  } catch (e) {
    console.log(`  FAIL ${slug}: ${e.message}`)
    return null
  }
}

let ok = 0, fail = 0
for (let i = 0; i < uniqueSlugs.length; i += 6) {
  const batch = uniqueSlugs.slice(i, i + 6)
  const results = await Promise.all(batch.map(download))
  ok += results.filter(Boolean).length
  fail += results.filter(r => !r).length
}

console.log(`\nDescarga: ${ok} OK, ${fail} FAIL`)
console.log(`Carpeta: ${OUT}`)
console.log(fs.readdirSync(OUT).map(f => `  ${f} ${(fs.statSync(path.join(OUT,f)).size/1024).toFixed(0)}KB`).join('\n'))
