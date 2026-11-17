/**
 * Validadores de formulario en tiempo real (checkout guest).
 * Cada función devuelve `null` cuando el valor es válido o un mensaje explicitativo.
 */

/** @param {string} v */
export function validarNombre(v) {
  const s = String(v || '').trim()
  if (s.length < 3) return 'Ingresá tu nombre completo'
  if (!/\s/.test(s)) return 'Ingresá nombre y apellido'
  return null
}

/** @param {string} v */
export function validarEmail(v) {
  const s = String(v || '').trim()
  if (!s) return 'Ingresá tu email'
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(s)) return 'El email no es válido'
  return null
}

/**
 * Acepta formatos argentinos: +54 9 11 5555-5555, 011 5555-5555, 5491127650658.
 * @param {string} v
 */
export function validarTelefono(v) {
  const d = String(v || '').replace(/\D/g, '')
  if (!d) return 'Ingresá tu WhatsApp'
  if (d.length < 10 || d.length > 13) return 'El teléfono debe tener entre 10 y 13 dígitos'
  const sinPais = d.startsWith('54') ? d.slice(2) : d.startsWith('0') ? d.slice(1) : d
  const numero = sinPais.startsWith('9') ? sinPais.slice(1) : sinPais
  if (numero.length < 10) return 'Ingresá el código de área y el número'
  return null
}

/** @param {string} v */
export function validarCp(v) {
  const s = String(v || '').trim()
  if (!/^\d{4}$/.test(s)) return 'El código postal debe tener 4 dígitos'
  return null
}

/** @param {string} v */
export function validarDireccion(v) {
  const s = String(v || '').trim()
  if (s.length < 5 || !/\d/.test(s)) return 'Ingresá calle y número'
  return null
}

/**
 * DNI (7-8 dígitos) o CUIT/CUIL (11 dígitos con dígito verificador).
 * @param {string} tipo
 * @param {string} v
 */
export function validarDocumento(tipo, v) {
  const d = String(v || '').replace(/[\s.\-]/g, '')
  if (!d) return tipo === 'CUIT' ? 'Ingresá el CUIT' : 'Ingresá el DNI'
  if (tipo === 'DNI') return /^\d{7,8}$/.test(d) ? null : 'El DNI debe tener 7 u 8 dígitos'
  if (!/^\d{11}$/.test(d)) return 'El CUIT debe tener 11 dígitos'
  const pesos = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const base = d.slice(0, 10)
  const esperado = 11 - (base.split('').reduce((sum, n, i) => sum + Number(n) * pesos[i], 0) % 11)
  const digito = esperado === 11 ? 0 : esperado === 10 ? 9 : esperado
  return digito === Number(d[10]) ? null : 'El dígito verificador del CUIT no es válido'
}

/**
 * @param {Record<string, string>} form
 * @returns {Record<string, string|null>}
 */
export function validarCheckout(form) {
  return {
    nombre: validarNombre(form.nombre),
    email: validarEmail(form.email),
    telefono: validarTelefono(form.telefono),
    cp: validarCp(form.cp),
    direccion: form.tipoEntrega === 'envio' ? validarDireccion(form.direccion) : null,
    documento: validarDocumento(form.tipoDocumento, form.documento),
  }
}
