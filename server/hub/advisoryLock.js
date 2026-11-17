/**
 * Lock distribuido liviano usando PostgreSQL advisory locks.
 * La lock y el unlock se ejecutan en la MISMA conexión (importante en serverless).
 */
function lockKey(name) {
  let h = 0
  for (const c of String(name)) h = ((h << 5) - h + c.charCodeAt(0)) | 0
  return h
}

/**
 * @param {object} pool
 * @param {string} name
 * @param {() => Promise<any>} fn
 * @returns {Promise<{skipped?:boolean, result?:any}>}
 */
export async function withAdvisoryLock(pool, name, fn) {
  const client = await pool.connect()
  const key = lockKey(name)
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS acquired', [key])
    if (!rows[0]?.acquired) return { skipped: true }
    try {
      return { result: await fn() }
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [key])
    }
  } finally {
    client.release()
  }
}
