/** Hosts con transformación de imagen conocida (AVIF/WebP). */
const TRANSFORM_HOSTS = ['images.unsplash.com', 'cdn.shopify.com', 'res.cloudinary.com', 'images.prismic.io']

/**
 * Devuelve la URL en formato moderno si el host soporta transformación,
 * o cadena vacía para usar el `<img>` original sin riesgo de imagen rota.
 * @param {string} url
 * @param {'avif'|'webp'} fmt
 */
export function modernSrc(url, fmt) {
  if (!url) return ''
  try {
    const u = new URL(url, typeof window === 'undefined' ? 'http://local' : window.location.origin)
    if (TRANSFORM_HOSTS.includes(u.hostname)) {
      u.searchParams.set(u.hostname === 'images.unsplash.com' ? 'fm' : 'format', fmt)
      return u.toString()
    }
    if (new RegExp(`\\.${fmt}$`, 'i').test(u.pathname)) return u.toString()
  } catch { /* URL relativa: se usa tal cual */ }
  return ''
}
