import { useEffect, useRef, useState } from 'react'

const QUICK = [
  '¿Qué notebooks gamer tenés?',
  '¿Tenés memorias RAM DDR5?',
  '¿Esta fuente es compatible con mi placa?',
]

/** Asistente con contexto del catálogo. No inventa: responde solo con datos cargados. */
export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hola. Soy el asistente de TechnoStore. Consultame por productos, precios o compatibilidades: respondo solo con la información de nuestro catálogo.' },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = async text => {
    const q = String(text || input).trim()
    if (!q || busy) return
    setInput(''); setError(''); setBusy(true)
    const history = messages.filter(m => m.role !== 'system').slice(-8).map(({ role, text }) => ({ role, content: text }))
    setMessages(m => [...m, { role: 'user', text: q }])
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo responder')
      setMessages(m => [...m, { role: 'assistant', text: data.answer || 'No tengo información suficiente para responder eso.' }])
    } catch (e) {
      setError(e?.message || 'Error inesperado')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="ts-chat-btn" onClick={() => setOpen(v => !v)} aria-label="Abrir asistente">
        {open ? '✕' : <span className="material-symbols-outlined">smart_toy</span>}
      </button>
      {open && (
        <div className="ts-chat-panel" role="dialog" aria-label="Asistente TechnoStore">
          <div className="ts-chat-head">
            <img src="/logo-mark.svg" alt="" />
            <div><b>Asistente TechnoStore</b><small>Responde solo con datos del catálogo</small></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
          </div>
          <div className="ts-chat-body">
            {messages.map((m, i) => (
              <div key={i} className={`ts-chat-msg ts-chat-msg--${m.role}`}>{m.text}</div>
            ))}
            {busy && <div className="ts-chat-msg ts-chat-msg--assistant">Buscando en el catálogo…</div>}
            {error && <p className="ts-chat-error">{error}</p>}
            <div ref={endRef} />
          </div>
          <div className="ts-chat-quick">
            {QUICK.map(q => <button type="button" key={q} onClick={() => send(q)} disabled={busy}>{q}</button>)}
          </div>
          <form className="ts-chat-input" onSubmit={e => { e.preventDefault(); send() }}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Escribí tu consulta…" aria-label="Consulta" />
            <button type="submit" disabled={busy || !input.trim()}>Enviar</button>
          </form>
        </div>
      )}
    </>
  )
}
