/** Header profesional (TechnoStore): barra superior, búsqueda con sugerencias, carrito y account. */
import { useState } from 'react'
import { ars } from '../utils/format.js'

const NAV = [
  { id: 'celulares', label: 'Celulares' },
  { id: 'notebooks', label: 'Notebooks' },
  { id: 'hardware', label: 'Hardware' },
  { id: 'gpus', label: 'Placas de Video' },
  { id: 'procesadores', label: 'Procesadores' },
  { id: 'ram', label: 'RAM' },
  { id: 'coolers', label: 'Coolers' },
  { id: 'apple', label: 'Apple', brand: true },
  { id: 'todos', label: 'Ver todo' },
  { id: 'nosotros', label: 'Nosotros' },
]

function SearchIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M11 19a8 8 0 1 0 0-16 8.8 8.8 0 0 0-2.8 2.8L19 19l3 3" /></svg>
}
function CartIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 7h12l-1 11H7L6 7z" /><path d="M9 7V5a3 3 0 0 1 6 0v2" /></svg>
}

export default function Header({
  search, onSearchChange, onSelectCategory, activeCategory, activeBrand,
  cartCount = 0, onCart, onAccount, suggestions = [], onOpenProduct, onSeeAllResults, view = 'home', onSelectView,
}) {
  const [open, setOpen] = useState(false)
  const [searchFocus, setSearchFocus] = useState(false)
  const closeAnd = fn => (...a) => { setOpen(false); fn(...a) }
  const showSuggests = searchFocus && suggestions.length > 0
  const openSuggest = p => { onOpenProduct?.(p); setSearchFocus(false); setOpen(false) }

  const searchField = ({ autoFocus, onDone } = {}) => (
    <span className="ts-search">
      <SearchIcon />
      <input
        type="text"
        placeholder="Buscar modelo, marca, SKU…"
        value={search}
        autoFocus={autoFocus}
        onChange={e => onSearchChange(e.target.value)}
        onFocus={() => setSearchFocus(true)}
        onBlur={() => setTimeout(() => setSearchFocus(false), 120)}
        onKeyDown={e => { if (e.key === 'Enter') { setSearchFocus(false); onDone?.() } }}
        aria-label="Buscar productos"
        aria-autocomplete="list"
      />
      {search && <button className="ts-search__clear" onClick={() => onSearchChange('')} aria-label="Limpiar búsqueda">✕</button>}
      {showSuggests && (
        <div className="ts-search-suggest" role="listbox">
          {suggestions.slice(0, 6).map(p => (
            <button key={p.sku} type="button" className="ts-search-suggest__item" role="option" onMouseDown={e => { e.preventDefault(); openSuggest(p) }}>
              <span className="ts-search-suggest__thumb">{p.imagenes?.[0] ? <img src={p.imagenes[0]} alt="" loading="lazy" /> : '◉'}</span>
              <span className="ts-search-suggest__name">{p.nombre}</span>
              <span className="ts-search-suggest__price">{ars(p.precio_transferencia ?? p.precio)}</span>
            </button>
          ))}
          <button type="button" className="ts-search-suggest__all" onMouseDown={e => { e.preventDefault(); setSearchFocus(false); onSeeAllResults?.() }}>
            Ver resultados →
          </button>
        </div>
      )}
    </span>
  )

  return (
    <header className="ts-header">
      <div className="ts-header__inner">
        <button className="ts-header__logo" onClick={() => onSelectCategory('todos')} aria-label="TechnoStore inicio">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="TechnoStore" className="ts-header__logo-img" />
        </button>

        <nav className="ts-header__nav">
          {NAV.map(item => (
            <button
              key={item.id}
              className={`ts-nav${item.id === (view === 'nosotros' ? 'nosotros' : activeCategory) ? ' is-active' : ''}${item.brand ? ' ts-nav--brand' : ''}`}
              onClick={() => (item.id === 'nosotros' ? onSelectView?.('nosotros') : onSelectCategory(item.id))}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ts-header__search">{searchField({ onDone: onSeeAllResults })}</div>

        <button className="ts-header__account" onClick={onAccount} aria-label="Mi cuenta">
          👤
        </button>
        <button className="ts-header__cart" onClick={onCart} aria-label={`Carrito (${cartCount})`}>
          <CartIcon />
          {cartCount > 0 && <span className="ts-header__cart-count">{cartCount}</span>}
        </button>

        <button className="ts-header__hamburger" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={open} onClick={() => setOpen(v => !v)}>
          <span className={`ts-header__hamburger-line ${open ? 'is-open' : ''}`} />
          <span className={`ts-header__hamburger-line ${open ? 'is-open' : ''}`} />
          <span className={`ts-header__hamburger-line ${open ? 'is-open' : ''}`} />
        </button>
      </div>

      {open && (
        <>
          <div className="ts-header__overlay" onClick={() => setOpen(false)} />
          <div className="ts-header__drawer">
            <div className="ts-header__drawer-search">{searchField({ autoFocus: true, onDone: closeAnd(onSeeAllResults) })}</div>
            <nav className="ts-header__drawer-nav">
              {NAV.map(item => (
                <button key={item.id} className="ts-nav ts-nav--drawer" onClick={closeAnd(() => (item.id === 'nosotros' ? onSelectView?.('nosotros') : onSelectCategory(item.id)))}>
                  {item.label}
                </button>
              ))}
              <button className="ts-nav ts-nav--drawer ts-nav--all" onClick={closeAnd(() => onSelectCategory('todos'))}>Ver todo el catálogo</button>
              <button className="ts-nav ts-nav--drawer ts-nav--ghost-btn" onClick={closeAnd(onCart)}>Carrito {cartCount > 0 ? `(${cartCount})` : ''}</button>
              <button className="ts-nav ts-nav--drawer ts-nav--ghost-btn" onClick={closeAnd(onAccount)}>Mi cuenta</button>
            </nav>
          </div>
        </>
      )}
    </header>
  )
}
