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
  <div class="price-strong font-headline-md text-headline-md text-on-surface font-extrabold tracking-tight mt-0.5">${money(p.precio_transferencia ?? p.precio)}</div>
  <p class="price-strong font-label-sm text-label-sm text-secondary font-bold mt-0.5">${money(p.precio_mercadopago ?? p.precio_lista)} en tarjeta</p></div>
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
  [/¡Pago Confirmado con Éxito!/gi, 'Confirmación de compra'],
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
  // Desktop y mobile usan clases distintas: buscar el div más chico con ícono + nombre.
  const candidates = [...doc.querySelectorAll('header div')]
    .filter(d => /memory/.test(d.textContent || '') && /Techno/.test(d.textContent || ''))
    .sort((a, b) => a.textContent.length - b.textContent.length)
  const wrap = candidates[0]
  if (wrap) {
    wrap.className = 'logo-lockup flex items-center'
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
    else if (/Env.o Gratis desde|BENEFICIOS Y CONFIANZA/i.test(t)) section.remove()
    else if (/Compró (MacBook|Sony)|Hace \d+ d.as|Opiniones Verificadas|Mariano L\.|Camila R\./i.test(t)) section.remove()
  }
}

function addSearch(doc, cartCount = 0, categorias = []) {
  // Reemplazamos el header de Stitch por uno propio: limpio, responsive y con
  // nuestras categorías reales. El original tenía dos filas que se cortaban en mobile.
  const old = doc.querySelector('header')
  if (!old) return
  const options = [['', 'Todas las categorías'], ...categorias.map(c => [c.id, c.label || c.id])]
    .map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')
  old.className = 'ts-header'
  old.innerHTML = `<div class="ts-header__inner">
    <a class="ts-header__brand" data-path="catalogo-de-productos" href="#"><img src="/logo-lockup.png" alt="TechnoStore"></a>
    <div class="ts-header__search" data-stitch-search-wrap>
      <select data-cat-quick aria-label="Categoría">${options}</select>
      <span class="material-symbols-outlined ts-header__search-icon">search</span>
      <input data-stitch-search type="search" placeholder="Buscar productos, SKU…" aria-label="Buscar productos">
      <div data-stitch-suggest class="hidden" role="listbox"></div>
    </div>
    <div class="ts-header__actions">
      <button type="button" data-path="carrito-de-compras" class="ts-header__action" aria-label="Carrito">
        <span class="material-symbols-outlined">shopping_cart</span><span class="ts-header__label">Carrito</span>
        <span class="ts-header__badge" data-cart-count>${Number(cartCount) || 0}</span>
      </button>
      <button type="button" data-path="mis-pedidos" class="ts-header__action" aria-label="Mi cuenta">
        <span class="material-symbols-outlined">person</span><span class="ts-header__label">Mi cuenta</span>
      </button>
    </div>
  </div>`
  const main = doc.querySelector('main')
  if (main) main.className = main.className.replace(/\bpt-44\b|\bpt-32\b|\bpt-24\b|\bpt-20\b/g, 'ts-main')
}

function seasonalAndHero(doc, products = []) {
  // HERO: copy breve (antes: "Renová tu setup con tecnología oficial y financiación garantizada.")
  const h1 = doc.querySelector('h1')
  if (h1) h1.innerHTML = 'El sitio de <span class="ds-accent-ink">confianza</span> para tus compras tech'
  const sub = doc.querySelector('h1')?.parentElement?.querySelector('p.font-body-lg')
  if (sub) sub.innerHTML = 'Armado de computadoras, computadoras gamer y componentes con stock real. ¿No sabés qué elegir? Te asesoramos sin cargo.'

}

