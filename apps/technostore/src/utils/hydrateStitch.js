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
  const wrapSuggest = (input, wrap) => {
    input.setAttribute('data-stitch-search', '')
    input.setAttribute('aria-label', 'Buscar productos')
    wrap.setAttribute('data-stitch-search-wrap', '')
    wrap.style.position = 'relative'
    const box = doc.createElement('div')
    box.setAttribute('data-stitch-suggest', '')
    box.className = 'hidden absolute z-50 top-full mt-2 w-full bg-surface-pure rounded-xl shadow-lg border border-border-subtle overflow-hidden'
    wrap.appendChild(box)
  }
  // El header nativo de Stitch es fixed y tapa cualquier header inyectado:
  // conectamos la búsqueda en vivo directamente a SU input.
  const nativeInput = doc.querySelector('header input[placeholder^="Buscar"]')
  if (nativeInput) {
    const wrap = nativeInput.parentElement
    wrapSuggest(nativeInput, wrap)
    const btn = wrap.querySelector('button')
    if (btn) btn.setAttribute('data-path', 'catalogo-de-productos')
    return
  }
  // Fallback para pantallas sin header nativo.
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
    ribbon.className = 'xmas-ribbon px-margin py-1.5 mb-3 text-center font-label-md font-bold'
    ribbon.innerHTML = '🎄 Navidad TechnoStore · Elegí tu próximo upgrade y recibilo antes del 24'
    const main = doc.querySelector('main')
    if (main) main.prepend(ribbon)
    else doc.body.prepend(ribbon)
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

// Imágenes grandes y reales de Elit (catálogo completo) para el banner principal.
const HERO_SLIDES = [
  { tag: 'Notebook Gaming', name: 'GIGABYTE AERO X16', img: '/banner/banner-notebook.webp' },
  { tag: 'Monitor Gaming', name: 'ASUS TUF Gaming 34"', img: '/banner/banner-monitor.webp' },
  { tag: 'Auriculares Gaming', name: 'ASUS ROG Delta II', img: '/banner/banner-auriculares.webp' },
  { tag: 'Memoria RGB', name: 'ADATA XPG Lancer RGB', img: '/banner/banner-memoria.webp' },
  { tag: 'Procesador', name: 'AMD Ryzen 7 7800X3D', img: '/banner/banner-procesador.webp' },
  { tag: 'Mini PC', name: 'ASUS NUC Ultra 7', img: '/banner/banner-minipc.webp' },
]

function buildHeroSlider() {
  return `<div class="hero-slider relative w-full" data-hero-slider>
  <div class="relative w-full h-[340px] sm:h-[380px] rounded-2xl overflow-hidden bg-surface-container-low shadow-xl">
    ${HERO_SLIDES.map((s, i) => `<a class="hero-slide absolute inset-0 flex items-center justify-center${i === 0 ? ' is-active' : ''}" data-hero-slide="${i}" data-path="catalogo-de-productos" href="#">
      <img class="hero-slide__img relative z-[1] w-full h-full object-cover" src="${esc(s.img)}" alt="${esc(s.name)}">
      <span class="absolute bottom-0 left-0 right-0 z-10 p-4 pt-10 bg-gradient-to-t from-black/60 to-transparent text-white text-left"><small class="block uppercase tracking-wider opacity-80 text-xs">${esc(s.tag)}</small><b class="text-lg">${esc(s.name)}</b></span>
    </a>`).join('')}
    <button type="button" data-hero-prev aria-label="Anterior" class="hero-slider__arrow hero-slider__arrow--prev">‹</button>
    <button type="button" data-hero-next aria-label="Siguiente" class="hero-slider__arrow hero-slider__arrow--next">›</button>
    <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">${HERO_SLIDES.map((_, i) => `<button type="button" data-hero-dot="${i}" aria-label="Imagen ${i + 1}" class="hero-slider__dot${i === 0 ? ' is-active' : ''}"></button>`).join('')}</div>
  </div>
</div>`
}

