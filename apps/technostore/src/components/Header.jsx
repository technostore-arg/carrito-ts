import { useMemo, useState } from "react"
import { ars } from "../utils/format"

/** Navegación construida desde las categorías reales del catálogo (una sola categoría por producto). */
function buildNav(categorias = []) {
  return [
    ...categorias.filter(c => c.id !== 'todos').map(c => ({ id: c.id, label: c.label })),
    { id: "apple", label: "Apple", brand: true },
    { id: "todos", label: "Ver todo" },
  ]
}

export default function Header({ search, onSearchChange, onSelectCategory, activeCategory, activeBrand, cartCount = 0, onCart, onAccount, accountLabel = 'Mi cuenta', suggestions = [], onOpenProduct, onSeeAllResults, categorias = [] }) {
  const NAV = useMemo(() => buildNav(categorias), [categorias])
  const [open, setOpen] = useState(false)
  const [searchFocus, setSearchFocus] = useState(false)
  const closeAnd = fn => (...a) => { setOpen(false); fn(...a) }
  const showSuggests = searchFocus && suggestions.length > 0

  const openSuggest = p => { onOpenProduct?.(p); setSearchFocus(false); setOpen(false) }

  // helper (no componente inline: remontaría el input y perdería el foco)
  const searchField = ({ autoFocus, onDone } = {}) => (
    <>
      <span className="search-icon">⌨</span>
      <input
        type="text"
        placeholder="Buscar modelo, marca, SKU…"
        value={search}
        autoFocus={autoFocus}
        onChange={e => onSearchChange(e.target.value)}
        onFocus={() => setSearchFocus(true)}
        onBlur={() => setTimeout(() => setSearchFocus(false), 120)}
        onKeyDown={e => { if (e.key === "Enter") { setSearchFocus(false); onDone?.() } }}
        aria-label="Buscar productos"
        aria-autocomplete="list"
      />
      {search && <button className="search-clear" onClick={() => onSearchChange("")} aria-label="Limpiar búsqueda">✕</button>}
      {showSuggests && (
        <div className="search-suggest" role="listbox">
          {suggestions.map(p => (
            <button key={p.sku} type="button" className="ss-item" role="option" onMouseDown={e => { e.preventDefault(); openSuggest(p) }}>
              <span className="ss-thumb">{p.imagenes?.[0] ? <img src={p.imagenes[0]} alt="" loading="lazy" /> : "◉"}</span>
              <span className="ss-name">{p.nombre}</span>
              <span className="ss-price">{ars(p.precio_transferencia ?? p.precio)}</span>
            </button>
          ))}
          <button type="button" className="ss-all" onMouseDown={e => { e.preventDefault(); setSearchFocus(false); onSeeAllResults?.() }}>
            Ver todos los resultados para “{search.trim()}” →
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

        <button className="account-btn" onClick={onAccount} aria-label="Mi cuenta">👤 <span>{accountLabel}</span></button>

        <button className="cart-btn" onClick={onCart} aria-label={`Carrito (${cartCount})`}>
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
            <div className="mobile-search search">
              {searchField({ autoFocus: true, onDone: closeAnd(onSeeAllResults) })}
            </div>
            <nav className="mobile-nav">
              {NAV.map(item => (
                <button key={item.id} onClick={closeAnd(() => onSelectCategory(item.id))} className={item.brand ? "nav-apple" : ""}>
                  {item.label}
                </button>
              ))}
              <button onClick={closeAnd(() => onSelectCategory("todos"))} className="mobile-all">Ver todo el catálogo</button>
              <button onClick={closeAnd(onCart)} className="mobile-all" style={{ background: '#fff', color: 'var(--text)', border: '1px solid var(--border)' }}>
                Carrito {cartCount > 0 ? `(${cartCount})` : ''}
              </button>
              <button onClick={closeAnd(onAccount)} className="mobile-all" style={{ background: '#fff', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                {accountLabel}
              </button>
            </nav>
          </div>
        </>
      )}
    </header>
  )
}
