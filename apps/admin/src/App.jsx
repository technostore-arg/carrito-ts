import { useEffect, useState } from 'react'

const API = ''

export default function App() {
  const [tab, setTab] = useState('catalogo')
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [consultas, setConsultas] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('fh_consultas') || '[]')
    } catch {
      return []
    }
  })
  const [token, setToken] = useState(sessionStorage.getItem('admin_tok') || '')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')

  const login = async e => {
    e.preventDefault()
    setErr('')
    try {
      const r = await fetch(`${API}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error')
      setToken(d.token)
      sessionStorage.setItem('admin_tok', d.token)
    } catch (e) {
      setErr(e.message)
    }
  }

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  useEffect(() => {
    if (!token) return
    fetch(`${API}/api/products`)
      .then(r => r.json())
      .then(setProducts)
      .catch(() => {})
    fetch(`${API}/api/orders`, { headers: authHeaders })
      .then(r => (r.ok ? r.json() : []))
      .then(setOrders)
      .catch(() => {})
  }, [token])

  if (!token) {
    return (
      <div className="admin-login">
        <form onSubmit={login} className="card">
          <h1>⚙ Admin unificado</h1>
          <p>TechnoStore + Futuro Hard · panel compartido</p>
          <input
            type="password"
            placeholder="Contraseña (technostore2026)"
            value={pw}
            onChange={e => setPw(e.target.value)}
            autoFocus
          />
          <button className="btn-primary" type="submit">
            Entrar
          </button>
          {err && <span className="err">{err}</span>}
        </form>
      </div>
    )
  }

  const directas = orders
  const marcas = { technostore: 0, futurohard: 0 }
  products.forEach(p => {
    const m = p.marca || (['gpus', 'memorias'].includes(p.category) ? 'futurohard' : 'technostore')
    if (m in marcas) marcas[m]++
  })

  return (
    <div className="admin">
      <header className="topbar">
        <b>⚙ Admin · TechnoStore + Futuro Hard</b>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="http://localhost:5173" target="_blank" rel="noreferrer">
            TechnoStore ↗
          </a>
          <a href="http://localhost:5174" target="_blank" rel="noreferrer">
            Futuro Hard ↗
          </a>
          <button
            onClick={() => {
              sessionStorage.removeItem('admin_tok')
              setToken('')
            }}
          >
            Salir
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button onClick={() => setTab('catalogo')} className={tab === 'catalogo' ? 'active' : ''}>
          📦 Catálogo ({products.length})
        </button>
        <button onClick={() => setTab('pedidos')} className={tab === 'pedidos' ? 'active' : ''}>
          🧾 Directas ({directas.length})
        </button>
        <button onClick={() => setTab('consultas')} className={tab === 'consultas' ? 'active' : ''}>
          💬 Consultas encargo ({consultas.length})
        </button>
        <button onClick={() => setTab('metricas')} className={tab === 'metricas' ? 'active' : ''}>
          📊 Métricas
        </button>
      </nav>

      <main>
        {tab === 'catalogo' && (
          <div className="card">
            <h3>Catálogo (preview — edición manual en Fase 6)</h3>
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Marca</th>
                  <th>Tipo</th>
                  <th>Precio</th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 12).map(p => (
                  <tr key={p.id}>
                    <td>{p.sku ?? p.id}</td>
                    <td>{p.nombre ?? p.name}</td>
                    <td>{p.marca ?? '—'}</td>
                    <td>{p.tipo_venta ?? 'directa'}</td>
                    <td>{p.precio ?? p.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">Esquema: packages/catalog-schema · fuente: {products.length} productos del backend</p>
          </div>
        )}

        {tab === 'pedidos' && (
          <div className="card">
            <h3>Compras directas</h3>
            {directas.length === 0 ? (
              <p className="muted">Sin pedidos todavía</p>
            ) : (
              directas.map(o => (
                <div key={o.id} className="row">
                  <b>{o.code}</b> · {o.customer_name} · {o.total} · {o.status}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'consultas' && (
          <div className="card">
            <h3>Consultas por WhatsApp (tipo_venta = encargo)</h3>
            {consultas.length === 0 ? (
              <p className="muted">
                Vacío — cuando un cliente haga clic en "Consultar por WhatsApp" en un
                producto encargo, aparecerá acá como <code>consulta_encargo</code>.
              </p>
            ) : (
              consultas.map((c, i) => (
                <div key={i} className="row">
                  {c.sku} — {c.nombre} — {new Date(c.ts).toLocaleString()}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'metricas' && (
          <div className="card">
            <h3>Métricas por marca</h3>
            <div className="stats">
              <div>
                <b>{marcas.technostore}</b>
                <small>productos TechnoStore</small>
              </div>
              <div>
                <b>{marcas.futurohard}</b>
                <small>productos Futuro Hard</small>
              </div>
              <div>
                <b>{directas.length}</b>
                <small>ventas directas</small>
              </div>
              <div>
                <b>{consultas.length}</b>
                <small>consultas encargo</small>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
