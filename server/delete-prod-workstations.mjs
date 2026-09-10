const BASE = 'https://carrito-ts-neon.vercel.app'
const PASSWORD = process.env.ADMIN_PASSWORD || 'technostore2026'

const login = await (await fetch(`${BASE}/api/admin/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: PASSWORD }),
})).json()
if (!login.token) throw new Error('login failed: ' + JSON.stringify(login))
const headers = { Authorization: `Bearer ${login.token}` }

for (const id of ['abf5aa26f380', 'dfe4c90a6df6']) {
  const r = await fetch(`${BASE}/api/products/${id}`, { method: 'DELETE', headers })
  console.log(id, r.status, JSON.stringify(await r.json()).slice(0, 120))
}