function reworkHome(doc, products = []) {
  // 1) Sacar reclamos no respaldados (cuotas fijas / envío en el día).
  for (const el of [...doc.querySelectorAll('span, div, p, li, a')]) {
    const t = (el.textContent || '').trim()
    const claim = /12 (cuotas|Cuotas)|Hasta 12|15% OFF|Envío Prioritario|Despacho Prioritario|Despachos prioritarios|Entrega Inmediata|envíos en el día/i.test(t)
    if (!claim) continue
    if (el.children.length === 0 || (t.length < 140 && el.children.length < 3)) el.remove()
  }
  for (const h of doc.querySelectorAll('h2, h3')) {
    if (/Más Vendidos/i.test(h.textContent || '')) h.textContent = 'Productos destacados'
  }

  // 2) Banner principal: IMÁGENES a todo lo ancho arriba, texto chico abajo.
  //    Se reemplaza toda la columna derecha para eliminar los badges viejos
  //    ("10% OFF", "12x Sin Interés", "Apple & Sony Pro Setup", garantía, etc.).
  const hero = doc.querySelector('section')
  if (hero) {
    hero.classList.add('hero-compact')
    const grid = hero.querySelector('.grid')
    const left = grid?.children?.[0]
    const right = grid?.children?.[1]
    if (grid && left && right) {
      right.innerHTML = buildHeroSlider()
      // Imagen arriba, a todo el ancho; texto abajo y en segundo plano.
      grid.className = 'w-full flex flex-col gap-4 relative z-10'
      right.className = 'w-full order-1'
      left.className = 'w-full order-2 flex flex-col gap-2'
      grid.insertBefore(right, left)
      const box = right.querySelector('[data-hero-slider] > div')
      if (box) box.style.height = 'clamp(260px, 32vw, 430px)'
      for (const img of right.querySelectorAll('[data-hero-slide] img')) img.className = 'hero-slide__img relative z-[1] w-full h-full object-cover'
      const h1 = left.querySelector('h1')
      if (h1) { h1.style.fontSize = '22px'; h1.style.lineHeight = '1.2' }
      for (const p of left.querySelectorAll('p')) { p.style.fontSize = '13px'; p.style.marginTop = '2px' }
      for (const a of left.querySelectorAll('a')) { a.style.height = '36px'; a.style.fontSize = '12px'; a.style.paddingLeft = '14px'; a.style.paddingRight = '14px' }
      const chips = left.querySelector('.grid')
      if (chips) {
        chips.className = 'grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1'
        for (const chip of chips.children) chip.style.padding = '4px 8px'
      }
    }
  }

  // 2b) Medios de pago: tira fina y discreta (sin descripciones ni cajas de color).
  const pay = [...doc.querySelectorAll('section')].find(s => /SiPago Credicoop|Transferencia \/ DEBIN/i.test(s.textContent || ''))
  if (pay) {
    pay.className = 'w-full px-margin py-2 bg-surface-subtle border-b border-border-subtle'
    for (const card of pay.querySelectorAll('.grid > div')) {
      card.className = 'flex items-center gap-2 py-1 px-2'
      const icon = card.querySelector('div.w-10')
      if (icon) {
        icon.className = 'w-6 h-6 rounded-md bg-surface-container text-on-surface-variant flex items-center justify-center shrink-0'
        const sym = icon.querySelector('span')
        if (sym) sym.className = 'material-symbols-outlined text-sm'
      }
      for (const p of card.querySelectorAll('p')) p.remove()
      for (const h of card.querySelectorAll('h2')) h.className = 'font-label-sm text-label-sm text-on-surface-variant truncate'
      for (const b of card.querySelectorAll('span.px-2')) b.className = 'font-label-sm text-label-sm text-on-surface-variant'
    }
  }

  // 3) Marcas como tira divisoria fina (no un bloque).
  const footerStrip = doc.querySelector('footer .bg-surface-subtle')
  if (footerStrip) {
    footerStrip.className = footerStrip.className.replace(/\bpy-6\b/, 'py-2')
    for (const el of footerStrip.querySelectorAll('h4, p, .text-2xl')) el.remove()
  }

  // 4) CyberTrust al final, antes del footer.
  const trust = [...doc.querySelectorAll('section')].find(s => /Seguridad de nivel corporativo/i.test(s.textContent || ''))
  const footer = doc.querySelector('footer')
  if (trust && footer) { trust.remove(); footer.before(trust) }
}

export function hydrateStitch(doc, { products = [], categorias = [] } = {}) {
  simplifyStitch(doc)
  addSearch(doc)
  seasonalAndHero(doc, products)
  reworkHome(doc, products)
  // Categorías reales en la grilla de "Categorías Populares"
  const catSection = [...doc.querySelectorAll('section')].find(s => /Explor.*Categor/i.test(s.textContent || ''))
  if (catSection && categorias.length) {
    const grid = catSection.querySelector('div.grid')
    if (grid) {
      const counts = new Map()
      for (const p of products) counts.set(p.categoria, (counts.get(p.categoria) || 0) + 1)
      const prefer = ['hardware', 'computadoras', 'memorias', 'almacenamiento', 'perifericos', 'audio', 'imagen', 'gpus']
      const cats = categorias
        .filter(c => c.id !== 'todos')
        .sort((a, b) => {
          const pa = prefer.indexOf(a.id), pb = prefer.indexOf(b.id)
          if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb)
          return (counts.get(b.id) || 0) - (counts.get(a.id) || 0)
        })
        .slice(0, 6)
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
