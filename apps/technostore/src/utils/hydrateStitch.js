/**
 * Hidrata el HTML estático de Stitch con productos y categorías reales del hub,
 * conservando las clases Tailwind exactas del diseño.
 */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const money = (n) => '$' + Number(n || 0).toLocaleString('es-AR')

function categoryCard(c, img, count) {
  return `<a class="group bg-surface-pure p-4 rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center" data-path="catalogo-de-productos" data-cat="${esc(c.id)}" href="#">
  <div class="w-full h-28 rounded-xl bg-surface-container-low overflow-hidden mb-3 p-2 flex items-center justify-center"><img class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" src="${esc(img || '')}" alt=""></div>
  <h3 class="font-label-lg text-label-lg font-bold text-on-surface group-hover:text-primary transition-colors">${esc(c.label || c.id)}</h3>
  <p class="font-label-sm text-label-sm text-on-surface-variant mt-0.5">${count} productos</p></a>`
}

function productCard(p) {
  const brand = esc(p.marca || 'TechnoStore')
  const stock = Number(p.stock) > 0 ? 'En Stock' : 'A pedido'
  return `<div class="bg-surface-pure rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between group relative" data-sku="${esc(p.sku)}">
  <div class="flex items-center justify-between mb-3"><span class="px-2.5 py-1 bg-surface-container-high text-primary font-label-sm text-label-sm rounded-md font-bold flex items-center gap-1">${brand}</span><span class="px-2 py-0.5 bg-secondary-fixed/30 text-secondary font-label-sm text-label-sm rounded-md font-semibold">${stock}</span></div>
  <div class="w-full h-48 bg-surface-container-low rounded-xl p-4 flex items-center justify-center overflow-hidden mb-4 relative"><img class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" src="${esc(p.imagenes?.[0] || '')}" alt=""></div>
  <div class="flex flex-col flex-1"><h3 class="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight mt-0.5">${esc(p.nombre || p.sku || '')}</h3>
  <div class="font-headline-md text-headline-md text-on-surface font-extrabold tracking-tight mt-0.5">${money(p.precio_transferencia ?? p.precio)}</div>
  <p class="font-label-sm text-label-sm text-secondary font-bold mt-0.5">${money(p.precio_mercadopago ?? p.precio_lista)} en tarjeta</p></div>
  <div class="mt-5 space-y-2"><button class="w-full h-11 bg-primary-container hover:bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold flex items-center justify-center gap-2 shadow-sm transition-colors" data-add="${esc(p.sku)}">Agregar al Carrito</button>
  <a class="w-full h-9 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg font-label-sm text-label-sm font-semibold flex items-center justify-center transition-colors" data-path="detalle-de-producto" data-sku="${esc(p.sku)}" href="#">Ver Ficha Técnica Completa</a></div></div>`
}

function simplifyStitch(doc) {
  // Quitar seciones "de relleno" que cargan visualmente la home sin aportar a la búsqueda.
  for (const section of [...doc.querySelectorAll('section')]) {
    const t = section.textContent || ''
    if (/La confianza de nuestra comunidad/i.test(t)) section.remove()
    else if (/Necesit.s asesoramiento personalizado/i.test(t)) section.remove()
  }
}

function addSearch(doc) {
  if (doc.querySelector('[data-stitch-search]')) return
  const header = doc.createElement('div')
  header.className = 'sticky top-0 z-40 w-full bg-surface-pure/95 backdrop-blur border-b border-border-subtle px-margin py-3'
  header.innerHTML = `<div class="w-full max-w-[1440px] mx-auto flex items-center gap-4">
  <a class="font-extrabold text-xl tracking-tight text-on-surface shrink-0" data-path="catalogo-de-productos" href="#">Techno<span class="text-primary-container">Store</span></a>
  <div class="relative flex-1 max-w-2xl" data-stitch-search-wrap>
    <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">search</span>
    <input data-stitch-search type="search" placeholder="Buscar GPU, notebook, RAM, SKU…" aria-label="Buscar productos" class="w-full h-11 pl-10 pr-4 rounded-xl bg-surface-container-low border border-border-subtle text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary-container">
    <div data-stitch-suggest class="hidden absolute z-50 top-full mt-2 w-full bg-surface-pure rounded-xl shadow-lg border border-border-subtle overflow-hidden"></div>
  </div>
  <a class="shrink-0 h-10 px-4 rounded-xl bg-trust-shield text-surface-pure font-label-md font-bold flex items-center gap-2" data-path="carrito-de-compras" href="#"><span class="material-symbols-outlined text-base">shopping_cart</span>Carrito</a>
</div>`
  doc.body.prepend(header)
}

