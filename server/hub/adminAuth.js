/**
 * Validación centralizada del login admin (password + TOTP opcional).
 * Pura e inyectable para tests.
 */
import { safeCompareSecret } from './security.js'
import { verifyTotp } from './totp.js'

/**
 * @param {{password?:string, totp?:string, adminPassword?:string, totpSecret?:string, now?:()=>number}} args
 */
export function validateAdminCredentials({ password, totp, adminPassword, totpSecret, now = () => Date.now() } = {}) {
  if (!adminPassword) return { ok: false, error: 'ADMIN_PASSWORD no configurada' }
  if (!safeCompareSecret(password, adminPassword)) return { ok: false, error: 'Contraseña incorrecta' }
  if (totpSecret && !verifyTotp(totp, totpSecret, { now: now() })) {
    return { ok: false, error: 'Código 2FA inválido o expirado' }
  }
  return { ok: true }
}
