// Helpers de specs: fichas resumidas en tarjetas + matching para filtros.
// Fuentes: especificaciones.{cpu,ram,ssd,gpu} y, como fallback, el nombre.

export function gbOf(str) {
  if (!str) return null
  const m = String(str).match(/(\d+(?:[.,]\d+)?)\s*(TB|GB)/i)
  if (!m) return null
  const n = parseFloat(m[1].replace(',', '.'))
  if (Number.isNaN(n)) return null
  return Math.round(m[2].toUpperCase() === 'TB' ? n * 1024 : n)
}

export function shortCpu(cpu) {
  if (!cpu) return null
  const s = String(cpu).toUpperCase()
  let m = s.match(/I([3579])[\s-]?(\d{4,5}[A-Z]*)/)
  if (m) return `i${m[1]}-${m[2]}`
  m = s.match(/ULTRA\s*(\d)[^0-9]*(\d{3}[A-Z]*)/)
  if (m) return `Ultra ${m[1]} ${m[2]}`
  m = s.match(/RYZEN\s*(\d)[^0-9]*([\w-]+)/)
  if (m) return `Ryzen ${m[1]} ${m[2]}`
  m = s.match(/SNAPDRAGON\s*([A-Z]?\s?[A-Z0-9-]+)/)
  if (m) return `Snapdragon ${m[1].trim()}`
  m = s.match(/\bM([123])\b/)
  if (/APPLE/.test(s) && m) return `M${m[1]}`
  m = s.match(/(CELERON|PENTIUM)\s*([A-Z0-9-]+)/)
  if (m) return `${m[1][0]}${m[1].slice(1).toLowerCase()} ${m[2]}`
  return String(cpu).split('—')[0].trim().slice(0, 22)
}

export function shortGpu(gpu) {
  if (!gpu) return null
  const s = String(gpu).toUpperCase()
  const m = s.match(/((?:RTX|QUADRO|GEFORCE|RADEON)[A-Z0-9\s]*?(\d+)\s*GB)/)
  if (m) return m[1].replace(/\s+/g, ' ').trim()
  return null
}

const RAM_CATS = new Set(['ram', 'ram-sodimm', 'memorias'])

function ramOf(p) {
  const e = p.especificaciones || {}
  const cat = String(p.categoria || '').toLowerCase()
  const fromEspec = gbOf(e.ram)
  if (fromEspec != null) return fromEspec
  const m = String(p.nombre || '').match(/(\d+)\s*GB\s*RAM/i)
  if (m) return Number(m[1])
  // Kits de memoria: "DDR5 64GB (2x32GB)" sin la palabra RAM después
  // (solo si el nombre habla de memoria: evita confundir SSDs en categoría memorias)
  if (RAM_CATS.has(cat) && /RAM|MEMORIA|DDR|SODIMM|DIMM/i.test(p.nombre || '')) {
    const b = String(p.nombre || '').match(/(\d+)\s*(GB|TB)/i)
    if (b) return b[2].toUpperCase() === 'TB' ? Number(b[1]) * 1024 : Number(b[1])
  }
  return null
}

function ssdOf(p) {
  const e = p.especificaciones || {}
  return gbOf(e.ssd) ?? gbOf((p.nombre || '').match(/(\d+\s*(?:GB|TB)\s*(?:SSD|NVME))/i)?.[0])
}

function storageOf(p) {
  const ssd = ssdOf(p)
  if (ssd != null) return ssd
  return gbOf((p.nombre || '').match(/(\d+\s*(?:GB|TB))/i)?.[0])
}

