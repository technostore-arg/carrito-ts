export function getBrand(p) {
  const m = (p.marca || "").toLowerCase()
  if (m === "samsung") return "Samsung"
  if (m === "apple") return "Apple"
  if (p.marca && p.marca !== "technostore" && p.marca !== "futurohard") return p.marca.charAt(0).toUpperCase() + p.marca.slice(1)
  const n = p.nombre || ""
  const up = n.toUpperCase()
  if (up.includes("SAMSUNG")) return "Samsung"
  if (up.includes("XIAOMI") || up.includes(" REDMI") || up.startsWith("REDMI") || up.includes(" POCO") || up.startsWith("POCO")) return "Xiaomi"
  if (up.includes("IPHONE") || up.includes("AIRPODS") || up.includes("MACBOOK")) return "Apple"
  if (up.includes("GOOGLE") || up.includes("PIXEL")) return "Google"
  if (up.includes("MOTOROLA") || up.includes(" MOTO ")) return "Motorola"
  if (up.startsWith("DELL")) return "Dell"
  if (up.startsWith("LENOVO")) return "Lenovo"
  if (up.startsWith("ASUS")) return "ASUS"
  if (up.startsWith("HP") || up.includes(" OMNIBOOK") || up.includes(" VICTUS") || up.includes(" PROBOOK") || up.includes(" ENVY") || up.includes(" OMEN") || up.includes(" SPECTRE")) return "HP"
  if (up.startsWith("MSI")) return "MSI"
  if (up.startsWith("ACER")) return "Acer"
  if (up.startsWith("MICROSOFT")) return "Microsoft"
  if (up.startsWith("SAMSUNG")) return "Samsung"
  if (up.startsWith("PC GAMER") || up.startsWith("MINI PC")) return "Armados"
  if (up.startsWith("TECLADO") || up.startsWith("SSD")) return "Accesorios"
  return "Otros"
}
