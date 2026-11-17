/**
 * server/ml/mlClient.js — Cliente MLA con OAuth auto-refresh.
 *
 * Variables: ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REDIRECT_URI, ML_USER_ID.
 * Las credenciales persistentes viven en `ml_credentials` (repo inyectable).
 */
export const ML_AUTH_BASE = 'https://auth.mercadolibre.com.ar'
export const ML_API_BASE = 'https://api.mercadolibre.com'
export const TOKEN_REFRESH_MARGIN_MS = 10 * 60 * 1000

export class MlApiError extends Error {
  constructor(message, status, payload = null) {
    super(message)
    this.name = 'MlApiError'
    this.status = status
    this.payload = payload
  }
}

/** URL de autorización OAuth de Mercado Libre Argentina. */
export function buildAuthUrl({ clientId, redirectUri, state = '' } = {}) {
  const id = clientId || process.env.ML_CLIENT_ID || ''
  const redirect = redirectUri || process.env.ML_REDIRECT_URI || ''
  const q = new URLSearchParams({ response_type: 'code', client_id: id, redirect_uri: redirect })
  if (state) q.set('state', state)
  return `${ML_AUTH_BASE}/authorization?${q.toString()}`
}

/** Body del intercambio de código / refresh token. */
export function tokenRequestBody({ clientId, clientSecret, code, redirectUri, refreshToken }) {
  const p = new URLSearchParams()
  p.set('client_id', clientId || process.env.ML_CLIENT_ID || '')
  p.set('client_secret', clientSecret || process.env.ML_CLIENT_SECRET || '')
  if (code) {
    p.set('grant_type', 'authorization_code')
    p.set('code', code)
    p.set('redirect_uri', redirectUri || process.env.ML_REDIRECT_URI || '')
  } else {
    p.set('grant_type', 'refresh_token')
    p.set('refresh_token', refreshToken || '')
  }
  return p
}

let _refreshing = null

/**
 * @param {object} deps
 * @returns {{getValidToken:Function, mlFetch:Function, get:Function, post:Function, put:Function,
 *            exchangeCode:Function, createItem:Function, updateItem:Function, pauseItem:Function,
 *            getOrder:Function, getQuestion:Function}}
 */
export function createMlClient(deps = {}) {
  const repo = deps.repo
  if (!repo) throw new Error('createMlClient requiere un repo inyectable')
  const config = {
    clientId: deps.clientId || process.env.ML_CLIENT_ID || '',
    clientSecret: deps.clientSecret || process.env.ML_CLIENT_SECRET || '',
    redirectUri: deps.redirectUri || process.env.ML_REDIRECT_URI || '',
    apiBase: deps.apiBase || process.env.ML_API_BASE || ML_API_BASE,
    fetchImpl: deps.fetchImpl || fetch,
    now: deps.now || (() => Date.now()),
    sleep: deps.sleep || (ms => new Promise(r => setTimeout(r, ms))),
    maxRetries: deps.maxRetries ?? 2,
  }

  async function requestToken(body) {
    const res = await config.fetchImpl(`${config.apiBase}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: body.toString(),
    })
    const text = await res.text().catch(() => '')
    let data = null
    try { data = JSON.parse(text) } catch { /* cuerpo inválido */ }
    if (!res.ok || !data?.access_token) {
      throw new MlApiError(`OAuth MLA ${res.status}: ${text.slice(0, 200)}`, res.status, data || text)
    }
    return data
  }

  async function persistToken(data) {
    const saved = await repo.saveMlCredential({
      userId: data.user_id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(config.now() + (Number(data.expires_in) || 21600) * 1000).toISOString(),
    })
    return saved || {
      user_id: data.user_id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(config.now() + (Number(data.expires_in) || 21600) * 1000).toISOString(),
    }
  }

  /** Devuelve un access_token vigente; refreshea con 10 min de anticipación. */
  async function getValidToken({ force = false } = {}) {
    const cred = await repo.getMlCredential()
    if (!cred) throw new MlApiError('No hay credenciales de Mercado Libre', 401)
    const expiresAt = Date.parse(cred.expires_at || cred.expiresAt || '')
    const valid = !force && Number.isFinite(expiresAt) && expiresAt - config.now() > TOKEN_REFRESH_MARGIN_MS
    if (valid) return cred.access_token || cred.accessToken

    if (_refreshing) return _refreshing
    _refreshing = (async () => {
      const data = await requestToken(tokenRequestBody({
        ...config,
        refreshToken: cred.refresh_token || cred.refreshToken,
      }))
      const saved = await persistToken(data)
      return saved.access_token || saved.accessToken
    })()
    try { return await _refreshing } finally { _refreshing = null }
  }

  /** Wrapper con reintentos en 429/5xx y refresh en 401. */
  async function mlFetch(path, { method = 'GET', body, auth = true, retries = config.maxRetries } = {}) {
    let lastError
    for (let attempt = 0; attempt <= retries; attempt++) {
      const token = auth ? await getValidToken() : null
      const res = await config.fetchImpl(`${config.apiBase}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      const text = await res.text().catch(() => '')
      let data = null
      try { data = text ? JSON.parse(text) : null } catch { /* texto plano */ }

      if (res.ok) return data
      const err = new MlApiError(`MLA ${method} ${path} -> ${res.status}`, res.status, data || text)

      if (res.status === 401 && auth && attempt === 0) {
        try { await getValidToken({ force: true }) } catch { /* se propaga el 401 */ }
        lastError = err
        continue
      }
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const retryAfter = Number(res.headers?.get?.('retry-after')) || 1
        await config.sleep(Math.min(retryAfter, 10) * 1000)
        lastError = err
        continue
      }
      throw err
    }
    throw lastError || new MlApiError('Error MLA sin respuesta', 0)
  }

  return {
    getValidToken,
    mlFetch,
    get: (path) => mlFetch(path),
    post: (path, body) => mlFetch(path, { method: 'POST', body }),
    put: (path, body) => mlFetch(path, { method: 'PUT', body }),
    async exchangeCode(code) {
      const data = await requestToken(tokenRequestBody({ ...config, code }))
      await persistToken(data)
      return { userId: data.user_id, expiresIn: data.expires_in }
    },
    createItem: payload => mlFetch('/items', { method: 'POST', body: payload }),
    updateItem: (id, payload) => mlFetch(`/items/${id}`, { method: 'PUT', body: payload }),
    pauseItem: id => mlFetch(`/items/${id}`, { method: 'PUT', body: { status: 'paused' } }),
    getOrder: id => mlFetch(`/orders/${id}`),
    getQuestion: id => mlFetch(`/questions/${id}`),
  }
}
