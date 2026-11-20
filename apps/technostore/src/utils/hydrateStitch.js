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
  const precio = Number(p.precio_transferencia ?? p.precio) || 0
  const lista = Number(p.precio_lista ?? p.precio_mercadopago) || 0
  const oferta = lista > precio ? 1 : 0
  const cats = Array.isArray(p.categorias) && p.categorias.length ? p.categorias : [p.categoria || '']
  return `<div class="bg-surface-pure rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between group relative" data-sku="${esc(p.sku)}" data-catalog-item data-cat="${esc(cats.join(' '))}" data-marca="${brand}" data-precio="${precio}" data-oferta="${oferta}" data-nombre="${esc(p.nombre || p.sku || '')}" data-stock="${Number(p.stock) || 0}">
  <div class="flex items-center justify-between mb-3"><span class="px-2.5 py-1 bg-surface-container-high text-primary font-label-sm text-label-sm rounded-md font-bold flex items-center gap-1">${brand}</span><span class="px-2 py-0.5 bg-secondary-fixed/30 text-secondary font-label-sm text-label-sm rounded-md font-semibold">${stock}</span></div>
  <div class="w-full h-48 bg-surface-container-low rounded-xl p-4 flex items-center justify-center overflow-hidden mb-4 relative"><img class="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" src="${esc(p.imagenes?.[0] || '')}" alt=""></div>
  <div class="flex flex-col flex-1"><h3 class="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight mt-0.5">${esc(p.nombre || p.sku || '')}</h3>
  <div class="font-headline-md text-headline-md text-on-surface font-extrabold tracking-tight mt-0.5">${money(p.precio_transferencia ?? p.precio)}</div>
  <p class="font-label-sm text-label-sm text-secondary font-bold mt-0.5">${money(p.precio_mercadopago ?? p.precio_lista)} en tarjeta</p></div>
  <div class="mt-5 space-y-2"><button class="w-full h-11 bg-primary-container hover:bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold flex items-center justify-center gap-2 shadow-sm transition-colors" data-add="${esc(p.sku)}">Agregar al Carrito</button>
  <a class="w-full h-9 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-lg font-label-sm text-label-sm font-semibold flex items-center justify-center transition-colors" data-path="detalle-de-producto" data-sku="${esc(p.sku)}" href="#">Ver Ficha Técnica Completa</a></div></div>`
}

// Unificación de copy: no prometer tipo de factura ni garantías de 12 meses.
const COPY_FIXES = [
  [/Factura\s+Oficial\s+A\s*y\s*B/gi, 'Factura'],
  [/Facturaci[oó]n\s+Autom[aá]tica\s+A\s*y\s*B/gi, 'Facturación automática'],
  [/Factura\s+A\s*o\s*B\s+Autom[aá]tica/gi, 'Factura automática'],
  [/Factura\s+Electr[oó]nica\s+A/gi, 'Factura electrónica'],
  [/Factura\s+A\s+AFIP/gi, 'Factura'],
  [/Factura\s+legal\s+AFIP/gi, 'Factura'],
  [/Factura\s+A\s+deducible/gi, 'Factura deducible'],
  [/Factura\s+A\s*y\s*B/gi, 'Factura'],
  [/Factura\s+A\s*o\s*B/gi, 'Factura'],
  [/Factura\s+A\s*\/\s*B/gi, 'Factura'],
  [/Factura\s+A\b/gi, 'Factura'],
  [/Factura\s+B\b/gi, 'Factura'],
  [/Facturaci[oó]n\s+A\s*\/\s*B\s+electr[oó]nica/gi, 'Facturación electrónica'],
  [/Facturaci[oó]n\s+fiscal\s+A\s*y\s*B/gi, 'Facturación fiscal'],
  [/Facturaci[oó]n\s+A\s*y\s*B/gi, 'Facturación'],
  [/Facturaci[oó]n\s+AFIP/gi, 'Facturación'],
  [/Emisi[oó]n\s+autom[aá]tica\s+A\s+y\s+B/gi, 'Emisión automática'],
  [/\bA\s*\/\s*B\b/gi, ''],
  [/\bA\s+(?:o|y)\s+B\b/gi, ''],
  [/garant[ií]a\s+oficial\s+directa\s+del\s+fabricante\s+por\s+12\s+meses/gi, 'garantía del fabricante'],
  [/garant[ií]a\s+integral\s+de\s+12\s+meses/gi, 'garantía'],
  [/Garant[ií]a\s+Oficial\s+12\s+Meses/gi, 'Productos originales con factura'],
  [/soporte\s+t[eé]cnico\s+oficial/gi, 'soporte técnico'],
  [/Distribuidores\s+Oficiales\s+Certificados/gi, 'Distribuidores'],
]

