import { useState } from 'react'
import Catalog from './components/Catalog.jsx'
import Orders from './components/Orders.jsx'
import Metrics from './components/Metrics.jsx'

const TABS = [
  { id: 'catalogo', label: 'Catálogo', icon: '📦' },
  { id: 'pedidos', label: 'Pedidos', icon: '🧾' },
  { id: 'metricas', label: 'Métricas', icon: '📊' },
]

export default function App() {
  const [tab, setTab] = useState('catalogo')
  const [token, setToken] = useState(sessionStorage.getItem('admin_tok') || '')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')

  const login = async e => {
    e.preventDefault()
    setErr('')
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error')
      setToken(d.token)
      sessionStorage.setItem('admin_tok', d.token)
    } catch (e) { setErr(e.message) }
  }

  if (!token) {
    return (
      <div className="admin-login">
        <form onSubmit={login} className="card" style={{ maxWidth: 380, width: '100%', display: 'grid', gap: 12, textAlign: 'center' }}>
          <h1>⚙ Admin unificado</h1>
          <p className="muted">TechnoStore + Futuro Hard · panel compartido</p>
          <input type="password" placeholder="Contraseña (technostore2026)" value={pw} onChange={e => setPw(e.target.value)} autoFocus />
          <button className="btn-primary" type="submit">Entrar</button>
          {err && <span className="err">{err}</span>}
          <small className="muted">Mock local activo — sin Firebase hasta Fase 7</small>
        </form>
      </div>
    )
  }

  return (
    <div className="admin">
      <header className="topbar">
        <b>⚙ Admin · TechnoStore + Futuro Hard</b>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/" target="_blank" rel="noreferrer">TechnoStore ↗</a>
          <a href="/futurohard/" target="_blank" rel="noreferrer">Futuro Hard ↗</a>
          <button className="btn-ghost" onClick={() => { sessionStorage.removeItem('admin_tok'); setToken('') }}>Salir</button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={tab === t.id ? 'active' : ''}>{t.icon} {t.label}</button>
        ))}
      </nav>

      <main>
        {tab === 'catalogo' && <Catalog />}
        {tab === 'pedidos' && <Orders />}
        {tab === 'metricas' && <Metrics />}
      </main>

      <footer className="admin-foot muted">Adaptador: <code>src/data/adapter.js</code> · mock local → Firestore sin tocar componentes · Esquema: <code>packages/catalog-schema</code></footer>
    </div>
  )
}
