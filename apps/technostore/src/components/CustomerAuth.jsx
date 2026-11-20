import { useEffect, useState } from 'react'
import { authClient, isAuthConfigured } from '../lib/auth.js'

/** Acceso de clientes con Neon Auth. No reemplaza el login admin. */
export default function CustomerAuth({ open, onClose, initialError = '', session = null, onSession }) {
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localUser, setLocalUser] = useState(null)
  const user = session || localUser
  const setUser = u => { setLocalUser(u); onSession?.(u) }
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (initialError) setError(initialError)
  }, [initialError])

  useEffect(() => {
    if (!open) return
    let alive = true
    authClient.getSession().then(({ data }) => { if (alive) setUser(data?.user || null) }).catch(() => {})
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
      setUser(res?.data?.user || { email })
      setMessage(mode === 'signup' ? '¡Cuenta creada!' : '¡Bienvenido!')
      if (mode === 'signup') setMode('signin')
    } catch (err) {
      setError(err?.message || 'Error inesperado')
    } finally { setBusy(false) }
  }

  const signInWithGoogle = async () => {
    setError(''); setBusy(true)
    try {
      const res = await authClient.signIn.social({
        provider: 'google',
        callbackURL: window.location.origin,
      })
      if (res?.error) { setError(res.error.message); return }
      if (res?.data?.url) window.location.href = res.data.url
      else setError('No se pudo iniciar el ingreso con Google')
    } catch (e) {
      setError(e?.message || 'Error inesperado')
    } finally { setBusy(false) }
  }

  const signOut = async () => {
    setBusy(true)
    await authClient.signOut().catch(() => {})
    setUser(null); setMessage('Sesión cerrada'); setBusy(false)
  }

  return (
    <div className="auth-layer" role="dialog" aria-modal="true" aria-label="Mi cuenta">
      <div className="auth-overlay" onClick={onClose} />
      <div className="auth-card">
        <button className="icon-btn auth-close" onClick={onClose} aria-label="Cerrar">✕</button>
        <img src="/logo-lockup.png" alt="TechnoStore" className="auth-logo" />
        <h2>Mi cuenta</h2>
        {!isAuthConfigured && <p className="auth-error">La autenticación no está configurada en este entorno.</p>}
        {user ? (
          <div className="auth-session">
            <p>Ingresaste como <b>{user.email || user.name}</b></p>
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
            <div className="auth-divider"><span>o</span></div>
            <button type="button" className="auth-google" onClick={signInWithGoogle} disabled={busy || !isAuthConfigured}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.7 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.9 24.6c0-1.6-.2-3.2-.5-4.6H24v9.2h12.9c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 7.1-10.3 7.1-17.8z"/>
                <path fill="#FBBC05" d="M10.4 28.6A14.5 14.5 0 0 1 9.6 24c0-1.6.3-3.1.8-4.6l-7.8-6.1A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.8-6.1z"/>
                <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.7-6c-2.1 1.4-4.8 2.3-7.6 2.3-6.3 0-11.7-3.7-13.6-9.2l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/>
              </svg>
              Continuar con Google
            </button>
          </>
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-ok">{message}</p>}
      </div>
    </div>
  )
}