function seasonalAndHero(doc, products = []) {
  // HERO: copy breve (antes: "Renová tu setup con tecnología oficial y financiación garantizada.")
  const h1 = doc.querySelector('h1')
  if (h1) h1.innerHTML = 'Tu setup, <span class="text-primary-container">a otro nivel</span>.'
  const sub = doc.querySelector('h1')?.parentElement?.querySelector('p.font-body-lg')
  if (sub) sub.innerHTML = 'GPUs, workstations y memorias con stock real, garantía escrita y envío a todo el país.'

  // Decoración navideña sutil (franja + copitos), sin invadir el diseño.
  if (!doc.querySelector('[data-xmas-ribbon]')) {
    const ribbon = doc.createElement('div')
    ribbon.setAttribute('data-xmas-ribbon', '')
    ribbon.className = 'xmas-ribbon px-margin py-1.5 text-center font-label-md font-bold'
    ribbon.innerHTML = '🎄 Navidad TechnoStore · Elegí tu próximo upgrade y recibilo antes del 24'
    doc.body.prepend(ribbon)
  }

  // Carrusel de imágenes de productos destacados (debajo del hero).
  if (products.length && !doc.querySelector('[data-stitch-carousel]')) {
    const hero = doc.querySelector('section')
    const featured = products.filter(p => Number(p.precio_transferencia ?? p.precio) > 0).slice(0, 8)
    const sec = doc.createElement('section')
    sec.setAttribute('data-stitch-carousel', '')
    sec.className = 'w-full px-margin py-space-md'
    sec.innerHTML = `<div class="flex items-center justify-between mb-3"><div class="flex items-center gap-2 text-primary font-label-md font-bold uppercase tracking-wider"><span class="material-symbols-outlined text-base">auto_awesome</span>Destacados de la semana</div><div class="flex gap-2"><button type="button" data-carousel="prev" aria-label="Anterior" class="w-9 h-9 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center"><span class="material-symbols-outlined">chevron_left</span></button><button type="button" data-carousel="next" aria-label="Siguiente" class="w-9 h-9 rounded-lg bg-primary-container text-on-primary flex items-center justify-center"><span class="material-symbols-outlined">chevron_right</span></button></div></div>
    <div data-carousel-track class="flex gap-4 overflow-x-auto pb-2">${featured.map(p => `<button type="button" class="shrink-0 w-40 rounded-xl bg-surface-pure border border-border-subtle p-3 text-left hover:shadow-md transition-shadow" data-path="detalle-de-producto" data-sku="${esc(p.sku)}"><img class="w-full h-28 object-contain bg-surface-container-low rounded-lg mb-2" src="${esc(p.imagenes?.[0] || '')}" alt=""><b class="block text-label-md text-on-surface truncate">${esc(p.nombre || '')}</b><span class="text-body-sm font-bold text-primary">$${Number((p.precio_transferencia ?? p.precio) || 0).toLocaleString('es-AR')}</span></button>`).join('')}</div>`
    if (hero) hero.after(sec)
    else doc.body.prepend(sec)
  }
}

export function hydrateStitch(doc, { products = [], categorias = [] } = {}) {
  simplifyStitch(doc)
  addSearch(doc)
  seasonalAndHero(doc, products)
  // Categorías reales en la grilla de "Categorías Populares"
  const catSection = [...doc.querySelectorAll('section')].find(s => /Explor.*Categor/i.test(s.textContent || ''))
  if (catSection && categorias.length) {
    const grid = catSection.querySelector('div.grid')
    if (grid) {
      const cats = categorias.filter(c => c.id !== 'todos').slice(0, 6)
      grid.innerHTML = cats.map(c => {
        const items = products.filter(p => p.categoria === c.id)
        return categoryCard(c, items[0]?.imagenes?.[0], items.length)
      }).join('')
    }
  }

  // Productos reales en grillas con precios (Home "Más Vendidos" y catálogos)
  const real = products.filter(p => Number(p.stock) > 0 && Number(p.precio_transferencia ?? p.precio) > 0).slice(0, 12)
  if (real.length) {
    for (const grid of doc.querySelectorAll('div.grid')) {
      if (grid.querySelector('[data-sku]')) continue
      const cards = [...grid.children]
      if (cards.length < 2) continue
      const priceLike = cards.filter(c => /\$[\d.,]{4,}/.test(c.textContent || '')).length
      if (priceLike < 2) continue
      grid.innerHTML = real.slice(0, cards.length).map(productCard).join('')
    }
  }
  return doc
}
