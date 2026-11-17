import { useCallback, useEffect, useState } from 'react'
import { fetchStaticCatalog, fetchLiveQuotes, mergeQuotes } from '../data/catalog.js'

/**
 * Carga datos estáticos una vez y los dinámicos (precio/stock) por separado.
 * Devuelve `refreshQuotes` para volver a consultar antes de agregar al carrito
 * o abrir el detalle, sin recargar fotos ni descripción.
 */
export default function useCatalog() {
  const [products, setProducts] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    fetchStaticCatalog()
      .then(async base => {
        if (!alive) return
        setProducts(base)
        // Hidrata precios/stock de los primeros SKUs (el resto se refresca bajo demanda).
        const skus = base.slice(0, 48).map(p => p.sku || p.id)
        const quotes = await fetchLiveQuotes(skus)
        if (alive && Object.keys(quotes).length) setProducts(prev => mergeQuotes(prev || [], quotes))
      })
      .catch(e => { if (alive) { setError(e.message); setProducts([]) } })
    return () => { alive = false }
  }, [])

  const refreshQuotes = useCallback(async skus => {
    const quotes = await fetchLiveQuotes(skus)
    if (Object.keys(quotes).length) setProducts(prev => mergeQuotes(prev || [], quotes))
    return quotes
  }, [])

  return { products, error, loading: products === null, refreshQuotes }
}
