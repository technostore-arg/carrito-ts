import { onRequest } from 'firebase-functions/v2/https'
import { handleNormalizeCatalogFile } from '../server/ingesta/handler.js'
import { initializeApp, cert } from 'firebase-admin/app'
import { readFileSync, existsSync } from 'node:fs'

try {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'technostore-local' })
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    initializeApp()
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) })
  } else {
    const local = './server/firebase-service-account.json'
    if (existsSync(local)) initializeApp({ credential: cert(JSON.parse(readFileSync(local, 'utf-8'))) })
    else initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'technostore-local' })
  }
} catch {}

export const normalizeCatalogFile = onRequest(
  {
    cors: true,
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 60,
    secrets: ['LLM_API_KEY', 'LLM_PROVIDER', 'LLM_MODEL', 'LLM_BASE_URL'],
  },
  async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

    try {
      let buffer, fileName, mime

      if (req.headers['content-type']?.includes('multipart/form-data')) {
        const busboy = (await import('busboy')).default
        const bb = busboy({ headers: req.headers })
        const chunks = []
        let fields = {}
        await new Promise((resolve, reject) => {
          bb.on('file', (name, file, info) => {
            fileName = info.filename || 'upload'
            mime = info.mimeType
            file.on('data', d => chunks.push(d))
          })
          bb.on('field', (name, val) => { fields[name] = val })
          bb.on('close', resolve)
          bb.on('error', reject)
          req.pipe(bb)
        })
        buffer = Buffer.concat(chunks)
        if (!buffer.length) return res.status(400).json({ error: 'Archivo vacío' })
        if (buffer.length > 12 * 1024 * 1024) return res.status(413).json({ error: 'Archivo muy grande (max 12MB)' })
      } else {
        const body = req.body || {}
        const b64 = body.fileBase64 || body.contentBase64
        if (!b64) return res.status(400).json({ error: 'Falta fileBase64 o multipart file' })
        buffer = Buffer.from(b64, 'base64')
        if (buffer.length > 12 * 1024 * 1024) return res.status(413).json({ error: 'Archivo muy grande (max 12MB)' })
        fileName = body.fileName || 'upload.xlsx'
        mime = body.mimeType || 'application/octet-stream'
      }

      const { borrador, errores } = await handleNormalizeCatalogFile({ buffer, fileName, mime, origen: 'archivo' })
      res.json({ ok: true, borradorId: borrador.id, resumen: borrador.resumen, errores: errores.slice(0, 6) })
    } catch (e) {
      console.error('[normalizeCatalogFile]', e)
      res.status(500).json({ error: e.message })
    }
  },
)
