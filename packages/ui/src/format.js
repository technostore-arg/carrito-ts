export const ars = n => "$ " + Math.round(Number(n) || 0).toLocaleString("es-AR")
export const WHATSAPP_NUMBER = "5491127650658"
export const waLink = (nombre, sku) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hola, quiero consultar por ${nombre} (SKU: ${sku})`)}`
