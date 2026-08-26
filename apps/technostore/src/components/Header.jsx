import { useCart } from '../context/CartContext'

const NAV = [
  { id: 'gpus', label: 'Placas gráficas' },
  { id: 'memorias', label: 'Memorias' },
  { id: 'workstations', label: 'Workstations' },
  { id: 'accesorios', label: 'Accesorios' },
]

export default function Header({ search, onSearchChange, onSelectCategory }) {
  const { count, setCartOpen } = useCart()
  return (
    <header className="header">
      <div className="header-inner">
        <button className="logo-link" onClick={() => onSelectCategory('todos')} aria-label="TechnoStore inicio">
          <img src="/logo.jpg" alt="TechnoStore" className="logo-img" />
        </button>
        <span style={{fontSize:'9px',background:'var(--bg-alt)',border:'1px solid var(--border)',padding:'2px 6px',borderRadius:'4px',color:'var(--muted)'}}>v3.1 300s video</span>
        <nav className="nav">
          {NAV.map(item => (
            <button key={item.id} onClick={() => onSelectCategory(item.id)}>
              {item.label}
            </button>
          ))}
          <button onClick={() => document.getElementById('servicios')?.scrollIntoView({ behavior: 'smooth' })}>
            Instalación
          </button>
        </nav>
        <div className="search">
          <span className="search-icon">⌕</span>
          <input type="text" placeholder="Buscar" value={search} onChange={e => onSearchChange(e.target.value)} />
        </div>
        <button className="cart-btn" onClick={() => setCartOpen(true)} aria-label="Carrito">
          <span>—</span>
          {count > 0 && <span className="cart-badge">{count}</span>}
        </button>
      </div>
    </header>
  )
}