function normalizeCopy(doc) {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  for (const node of nodes) {
    const tag = node.parentElement?.tagName
    if (tag === 'SCRIPT' || tag === 'STYLE') continue
    const before = node.nodeValue
    let after = before
    for (const [re, rep] of COPY_FIXES) after = after.replace(re, rep)
    if (after !== before) node.nodeValue = after.replace(/[ \t]{2,}/g, ' ')
  }
}

function replaceLogo(doc) {
  const wrap = [...doc.querySelectorAll('div.flex.items-center.gap-2')]
    .find(d => /memory/.test(d.textContent || '') && /Techno/.test(d.textContent || ''))
  if (wrap) {
    wrap.className = 'flex items-center gap-2 logo-lockup'
    wrap.innerHTML = '<img src="/logo-lockup.png" alt="TechnoStore" class="h-9 w-auto max-w-[230px] object-contain">'
  }
}

function simplifyStitch(doc) {
  const header = doc.querySelector('header')
  const main = doc.querySelector('main')
  // Sacar la franja negra superior; queda un botón de WhatsApp flotante.
  const topbar = header?.firstElementChild
  if (topbar && /Envíos asegurados|WhatsApp Directo|Garantía/i.test(topbar.textContent || '')) topbar.remove()
  // Sacar el sub-menú superior (Laptops & Mac, Smartphones, Audio Hi-Fi, ...).
  const submenu = header?.lastElementChild
  if (submenu && /Laptops & Mac|Smartphones & iPhone|Monitores & Accesorios/i.test(submenu.textContent || '')) submenu.remove()
  if (main) main.className = main.className.replace(/\bpt-44\b/, 'pt-24').replace(/\bpt-32\b/, 'pt-24')
  // Sacar la etiqueta "Semana Tech 2025".
  const badge = [...doc.querySelectorAll('span')].find(s => /Semana Tech/i.test(s.textContent || ''))
  if (badge) {
    const parent = badge.parentElement
    badge.remove()
    if (parent && !parent.children.length) parent.remove()
  }
  // Quitar seciones "de relleno" que cargan visualmente la home sin aportar a la búsqueda.
  for (const section of [...doc.querySelectorAll('section')]) {
    const t = section.textContent || ''
    if (/La confianza de nuestra comunidad/i.test(t)) section.remove()
    else if (/Necesit.s asesoramiento personalizado/i.test(t)) section.remove()
    // El catálogo unificado reemplaza estas secciones redundantes.
    else if (/Explor.*Categor.as Populares/i.test(t)) section.remove()
    else if (/M.s Vendidos|Productos destacados/i.test(t)) section.remove()
  }
}

function addSearch(doc, cartCount = 0) {
  // Acciones del header siempre visibles y con etiqueta clara (sin breakpoints).
  const actions = [...doc.querySelectorAll('header div')].find(d => d.classList.contains('gap-6') && d.classList.contains('shrink-0'))
  if (actions) {
    actions.className = 'flex items-center gap-2 shrink-0'
    actions.innerHTML = `<button type="button" data-path="carrito-de-compras" class="header-action" aria-label="Carrito">
        <span class="material-symbols-outlined">shopping_cart</span><span class="header-action__label">Carrito</span>
        <span class="header-action__badge" data-cart-count>${Number(cartCount) || 0}</span>
      </button>
      <button type="button" data-path="mis-pedidos" class="header-action" aria-label="Mi cuenta">
        <span class="material-symbols-outlined">person</span><span class="header-action__label">Mi cuenta</span>
      </button>`
  }
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
  if (h1) h1.innerHTML = 'El sitio de <span class="text-primary-container">confianza</span> para tus compras tech'
  const sub = doc.querySelector('h1')?.parentElement?.querySelector('p.font-body-lg')
  if (sub) sub.innerHTML = 'Armado de computadoras, computadoras gamer y componentes con stock real. ¿No sabés qué elegir? Te asesoramos sin cargo.'

}

