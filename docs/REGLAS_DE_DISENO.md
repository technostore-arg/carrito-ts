# Reglas de diseño y comportamiento — TechnoStore

> Estas reglas se respetan **siempre**, en desktop y mobile. No se negocian por "mejorar" algo puntual.
> Si un cambio las contradice, el cambio está mal.

## 1. Coherencia total (una sola línea visual)
- **Un solo diseño** en todas las pantallas y anchos. No existen "versión Stitch" ni "versión funcional" ni switch entre diseños.
- Un solo **header**, un solo **logo**, un solo **select de categorías** por pantalla. Nunca duplicar el header al abrir un overlay.
- Un solo sistema tipográfico: **Quicksand** para titulares (H1/H2/H3), **Inter** para cuerpo y botones. Pesos **400 / 500 / 600** solamente. Sin 700/800.
- Una sola paleta: azul `#0066FF`, verde/menta `#00A651` / `#66FF8E`, azul noche `#0B192C`, fondos claros. Sin degradados purple→blue.
- Un solo footer, mismo contenido en todas las páginas.

## 2. Jerarquía de información — "compactar" NO es bajar la fuente
- **Compactar = quitar información**, no achicar la letra. Si algo ocupa mucho, se elimina texto y elementos, se reducen renglones y se baja la altura real del bloque.
- Nunca resolver un bloque muy alto bajando `font-size` / `padding` y dejando el mismo contenido. Eso es "achicar", no "compactar".
- Franjas divisoras (CyberTrust, marcas, medios de pago): **una sola línea**, contenido mínimo, altura real baja. En mobile: una fila con scroll horizontal, nunca varios renglones.
- Zócalo CyberTrust: **solo** ícono + "CyberTrust™". Sin frases explicativas. Altura objetivo ~20–24 px **por cantidad de contenido**, no por tipografía.
- Tira de marcas: solo nombres, sin "Auth Reseller", "Official", "GeForce Partner", "Gold" ni sells falsos.
- Medios de pago: solo nombres de pasarelas. Sin "10% OFF", "En Cuotas", ni claims.

## 3. Contenido: nada inventado
- No publicar: cuotas fijas, 12 cuotas sin interés, envío en el día, Same Day, seguimiento GPS, garantía de 12 meses con cambio directo, "100% bonificado", "Cifrado militar", números de transacción falsos, testimonios, "@technostore_ts", "Flagship Store", "Pagos B2B", "Concierge 24/7", "Botón de Arrepentimiento", eyebrows ("CATÁLOGO COMPLETO", "TU COMPRA").
- Solo decir lo que el negocio confirmó: categorías y productos reales de Elit, transferencia con impuestos incluidos, cuotas informativas sujetas a cada pasarela, garantía sujeta a revisión (7 días) y plazos de cada marca, envío por mensajería privada CABA / correo a provincias / retiro en Barrio Norte con confirmación.
- Footer: solo **Información fiscal**, **Garantía y RMA**, disclaimer de garantías y copyright. Orden: identidad → información → posventa → legal.

## 4. Producto y precios
- Ficha: precio de **transferencia** destacado como "Precio especial con transferencia"; abajo precio en tarjeta y cuotas 3 / 6 / 12 calculadas sobre el precio en tarjeta.
- Galería con las imágenes reales que Elit provee por producto. Si una miniatura falla → placeholder, nunca ícono roto.
- Carrusel del banner: 6 destacados con SKU real, imágenes representativas (no fotos exactas), sin logo incrustado en el caption.
- Stock publicado: solo productos activos con precio válido. Sin límites arbitrarios de filas.

## 5. Comportamiento
- **Agregar al carrito** debe dar feedback visible inmediato (toast con check) y el badge actualizarse sin recargar el HTML.
- Click dentro de un overlay no se propaga al header de la home.
- Mobile: buscador en su propia fila, botones Carrito/Mi cuenta arriba a la derecha, sin cortes (`scrollWidth === innerWidth`). Verificar siempre con viewport real (375 px), no con el ancho del browser de escritorio.
- Navidad: solo el gorro sobre el logo, inclinado y calzado, sin invadir. Sin franjas rojas, copos animados ni guirnaldas.

## 6. Verificación obligatoria antes de decir "listo"
1. Build: `npm run build` en `apps/technostore`.
2. Linter Hallmark: `node C:\Users\Usuario\.agents\skills\hallmark\scripts\sloplint.mjs apps/technostore/src/App.jsx --genre editorial --render --url http://127.0.0.1:5173/ --scope app` → objetivo **0 FAIL / 0 REFLEX / 0 WARN**.
3. Revisar **todas** las pantallas (home, carrito, envío, pago, confirmación, ficha, cuenta) en desktop y mobile.
4. No dar por terminado algo que solo se verificó en un viewport.

## 7. Deploy
- Vercel Hobby: cupo de 100 deployments/día. Si falla, **no reintentar en bucle**: dejar el alias apuntando al último deployment sano y esperar al día siguiente.
- Siempre hacer `git push origin main` (Vercel construye desde GitHub, no desde el build local).
- Verificar que el bundle servido (`assets/index-*.js`) coincida con el build local antes de dar algo por publicado.

## 8. Trato con el usuario
- No preguntar cuando la instrucción ya dice qué hacer; ejecutar.
- No hacer cambios "creativos" que no se pidieron: solo lo solicitado, sin tocar lo que ya está bien.
- Si un cambio no se pudo publicar, decirlo explícitamente en vez de darlo por hecho.
- Mantener un solo hilo: arreglar → verificar → reportar con qué se verificó.
