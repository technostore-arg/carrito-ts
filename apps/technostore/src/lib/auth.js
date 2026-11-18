/**
 * Cliente ligero de Neon Auth (Managed Better Auth) para el storefront.
 * Usa fetch nativo contra los endpoints estándar de Better Auth, para que el
 * bundle de Vite no dependa de paquetes npm adicionales.
 * El login del admin (password + TOTP) queda intacto: esto es para clientes.
 */
const baseUrl = (import.meta.env.VITE_NEON_AUTH_URL || '').replace(/\/$/, '')

async function request(path, { method = 'GET', body } = {}) {
  if (!baseUrl) return { data: null, error: { message: 'Autenticación no configurada' } }
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const text = await res.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch { /* cuerpo no JSON */ }
    if (!res.ok) {
      return { data: null, error: { message: data?.message || data?.error || `Error ${res.status}` } }
    }
    return { data: data?.user ? data : (data?.data ? data.data : data), error: null }
  } catch (e) {
    return { data: null, error: { message: e?.message || 'Error de red' } }
  }
}

export const authClient = {
  signUp: { email: ({ name, email, password }) => request('/sign-up/email', { method: 'POST', body: { name, email, password } }) },
  signIn: {
    email: ({ email, password }) => request('/sign-in/email', { method: 'POST', body: { email, password } }),
    social: ({ provider, callbackURL }) => request('/sign-in/social', { method: 'POST', body: { provider, callbackURL } }),
  },
  getSession: () => request('/get-session'),
  signOut: () => request('/sign-out', { method: 'POST', body: {} }),
}

export const isAuthConfigured = Boolean(baseUrl)
