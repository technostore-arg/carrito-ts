import { getFirestoreDb, COLLECTIONS } from '../firebase.js'
import { resumirIngesta } from '../../packages/catalog-schema/index.js'
import { mockStore } from '../mock-store.js'

const DRAFTS = 'borradores_catalogo'
function isMock(e){ return e && String(e.message||'').includes('FIREBASE_NO_CONFIG')}

function computeDiff({ existentes, normalizados }) {
  const resumen = resumirIngesta({ existentes, normalizados })
  const porSku = new Map(existentes.map(p => [p.sku, p]))
  const altas = []
  const modificaciones = []
  const porSkuNuevo = new Set(normalizados.map(p => p.sku))

  for (const n of normalizados) {
    const e = porSkuNuevo.has(n.sku) ? porSku.get(n.sku) : null
    const ex = porSku.get(n.sku)
    if (!ex) altas.push(n)
    else if (Number(ex.precio) !== Number(n.precio) || String(ex.nombre) !== String(n.nombre) || Number(ex.stock) !== Number(n.stock)) {
      const cambios = []
      if (Number(ex.precio) !== Number(n.precio)) cambios.push({ campo: 'precio', antes: ex.precio, despues: n.precio })
      if (String(ex.nombre) !== String(n.nombre)) cambios.push({ campo: 'nombre', antes: ex.nombre, despues: n.nombre })
      if (Number(ex.stock) !== Number(n.stock)) cambios.push({ campo: 'stock', antes: ex.stock, despues: n.stock })
      if (String(ex.categoria) !== String(n.categoria)) cambios.push({ campo: 'categoria', antes: ex.categoria, despues: n.categoria })
      modificaciones.push({ sku: n.sku, antes: ex, despues: n, cambios })
    }
  }
  const bajas = existentes.filter(p => !porSkuNuevo.has(p.sku))
  return { resumen, altas, bajas, modificaciones }
}

export async function listExistentesForDiff() {
  try {
    const db = getFirestoreDb()
    const snap = await db.collection(COLLECTIONS.PRODUCTS).get().catch(() => ({ docs: [] }))
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (e) { if (isMock(e)) return mockStore.products.map(p=> ({ ...p, sku: p.sku, precio: p.price })); throw e }
}

export async function createBorrador({ origen = 'archivo', archivoNombre = null, archivoHash = null, propuestas, diff, llmMeta = null, fuenteId = null }) {
  try {
    const db = getFirestoreDb()
    const doc = {
      creadoEn: new Date().toISOString(),
      origen,
      archivoNombre,
      archivoHash,
      fuenteId,
      estado: 'pendiente',
      propuestas,
      resumen: diff.resumen,
      altas: diff.altas,
      bajas: diff.bajas,
      modificaciones: diff.modificaciones,
      llmMeta,
      log: [{ accion: 'creado', en: new Date().toISOString(), origen }],
    }
    const ref = await db.collection(DRAFTS).add(doc)
    const snap = await ref.get()
    return { id: snap.id, ...snap.data() }
  } catch (e) { if (isMock(e)) return mockStore.createBorrador({ origen, archivoNombre, archivoHash, propuestas, diff, llmMeta, fuenteId }); throw e }
}

export async function createBorradorGeneric({ origen, archivoNombre, fuenteId, propuestas }) {
  try {
    const existentes = await listExistentesForDiff()
    const diff = computeDiff({ existentes, normalizados: propuestas })
    return createBorrador({ origen, archivoNombre, fuenteId, propuestas, diff, llmMeta: { provider: 'externo' } })
  } catch (e) { if (isMock(e)) return mockStore.createBorradorGeneric({ origen, archivoNombre, fuenteId, propuestas }); throw e }
}

export async function listBorradores({ estado } = {}) {
  try {
    const db = getFirestoreDb()
    let q = db.collection(DRAFTS)
    if (estado) q = q.where('estado', '==', estado)
    const snap = await q.get()
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    rows.sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)))
    return rows
  } catch (e) { if (isMock(e)) return mockStore.listBorradores({ estado }); throw e }
}

export async function getBorrador(id) {
  try {
    const db = getFirestoreDb()
    const snap = await db.collection(DRAFTS).doc(String(id)).get()
    if (!snap.exists) return null
    return { id: snap.id, ...snap.data() }
  } catch (e) { if (isMock(e)) return mockStore.getBorrador(id); throw e }
}

export async function aplicarBorrador({ id, skusAprobados, aprobadoPor = 'admin' }) {
  try {
    const db = getFirestoreDb()
  const ref = db.collection(DRAFTS).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Borrador no encontrado')
  const borrador = snap.data()
  if (borrador.estado === 'aplicado') throw new Error('Borrador ya aplicado')

  const propuestas = borrador.propuestas || []
  const filtradas = skusAprobados && skusAprobados.length
    ? propuestas.filter(p => skusAprobados.includes(p.sku))
    : propuestas

  if (!filtradas.length) throw new Error('Nada para aplicar — seleccioná al menos un SKU')

  const batch = db.batch()
  for (const p of filtradas) {
    const sku = String(p.sku).toUpperCase()
    const q = await db.collection(COLLECTIONS.PRODUCTS).where('sku', '==', sku).limit(1).get()
    if (!q.empty) {
      const docRef = q.docs[0].ref
      batch.set(docRef, { ...p, sku, updatedAt: new Date().toISOString() }, { merge: true })
    } else {
      const docRef = db.collection(COLLECTIONS.PRODUCTS).doc()
      batch.set(docRef, { ...p, sku, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    }
  }

  const ahora = new Date().toISOString()
  batch.update(ref, {
    estado: 'aplicado',
    aplicadoEn: ahora,
    aplicadoPor: aprobadoPor,
    skusAprobados: filtradas.map(p => p.sku),
    log: [...(borrador.log || []), { accion: 'aplicado', en: ahora, por: aprobadoPor, skus: filtradas.map(p => p.sku) }],
  })

  await batch.commit()
  const updated = await ref.get()
  return { id: updated.id, ...updated.data() }
  } catch (e) { if (isMock(e)) return mockStore.aplicarBorrador({ id, skusAprobados, aprobadoPor }); throw e }
}

export async function descartarBorrador({ id, por = 'admin' }) {
  try {
  const db = getFirestoreDb()
  const ref = db.collection(DRAFTS).doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) throw new Error('Borrador no encontrado')
  const borrador = snap.data()
  if (borrador.estado === 'aplicado') throw new Error('No se puede descartar un borrador ya aplicado')
  const ahora = new Date().toISOString()
  await ref.update({ estado: 'descartado', descartadoEn: ahora, descartadoPor: por, log: [...(borrador.log || []), { accion: 'descartado', en: ahora, por }] })
  const updated = await ref.get()
  return { id: updated.id, ...updated.data() }
  } catch (e) { if (isMock(e)) return mockStore.descartarBorrador({ id, por }); throw e }
}

export { DRAFTS, computeDiff }
