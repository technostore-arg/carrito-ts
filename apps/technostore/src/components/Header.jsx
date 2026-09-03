import { useState } from "react"

const NAV = [
  { id: "celulares", label: "Celulares" },
  { id: "gpus", label: "Placas de Video" },
  { id: "procesadores", label: "Procesadores" },
  { id: "ram", label: "RAM" },
  { id: "coolers", label: "Coolers" },
  { id: "accesorios", label: "Ver todo" },
]

export default function Header({ search, onSearchChange, onSelectCategory, activeCategory, cartCount = 0, onCart }) {
  const [open, setOpen] = useState(false)
  const closeAnd = fn => (...a) => { setOpen(false); fn(...a) }

  return (
    <header className="header">
      <div className="header-inner">
        <button className="logo-link" onClick={() => onSelectCategory("todos")} aria-label="TechnoStore inicio">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="TechnoStore" className="logo-img" />
        </button>

        <nav className="nav nav--desktop">
          {NAV.map(item => (
            <button key={item.id} onClick={() => onSelectCategory(item.id)} className={activeCategory === item.id ? "active" : ""}>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="search search--desktop">
          <span className="search-icon">⌕</span>
          <input type="text" placeholder="Buscar modelo, marca…" value={search} onChange={e => onSearchChange(e.target.value)} aria-label="Buscar productos" />
          {search && <button className="search-clear" onClick={() => onSearchChange("")} aria-label="Limpiar búsqueda">✕</button>}
        </div>

        <button className="cart-btn" onClick={onCart} aria-label={`Bolsa (${cartCount})`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7h12l-1 11H7L6 7z" /><path d="M9 7V5a3 3 0 0 1 6 0v2" /></svg>
          {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
        </button>

        <button className="hamburger" aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} onClick={() => setOpen(v => !v)}>
          <span className={`ham-line ${open ? "open" : ""}`} />
          <span className={`ham-line ${open ? "open" : ""}`} />
          <span className={`ham-line ${open ? "open" : ""}`} />
        </button>
      </div>

      {open && (
        <>
          <div className="mobile-overlay" onClick={() => setOpen(false)} />
          <div className="mobile-drawer">
            <div className="mobile-search">
              <span className="search-icon">⌕</span>
              <input type="text" placeholder="Buscar" value={search} onChange={e => onSearchChange(e.target.value)} autoFocus />
            </div>
            <nav className="mobile-nav">
              {NAV.map(item => (
                <button key={item.id} onClick={closeAnd(() => onSelectCategory(item.id))}>{item.label}</button>
              ))}
              <button onClick={closeAnd(() => onSelectCategory("todos"))} className="mobile-all">Ver todo el catálogo</button>
              <button onClick={closeAnd(onCart)} className="mobile-all" style={{ background: '#fff', color: 'var(--text)', border: '1px solid var(--border)' }}>
                Bolsa {cartCount > 0 ? `(${cartCount})` : ''}
              </button>
            </nav>
          </div>
        </>
      )}
    </header>
  )
}
