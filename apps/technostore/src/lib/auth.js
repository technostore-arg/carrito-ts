/**
 * Cliente de Neon Auth (Managed Better Auth) para el storefront.
 * El wrapper de Neon maneja el intercambio del `neon_auth_session_verifier`
 * que llega después del login social (Google). Sin él no se crea la sesión.
 * El login del admin (password + TOTP) queda intacto: esto es para clientes.
 */
import { createAuthClient } from '@neon/auth'
import { BetterAuthReactAdapter } from '@neon/auth/react/adapters'

const baseUrl = import.meta.env.VITE_NEON_AUTH_URL || ''

const offline = {
  signUp: { email: async () => ({ error: { message: 'Autenticación no configurada' } }) },
  signIn: {
    email: async () => ({ error: { message: 'Autenticación no configurada' } }),
    social: async () => ({ error: { message: 'Autenticación no configurada' } }),
  },
  getSession: async () => ({ data: null, error: null }),
  signOut: async () => ({ error: null }),
}

export const authClient = baseUrl
  ? createAuthClient(baseUrl, { adapter: BetterAuthReactAdapter() })
  : offline

export const isAuthConfigured = Boolean(baseUrl)
