/**
 * api/index.js — Entrypoint serverless (Vercel zero-config).
 * Re-exporta la app Express de server/index.js.
 * vercel.json reescribe /api/:path* -> /api preservando la URL original.
 */
import app from '../server/index.js'

export default app
