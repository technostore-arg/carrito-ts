/**
 * server/firebase.js — Inicialización de Firebase Admin (Firestore)
 *
 * Estrategia de credenciales (en orden de prioridad), SIN commitear claves:
 *   1. FIRESTORE_EMULATOR_HOST  → usa el emulador local (sin credenciales)
 *   2. GOOGLE_APPLICATION_CREDENTIALS → archivo Service Account (gitignoreado)
 *   3. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY → env vars
 *   4. ./firebase-service-account.json → archivo local (gitignoreado)
 *
 * La variable FIREBASE_PRIVATE_KEY puede venir con \n escapados; los normalizamos.
 */
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, existsSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const COLLECTIONS = {
  PRODUCTS: 'productos',
  ORDERS: 'pedidos',
  CONSULTAS: 'consultas',
  MP_PAYMENTS: 'mp_payments',
  PENDING_CHECKOUTS: 'pending_checkouts',
}

export const FREE_SHIPPING_THRESHOLD = 300000
export const SHIPPING_COST = 15000

let _db = null
let _noConfig = false

export function isFirebaseConfigured() {
  return !_noConfig
}

export function getFirestoreDb() {
  if (_db) return _db

  const emulator = process.env.FIRESTORE_EMULATOR_HOST
  const projectId = process.env.FIREBASE_PROJECT_ID || 'technostore-local'

  if (emulator) {
    initializeApp({ projectId })
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp()
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    })
    } else {
      const saPath = path.join(__dirname, 'firebase-service-account.json')
      if (existsSync(saPath)) {
        const sa = JSON.parse(readFileSync(saPath, 'utf-8'))
        initializeApp({ credential: cert(sa) })
      } else {
        _noConfig = true
        throw new Error(
          'FIREBASE_NO_CONFIG: no se encontró configuración de Firebase. Usá el emulador ' +
          '(FIRESTORE_EMULATOR_HOST) o definí FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/' +
          'FIREBASE_PRIVATE_KEY (o GOOGLE_APPLICATION_CREDENTIALS). Ver README.md. [MOCK disponible]',
        )
      }
    }

  _db = getFirestore()
  _db.settings({ ignoreUndefinedProperties: true })
  return _db
}
