/**
 * Cliente LLM compatible con API OpenAI / Gemini (modo OpenAI) vía fetch nativo.
 * Sin dependencias pesadas y con implementación inyectable para tests.
 */
export class LlmError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'LlmError'
    this.status = status
  }
}

const DEFAULTS = {
  openai: 'https://api.openai.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
}

/** @param {object} opts */
export function createLlmClient(opts = {}) {
  const provider = String(opts.provider || process.env.LLM_PROVIDER || 'openai').toLowerCase()
  const apiKey = opts.apiKey || process.env.LLM_API_KEY || ''
  const model = opts.model || process.env.LLM_MODEL || 'gpt-4o-mini'
  const baseUrl = (opts.baseUrl || process.env.LLM_BASE_URL || DEFAULTS[provider] || DEFAULTS.openai).replace(/\/$/, '')
  const fetchImpl = opts.fetchImpl || fetch

  return {
    provider,
    model,
    async chat({ messages = [], tools = [], temperature = 0.2, maxTokens = 600 } = {}) {
      const res = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          messages,
          ...(tools.length ? {
            tools: tools.map(t => ({ type: 'function', function: t })),
            tool_choice: 'auto',
          } : {}),
        }),
      })
      const text = await res.text().catch(() => '')
      let data = null
      try { data = JSON.parse(text) } catch { /* cuerpo no JSON */ }
      if (!res.ok) throw new LlmError(`LLM ${provider} ${res.status}: ${text.slice(0, 300)}`, res.status)
      const message = data?.choices?.[0]?.message || {}
      return {
        content: typeof message.content === 'string' ? message.content : '',
        toolCalls: (message.tool_calls || []).map(tc => ({
          id: tc.id,
          name: tc.function?.name,
          arguments: (() => { try { return JSON.parse(tc.function?.arguments || '{}') } catch { return {} } })(),
        })),
        usage: data?.usage || null,
      }
    },
  }
}

/** LLM determinista para tests: devuelve las respuestas en orden. */
export function createMockLlm(responses = []) {
  const queue = [...responses]
  const calls = []
  return {
    calls,
    async chat(args) {
      calls.push(args)
      const next = queue.shift() || { content: 'Sin respuesta del modelo', toolCalls: [] }
      return next
    },
  }
}