// Imágenes wide generadas para el banner principal (productos representativos).
const HERO_SLIDES = [
  { tag: 'Notebook Gaming', name: 'GIGABYTE AERO X16', img: '/banner/banner-notebook.webp' },
  { tag: 'Monitor Gaming', name: 'ASUS TUF Gaming 34"', img: '/banner/banner-monitor.webp' },
  { tag: 'Auriculares Gaming', name: 'ASUS ROG Delta II', img: '/banner/banner-auriculares.webp' },
  { tag: 'Memoria RGB', name: 'ADATA XPG Lancer RGB', img: '/banner/banner-memoria.webp' },
  { tag: 'Procesador', name: 'AMD Ryzen 7 7800X3D', img: '/banner/banner-procesador.webp' },
  { tag: 'Mini PC', name: 'ASUS NUC Ultra 7', img: '/banner/banner-minipc.webp' },
]

// Navidad: un solo gesto — gran gorro inclinado sobre una esquina del logo.
function addXmasDecor(doc) {
  const logo = doc.querySelector('header img[src="/logo-lockup.png"]')
  if (logo) {
    const wrap = logo.parentElement
    if (wrap && !wrap.querySelector('.xmas-santa-hat')) {
      const hat = doc.createElement('span')
      hat.className = 'xmas-santa-hat'
      hat.setAttribute('aria-hidden', 'true')
      hat.innerHTML = '<img src="/santa-hat.webp" alt="">'
      wrap.appendChild(hat)
    }
  }
}

const FAKE_CLAIMS = /Facturación Automática|Monitoreo Satelital|Financiación Oficial Exclusiva|Concierge WhatsApp|10% OFF Extra de Bienvenida|Bóveda de Garantías|Atención y Despacho Prioritario|Atención & Despacho Prioritario|Devolución Gratis 30 Días|Factura A o B Automática|Embalaje Blindado Sellado|Soporte Técnico 24\/7|Garantía Directa de Fabricante|Prueba de 30 Días|Envíos Blindados y Asegurados|Seguridad Bancaria TLS|ISO\/IEC 27001|100% Bonificado|Cupón TechWeek|Reservados:|14:59 min/i

function dropFakeClaims(doc) {
  const nodes = [...doc.querySelectorAll('div, span, p, h3, h4, li')].reverse()
  const isIcon = c => c.classList?.contains('material-symbols-outlined')
  for (const el of nodes) {
    if (!el.parentElement) continue
    const kids = [...el.children]
    if (kids.length > 1 || (kids.length === 1 && !isIcon(kids[0]))) continue
    const t = (el.textContent || '').trim()
    if (!t || t.length > 160 || !FAKE_CLAIMS.test(t)) continue
    const parent = el.parentElement
    el.remove()
    if ([...parent.children].every(isIcon)) parent.remove()
  }
}

function dropFakeReviews(doc) {
  const heading = [...doc.querySelectorAll('h2, h3')].find(h => /Opiniones Reales|Clientes TechnoStore|Opiniones Verificadas/i.test(h.textContent || ''))
  if (!heading) return
  const section = heading.closest('section')
  if (section) { section.remove(); return }
  let node = heading.parentElement
  for (let i = 0; i < 3 && node; i++) { const next = node.parentElement; node.remove(); node = next }
}

function harmonizeAccounts(doc) {
  const hero = [...doc.querySelectorAll('h2')].find(h => /operaciones tecnológicas|ecosistema de hardware/i.test(h.textContent || ''))
  if (hero) hero.textContent = 'Tu espacio TechnoStore'
  const h1 = doc.querySelector('h1')
  if (h1 && /Hola de nuevo/i.test(h1.textContent || '')) h1.textContent = 'Ingresá a tu cuenta'
  else if (h1 && /Crear tu cuenta/i.test(h1.textContent || '')) h1.textContent = 'Creá tu cuenta'
  const testimonial = [...doc.querySelectorAll('p')].find(p => /Marina Valenzuela|Directora Operaciones/i.test(p.textContent || ''))
  if (testimonial) (testimonial.closest('div[class*="rounded"]') || testimonial.parentElement)?.remove()
}

