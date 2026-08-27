import { useEffect, useState } from 'react'
import { getMetricas } from '../data/adapter.js'

const fmt = n => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0)

export default function Metrics() {
  const [data, setData] = useState(null)
  useEffect(() => { getMetricas().then(setData) }, [])
  if (!data) return <p className="muted">Cargando métricas…</p>

  const { vistas, abiertas, ventasPeriodo, totalVentas, porMarca, totalConsultas, totalPedidos } = data

  return (
    <div className="stack">
      <div className="kpi-grid">
        <div className="kpi"><span>Ventas del período</span><b>{fmt(totalVentas)}</b><small>{totalPedidos} pedidos · {ventasPeriodo.filter(o => o.status === 'pagado' || o.status === 'entregado').length} pagados</small></div>
        <div className="kpi"><span>Consultas sin cierre</span><b>{abiertas.length}</b><small>de {totalConsultas} totales · {totalConsultas - abiertas.length} cerradas</small></div>
        <div className="kpi"><span>Tasa de cierre WhatsApp</span><b>{totalConsultas ? Math.round((data.totalConsultas - abiertas.length) / totalConsultas * 100) : 0}%</b><small>{abiertas.length} abiertas pendientes</small></div>
        <div className="kpi"><span>Vistas top 1</span><b>{vistas[0]?.vistas ?? 0}</b><small>{vistas[0]?.nombre ?? '—'}</small></div>
      </div>

      <div className="cols2">
        <div className="card">
          <h3>🔥 Productos más vistos</h3>
          <table>
            <thead><tr><th>#</th><th>Producto</th><th>Marca</th><th>Vistas</th></tr></thead>
            <tbody>
              {vistas.slice(0, 5).map((v, i) => (
                <tr key={v.producto_id}><td>{i + 1}</td><td><small><b>{v.nombre}</b><br /><code className="sku">{v.sku}</code></small></td><td><span className={`pill ${v.marca}`}>{v.marca}</span></td><td><b>{v.vistas}</b></td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>💬 Consultas sin cierre</h3>
          {abiertas.length === 0 ? <p className="muted">Todas las consultas están cerradas ✓</p>
            : <table><thead><tr><th>SKU</th><th>Producto</th><th>Marca</th></tr></thead>
              <tbody>{abiertas.slice(0, 5).map(c => <tr key={c.id}><td><code className="sku">{c.sku}</code></td><td><small>{c.nombre}</small></td><td><span className={`pill ${c.marca}`}>{c.marca}</span></td></tr>)}</tbody></table>}
          {abiertas.length > 5 && <p className="muted" style={{ marginTop: 8, fontSize: '.82rem' }}>+{abiertas.length - 5} más</p>}
        </div>
      </div>

      <div className="card">
        <h3>⚖️ Comparación TechnoStore vs Futuro Hard</h3>
        <div className="compare">
          {(['technostore', 'futurohard']).map(marca => (
            <div key={marca} className="compare-col">
              <h4 className={`pill ${marca}`} style={{ display: 'inline-block' }}>{marca === 'technostore' ? 'TechnoStore' : 'Futuro Hard'}</h4>
              <div className="compare-stats">
                <div><b>{porMarca[marca].productos}</b><small>productos en catálogo</small></div>
                <div><b>{porMarca[marca].ventas}</b><small>ventas asignadas</small></div>
                <div><b>{porMarca[marca].consultas}</b><small>consultas WhatsApp</small></div>
              </div>
              <div className="bar"><div className="bar-fill" style={{ width: `${Math.round(porMarca[marca].productos / Math.max(1, porMarca.technostore.productos + porMarca.futurohard.productos) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: '.82rem', marginTop: 10 }}>Ventas del período: {ventasPeriodo.length} · Consultas totales: {totalConsultas} · Fuente mock · adaptador <code>src/data/adapter.js</code></p>
      </div>

      <div className="card">
        <h3>📈 Ventas del período</h3>
        <table>
          <thead><tr><th>Código</th><th>Cliente</th><th>Total</th><th>Estado</th></tr></thead>
          <tbody>
            {ventasPeriodo.slice(0, 6).map(o => <tr key={o.id}><td><code className="sku">{o.code}</code></td><td><small>{o.customer_name}</small></td><td>{fmt(o.total)}</td><td><span className={`pill ${o.status}`}>{o.status}</span></td></tr>)}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: '.82rem', marginTop: 8 }}>Total facturado: <b style={{ color: 'var(--text)' }}>{fmt(totalVentas)}</b></p>
      </div>
    </div>
  )
}
