import { useEffect, useState, useRef, useCallback } from 'react'
import { listProductos, createProducto, updateProducto, deleteProducto, uploadProductImage } from '../data/adapter.js'

const MARCAS = ['todas', 'technostore', 'futurohard']
const MAX_IMAGES = 6
const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.8
const fmt = n => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0)

const emptyForm = { sku: '', nombre: '', descripcion: '', marca: 'technostore', categoria: '', tipo_venta: 'directa', precio: 0, stock: 0, estado: 'activo' }

function resizeImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim }
          else { width = Math.round(width * maxDim / height); height = maxDim }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('Error al procesar imagen'))
          const r2 = new FileReader()
          r2.onload = () => {
            const base64 = r2.result.split(',')[1]
            resolve({ base64, width, height, size: blob.size })
          }
          r2.onerror = reject
          r2.readAsDataURL(blob)
        }, 'image/jpeg', quality)
      }
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'))
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function Catalog() {
  const [marca, setMarca] = useState('todas')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState('')
  const [images, setImages] = useState([])
  const [uploading, setUploading] = useState(false)
  const [dragIdx, setDragIdx] = useState(null)
  const fileRef = useRef(null)

  const load = async () => {
    setLoading(true)
    const data = await listProductos({ marca, q: q.trim() || undefined })
    setRows(data)
    setLoading(false)
  }
  useEffect(() => { load() }, [marca])
  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [q])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, sku: `TS-${Math.random().toString(36).slice(2, 6).toUpperCase()}` })
    setImages([])
    setShowForm(true)
  }
  const openEdit = p => {
    setEditing(p)
    setForm({ sku: p.sku, nombre: p.nombre, descripcion: p.descripcion || '', marca: p.marca, categoria: p.categoria, tipo_venta: p.tipo_venta, precio: p.precio, stock: p.stock ?? 0, estado: p.estado })
    setImages(Array.isArray(p.imagenes) ? p.imagenes.filter(Boolean).map(url => ({ url, uploading: false })) : [])
    setShowForm(true)
  }

  const handleFiles = async (files) => {
    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) { setMsg(`Máximo ${MAX_IMAGES} imágenes`); setTimeout(() => setMsg(''), 2000); return }
    const toProcess = Array.from(files).slice(0, remaining)
    setUploading(true)

    const newImages = []
    for (const file of toProcess) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) continue
      try {
        const { base64, width, height, size } = await resizeImage(file, MAX_DIMENSION, JPEG_QUALITY)
        newImages.push({ base64, width, height, size, name: file.name, uploading: true, url: null })
      } catch (e) {
        console.error('Error procesando imagen:', e)
      }
    }

    if (newImages.length === 0) { setUploading(false); return }

    const placeholderImages = newImages.map(ni => ({ url: null, uploading: true, _temp: ni }))
    setImages(prev => [...prev, ...placeholderImages])

    const sku = form.sku.trim().toUpperCase()
    for (let i = 0; i < newImages.length; i++) {
      const ni = newImages[i]
      try {
        const result = await uploadProductImage(sku, ni.base64, images.length + i)
        setImages(prev => prev.map((img, idx) => {
          if (idx === images.length + i) return { url: result.url, uploading: false }
          return img
        }))
      } catch (e) {
        console.error('Error subiendo imagen:', e)
        setImages(prev => prev.filter((_, idx) => idx !== images.length + i))
        setMsg('Error subiendo imagen'); setTimeout(() => setMsg(''), 2000)
      }
    }
    setUploading(false)
  }

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx))
  }

  const handleDragStart = (idx) => { setDragIdx(idx) }
  const handleDragOver = (e, idx) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    setImages(prev => {
      const arr = [...prev]
      const [item] = arr.splice(dragIdx, 1)
      arr.splice(idx, 0, item)
      return arr
    })
    setDragIdx(idx)
  }
  const handleDragEnd = () => { setDragIdx(null) }

  const save = async e => {
    e.preventDefault()
    try {
      if (!form.nombre.trim() || !form.sku.trim() || !form.categoria.trim()) throw new Error('SKU, nombre y categoría son obligatorios')
      if (form.tipo_venta === 'directa' && !(Number(form.precio) > 0)) throw new Error('Precio > 0 para directa')
      if (uploading) throw new Error('Esperá a que terminen de subir las imágenes')
      const imagenes = images.filter(img => img.url && !img.uploading).map(img => img.url)
      const payload = { ...form, sku: form.sku.trim().toUpperCase(), nombre: form.nombre.trim(), categoria: form.categoria.trim().toLowerCase(), precio: Number(form.precio), stock: form.tipo_venta === 'encargo' ? null : Number(form.stock), estado: form.estado, descripcion: form.descripcion.trim(), moneda: 'ARS', fuente_origen: 'manual', especificaciones: {}, imagenes }
      if (editing) await updateProducto(editing.id, payload)
      else await createProducto(payload)
      setShowForm(false); setMsg(editing ? 'Producto actualizado' : 'Producto creado')
      setTimeout(() => setMsg(''), 2000)
      load()
    } catch (err) { setMsg(err.message) }
  }

  const remove = async p => {
    if (!confirm(`¿Eliminar ${p.sku} — ${p.nombre}?`)) return
    await deleteProducto(p.id)
    setMsg('Producto eliminado'); setTimeout(() => setMsg(''), 2000)
    load()
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="seg">
            {MARCAS.map(m => (
              <button key={m} className={marca === m ? 'seg-active' : ''} onClick={() => setMarca(m)}>{m === 'todas' ? 'Todas' : m === 'technostore' ? 'TechnoStore' : 'Futuro Hard'}</button>
            ))}
          </div>
          <input className="search" placeholder="Buscar SKU, nombre o categoría…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={openCreate}>+ Alta producto</button>
      </div>

      {msg && <div className="toast">{msg}</div>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>SKU</th><th>Nombre</th><th>Marca</th><th>Categoría</th><th>Tipo</th><th>Precio</th><th>Stock</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 24 }}>Cargando…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 24 }}>Sin resultados</td></tr>
                : rows.map(p => (
                  <tr key={p.id}>
                    <td><code className="sku">{p.sku}</code></td>
                    <td><b>{p.nombre}</b><br /><small className="muted">{p.descripcion?.slice(0, 56)}</small></td>
                    <td><span className={`pill ${p.marca}`}>{p.marca}</span></td>
                    <td>{p.categoria}</td>
                    <td><span className={`pill ${p.tipo_venta}`}>{p.tipo_venta}</span></td>
                    <td>{p.tipo_venta === 'encargo' ? <span className="muted">a consultar</span> : fmt(p.precio)}</td>
                    <td>{p.stock == null ? '—' : p.stock}</td>
                    <td><span className={`dot ${p.estado}`} /> {p.estado}</td>
                    <td className="row-actions">
                      <button className="btn-sm" onClick={() => openEdit(p)}>Editar</button>
                      <button className="btn-sm danger" onClick={() => remove(p)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: '.82rem' }}>{rows.length} productos</p>

      {showForm && (
        <div className="modal-bg" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={save} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>{editing ? 'Editar producto' : 'Alta de producto'}</h3>
            <div className="grid2">
              <label>SKU<input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="TS-XXXX" /></label>
              <label>Marca<select value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })}><option value="technostore">technostore</option><option value="futurohard">futurohard</option></select></label>
              <label className="span2">Nombre<input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></label>
              <label className="span2">Descripción<input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></label>
              <label>Categoría<input value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} placeholder="gpus / celulares / …" /></label>
              <label>Tipo venta<select value={form.tipo_venta} onChange={e => setForm({ ...form, tipo_venta: e.target.value })}><option value="directa">directa</option><option value="encargo">encargo</option></select></label>
              <label>Precio (ARS)<input type="number" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} disabled={form.tipo_venta === 'encargo'} /></label>
              <label>Stock<input type="number" value={form.stock ?? ''} onChange={e => setForm({ ...form, stock: e.target.value })} disabled={form.tipo_venta === 'encargo'} placeholder={form.tipo_venta === 'encargo' ? 'null' : '0'} /></label>
              <label>Estado<select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}><option value="activo">activo</option><option value="pausado">pausado</option><option value="agotado">agotado</option></select></label>
            </div>

            {/* Image upload section */}
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                Imágenes del producto <span className="muted" style={{ fontWeight: 400 }}>({images.length}/{MAX_IMAGES})</span>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    style={{
                      width: 80, height: 80, borderRadius: 8, overflow: 'hidden', position: 'relative',
                      border: idx === 0 ? '2px solid var(--accent)' : '2px solid #ddd',
                      opacity: img.uploading ? 0.5 : 1, cursor: 'grab',
                      background: '#f5f5f7', display: 'grid', placeItems: 'center',
                    }}
                  >
                    {img.url ? (
                      <img src={img.url} alt={`#${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 10, color: '#999' }}>Subiendo…</span>
                    )}
                    {idx === 0 && (
                      <span style={{ position: 'absolute', top: 2, left: 2, background: 'var(--accent)', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 4 }}>PRIN</span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeImage(idx) }}
                      style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, display: 'grid', placeItems: 'center', lineHeight: 1 }}
                    >✕</button>
                  </div>
                ))}
                {images.length < MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    style={{
                      width: 80, height: 80, borderRadius: 8, border: '2px dashed #ccc', background: '#fafafa',
                      cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 24, color: '#999',
                    }}
                  >+</button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                style={{ display: 'none' }}
                onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
              />
              <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                Arrastrá para reordenar · La primera es la foto principal · JPG/PNG/WebP, máx {MAX_IMAGES} · Se comprimen automáticamente a {MAX_DIMENSION}px
              </p>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={uploading}>{uploading ? 'Subiendo…' : editing ? 'Guardar' : 'Crear'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
