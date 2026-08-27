export type Marca = "technostore" | "futurohard"
export type TipoVenta = "directa" | "encargo"
export type Estado = "activo" | "pausado" | "agotado"
export type FuenteOrigen = "manual" | "archivo_normalizado" | "scraping"

export interface Producto {
  id: string | null
  sku: string
  nombre: string
  descripcion: string
  marca: Marca
  categoria: string
  subcategoria: string
  tipo_venta: TipoVenta
  precio: number
  moneda: "ARS" | "USD"
  stock: number | null
  especificaciones: Record<string, string | number>
  imagenes: string[]
  fuente_origen: FuenteOrigen
  estado: Estado
  vram?: number | null
  cuda?: number | null
  tflops?: number | null
  frameworks?: string[]
  rating?: number
  reviews?: number
  createdAt?: string
  updatedAt?: string
}

export const MARCAS: Marca[]
export const TIPOS_VENTA: TipoVenta[]
export const ESTADOS: Estado[]
export const FUENTES: FuenteOrigen[]
export const MONEDAS: string[]
export const CATEGORIAS: Record<Marca, string[]>

export function validarProducto(p: Partial<Producto>): string[]
export function normalizarProducto(raw: any): Producto
export function crearProductoDirecta(overrides?: Partial<Producto>): Producto
export function crearProductoEncargo(overrides?: Partial<Producto>): Producto

export const productoConverter: {
  toFirestore(producto: Producto): Omit<Producto, "id">
  fromFirestore(snapshot: any, options?: any): Producto
}

export interface ResumenIngesta {
  altas: number
  bajas: number
  cambiosPrecio: number
  sinCambios: number
  ejemplos: any[]
}
export function resumirIngesta(args: { existentes?: Producto[]; normalizados?: Producto[] }): ResumenIngesta
