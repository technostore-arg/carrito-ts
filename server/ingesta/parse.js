import XLSX from 'xlsx'

function sheetToRows(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const detectSep = (header) => {
    const counts = [',', ';', '\t', '|'].map(s => ({ s, n: (header.match(new RegExp(s === '\t' ? '\t' : `\\${s}`, 'g')) || []).length }))
    counts.sort((a, b) => b.n - a.n)
    return counts[0].n > 0 ? counts[0].s : ','
  }
  const sep = detectSep(lines[0])
  const headers = lines[0].split(sep).map(h => h.trim())
  return lines.slice(1).filter(Boolean).map(line => {
    const cells = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
    const row = {}
    headers.forEach((h, i) => { row[h] = cells[i] ?? '' })
    return row
  })
}

async function parsePDF(buffer) {
  try {
    const mod = await import('pdf-parse')
    const pdfParse = mod.default || mod
    const data = await pdfParse(buffer)
    return data.text || ''
  } catch {
    return buffer.toString('utf-8').slice(0, 8000)
  }
}

export async function parseFile({ buffer, fileName, mime }) {
  const lower = fileName.toLowerCase()
  const mt = (mime || '').toLowerCase()

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || mt.includes('spreadsheet') || mt.includes('excel')) {
    const rows = sheetToRows(buffer)
    return { kind: 'rows', rows, text: JSON.stringify(rows.slice(0, 30), null, 2) }
  }
  if (lower.endsWith('.csv') || mt.includes('csv')) {
    const text = buffer.toString('utf-8')
    const rows = parseCSV(text)
    return { kind: 'rows', rows, text }
  }
  if (lower.endsWith('.pdf') || mt.includes('pdf')) {
    const text = await parsePDF(buffer)
    return { kind: 'text', rows: [], text }
  }
  const text = buffer.toString('utf-8')
  // Para .txt: solo tratar como CSV si la primera línea parece header CSV (contiene palabras clave)
  if (text.includes(',') || text.includes(';')) {
    try {
      const firstLine = text.trim().split(/\r?\n/)[0] || ''
      const looksLikeCsvHeader = /sku|codigo|cod|nombre|name|descripcion|precio|price|stock|categoria|category|marca|brand/i.test(firstLine) && (firstLine.includes(',') || firstLine.includes(';') || firstLine.includes('\t'))
      // Si es .txt sin header CSV, forzar texto libre para heurística (evita falsos positivos por comas en descripciones)
      if (lower.endsWith('.txt') && !looksLikeCsvHeader) {
        return { kind: 'text', rows: [], text: text.slice(0, 12000) }
      }
      const rows = parseCSV(text)
      // Validar que las filas tengan al menos 2 columnas con datos reales, no una sola columna gigante
      if (rows.length && Object.keys(rows[0]).length >= 2) return { kind: 'rows', rows, text }
    } catch {}
  }
  return { kind: 'text', rows: [], text: text.slice(0, 12000) }
}
