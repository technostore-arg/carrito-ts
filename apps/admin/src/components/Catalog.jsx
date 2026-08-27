import { useEffect, useState } from 'react'
import { listProductos, createProducto, updateProducto, deleteProducto } from '../data/adapter.js'

const MARCAS = ['todas', 'technostore', 'futurohard']
const fmt = n => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0)

const emptyForm = { sku: '', nombre: '', descripcion: '', marca: 'technostore', categoria: '', tipo_venta: 'directa', precio: 0, stock: 0, estado: 'activo' }

export default function Catalog() {
  const [marca, setMarca] = useState('todas')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState('')

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

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, sku: `TS-${Math.random().toString(36).slice(2, 6).toUpperCase()}` }); setShowForm(true) }
  const openEdit = p => { setEditing(p); setForm({ sku: p.sku, nombre: p.nombre, descripcion: p.descripcion || '', marca: p.marca, categoria: p.categoria, tipo_venta: p.tipo_venta, precio: p.precio, stock: p.stock ?? 0, estado: p.estado }); setShowForm(true) }

  const save = async e => {
    e.preventDefault()
    try {
      if (!form.nombre.trim() || !form.sku.trim() || !form.categoria.trim()) throw new Error('SKU, nombre y categoría son obligatorios')
      if (form.tipo_venta === 'directa' && !(Number(form.precio) > 0)) throw new Error('Precio > 0 para directa')
      const payload = { ...form, sku: form.sku.trim().toUpperCase(), nombre: form.nombre.trim(), categoria: form.categoria.trim().toLowerCase(), precio: Number(form.precio), stock: form.tipo_venta === 'encargo' ? null : Number(form.stock), estado: form.estado, descripcion: form.descripcion.trim(), moneda: 'ARS', fuente_origen: 'manual', especificaciones: {}, imagenes: [] }
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
      <p className="muted" style={{ fontSize: '.82rem' }}>{rows.length} productos · adaptador: <code>src/data/adapter.js</code> (mock → Firestore sin tocar UI)</p>

      {showForm && (
        <div className="modal-bg" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={e => e.stopPropagation()} onSubmit={save}>
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
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn-primary">{editing ? 'Guardar' : 'Crear'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