// Carrusel del banner: 6 productos reales con stock (las imágenes son representativas de la categoría).
const HERO_SLIDES = [
  { tag: 'Notebooks', name: 'HP Laptop R5-7520U 15,6"', sku: 'ELIT-HP-NOTB9TP2LA', img: '/banner/banner-notebook.webp' },
  { tag: 'Monitores Gaming', name: 'Teros TE-2475G Gaming 24.5"', sku: 'ELIT-TERMONTE2475G', img: '/banner/banner-monitor.webp' },
  { tag: 'Auriculares', name: 'Logitech H111', sku: 'ELIT-LOGMICH111', img: '/banner/banner-auriculares.webp' },
  { tag: 'Memorias RAM', name: 'Kingston Fury DDR5 RGB 16GB', sku: 'ELIT-KFUMEM556C40B16', img: '/banner/banner-memoria.webp' },
  { tag: 'Procesadores', name: 'AMD Ryzen 7 5700G', sku: 'ELIT-AMDPRO5700G8COR', img: '/banner/banner-procesador.webp' },
  { tag: 'Mini PC', name: 'ASUS NUC Ultra 5', sku: 'ELIT-ASUMPC90AR00Q2M', img: '/banner/banner-minipc.webp' },
]

// Navidad: gorro calzado sobre la "e" de TechnoStore, inclinado como apoyado en una cabeza.
function addXmasHat(doc) {
  const logo = doc.querySelector('.ts-header__brand img[src="/logo-lockup.png"]')
  if (!logo || doc.querySelector('.xmas-santa-hat')) return
  const hat = doc.createElement('span')
  hat.className = 'xmas-santa-hat'
  hat.setAttribute('aria-hidden', 'true')
  hat.innerHTML = '<img src="/santa-hat.webp" alt="">'
  logo.parentElement.appendChild(hat)
}


const FAKE_CLAIMS = /Facturación Automática|Monitoreo Satelital|Financiación Oficial Exclusiva|Concierge WhatsApp|10% OFF Extra de Bienvenida|Bóveda de Garantías|Atención y Despacho Prioritario|Atención & Despacho Prioritario|Devolución Gratis 30 Días|Factura A o B Automática|Embalaje Blindado Sellado|Soporte Técnico 24\/7|Garantía Directa de Fabricante|Prueba de 30 Días|Envíos Blindados y Asegurados|Seguridad Bancaria TLS|ISO\/IEC 27001|100% Bonificado|Cupón TechWeek|Reservados:|14:59 min|Cifrado Bancario de Grado Militar|Sesión Encriptada Tokenizada|TX-\d+|SSL 256-bit|Data Fiscal AFIP|Garantías Oficiales Incluidas|Opciones de Entrega Certificada/i

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

