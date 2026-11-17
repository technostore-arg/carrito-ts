import { useEffect, useState } from 'react'

/**
 * Devuelve el valor con debounce. Útil para búsqueda instantánea sin
 * recalcular el catálogo en cada tecla.
 * @template T
 * @param {T} value
 * @param {number} delay
 * @returns {T}
 */
export default function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
