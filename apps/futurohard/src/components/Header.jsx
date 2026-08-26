import { useCart } from '../context/CartContext'

const NAV = [
  { id: 'gpus', label: 'GPUs' },
  { id: 'memorias', label: 'Memorias' },
  { id: 'workstations', label: 'Rigs IA' },
]

export default function Header({ search, onSearchChange, onSelectCategory }) {
  const { count, setCartOpen } = useCart()
  return (
    <header className="header">
      <div className="header-inner">
        <button className="logo-link" onClick={() => onSelectCategory('todos')} aria-label="Futuro Hard inicio">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Futuro Hard" style={{ height: 28 }} />
        </button>
        <span style={{fontSize:'9px',background:'var(--bg-alt)',border:'1px solid var(--border)',padding:'2px 6px',borderRadius:'4px',color:'var(--muted)'}}>v3.1 300s video</span>
        <nav className="nav">
          {NAV.map(item => (
            <button key={item.id} onClick={() => onSelectCategory(item.id)}>{item.label}</button>
          ))}
          <button onClick={() => document.getElementById('servicios')?.scrollIntoView({ behavior: 'smooth' })} style={{ color: '#8E8E93' }}>
            Instalación
          </button>
        </nav>
        <div className="search">
          <span className="search-icon">⌕</span>
          <input type="text" placeholder="Buscar GPU, VRAM" value={search} onChange={e => onSearchChange(e.target.value)} />
        </div>
        <button className="cart-btn" onClick={() => setCartOpen(true)} aria-label="Carrito">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 7h12l-1 11H7L6 7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg>
          {count > 0 && <span className="cart-badge">{count}</span>}
        </button>
      </div>
    </header>
  )
}
