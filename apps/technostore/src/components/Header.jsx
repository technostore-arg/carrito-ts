import { useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

const NAV = [
  { id: "celulares", label: "Celulares" },
  { id: "notebooks", label: "Notebooks" },
  { id: "computadoras", label: "Computadoras" },
  { id: "accesorios", label: "Accesorios" },
]

export default function Header({ search, onSearchChange, onSelectCategory }) {
  const [open, setOpen] = useState(false)
  const shouldReduce = useReducedMotion()

  const closeAnd = fn => (...args) => {
    setOpen(false)
    fn(...args)
  }

  return (
    <header className="header">
      <div className="header-inner">
        <button className="logo-link" onClick={() => onSelectCategory("todos")} aria-label="TechnoStore inicio">
          <img src="/logo.jpg" alt="TechnoStore" className="logo-img" />
        </button>

        <nav className="nav nav--desktop">
          {NAV.map(item => (
            <button key={item.id} onClick={() => onSelectCategory(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="search search--desktop">
          <span className="search-icon">⌕</span>
          <input type="text" placeholder="Buscar por nombre o spec" value={search} onChange={e => onSearchChange(e.target.value)} />
        </div>

        <motion.button
          whileTap={{ scale: 0.94 }}
          transition={{ duration: 0.12 }}
          className="hamburger"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          <span className={`ham-line ${open ? "open" : ""}`} />
          <span className={`ham-line ${open ? "open" : ""}`} />
          <span className={`ham-line ${open ? "open" : ""}`} />
        </motion.button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
              className="mobile-overlay"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={shouldReduce ? { opacity: 0 } : { x: "100%" }}
              animate={shouldReduce ? { opacity: 1 } : { x: 0 }}
              exit={shouldReduce ? { opacity: 0 } : { x: "100%" }}
              transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
              className="mobile-drawer"
              style={{ willChange: "transform" }}
            >
              <div className="mobile-search">
                <span className="search-icon">⌕</span>
                <input type="text" placeholder="Buscar" value={search} onChange={e => onSearchChange(e.target.value)} autoFocus />
              </div>
              <nav className="mobile-nav">
                {NAV.map(item => (
                  <motion.button
                    key={item.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={closeAnd(() => onSelectCategory(item.id))}
                  >
                    {item.label}
                  </motion.button>
                ))}
                <motion.button whileTap={{ scale: 0.98 }} onClick={closeAnd(() => onSelectCategory("todos"))} className="mobile-all">
                  Ver todo el catálogo
                </motion.button>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