function renderCart(doc, cartItems = []) {
  const main = doc.querySelector('main')
  if (!main || !cartItems.length) return
  const rows = cartItems.map(it => {
    const p = it.product || it
    const sku = it.sku || p.sku || ''
    const precio = Number(p.precio_transferencia ?? p.precio) || 0
    const img = p.imagenes?.[0] || p.image || ''
    return `<div class="bg-surface-pure rounded-2xl p-4 shadow-sm flex gap-4 items-center" data-cart-item="${esc(sku)}">
      <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-surface-container-low p-2 shrink-0"><img class="w-full h-full object-contain" src="${esc(img)}" alt=""></div>
      <div class="flex-1 min-w-0"><h3 class="font-headline-sm text-headline-sm font-bold text-on-surface truncate">${esc(p.nombre || p.name || sku)}</h3>
      <p class="font-label-sm text-label-sm text-on-surface-variant">${esc(p.marca || '')} · Cantidad: ${Number(it.qty) || 1}</p>
      <p class="font-headline-sm text-headline-sm font-bold text-primary mt-1">${money(precio * (Number(it.qty) || 1))}</p></div>
      <button type="button" data-add="${esc(sku)}" class="w-9 h-9 rounded-lg bg-surface-container text-on-surface shrink-0">+</button>
    </div>`
  }).join('')
  const total = cartItems.reduce((s, it) => s + (Number(it.product?.precio_transferencia ?? it.precio_transferencia ?? it.precio) || 0) * (Number(it.qty) || 1), 0)
  main.innerHTML = `<div class="w-full px-margin py-space-xl">
    <div class="flex items-center justify-between gap-3 mb-6"><h1 class="font-headline-lg text-headline-lg font-bold text-on-surface">Mi carrito</h1>
      <span class="font-label-md text-label-md text-on-surface-variant">${cartItems.length} producto${cartItems.length === 1 ? '' : 's'}</span></div>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div class="lg:col-span-8 space-y-4">${rows}</div>
      <aside class="lg:col-span-4 bg-surface-pure rounded-2xl p-6 shadow-sm">
        <h2 class="font-headline-sm text-headline-sm font-bold text-on-surface mb-4">Resumen de compra</h2>
        <div class="flex items-center justify-between font-body-md text-body-md text-on-surface-variant mb-2"><span>Subtotal</span><b class="text-on-surface">${money(total)}</b></div>
        <p class="font-label-sm text-label-sm text-on-surface-variant mb-5">El costo de envío se calcula al finalizar la compra.</p>
        <button type="button" data-path="carrito-de-compras" class="w-full h-12 rounded-xl bg-primary-container text-on-primary font-label-md font-bold">Finalizar compra</button>
        <a href="#" data-path="catalogo-de-productos" class="block text-center mt-3 font-label-md text-primary">Seguir comprando</a>
      </aside>
    </div>
  </div>`
}

