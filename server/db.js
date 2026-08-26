import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = new DatabaseSync(path.join(__dirname, 'technova.db'))

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    price REAL NOT NULL,
    old_price REAL,
    rating REAL NOT NULL DEFAULT 4.5,
    reviews INTEGER NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    badge TEXT,
    emoji TEXT NOT NULL DEFAULT '📦',
    specs TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    vram INTEGER,
    cuda INTEGER,
    tflops REAL,
    frameworks TEXT,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    payment_method TEXT NOT NULL DEFAULT 'mercadopago',
    subtotal REAL NOT NULL,
    shipping REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendiente',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '📦',
    qty INTEGER NOT NULL,
    unit_price REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mp_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_code TEXT,
    preference_id TEXT,
    payload TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

for (const [col, type] of [
  ['vram', 'INTEGER'],
  ['cuda', 'INTEGER'],
  ['tflops', 'REAL'],
  ['frameworks', 'TEXT'],
  ['image', 'TEXT'],
]) {
  try {
    db.exec(`ALTER TABLE products ADD COLUMN ${col} ${type}`)
  } catch {
    /* ya existe */
  }
}

const count = db.prepare('SELECT COUNT(*) AS n FROM products').get().n
if (count === 0) {
  const seedPath = path.join(__dirname, '..', 'src', 'data', 'products.json')
  if (existsSync(seedPath)) {
    const seed = JSON.parse(readFileSync(seedPath, 'utf-8'))
    const insert = db.prepare(`
      INSERT INTO products (name, brand, category, price, old_price, rating, reviews, stock, badge, emoji, specs, vram, cuda, tflops, frameworks, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const p of seed) {
      insert.run(
        p.name, p.brand || '', p.category, p.price,
        p.oldPrice ?? null, p.rating ?? 4.5, p.reviews ?? 0, p.stock ?? 10,
        p.badge ?? null, p.emoji ?? '📦', JSON.stringify(p.specs ?? []),
        p.vram ?? null, p.cuda ?? null, p.tflops ?? null,
        JSON.stringify(p.frameworks ?? []), p.image ?? null,
      )
    }
    console.log(`[db] Sembrados ${seed.length} productos de hardware IA`)
  }
}

export function rowToProduct(r) {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    category: r.category,
    price: r.price,
    oldPrice: r.old_price ?? undefined,
    rating: r.rating,
    reviews: r.reviews,
    stock: r.stock,
    badge: r.badge ?? undefined,
    emoji: r.emoji,
    specs: JSON.parse(r.specs || '[]'),
    active: !!r.active,
    vram: r.vram ?? null,
    cuda: r.cuda ?? null,
    tflops: r.tflops ?? null,
    frameworks: JSON.parse(r.frameworks || '[]'),
    image: r.image ?? null,
  }
}

export default db
