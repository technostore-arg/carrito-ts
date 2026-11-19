import { useState, useEffect } from 'react'
import { jsPDF } from 'jspdf'

const DISCLAIMER = 'Las garantías están sujetas a revisión del producto, con un plazo de hasta 7 días para la resolución. Luego se aplican los plazos de garantía de cada marca.'

/** Solicitud de garantía/RMA: guarda la consulta y genera el PDF para el envío. */
export default function RmaModal({ open, onClose }) {
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', sku: '', factura: '', motivo: 'Falla de funcionamiento', descripcion: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pdf, setPdf] = useState(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const makePdf = () => {
    const d = new jsPDF()
    d.setFont('helvetica', 'bold'); d.setFontSize(16)
    d.text('TECHNOSTORE - SOLICITUD RMA / GARANTIA', 14, 20)
    d.setFont('helvetica', 'normal'); d.setFontSize(10)
    d.text(`Fecha: ${new Date().toLocaleDateString('es-AR')}`, 14, 30)
    let y = 40
    const line = (label, value) => { d.text(`${label}: ${value || '-'}`, 14, y); y += 7 }
    line('Nombre', form.nombre)
    line('Email', form.email)
    line('Telefono', form.telefono)
    line('SKU / producto', form.sku)
    line('Nro. de factura', form.factura)
    line('Motivo', form.motivo)
    y += 4
    d.setFont('helvetica', 'bold'); d.text('Descripcion del problema', 14, y); y += 7
    d.setFont('helvetica', 'normal')
    for (const s of d.splitTextToSize(form.descripcion || '-', 180)) { d.text(s, 14, y); y += 6 }
    y += 6
    d.setFont('helvetica', 'bold'); d.text('Condiciones de garantia', 14, y); y += 7
    d.setFont('helvetica', 'normal')
    for (const s of d.splitTextToSize(DISCLAIMER, 180)) { d.text(s, 14, y); y += 6 }
    y += 6
    d.setFont('helvetica', 'bold'); d.text('Instrucciones de envio', 14, y); y += 7
    d.setFont('helvetica', 'normal')
    const instr = 'Imprimir este documento y colocarlo dentro del paquete junto con el producto y una copia de la factura. La direccion de envio se confirma por email una vez aprobada la solicitud. No enviar sin antes recibir la confirmacion.'
    for (const s of d.splitTextToSize(instr, 180)) { d.text(s, 14, y); y += 6 }
    d.text('Codigo de solicitud: ' + new Date().getTime(), 14, 285)
    return d
  }

  const submit = async e => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/consultas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: form.sku.trim(),
          nombre: form.nombre.trim(),
          marca: 'RMA',
          telefono: form.telefono.trim(),
          mensaje: `RMA - Email: ${form.email.trim()} | Factura: ${form.factura.trim()} | Motivo: ${form.motivo}\n${form.descripcion.trim()}\n${DISCLAIMER}`,
          origen: 'rma-web',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar la solicitud')
      const doc = makePdf()
      setPdf(doc)
      doc.save(`RMA-TechnoStore-${Date.now()}.pdf`)
    } catch (err) {
      setError(err?.message || 'Error inesperado')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-layer" role="dialog" aria-modal="true" aria-label="Garantía y RMA">
      <div className="auth-overlay" onClick={onClose} />
      <div className="auth-card asesor-card">
        <button className="icon-btn auth-close" onClick={onClose} aria-label="Cerrar">✕</button>
        <h2>Garantía / RMA</h2>
        {pdf ? (
          <div className="auth-session">
            <p>Solicitud registrada. Descargá el PDF y seguí las instrucciones de envío.</p>
            <button className="btn-primary" onClick={() => pdf.save(`RMA-TechnoStore-${Date.now()}.pdf`)}>Descargar PDF</button>
            <p className="asesor-hint">{DISCLAIMER}</p>
            <button className="btn-ghost" onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <form className="auth-form asesor-form" onSubmit={submit}>
            <p className="asesor-hint">{DISCLAIMER}</p>
            <label>Nombre y apellido <input className="asesor-field" required value={form.nombre} onChange={set('nombre')} /></label>
            <label>Email <input className="asesor-field" type="email" required value={form.email} onChange={set('email')} /></label>
            <label>Teléfono <input className="asesor-field" required value={form.telefono} onChange={set('telefono')} /></label>
            <label>SKU del producto <input className="asesor-field" required value={form.sku} onChange={set('sku')} placeholder="Ej. ELIT-..." /></label>
            <label>Número de factura <input className="asesor-field" value={form.factura} onChange={set('factura')} /></label>
            <label>Motivo
              <select className="asesor-field" value={form.motivo} onChange={set('motivo')}>
                <option>Falla de funcionamiento</option><option>Producto dañado en el envío</option><option>Producto incorrecto</option><option>Otro</option>
              </select>
            </label>
            <label>Descripción <textarea className="asesor-field" rows="3" required value={form.descripcion} onChange={set('descripcion')} /></label>
            {error && <p className="auth-error">{error}</p>}
            <button className="btn-primary" type="submit" disabled={busy}>{busy ? 'Generando…' : 'Registrar y descargar PDF'}</button>
          </form>
        )}
      </div>
    </div>
  )
}
