const p = await (await fetch('https://carrito-ts-neon.vercel.app/api/products?cb=4')).json()
console.log('total:', p.length)

// réplica exacta del filtro de TechnoStore con categoria='gpus', resto default
const canonCat = (c) => {
  const k = String(c || '').toLowerCase()
  return { ram: 'memorias', 'ram-sodimm': 'memorias', memorias: 'memorias', ssd: 'almacenamiento', 'ssd-nvme': 'almacenamiento', 'ssd-sata': 'almacenamiento' }[k] || k
}
const out = p.filter(x => {
  const cat = canonCat('gpus')
  if ('gpus' !== 'todos' && canonCat(x.categoria) !== cat) return false
  return true
})
console.log('gpus filtrados:', out.length)
const cats = {}
for (const x of out) cats[x.categoria] = (cats[x.categoria] || 0) + 1
console.log('categorias en resultado:', JSON.stringify(cats))
for (const x of out) console.log(' ', x.sku, '|', x.nombre, '|', x.marca)
