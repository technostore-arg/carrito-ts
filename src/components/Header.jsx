import { useCart } from '../context/CartContext'

const NAV = [
  { id: 'gpus', label: 'Placas Gráficas' },
  { id: 'memorias', label: 'Memorias & Storage' },
  { id: 'workstations', label: 'Workstations IA' },
  { id: 'accesorios', label: 'Accesorios' },
]

export default function Header({ search, onSearchChange, onSelectCategory }) {
  const { count, setCartOpen } = useCart()

  return (
    <header className="header">
      <div className="container header-inner">
        <button className="logo" onClick={() => onSelectCategory('todos')}>
          <span className="logo-mark">🧠</span>
          Techno<span className="grad-text">Store</span>
        </button>

        <nav className="nav">
          {NAV.map(item => (
            <button key={item.id} onClick={() => onSelectCategory(item.id)}>
              {item.label}
            </button>
          ))}
          <button onClick={() => document.getElementById('servicios')?.scrollIntoView({ behavior: 'smooth' })}>
            Instalación IA
          </button>
        </nav>

        <div className="search">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Buscar GPU, VRAM, framework..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>

        <button className="cart-btn" onClick={() => setCartOpen(true)} aria-label="Abrir carrito">
          🛒
          {count > 0 && <span className="cart-badge">{count}</span>}
        </button>
      </div>
    </header>
  )
}
