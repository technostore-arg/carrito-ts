/**
 * Genera (o verifica) el secreto TOTP del admin.
 *   node scripts/admin-2fa-setup.mjs
 *   node scripts/admin-2fa-setup.mjs <SECRETO_BASE32>
 *
 * Pegá el secreto en ADMIN_TOTP_SECRET (Vercel / .env) y hacé redeploy.
 * Escaneá el otpauth:// con Google Authenticator, 1Password, Aegis, etc.
 */
import { generateTotpSecret, totpUri, totpCode, formatTotpSecret, verifyTotp } from '../server/hub/totp.js'

const secret = (process.argv[2] || '').trim() || generateTotpSecret()
console.log('Secreto Base32 :', secret)
console.log('Legible        :', formatTotpSecret(secret))
console.log('URI otpauth    :', totpUri(secret))
console.log('Código ahora   :', totpCode(secret))
if (process.argv[3]) console.log('Verificación   :', verifyTotp(process.argv[3], secret) ? 'VÁLIDO' : 'INVÁLIDO')
console.log('\nGuardalo como ADMIN_TOTP_SECRET y NO lo compartas ni lo subas a git.')
