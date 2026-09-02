import { useEffect, useState } from 'react'

const fmt = n => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0)

function BorradorCard({ borrador, onApproved, onDiscarded, token, onRecalcular }) {
  const [skus, setSkus] = useState(() => new Set(borrador.propuestas?.map(p => p.sku) || []))
  const [saving, setSaving] = useState(false)
  const [recalcOpen, setRecalcOpen] = useState(false)
  const [margenExtra, setMargenExtra] = useState(String(borrador.llmMeta?.pricing?.margenExtraPercent ?? 0))
  const [mpFee, setMpFee] = useState(String(borrador.llmMeta?.pricing?.mpFeePercent ?? 6.5))
  const [usdRate, setUsdRate] = useState(String(borrador.llmMeta?.pricing?.usdRate ?? 1200))
  const [fixedUsd, setFixedUsd] = useState(String(borrador.llmMeta?.pricing?.fixedUsd ?? 100))
  const all = borrador.propuestas || []
  const allChecked = skus.size === all.length && all.length > 0
  const pricing = borrador.llmMeta?.pricing || null
  const esCosto = !!pricing?.esCosto

  const toggle = sku => {
    const next = new Set(skus)
    if (next.has(sku)) next.delete(sku)
    else next.add(sku)
    setSkus(next)
  }
  const toggleAll = () => {
    if (allChecked) setSkus(new Set())
    else setSkus(new Set(all.map(p => p.sku)))
  }

  const aplicar = async () => {
    if (skus.size === 0) return alert('Seleccioná al menos un producto')
    setSaving(true)
    try {
      const r = await fetch(`/api/borradores/${borrador.id}/aplicar`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ skus: Array.from(skus) }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error al aplicar')
      onApproved(d.borrador)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }
  const descartar = async () => {
    if (!confirm('¿Descartar este borrador?')) return
    setSaving(true)
    try {
      const r = await fetch(`/api/borradores/${borrador.id}/descartar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error')
      onDiscarded(d.borrador)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }
  const recalcular = async () => {
    setSaving(true)
    try {
      const r = await fetch(`/api/borradores/${borrador.id}/recalcular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pricing: { esCosto: true, usdRate: Number(usdRate), mpFeePercent: Number(mpFee), fixedUsd: Number(fixedUsd), margenExtraPercent: Number(margenExtra) } })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error al recalcular')
      setRecalcOpen(false)
      onRecalcular(d.borrador)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const altasSet = new Set((borrador.altas || []).map(p => p.sku))
  const modsMap = new Map((borrador.modificaciones || []).map(m => [m.sku, m]))

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <b>{borrador.archivoNombre || borrador.fuenteId || 'scraping'}</b> <span className={`pill ${borrador.origen}`}>{borrador.origen}</span> <span className={`pill ${borrador.estado}`}>{borrador.estado}</span>
          {esCosto && <span className="pill" style={{ background: 'rgba(251,191,36,.18)', color: '#fbbf24' }}>costo → venta</span>}
          <div className="muted" style={{ fontSize: '.82rem' }}>{new Date(borrador.creadoEn).toLocaleString('es-AR')} · {borrador.resumen?.altas ?? 0} altas · {borrador.resumen?.cambiosPrecio ?? borrador.modificaciones?.length ?? 0} cambios · {borrador.resumen?.bajas ?? 0} bajas</div>
          {borrador.llmMeta && <small className="muted">LLM: {borrador.llmMeta.usedLLM ? `${borrador.llmMeta.provider || '?'}/${borrador.llmMeta.model || ''}` : borrador.llmMeta.reason || 'reglas'}{esCosto && ` · pricing: +${pricing.fixedUsd}USD×${pricing.usdRate} + MP ${pricing.mpFeePercent}%${Number(pricing.margenExtraPercent)? ` + margen ${pricing.margenExtraPercent}%`:''}`}</small>}
          {esCosto && pricing?.detalle && <details style={{ marginTop: 6 }}><summary style={{ fontSize: '.78rem', cursor: 'pointer' }}>Ver detalle pricing (costo → venta)</summary><pre style={{ fontSize: '.72rem', whiteSpace: 'pre-wrap', marginTop: 6 }}>{pricing.detalle.slice(0, 8).map(d => `${d.sku}: costo $${d.costo} + fijo $${d.fijoArs || 0} → base $${d.base} → con MP $${d.conMP} → final $${d.precioFinal}`).join('\n')}</pre></details>}
        </div>
        {borrador.estado === 'pendiente' && (
          <label className="check-wrap" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '.85rem', minWidth: 'auto', minHeight: '44px' }}>
            <input type="checkbox" checked={allChecked} onChange={toggleAll} /> Todos
          </label>
        )}
      </div>

      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <thead><tr><th></th><th>SKU</th><th>Producto</th><th>Marca</th><th>Tipo</th><th>Precio</th>{esCosto && <th>Costo</th>}<th>Diff</th></tr></thead>
          <tbody>
            {all.map(p => {
              const isAlta = altasSet.has(p.sku)
              const mod = modsMap.get(p.sku)
              const checked = skus.has(p.sku)
              const costo = p.especificaciones?._costo_original ?? p.costo_original ?? null
              return (
                <tr key={p.sku} style={{ opacity: borrador.estado !== 'pendiente' && !checked ? 0.5 : 1 }}>
                  <td><label className="check-wrap" style={{ margin: '-6px' }}>{borrador.estado === 'pendiente' ? <input type="checkbox" checked={checked} onChange={() => toggle(p.sku)} /> : checked ? '✓' : '—'}</label></td>
                  <td><code className="sku">{p.sku}</code></td>
                  <td><b>{p.nombre}</b><br /><small className="muted">{p.categoria} · {p.descripcion?.slice(0, 64)}</small></td>
                  <td><span className={`pill ${p.marca}`}>{p.marca}</span></td>
                  <td><span className={`pill ${p.tipo_venta}`}>{p.tipo_venta}</span></td>
                  <td>{p.tipo_venta === 'encargo' ? <span className="muted">a consultar</span> : <><b>{fmt(p.precio)}</b>{costo != null && costo !== p.precio && <><br /><small className="muted" style={{ textDecoration: 'line-through' }}>{fmt(costo)}</small></>}</>}</td>
                  {esCosto && <td>{costo != null ? fmt(costo) : <span className="muted">—</span>}</td>}
                  <td>
                    {isAlta ? <span className="pill" style={{ background: 'rgba(52,211,153,.14)' }}>nuevo</span>
                      : mod ? <span style={{ fontSize: '.78rem' }}>{mod.cambios.map(c => `${c.campo}: ${fmt(c.antes)} → ${fmt(c.despues)}`).join(' · ') || 'cambios'}</span>
                        : <span className="muted">sin cambios</span>}
                  </td>
                </tr>
              )
            })}
            {all.length === 0 && <tr><td colSpan={esCosto ? 8 : 7} className="muted" style={{ textAlign: 'center', padding: 18 }}>Sin propuestas — {borrador.llmMeta?.reason || 'ver errores'}</td></tr>}
          </tbody>
        </table>
      </div>

      {borrador.estado === 'pendiente' ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn-primary" disabled={saving || skus.size === 0} onClick={aplicar}>{saving ? 'Aplicando…' : `Aprobar ${skus.size} seleccionados`}</button>
          <button className="btn-ghost" disabled={saving} onClick={descartar}>Descartar borrador</button>
          {esCosto && <button className="btn-ghost" disabled={saving} onClick={() => setRecalcOpen(!recalcOpen)} style={{ borderStyle: 'dashed' }}>{recalcOpen ? 'Cancelar' : '✎ Recalcular margen'}</button>}
        </div>
      ) : (
        <div className="muted" style={{ marginTop: 8, fontSize: '.82rem' }}>
          {borrador.estado === 'aplicado' ? `Aplicado el ${new Date(borrador.aplicadoEn).toLocaleString('es-AR')} por ${borrador.aplicadoPor || 'admin'}` : `Descartado el ${borrador.descartadoEn ? new Date(borrador.descartadoEn).toLocaleString('es-AR') : ''}`}
          {borrador.log && <details style={{ marginTop: 6 }}><summary>Log</summary><pre style={{ fontSize: '.75rem', whiteSpace: 'pre-wrap' }}>{JSON.stringify(borrador.log, null, 2)}</pre></details>}
        </div>
      )}
      {recalcOpen && borrador.estado === 'pendiente' && esCosto && (
        <div className="card" style={{ marginTop: 12, background: 'rgba(251,191,36,.06)', border: '1px dashed rgba(251,191,36,.3)', padding: 12 }}>
          <b style={{ fontSize: '.9rem' }}>Recalcular precio de venta</b>
          <p className="muted" style={{ fontSize: '.8rem' }}>La IA te consulta: ¿qué margen querés? Ajustá y recalcula sin resubir el archivo. Fórmula: (costo + fijo USD) gross-up MP + margen extra.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 8 }}>
            <label style={{ fontSize: '.82rem' }}>USD/ARS <input type="number" value={usdRate} onChange={e => setUsdRate(e.target.value)} style={{ width: '100%', marginTop: 4 }} /></label>
            <label style={{ fontSize: '.82rem' }}>MP % <input type="number" step="0.1" value={mpFee} onChange={e => setMpFee(e.target.value)} style={{ width: '100%', marginTop: 4 }} /></label>
            <label style={{ fontSize: '.82rem' }}>Fijo USD (cel/comput) <input type="number" value={fixedUsd} onChange={e => setFixedUsd(e.target.value)} style={{ width: '100%', marginTop: 4 }} /></label>
            <label style={{ fontSize: '.82rem' }}>Margen extra % <input type="number" step="0.5" value={margenExtra} onChange={e => setMargenExtra(e.target.value)} style={{ width: '100%', marginTop: 4 }} /></label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn-primary" disabled={saving} onClick={recalcular}>{saving ? 'Recalculando…' : 'Aplicar nuevo margen'}</button>
            <small className="muted" style={{ alignSelf: 'center' }}>Se actualizará el borrador y podrás aprobar</small>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Ingesta({ token }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [borradores, setBorradores] = useState([])
  const [msg, setMsg] = useState('')
  const [esCosto, setEsCosto] = useState(false)
  const [usdRate, setUsdRate] = useState('1200')
  const [mpFee, setMpFee] = useState('6.5')
  const [fixedUsd, setFixedUsd] = useState('100')
  const [margenExtra, setMargenExtra] = useState('0')
  const [marca, setMarca] = useState('technostore')
  const [loadErr, setLoadErr] = useState('')

  const load = async () => {
    try {
      setLoadErr('')
      const r = await fetch('/api/borradores', { headers: { Authorization: `Bearer ${token}` } })
      const d = await r.json()
      if (r.ok) setBorradores(d)
      else setLoadErr(d.error || `Error ${r.status}`)
    } catch (e) { setLoadErr(e.message) }
  }
  useEffect(() => { if (token) load() }, [token])

  const onFile = e => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!/\.(xlsx|xls|csv|pdf|txt)$/i.test(f.name)) return alert('Usá xlsx, csv, pdf o txt')
    if (f.size > 12 * 1024 * 1024) return alert('Máx 12MB')
    setFile(f)
  }

  const upload = async () => {
    if (!file) return
    setUploading(true); setMsg('')
    try {
      const b64 = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result).split(',')[1])
        r.onerror = reject
        r.readAsDataURL(file)
      })
      const pricing = esCosto ? { esCosto: true, usdRate: Number(usdRate), mpFeePercent: Number(mpFee), fixedUsd: Number(fixedUsd), margenExtraPercent: Number(margenExtra) } : null
      const r = await fetch('/api/ingesta/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileBase64: b64, fileName: file.name, mimeType: file.type, pricing, marca }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Error al subir')
      let extra = ''
      if (d.pricingDetalle) {
        extra = ` · pricing: ${d.pricingDetalle.slice(0,2).map(x=> `${x.sku} $${x.costo}→$${x.precioFinal}`).join(', ')}`
      }
      setMsg(`Borrador creado: ${d.resumen?.altas ?? 0} altas, ${d.resumen?.cambiosPrecio ?? 0} cambios${esCosto ? ' (con margen +MP aplicado)' : ''}${extra}`)
      setFile(null)
      const inp = document.getElementById('ingesta-file')
      if (inp) inp.value = ''
      load()
    } catch (e) { setMsg(e.message) } finally { setUploading(false) }
  }

  return (
    <div className="stack">
      <div className="card">
        <h3>📥 Ingesta de catálogo</h3>
        <p className="muted" style={{ fontSize: '.88rem' }}>Subí un Excel/CSV/PDF/TXT. Se normaliza con <code>packages/catalog-schema</code> vía <code>normalizeCatalogFile</code> (LLM configurable por <code>LLM_PROVIDER</code> / <code>LLM_API_KEY</code>) y se guarda como borrador en <code>borradores_catalogo</code> (origen: archivo). TXT con headers tipo CSV funciona sin LLM; texto libre requiere LLM.</p>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '.9rem', fontWeight: 600 }}>Marca destino:
            <select value={marca} onChange={e => setMarca(e.target.value)} style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 8 }}>
              <option value="technostore">TechnoStore (general)</option>
              <option value="futurohard">Futuro Hard (IA/GPUs)</option>
            </select>
          </label>
          <small className="muted">La IA usará esta marca si no la infiere del texto</small>
        </div>

        <div style={{ background: 'rgba(99,102,241,.07)', border: '1px solid rgba(99,102,241,.18)', borderRadius: 10, padding: 12, marginTop: 12 }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: '.9rem' }}>
            <input type="checkbox" checked={esCosto} onChange={e => setEsCosto(e.target.checked)} />
            Los precios del archivo son de <b>costo</b> (la IA debe agregar ganancia)
          </label>
          {esCosto ? (
            <div style={{ marginTop: 10 }}>
              <p className="muted" style={{ fontSize: '.82rem', margin: '0 0 8px' }}>
                La IA te consulta: ¿qué margen aplico? Por defecto celulares/notebooks/computadoras <b>+{fixedUsd} USD</b> + <b>MP {mpFee}%</b> (gross-up). Resto solo MP. Podés ajustar antes de subir o <b>recalcular</b> después sin resubir.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                <label style={{ fontSize: '.82rem' }}>Cotización USD (ARS)
                  <input type="number" value={usdRate} onChange={e => setUsdRate(e.target.value)} style={{ width: '100%', marginTop: 4 }} placeholder="1200" />
                </label>
                <label style={{ fontSize: '.82rem' }}>Comisión MP %
                  <input type="number" step="0.1" value={mpFee} onChange={e => setMpFee(e.target.value)} style={{ width: '100%', marginTop: 4 }} placeholder="6.5" />
                </label>
                <label style={{ fontSize: '.82rem' }}>Fijo USD (cel/comput)
                  <input type="number" value={fixedUsd} onChange={e => setFixedUsd(e.target.value)} style={{ width: '100%', marginTop: 4 }} placeholder="100" />
                </label>
                <label style={{ fontSize: '.82rem' }}>Margen extra global %
                  <input type="number" step="0.5" value={margenExtra} onChange={e => setMargenExtra(e.target.value)} style={{ width: '100%', marginTop: 4 }} placeholder="0" />
                </label>
              </div>
              <small className="muted" style={{ display: 'block', marginTop: 6, fontSize: '.75rem' }}>Fórmula: <code>(costo + fijoARS) / (1 - MP%) × (1 + margenExtra%)</code> — fijoARS = {fixedUsd}×{usdRate} = {fmt(Number(fixedUsd)*Number(usdRate))} solo para celulares/notebooks/computadoras. El resto: <code>costo / (1 - MP%)</code>.</small>
            </div>
          ) : (
            <small className="muted" style={{ display: 'block', marginTop: 6, fontSize: '.82rem' }}>Si tildás “costo”, la IA sumará +{fixedUsd} USD para celulares/computadoras + MP siempre. Si no, se toma el precio tal cual.</small>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input id="ingesta-file" type="file" accept=".xlsx,.xls,.csv,.pdf,.txt" onChange={onFile} />
          <button className="btn-primary" disabled={!file || uploading} onClick={upload}>{uploading ? 'Procesando…' : 'Subir y normalizar'}</button>
          {file && <small className="muted">{file.name} · {(file.size / 1024).toFixed(0)} KB {esCosto && <span>· con costo + pricing</span>}</small>}
        </div>
        {msg && <div className="muted" style={{ marginTop: 8, fontSize: '.85rem', whiteSpace: 'pre-wrap' }}>{msg}</div>}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <b style={{ fontSize: '.9rem' }}>Borradores ({borradores.length})</b>
        <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: '.8rem' }} onClick={load}>↻ Recargar</button>
        {loadErr && <small style={{ color: '#ef4444' }}>Error: {loadErr}</small>}
      </div>
      <div className="stack">
        {borradores.length === 0 ? <p className="muted">Sin borradores aún — subí un archivo (arriba) o esperá al tracker de Futuro Hard (scraping). Si acabás de subir y no aparece, hacé “Recargar” o revisá el mensaje de arriba.</p>
          : borradores.map(b => <BorradorCard key={b.id} borrador={b} token={token} onApproved={() => load()} onDiscarded={() => load()} onRecalcular={() => load()} />)}
      </div>

      <p className="muted" style={{ fontSize: '.78rem' }}>Colección <code>borradores_catalogo</code> · campos: creadoEn, origen (archivo|scraping), archivoNombre, propuestas[], resumen, estado (pendiente|aplicado|descartado), aplicadoEn/Por, log[], llmMeta.pricing · Cloud Function: <code>normalizeCatalogFile</code> en <code>functions/index.js</code></p>
    </div>
  )
}
