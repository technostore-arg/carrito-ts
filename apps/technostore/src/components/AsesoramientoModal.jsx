import { useState } from 'react'

/** Solicitud de asesoramiento/armado de PC. Se guarda en /api/consultas (Firestore). */
export default function AsesoramientoModal({ open, onClose }) {
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', tipo: 'Armado de PC', presupuesto: '', mensaje: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (!open) return null
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/consultas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: '',
          nombre: form.nombre.trim(),
          marca: form.tipo,
          telefono: form.telefono.trim(),
          mensaje: `Email: ${form.email.trim()}\nPresupuesto: ${form.presupuesto || 'No especificado'}\n\n${form.mensaje.trim()}`,
          origen: 'asesoramiento-web',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar la solicitud')
      setDone(true)
    } catch (err) {
      setError(err?.message || 'Error inesperado')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-layer" role="dialog" aria-modal="true" aria-label="Solicitar asesoramiento">
      <div className="auth-overlay" onClick={onClose} />
      <div className="auth-card asesor-card">
        <button className="icon-btn auth-close" onClick={onClose} aria-label="Cerrar">✕</button>
        <h2>Asesoramiento personalizado</h2>
        {done ? (
          <div className="auth-session">
            <p>¡Listo! Recibimos tu solicitud. Te contactamos por email o WhatsApp con una propuesta.</p>
            <button className="btn-primary" onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <form className="auth-form asesor-form" onSubmit={submit}>
            <p className="asesor-hint">Contanos qué necesitás: armado de computadoras, computadoras gamer o componentes, y te ayudamos a elegir.</p>
            <label>Nombre y apellido <input className="asesor-field" required value={form.nombre} onChange={set('nombre')} placeholder="Tu nombre" /></label>
            <label>Email <input className="asesor-field" type="email" required value={form.email} onChange={set('email')} placeholder="tu@email.com" /></label>
            <label>Teléfono / WhatsApp <input className="asesor-field" required value={form.telefono} onChange={set('telefono')} placeholder="11 5555 5555" /></label>
            <label>¿Qué necesitás?
              <select className="asesor-field" value={form.tipo} onChange={set('tipo')}>
                <option>Armado de PC</option><option>PC gamer</option><option>Componentes</option><option>Otro</option>
              </select>
            </label>
            <label>Presupuesto aproximado
              <select className="asesor-field" value={form.presupuesto} onChange={set('presupuesto')}>
                <option value="">No especificado</option><option>Hasta $500.000</option><option>$500.000 – $1.500.000</option><option>Más de $1.500.000</option>
              </select>
            </label>
            <label>Detalles <textarea className="asesor-field" required rows="4" value={form.mensaje} onChange={set('mensaje')} placeholder="Componentes, juegos que querés correr, medidas, etc." /></label>
            {error && <p className="auth-error">{error}</p>}
            <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
