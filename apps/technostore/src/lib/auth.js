/**
 * Cliente de Neon Auth (Managed Better Auth) para el storefront.
 * El login del admin (password + TOTP) queda intacto: esto es para clientes.
 */
import { createAuthClient } from '@neon/auth'
import { BetterAuthReactAdapter } from '@neon/auth/react/adapters'

const baseUrl = import.meta.env.VITE_NEON_AUTH_URL || ''

const offline = {
  async signUp() { return { error: { message: 'Autenticación no configurada' } } },
  async signIn() { return { error: { message: 'Autenticación no configurada' } } },
  async getSession() { return { data: null, error: null } },
  async signOut() { return { error: null } },
}

export const authClient = baseUrl
  ? createAuthClient(baseUrl, { adapter: BetterAuthReactAdapter() })
  : offline

export const isAuthConfigured = Boolean(baseUrl)