// Fichas cortas para la tarjeta (máx 4)
export function specChips(p) {
  const chips = []
  const e = p.especificaciones || {}
  const cat = String(p.categoria || '').toLowerCase()
  if (cat === 'notebooks' || e.cpu || e.ram || e.ssd) {
    const cpu = shortCpu(e.cpu)
    if (cpu) chips.push(cpu)
    const ram = ramOf(p)
    if (ram != null) chips.push(ram >= 1024 ? `${ram / 1024}TB RAM` : `${ram}GB RAM`)
    const ssd = ssdOf(p)
    if (ssd != null) chips.push(ssd >= 1024 ? `${ssd / 1024}TB SSD` : `${ssd}GB SSD`)
    const gpu = shortGpu(e.gpu)
    if (gpu) chips.push(gpu)
  } else if (cat === 'celulares') {
    const stor = storageOf(p)
    if (stor != null) chips.push(stor >= 1024 ? `${stor / 1024}TB` : `${stor}GB`)
    const ram = ramOf(p)
    if (ram != null) chips.push(`${ram}GB RAM`)
  } else if (cat === 'gpus' && p.vram) {
    chips.push(`${p.vram}GB VRAM`)
  } else if ((cat === 'ram' || cat === 'ram-sodimm' || cat === 'memorias') && ramOf(p) != null) {
    chips.push(`${ramOf(p)}GB`)
  } else if ((cat === 'ssd' || cat === 'ssd-nvme' || cat === 'ssd-sata') && storageOf(p) != null) {
    const s = storageOf(p)
    chips.push(s >= 1024 ? `${s / 1024}TB` : `${s}GB`)
  }
  return chips.slice(0, 4)
}

// --- Filtros ---

export function cpuFamily(cpu) {
  if (!cpu) return null
  const s = String(cpu).toUpperCase()
  if (/\bI3[\s-]/.test(s)) return 'intel-i3'
  if (/\bI5[\s-]/.test(s)) return 'intel-i5'
  if (/\bI7[\s-]/.test(s)) return 'intel-i7'
  if (/\bI9[\s-]/.test(s)) return 'intel-i9'
  if (/ULTRA/.test(s)) return 'intel-ultra'
  if (/CELERON|PENTIUM/.test(s)) return 'intel-base'
  const rm = s.match(/RYZEN\s*(\d)/)
  if (rm) return `amd-r${rm[1]}`
  if (/SNAPDRAGON/.test(s)) return 'snapdragon'
  if (/APPLE|\bM[123]\b/.test(s)) return 'apple'
  return 'otro'
}

export const CPU_LABELS = {
  'intel-i3': 'Intel i3', 'intel-i5': 'Intel i5', 'intel-i7': 'Intel i7', 'intel-i9': 'Intel i9',
  'intel-ultra': 'Intel Ultra', 'intel-base': 'Intel Celeron/Pentium',
  'amd-r3': 'Ryzen 3', 'amd-r5': 'Ryzen 5', 'amd-r7': 'Ryzen 7', 'amd-r9': 'Ryzen 9',
  snapdragon: 'Snapdragon', apple: 'Apple', otro: 'Otro',
}

function cpuOf(p) {
  const e = p.especificaciones || {}
  if (e.cpu) return e.cpu
  // Fallback celulares/hardware: sin CPU declarada
  return null
}

export function matchCpu(p, id) {
  if (!id) return true
  return cpuFamily(cpuOf(p)) === id
}

export function matchRam(p, gb) {
  if (!gb) return true
  return ramOf(p) === Number(gb)
}

export function matchSsd(p, gb) {
  if (!gb) return true
  return ssdOf(p) === Number(gb)
}

// Opciones dinámicas según catálogo
export function specOptions(products) {
  const cpus = new Map(), rams = new Set(), ssds = new Set()
  for (const p of products) {
    const f = cpuFamily(cpuOf(p))
    if (f) cpus.set(f, (CPU_LABELS[f] || f))
    const r = ramOf(p)
    if (r != null) rams.add(r)
    const s = ssdOf(p)
    if (s != null) ssds.add(s)
  }
  const order = ['intel-i3', 'intel-i5', 'intel-i7', 'intel-i9', 'intel-ultra', 'intel-base', 'amd-r3', 'amd-r5', 'amd-r7', 'amd-r9', 'snapdragon', 'apple', 'otro']
  return {
    cpus: [...cpus.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(id => ({ id, label: cpus.get(id) })),
    rams: [...rams].sort((a, b) => a - b),
    ssds: [...ssds].sort((a, b) => a - b),
  }
}

export function fmtCap(gb) {
  return gb >= 1024 ? `${gb / 1024}TB` : `${gb}GB`
}