function renderCheckout(doc, cartItems = [], step = 'cart') {
  const main = doc.querySelector('main')
  if (!main) return
  const total = cartItems.reduce((s, it) => s + (Number(it.product?.precio_transferencia ?? it.precio_transferencia ?? it.precio) || 0) * (Number(it.qty) || 1), 0)
  const precioTarjeta = cartItems.reduce((s, it) => s + (Number(it.product?.precio_mercadopago ?? it.precio_mercadopago ?? it.precio_lista ?? it.precio) || 0) * (Number(it.qty) || 1), 0)
  const ahorro = Math.max(0, precioTarjeta - total)
  const shipOptions = [
    { id: 'caba', label: 'Mensajería privada', note: 'CABA y alrededores', price: '' },
    { id: 'provincias', label: 'Correo a provincias', note: 'Todo el país', price: '' },
    { id: 'retiro', label: 'Retiro en nuestra oficina', note: 'Barrio Norte · con previa confirmación', price: '' },
  ]
  const payOptions = [
    { id: 'transferencia', label: 'Transferencia / DEBIN', note: `Mejor precio · ahorrás ${money(ahorro)}`, tag: 'Recomendado' },
    { id: 'mercadopago', label: 'Mercado Pago', note: 'Tarjetas y Mercado Crédito', tag: '' },
    { id: 'openpay', label: 'Openpay by BBVA', note: 'Tarjetas de crédito y débito', tag: '' },
    { id: 'sipago', label: 'SiPago Credicoop', note: 'Tarjetas de crédito y débito', tag: '' },
    { id: 'efectivo', label: 'Efectivo', note: 'Al recibir o retirar', tag: '' },
  ]
  const current = step === 'cart' ? 0 : step === 'shipping' ? 1 : step === 'payment' ? 2 : 3
  const stepName = ['Carrito', 'Envío', 'Pago', 'Confirmación'][current]
  for (const h of doc.querySelectorAll('h1')) if (!main.contains(h)) h.remove()
  main.innerHTML = `<div class="checkout-page">
    <div class="checkout-head"><div><h1>${step === 'cart' ? 'Mi carrito' : step === 'shipping' ? 'Datos de envío' : step === 'payment' ? 'Medio de pago' : 'Compra confirmada'}</h1></div><span class="checkout-count">${cartItems.length} producto${cartItems.length === 1 ? '' : 's'}</span></div>
    <div class="checkout-steps" aria-hidden="true">${['Carrito', 'Envío', 'Pago', 'Confirmación'].map((n, i) => `<span class="${i === current ? 'is-active' : ''}">${i + 1} · ${n}</span>`).join('')}</div>
    <div class="checkout-grid">
      <div class="checkout-list">
        ${step === 'cart' ? (cartItems.length ? cartItems.map(it => {
          const sku = it.sku || it.product?.sku || ''
          const p = it.product || it
          const precio = Number(p.precio_transferencia ?? p.precio) || 0
          const qty = Number(it.qty) || 1
          const img = p.imagen || p.imagenes?.[0] || p.image || ''
          return `<div class="checkout-item" data-cart-item="${esc(sku)}">
            <div class="checkout-item__media"><img src="${esc(img)}" alt=""></div>
            <div class="checkout-item__info"><p class="checkout-item__brand">${esc(p.marca || '')}</p><h3 class="checkout-item__name">${esc(p.nombre || p.name || sku)}</h3><p class="checkout-item__unit">${money(precio)} por unidad</p>
              <div class="checkout-item__controls"><div class="qty-stepper"><button type="button" data-qty="${esc(sku)}" data-delta="-1" aria-label="Restar">−</button><span>${qty}</span><button type="button" data-qty="${esc(sku)}" data-delta="1" aria-label="Sumar">+</button></div><button type="button" class="checkout-remove" data-remove="${esc(sku)}">Eliminar</button></div></div>
            <div class="price-strong checkout-item__total">${money(precio * qty)}</div></div>`
        }).join('') : '<div class="checkout-empty"><p>Tu carrito está vacío.</p><a href="#" data-path="catalogo-de-productos">Ver productos →</a></div>') : ''}
        ${step === 'shipping' ? `<div class="checkout-card"><h2>Opciones de entrega</h2><div class="checkout-options">${shipOptions.map((o, i) => `<button type="button" class="checkout-option ${i === 0 ? 'is-selected' : ''}" data-ship="${o.id}"><span class="checkout-radio"></span><span><b>${o.label}</b><small>${o.note}</small></span><em>${o.price || ''}</em></button>`).join('')}</div>
          <div class="checkout-fields"><label>Código postal<input type="text" inputmode="numeric" maxlength="4" placeholder="Ej. 1425" data-cp></label><label>Dirección<input type="text" placeholder="Calle y número" data-address></label><label>Nombre y apellido<input type="text" placeholder="Como figura en el comprobante" data-name></label></div>
          <p class="checkout-note">El costo final se calcula con el código postal y se muestra antes de confirmar.</p></div>` : ''}
        ${step === 'payment' ? `<div class="checkout-card"><h2>Elegí cómo pagar</h2><div class="transfer-banner"><span class="material-symbols-outlined">savings</span><div><b>Mejor precio por transferencia</b><small>Pagando con transferencia o DEBIN ahorrás ${money(ahorro)} respecto del precio en tarjeta. Incluye impuestos.</small></div></div>
          <div class="checkout-options">${payOptions.map((o, i) => `<button type="button" class="checkout-option ${i === 0 ? 'is-selected' : ''}" data-pay="${o.id}"><span class="checkout-radio"></span><span><b>${o.label}</b><small>${o.note}</small></span>${o.tag ? `<em class="checkout-tag">${o.tag}</em>` : ''}</button>`).join('')}</div>
          <p class="checkout-note">Las cuotas y promociones se aplican en el checkout de cada pasarela y están sujetas a aprobación. No mostramos datos de tarjeta en este sitio.</p></div>` : ''}
        ${step === 'done' ? `<div class="checkout-card checkout-done"><span class="material-symbols-outlined">check_circle</span><h2>Solicitud recibida</h2><p>Te vamos a contactar por WhatsApp o email para coordinar el pago y el envío. Este sitio no procesa datos de tarjeta.</p></div>` : ''}
      </div>
      <aside class="checkout-summary">
        <h2>Resumen de compra</h2>
        <div class="checkout-line"><span>Subtotal</span><b class="price-strong">${money(total)}</b></div>
        ${ahorro > 0 ? `<div class="checkout-line checkout-line--save"><span>Ahorro por transferencia</span><b>${money(ahorro)}</b></div>` : ''}
        <div class="checkout-line checkout-line--muted"><span>Envío</span><span>${step === 'shipping' ? 'Según código postal' : 'Se calcula en el próximo paso'}</span></div>
        ${step !== 'cart' ? `<div class="checkout-line"><span>Cupón</span><span data-coupon-label>Sin aplicar</span></div><div class="coupon-row"><input type="text" placeholder="Código de descuento" data-coupon><button type="button" data-coupon-add>Aplicar</button></div><button type="button" class="coupon-remove" data-coupon-remove>Quitar cupón</button>` : ''}
        <div class="checkout-total"><span>Total</span><b class="price-strong">${money(total)}</b></div>
        ${step === 'cart' ? `<button type="button" data-path="checkout-envio" class="checkout-cta" ${cartItems.length ? '' : 'disabled'}>Continuar al envío</button>` : step === 'shipping' ? `<button type="button" data-path="checkout-pago" class="checkout-cta">Continuar al pago</button>` : step === 'payment' ? `<button type="button" data-path="checkout-confirmar" class="checkout-cta">Confirmar solicitud</button>` : `<a href="#" data-path="catalogo-de-productos" class="checkout-cta checkout-cta--link">Seguir comprando</a>`}
        <a href="#" data-path="${step === 'cart' ? 'catalogo-de-productos' : 'checkout-carrito'}" class="checkout-back">${step === 'cart' ? 'Seguir comprando' : 'Volver al carrito'}</a>
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
  const imagenes = (product.imagenes && product.imagenes.length ? product.imagenes : [product.image]).filter(Boolean)
  const img = imagenes[0] || ''
  const enTarjeta = lista > precio ? lista : precio
  const cuota = n => money(Math.round(enTarjeta / n))
  for (const h of doc.querySelectorAll('h1')) if (!main.contains(h)) h.remove()
  main.innerHTML = `<div class="w-full px-margin py-space-xl">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div class="lg:col-span-6 space-y-3">
        <div class="bg-surface-container-low rounded-2xl p-6 flex items-center justify-center"><img class="w-full h-auto max-h-[420px] object-contain" src="${esc(img)}" alt="${esc(product.nombre || '')}"></div>
        ${imagenes.length > 1 ? `<div class="flex gap-2 overflow-x-auto pb-1">${imagenes.slice(1, 7).map(src => `<img class="w-16 h-16 rounded-lg bg-surface-container-low object-contain p-1 shrink-0 cursor-pointer" src="${esc(src)}" alt="">`).join('')}</div>` : ''}
      </div>
      <div class="lg:col-span-6 space-y-5">
        <span class="inline-block px-3 py-1 rounded-full bg-surface-container-high text-primary font-label-sm font-bold">${esc(product.marca || '')}</span>
        <h1 class="ficha-title font-headline-lg text-headline-lg font-bold text-on-surface">${esc(product.nombre || product.name || '')}</h1>
        <p class="font-body-md text-body-md text-on-surface-variant">${esc(product.descripcion || product.description || 'Producto con stock real y factura.')}</p>
        <div class="ficha-precios">
          <span class="ficha-precios__tag">Precio especial con transferencia</span>
          <div class="price-strong ficha-precios__main">${money(precio)}</div>
          <div class="ficha-precios__card">${money(enTarjeta)} en tarjeta</div>
          <div class="ficha-precios__cuotas">3 cuotas de ${cuota(3)} · 6 de ${cuota(6)} · 12 de ${cuota(12)}</div>
        </div>
        <button type="button" data-add="${esc(product.sku)}" class="h-12 px-8 rounded-xl bg-primary-container text-on-primary font-label-md font-bold">Agregar al carrito</button>
        ${specs.length ? `<div class="bg-surface-pure rounded-2xl p-5 shadow-sm"><h2 class="ficha-subtitle font-headline-sm text-headline-sm font-bold text-on-surface mb-3">Ficha técnica</h2>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">${specs.slice(0, 12).map(s => `<div class="flex justify-between gap-3 border-b border-border-subtle py-2 font-body-sm"><dt class="text-on-surface-variant">${esc(s.label || s.name || '')}</dt><dd class="font-bold text-on-surface text-right">${esc(s.value ?? s.val ?? '')}</dd></div>`).join('')}</dl></div>` : ''}
      </div>
    </div>
  </div>`
}

function buildHeroSlider() {
  return `<div class="hero-slider relative w-full" data-hero-slider>
  <div class="relative w-full h-[340px] sm:h-[380px] rounded-2xl overflow-hidden bg-surface-container-low shadow-xl">
    ${HERO_SLIDES.map((s, i) => `<a class="hero-slide absolute inset-0 flex items-center justify-center${i === 0 ? ' is-active' : ''}" data-hero-slide="${i}" data-path="detalle-de-producto" data-sku="${esc(s.sku)}" href="#">
      <img class="hero-slide__img relative z-[1] w-full h-full object-cover" src="${esc(s.img)}" alt="Imagen representativa de ${esc(s.tag)}">
      <span class="hero-slide__caption"><small>${esc(s.tag)}</small><b>${esc(s.name)}</b></span>
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
    }))
    // Openpay BBVA se eliminó con el claim de "12 cuotas"; se reincorpora sin promesas.
    if (!cards.some(c => /Openpay/i.test(c.title))) cards.unshift({ icon: 'account_balance', title: 'Openpay BBVA' })
    pay.className = 'w-full px-margin py-1.5 bg-surface-subtle border-b border-border-subtle'
    pay.innerHTML = `<div class="w-full flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-1">
      ${cards.map(c => `<div class="flex items-center gap-2 shrink-0">
        <span class="w-7 h-7 rounded-md bg-surface-pure text-primary flex items-center justify-center shrink-0 shadow-sm"><span class="material-symbols-outlined text-base">${esc(c.icon)}</span></span>
        <span class="font-label-sm text-label-sm font-semibold text-on-surface whitespace-nowrap">${esc(c.title)}</span>
      </div>`).join('')}
    </div>`
  }


}

function compactFooter(doc) {
  // 3) Footer: solo la tira fiscal, GARANTÍA/RMA y el disclaimer de garantías.
  const footer = doc.querySelector('footer')
  if (footer) {
    footer.className = 'ds-footer w-full bg-surface-pure border-t border-border-subtle mt-space-xl'
    footer.innerHTML = `<div class="ds-footer-grid w-full px-margin py-10">
      <div class="ds-footer-brand">
        <img src="/logo-lockup.png" alt="TechnoStore" class="ds-footer-logo">
        <p>Computadoras, componentes y asesoramiento para tu próximo equipo.</p>
      </div>
      <div class="ds-footer-col">
        <h3>Información</h3>
        <button type="button" data-path="informacion-fiscal">Datos fiscales y facturación</button>
      </div>
      <div class="ds-footer-col">
        <h3>Posventa</h3>
        <button type="button" data-path="rma">Garantía y RMA</button>
        <p class="ds-footer-note">Las garantías se revisan dentro de los 7 días hábiles. Cumplido ese plazo, se aplican los términos de cada fabricante.</p>
      </div>
    </div>
    <div class="ds-footer-bottom w-full px-margin py-3 border-t border-border-subtle">
      <span>© ${new Date().getFullYear()} TechnoStore</span>
    </div>`
  }
  // Tira de marcas: divisora fina, logos con tipografía y tamaños uniformes.
  const brands = [...doc.querySelectorAll('section')].find(s => /Marcas Oficiales y Partners/i.test(s.textContent || ''))
  if (brands) {
    const MARCAS = ['Apple', 'SONY', 'SAMSUNG', 'NVIDIA', 'ASUS ROG', 'logitech G', 'Kingston FURY', 'intel', 'Lenovo']
    brands.className = 'w-full px-margin py-1.5 bg-surface-subtle border-y border-border-subtle'
    brands.innerHTML = `<div class="w-full flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
      <span class="font-label-sm text-label-sm font-bold uppercase tracking-wider text-on-surface-variant whitespace-nowrap">Marcas</span>
      ${MARCAS.map(n => `<span class="font-label-md text-label-md font-bold tracking-tight text-on-surface-variant whitespace-nowrap">${esc(n)}</span>`).join('')}
    </div>`
  }

  // 5) CyberTrust: zócalo que separa la paginación del footer.
  const trust = [...doc.querySelectorAll('section')].find(s => /Seguridad de nivel corporativo/i.test(s.textContent || ''))
  if (trust) {
    trust.setAttribute('data-cybertrust', '')
    trust.className = 'ds-cybertrust w-full px-margin'
    trust.innerHTML = `<div class="ds-cybertrust__inner">
      <span class="material-symbols-outlined">verified_user</span>
      <span class="ds-cybertrust__brand">CyberTrust™</span>
      <span class="ds-cybertrust__desc">Comprá con tranquilidad: productos originales, datos protegidos y factura siempre disponible.</span>
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
    <h2 class="catalog-title font-headline-lg text-headline-lg text-on-surface">Todos los productos</h2>
    <span class="font-label-md text-on-surface-variant"><b data-catalog-count>${items.length}</b> productos · <span data-catalog-updated>actualizando…</span></span>
  </div>
  <div class="bg-surface-pure rounded-xl shadow-sm p-4 mb-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-catalog-filters>
    <label class="flex flex-col gap-1 col-span-2 md:col-span-3 lg:col-span-2"><span class="font-label-sm text-on-surface-variant">Buscar en productos</span><input type="search" data-filter="q" placeholder="Nombre, SKU o marca…" class="${f}" value=""></label>
    <label class="flex flex-col gap-1"><span class="font-label-sm text-on-surface-variant">Categoría</span><select data-filter="cat" class="${f}">${opt('todos', 'Todas')}${cats.map(c => opt(c.id, c.label || c.id)).join('')}</select></label>
    <label class="flex flex-col gap-1"><span class="font-label-sm text-on-surface-variant">Marca</span><select data-filter="marca" class="${f}">${opt('todos', 'Todas')}${marcas.map(m => opt(m, m)).join('')}</select></label>
    <label class="flex flex-col gap-1"><span class="font-label-sm text-on-surface-variant">Precio</span><select data-filter="precio" class="${f}">
      ${opt('todos', 'Todos')}${opt('0-100000', 'Hasta $100.000')}${opt('100000-500000', '$100.000 – $500.000')}${opt('500000-1000000', '$500.000 – $1.000.000')}${opt('1000000+', 'Más de $1.000.000')}
    </select></label>
    <label class="flex flex-col gap-1"><span class="font-label-sm text-on-surface-variant">Oferta</span><select data-filter="oferta" class="${f}">${opt('todos', 'Todas')}${opt('si', 'Solo en oferta')}</select></label>
    <label class="flex flex-col gap-1"><span class="font-label-sm text-on-surface-variant">Ordenar por</span><select data-order class="${f}">
      ${opt('destacados', 'Destacados')}${opt('oferta', 'En oferta')}${opt('precio-asc', 'Menor precio')}${opt('precio-desc', 'Mayor precio')}${opt('nombre', 'Nombre A — Z')}
    </select></label>
    <div class="flex items-end"><button type="button" data-catalog-reset class="ds-reset-filter h-10 w-full px-4 rounded-lg border border-border-subtle text-on-surface-variant font-label-md hover:bg-surface-container transition-colors">Limpiar filtros</button></div>
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
  for (const el of [...doc.querySelectorAll('div')]) {
    if (/MacBook Air 13\.6|Sony WH-1000XM5/.test(el.textContent || '') && el.querySelector('img')) el.remove()
  }
  if (screen === 'ficha') { dropFakeReviews(doc); renderDetail(doc, product) }
  const CHECKOUT_STEPS = { carrito: 'cart', envio: 'shipping', pago: 'payment', confirmacion: 'done' }
  if (CHECKOUT_STEPS[screen]) renderCheckout(doc, cartItems, CHECKOUT_STEPS[screen])
  if (screen === 'login' || screen === 'registro') harmonizeAccounts(doc)
  compactFooter(doc)
  addSearch(doc, cartCount, categorias)
  addXmasHat(doc)
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
  return doc
}