function renderDetail(doc, product) {
  const main = doc.querySelector('main')
  if (!main || !product) return
  const precio = Number(product.precio_transferencia ?? product.precio) || 0
  const lista = Number(product.precio_lista ?? product.precio_mercadopago) || 0
  const specs = Array.isArray(product.specs) ? product.specs
    : Object.entries(product.especificaciones || {}).map(([k, v]) => ({ label: k, value: v }))
  const img = product.imagenes?.[0] || product.image || ''
  main.innerHTML = `<div class="w-full px-margin py-space-xl">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div class="lg:col-span-6 bg-surface-container-low rounded-2xl p-6 flex items-center justify-center"><img class="w-full h-auto max-h-[460px] object-contain" src="${esc(img)}" alt="${esc(product.nombre || '')}"></div>
      <div class="lg:col-span-6 space-y-5">
        <span class="inline-block px-3 py-1 rounded-full bg-surface-container-high text-primary font-label-sm font-bold">${esc(product.marca || '')}</span>
        <h1 class="font-headline-lg text-headline-lg font-bold text-on-surface">${esc(product.nombre || product.name || '')}</h1>
        <p class="font-body-md text-body-md text-on-surface-variant">${esc(product.descripcion || product.description || 'Producto con stock real y factura.')}</p>
        <div><div class="font-display-hero text-display-hero font-extrabold text-on-surface">${money(precio)}</div>
          ${lista > precio ? `<p class="font-label-md text-secondary font-bold">${money(lista)} en tarjeta</p>` : ''}</div>
        <button type="button" data-add="${esc(product.sku)}" class="h-12 px-8 rounded-xl bg-primary-container text-on-primary font-label-md font-bold">Agregar al carrito</button>
        ${specs.length ? `<div class="bg-surface-pure rounded-2xl p-5 shadow-sm"><h2 class="font-headline-sm text-headline-sm font-bold text-on-surface mb-3">Ficha técnica</h2>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">${specs.slice(0, 12).map(s => `<div class="flex justify-between gap-3 border-b border-border-subtle py-2 font-body-sm"><dt class="text-on-surface-variant">${esc(s.label || s.name || '')}</dt><dd class="font-bold text-on-surface text-right">${esc(s.value ?? s.val ?? '')}</dd></div>`).join('')}</dl></div>` : ''}
      </div>
    </div>
  </div>`
}

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
      const ctas = left.querySelectorAll('a')
      for (const a of ctas) { a.style.height = '36px'; a.style.fontSize = '12px'; a.style.paddingLeft = '14px'; a.style.paddingRight = '14px' }
      if (ctas[0]) {
        ctas[0].textContent = 'Ver todos los productos →'
        ctas[0].setAttribute('data-path', 'catalogo-de-productos')
      }
      if (ctas[1]) {
        ctas[1].textContent = 'Solicitar asesoramiento'
        ctas[1].setAttribute('data-path', 'asesoramiento')
        ctas[1].className = ctas[1].className.replace(/bg-secondary(\/\S+)?/, 'bg-primary-container').replace('text-on-secondary', 'text-on-primary')
      }
      const chips = left.querySelector('.grid')
      if (chips) {
        chips.className = 'grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1'
        for (const chip of chips.children) chip.style.padding = '4px 8px'
      }
    }
  }

  // 2b) Medios de pago: una sola fila pareja, sin cajas ni descripciones.
  const pay = [...doc.querySelectorAll('section')].find(s => /SiPago Credicoop|Transferencia \/ DEBIN/i.test(s.textContent || ''))
  if (pay) {
    const cards = [...pay.querySelectorAll('.grid > div')].map(card => ({
      icon: card.querySelector('.material-symbols-outlined')?.textContent || 'payments',
      title: card.querySelector('h2')?.textContent.trim() || '',
      badge: [...card.querySelectorAll('span')].map(s => s.textContent.trim()).find(t => /OFF|Cuotas|Cabal|Tech/i.test(t)) || '',
    }))
    // Openpay BBVA se eliminó con el claim de "12 cuotas"; se reincorpora sin promesas.
    if (!cards.some(c => /Openpay/i.test(c.title))) cards.unshift({ icon: 'account_balance', title: 'Openpay BBVA', badge: '' })
    pay.className = 'w-full px-margin py-2 bg-surface-subtle border-b border-border-subtle'
    pay.innerHTML = `<div class="w-full flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-1">
      ${cards.map(c => `<div class="flex items-center gap-2 shrink-0">
        <span class="w-7 h-7 rounded-md bg-surface-pure text-primary flex items-center justify-center shrink-0 shadow-sm"><span class="material-symbols-outlined text-base">${esc(c.icon)}</span></span>
        <span class="font-label-sm text-label-sm font-semibold text-on-surface whitespace-nowrap">${esc(c.title)}</span>
        ${c.badge ? `<span class="font-label-sm text-label-sm text-on-surface-variant whitespace-nowrap">· ${esc(c.badge)}</span>` : ''}
      </div>`).join('')}
    </div>`
  }

  // 3) Garantías: nada de "12 meses con cambio directo"; disclaimer + botón RMA.
  for (const el of doc.querySelectorAll('span, p, li')) {
    if (el.children.length) continue
    const t = (el.textContent || '').trim()
    if (/Garantía Oficial 12 Meses/i.test(t)) el.textContent = 'Productos originales con factura'
    else if (/garantía oficial directa del fabricante por 12 meses/i.test(t)) el.textContent = 'Productos originales con factura electrónica A o B. Las garantías se gestionan por RMA.'
    else if (/30 días de prueba y cambio directo/i.test(t)) el.textContent = 'Gestión de garantías y RMA'
    else if (/RMA y servicio técnico express/i.test(t)) el.textContent = 'Seguimiento por email'
    else if (/validación inmediata de garantía oficial de fábrica/i.test(t)) el.textContent = 'con número de serie y factura correspondiente.'
    else if (/Póliza de reposición total automática/i.test(t)) el.textContent = 'Embalaje reforzado para proteger el producto durante el transporte.'
  }
  const compra = [...doc.querySelectorAll('footer h4')].find(h => /Compra Protegida/i.test(h.textContent || ''))
  if (compra) {
    const block = compra.parentElement
    const rma = doc.createElement('button')
    rma.setAttribute('data-path', 'rma')
    rma.className = 'mt-3 px-4 py-2 rounded-lg bg-primary-container text-on-primary font-label-md font-bold'
    rma.textContent = 'GARANTÍA / RMA'
    block.appendChild(rma)
    const note = doc.createElement('p')
    note.className = 'font-label-sm text-label-sm text-on-surface-variant mt-2 leading-relaxed'
    note.textContent = 'Las garantías están sujetas a revisión del producto, con un plazo de hasta 7 días para la resolución. Luego se aplican los plazos de garantía de cada marca.'
    block.appendChild(note)
  }

  // 4) Tira inferior de pasarelas: SOLO el botón de información fiscal.
  const pasarelas = doc.querySelector('footer > div.bg-surface-subtle')
  if (pasarelas) {
    pasarelas.className = 'bg-surface-subtle py-2 border-b border-border-subtle'
    pasarelas.innerHTML = `<div class="w-full px-margin flex items-center justify-between gap-3">
      <span class="font-label-sm text-label-sm text-on-surface-variant">Datos fiscales y facturación</span>
      <button type="button" data-path="informacion-fiscal" class="px-3 py-1.5 rounded-lg bg-surface-pure border border-border-subtle text-primary font-label-md font-bold">Información fiscal</button>
    </div>`
  }
  // Tira de marcas: divisora fina, logos con tipografía y tamaños uniformes.
  const brands = [...doc.querySelectorAll('section')].find(s => /Marcas Oficiales y Partners/i.test(s.textContent || ''))
  if (brands) {
    const MARCAS = ['Apple', 'SONY', 'SAMSUNG', 'NVIDIA', 'ASUS ROG', 'logitech G', 'Kingston FURY', 'intel', 'Lenovo']
    brands.className = 'w-full px-margin py-2 bg-surface-subtle border-y border-border-subtle'
    brands.innerHTML = `<div class="w-full flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
      <span class="font-label-sm text-label-sm font-bold uppercase tracking-wider text-on-surface-variant whitespace-nowrap">Marcas</span>
      ${MARCAS.map(n => `<span class="font-label-md text-label-md font-bold tracking-tight text-on-surface-variant whitespace-nowrap">${esc(n)}</span>`).join('')}
    </div>`
  }

  // 5) CyberTrust: franja fina al final (antes ocupaba ~585px y robaba protagonismo).
  const trust = [...doc.querySelectorAll('section')].find(s => /Seguridad de nivel corporativo/i.test(s.textContent || ''))
  const footer = doc.querySelector('footer')
  if (trust) {
    trust.setAttribute('data-cybertrust', '')
    trust.className = 'w-full px-margin py-3 bg-surface-subtle border-t border-border-subtle'
    trust.innerHTML = `<div class="w-full flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
      <span class="material-symbols-outlined text-base text-primary">verified_user</span>
      <b class="font-label-sm text-label-sm text-on-surface">CyberTrust™</b>
      <span class="font-label-sm text-label-sm text-on-surface-variant">Compra protegida: productos originales, datos seguros y factura.</span>
    </div>`
    if (footer) { trust.remove(); footer.before(trust) }
  }
}

function buildCatalog(products = [], categorias = []) {
  const items = products.filter(p => Number(p.precio_transferencia ?? p.precio) > 0)
  const counts = new Map()
  for (const p of items) counts.set(p.categoria, (counts.get(p.categoria) || 0) + 1)
  const cats = categorias
    .filter(c => c.id !== 'todos' && counts.get(c.id))
    .sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0))
  const marcas = [...new Set(items.map(p => p.marca).filter(Boolean))].sort()
  const opt = (v, l) => `<option value="${esc(v)}">${esc(l)}</option>`
  const f = 'bg-surface-container-low border border-border-subtle rounded-lg px-3 py-2 text-label-md text-on-surface outline-none'
  return `<section id="catalogo" class="w-full px-margin py-space-xl" data-catalog>
  <div class="flex items-end justify-between mb-4 gap-3 flex-wrap">
    <div><div class="text-primary font-label-md font-bold uppercase tracking-widest">Catálogo completo</div><h2 class="font-headline-lg text-headline-lg font-bold text-on-surface">Todos los productos</h2></div>
    <span class="font-label-md text-on-surface-variant"><b data-catalog-count>${items.length}</b> productos · <span data-catalog-updated>actualizando…</span></span>
  </div>
  <div class="bg-surface-pure rounded-xl shadow-sm p-4 mb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-catalog-filters>
    <label class="flex flex-col gap-1"><span class="font-label-sm text-on-surface-variant">Categoría</span><select data-filter="cat" class="${f}">${opt('todos', 'Todas')}${cats.map(c => opt(c.id, c.label || c.id)).join('')}</select></label>
    <label class="flex flex-col gap-1"><span class="font-label-sm text-on-surface-variant">Marca</span><select data-filter="marca" class="${f}">${opt('todos', 'Todas')}${marcas.map(m => opt(m, m)).join('')}</select></label>
    <label class="flex flex-col gap-1"><span class="font-label-sm text-on-surface-variant">Precio</span><select data-filter="precio" class="${f}">
      ${opt('todos', 'Todos')}${opt('0-100000', 'Hasta $100.000')}${opt('100000-500000', '$100.000 – $500.000')}${opt('500000-1000000', '$500.000 – $1.000.000')}${opt('1000000+', 'Más de $1.000.000')}
    </select></label>
    <label class="flex flex-col gap-1"><span class="font-label-sm text-on-surface-variant">Oferta</span><select data-filter="oferta" class="${f}">${opt('todos', 'Todas')}${opt('si', 'Solo en oferta')}</select></label>
    <label class="flex flex-col gap-1"><span class="font-label-sm text-on-surface-variant">Ordenar por</span><select data-order class="${f}">
      ${opt('destacados', 'Destacados')}${opt('oferta', 'En oferta')}${opt('precio-asc', 'Menor precio')}${opt('precio-desc', 'Mayor precio')}${opt('nombre', 'Nombre A — Z')}
    </select></label>
    <div class="flex items-end"><button type="button" data-catalog-reset class="h-10 w-full px-4 rounded-lg border border-border-subtle text-on-surface-variant font-label-md hover:bg-surface-container transition-colors">Limpiar filtros</button></div>
  </div>
  <div data-catalog-grid class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
    ${items.map(productCard).join('')}
  </div>
  <div class="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-border-subtle" data-catalog-pagination>
    <span class="font-label-md text-on-surface-variant" data-page-info></span>
    <div class="flex items-center gap-1.5" data-page-buttons></div>
  </div>
</section>`
}

export function hydrateStitch(doc, { products = [], categorias = [], cartItems = [], cartCount = 0, product = null, screen = 'home' } = {}) {
  normalizeCopy(doc)
  replaceLogo(doc)
  simplifyStitch(doc)
  dropFakeClaims(doc)
  if (screen === 'ficha') { dropFakeReviews(doc); renderDetail(doc, product) }
  if (screen === 'carrito') renderCart(doc, cartItems)
  if (screen === 'login' || screen === 'registro') harmonizeAccounts(doc)
  addSearch(doc, cartCount)
  if (screen === 'home') {
    seasonalAndHero(doc, products)
    reworkHome(doc, products)
    // Catálogo único con filtros: reemplaza "categorías + destacados + más vendidos".
    if (products.length && !doc.querySelector('[data-catalog]')) {
      const trust = doc.querySelector('[data-cybertrust]') || [...doc.querySelectorAll('section')].find(s => /Seguridad de nivel corporativo/i.test(s.textContent || ''))
      const footer = doc.querySelector('footer')
      const holder = doc.createElement('div')
      holder.innerHTML = buildCatalog(products, categorias)
      const node = holder.firstElementChild
      if (trust) trust.before(node)
      else if (footer) footer.before(node)
      else doc.querySelector('main')?.appendChild(node) || doc.body.appendChild(node)
    }
  }
  addXmasDecor(doc)
  return doc
}
