import { useEffect, useState } from 'react'
import { authClient, isAuthConfigured } from '../lib/auth.js'

/** Acceso de clientes con Neon Auth. No reemplaza el login admin. */
export default function CustomerAuth({ open, onClose }) {
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    authClient.getSession().then(({ data }) => { if (alive) setSession(data?.user || null) }).catch(() => {})
    return () => { alive = false }
  }, [open])

  if (!open) return null

  const submit = async e => {
    e.preventDefault()
    setError(''); setMessage(''); setBusy(true)
    try {
      const res = mode === 'signup'
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password })
      if (res?.error) {
        setError(res.error.message || 'No se pudo completar la operación')
        return
      }
      setSession(res?.data?.user || { email })
      setMessage(mode === 'signup' ? '¡Cuenta creada!' : '¡Bienvenido!')
      if (mode === 'signup') setMode('signin')
    } catch (err) {
      setError(err?.message || 'Error inesperado')
    } finally { setBusy(false) }
  }

  const signOut = async () => {
    setBusy(true)
    await authClient.signOut().catch(() => {})
    setSession(null); setMessage('Sesión cerrada'); setBusy(false)
  }

  return (
    <div className="auth-layer" role="dialog" aria-modal="true" aria-label="Mi cuenta">
      <div className="auth-overlay" onClick={onClose} />
      <div className="auth-card">
        <button className="icon-btn auth-close" onClick={onClose} aria-label="Cerrar">✕</button>
        <h2>Mi cuenta</h2>
        {!isAuthConfigured && <p className="auth-error">La autenticación no está configurada en este entorno.</p>}
        {session ? (
          <div className="auth-session">
            <p>Ingresaste como <b>{session.email || session.name}</b></p>
            <button className="btn-primary" onClick={signOut} disabled={busy}>Cerrar sesión</button>
          </div>
        ) : (
          <>
            <div className="auth-tabs">
              <button className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setError(''); setMessage('') }}>Ingresar</button>
              <button className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); setMessage('') }}>Crear cuenta</button>
            </div>
            <form onSubmit={submit} className="auth-form">
              {mode === 'signup' && (
                <label>Nombre<input value={name} onChange={e => setName(e.target.value)} required placeholder="Juan Pérez" /></label>
              )}
              <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="juan@email.com" /></label>
              <label>Contraseña<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Mínimo 8 caracteres" /></label>
              <button className="btn-primary" type="submit" disabled={busy || !isAuthConfigured}>
                {busy ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta' : 'Ingresar'}
              </button>
            </form>
          </>
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-ok">{message}</p>}
      </div>
    </div>
  )
}
