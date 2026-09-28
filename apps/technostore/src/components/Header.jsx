import { useState } from "react"
import { ars } from "../utils/format"

const NAV = [
  { id: "celulares", label: "Celulares" },
  { id: "notebooks", label: "Notebooks" },
  { id: "hardware", label: "Hardware" },
  { id: "gpus", label: "Placas de Video" },
  { id: "procesadores", label: "Procesadores" },
  { id: "ram", label: "RAM" },
  { id: "coolers", label: "Coolers" },
  { id: "apple", label: "Apple", brand: true },
  { id: "todos", label: "Ver todo" },
]

export default function Header({ search, onSearchChange, onSelectCategory, activeCategory, activeBrand, cartCount = 0, onCart, suggestions = [], onOpenProduct, onSeeAllResults }) {
  const [open, setOpen] = useState(false)
  const [searchFocus, setSearchFocus] = useState(false)
  const closeAnd = fn => (...a) => { setOpen(false); fn(...a) }
  const showSuggests = searchFocus && suggestions.length > 0

  const openSuggest = p => { onOpenProduct?.(p); setSearchFocus(false); setOpen(false) }

  // helper (no componente inline: remontarÃ­a el input y perderÃ­a el foco)
  const searchField = ({ autoFocus, onDone } = {}) => (
    <>
      <span className="search-icon">âŒ•</span>
      <input
        type="text"
        placeholder="Buscar modelo, marcaâ€¦"
        value={search}
        autoFocus={autoFocus}
        onChange={e => onSearchChange(e.target.value)}
        onFocus={() => setSearchFocus(true)}
        onBlur={() => setTimeout(() => setSearchFocus(false), 120)}
        onKeyDown={e => { if (e.key === "Enter") { setSearchFocus(false); onDone?.() } }}
        aria-label="Buscar productos"
        aria-autocomplete="list"
      />
      {search && <button className="search-clear" onClick={() => onSearchChange("")} aria-label="Limpiar bÃºsqueda">âœ•</button>}
      {showSuggests && (
        <div className="search-suggest" role="listbox">
          {suggestions.map(p => (
            <button key={p.sku} type="button" className="ss-item" role="option" onMouseDown={e => { e.preventDefault(); openSuggest(p) }}>
              <span className="ss-thumb">{p.imagenes?.[0] ? <img src={p.imagenes[0]} alt="" loading="lazy" /> : "â—‹"}</span>
              <span className="ss-name">{p.nombre}</span>
              <span className="ss-price">{ars(p.precio_transferencia ?? p.precio)}</span>
            </button>
          ))}
          <button type="button" className="ss-all" onMouseDown={e => { e.preventDefault(); setSearchFocus(false); onSeeAllResults?.() }}>
            Ver todos los resultados para â€œ{search.trim()}â€ â†’
          </button>
        </div>
      )}
    </>
  )

  return (
    <header className="header">
      <div className="header-inner">
        <button className="logo-link" onClick={() => onSelectCategory("todos")} aria-label="TechnoStore inicio">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="TechnoStore" className="logo-img" />
        </button>

        <nav className="nav nav--desktop">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => onSelectCategory(item.id)}
              className={`${item.brand ? "nav-apple " : ""}${activeCategory === item.id || (item.brand && activeBrand === "Apple") ? "active" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="search search--desktop">
          {searchField({ onDone: onSeeAllResults })}
        </div>

        <button className="cart-btn" onClick={onCart} aria-label={`Carrito (${cartCount})`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7h12l-1 11H7L6 7z" /><path d="M9 7V5a3 3 0 0 1 6 0v2" /></svg>
          {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
        </button>

        <button className="hamburger" aria-label={open ? "Cerrar menÃº" : "Abrir menÃº"} aria-expanded={open} onClick={() => setOpen(v => !v)}>
          <span className={`ham-line ${open ? "open" : ""}`} />
          <span className={`ham-line ${open ? "open" : ""}`} />
          <span className={`ham-line ${open ? "open" : ""}`} />
        </button>
      </div>

      {open && (
        <>
          <div className="mobile-overlay" onClick={() => setOpen(false)} />
          <div className="mobile-drawer">
            <div className="mobile-search search">
              {searchField({ autoFocus: true, onDone: closeAnd(onSeeAllResults) })}
            </div>
            <nav className="mobile-nav">
              {NAV.map(item => (
                <button key={item.id} onClick={closeAnd(() => onSelectCategory(item.id))} className={item.brand ? "nav-apple" : ""}>
                  {item.label}
                </button>
              ))}
              <button onClick={closeAnd(() => onSelectCategory("todos"))} className="mobile-all">Ver todo el catÃ¡logo</button>
              <button onClick={closeAnd(onCart)} className="mobile-all" style={{ background: '#fff', color: 'var(--text)', border: '1px solid var(--border)' }}>
                Carrito {cartCount > 0 ? `(${cartCount})` : ''}
              </button>
            </nav>
          </div>
        </>
      )}
    </header>
  )
}
